/**
 * Owns the engine instance, the clock and the recording of results for one
 * typing screen.
 *
 * Note what this hook does *not* do: it holds no per-keystroke state in React.
 * Keystrokes go straight into the engine, and components subscribe to the
 * slices they display. Putting the cursor or the character states in `useState`
 * here would re-render the entire screen on every key, which is exactly the
 * thing to avoid.
 *
 * ## Input
 *
 * It does not listen to anything. Keys reach a test through two commands,
 * `inputKey` and `deleteWord`, from whichever adapter the screen uses: the
 * classic screen's window `keydown` (`useKeyboardInput`), or the GG.Typing
 * text field's `beforeinput`. What a key does to a test is decided here, once;
 * where it came from is the adapter's business, and nothing in the engine,
 * metrics, telemetry or persistence knows or cares.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  BACKSPACE,
  createTypingEngine,
  IDLE_GAP_CAP_MS,
  isTypeableCharacter,
  type CompletionPolicy,
  type TypingEngine,
} from '@core/engine'
import {
  createTypingSession,
  DEFAULT_SESSION_CONTEXT,
  sessionService as defaultSessionService,
  type SessionContext,
  type SessionService,
  type TypingSession,
} from '@core/sessions'
import {
  analyseSlowSequences,
  deriveSessionTelemetry,
  measureDrill,
  telemetryService as defaultTelemetryService,
  type DrillOutcome,
  type SequenceReport,
  type TelemetryService,
} from '@core/telemetry'
import type { TextProvider } from '@core/text'
import {
  PRACTICE_WORD_COUNTS,
  timestamp,
  type PracticeWordCount,
  type SessionTarget,
  type Timestamp,
} from '@core/types'

/** How often the clock advances while running, in milliseconds. */
const TICK_INTERVAL_MS = 100

/** The lengths on offer. Defined with the preference that remembers the choice. */
export const WORD_COUNT_OPTIONS = PRACTICE_WORD_COUNTS
export type WordCount = PracticeWordCount
export const DEFAULT_WORD_COUNT: WordCount = 30

/**
 * A remembered practice length: where to start, and how to remember a change.
 *
 * Optional, because only ordinary practice has a length to remember — a drill
 * is the length it was generated at.
 */
export interface WordCountPreference {
  readonly initial: WordCount
  readonly remember: (count: WordCount) => void
}

/**
 * How a training mode takes part in a session without the session knowing the
 * mode.
 *
 * Both are seams that already existed: the engine's completion policy, which is
 * how modes were always meant to decide when a test is over, and the context a
 * test is saved with. Ordinary practice passes nothing and gets the engine's
 * default rule and the context it was given, exactly as before.
 */
export interface SessionModeHooks {
  /** When the test is over. Read once, when the engine is created. */
  readonly isComplete: CompletionPolicy
  /** The context the finished test is saved with, built from the one it ran with. */
  readonly finalContext: (context: SessionContext) => SessionContext
}

/** Whether the finished test made it to storage. */
export type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

export interface TypingSessionController {
  readonly engine: TypingEngine
  readonly target: SessionTarget
  readonly wordCount: WordCount
  readonly setWordCount: (count: WordCount) => void
  readonly restart: () => void
  /**
   * One key from an input adapter: a typeable character, or `Backspace`.
   *
   * The first character starts the test. Returns whether the key belongs to the
   * test — including a space or backspace before it has started, which is
   * swallowed rather than scrolling the page — so the adapter knows whether to
   * stop the browser handling it too. Once a test is over nothing belongs to it.
   */
  readonly inputKey: (key: string, at: Timestamp) => boolean
  /** Deletes back to the start of the previous word. Only while running. */
  readonly deleteWord: (at: Timestamp) => boolean
  /**
   * The finished test, as it was recorded. The same object that went to
   * storage, so the screen and the history page cannot disagree about a result.
   */
  readonly lastSession: TypingSession | null
  readonly saveState: SaveState
  /**
   * Slowest transitions of the finished test. Derived once, after the last
   * character, from telemetry already in hand — never during typing.
   */
  readonly sequences: SequenceReport | null
  /**
   * How the target transition went, when the finished test was a drill.
   * Null for ordinary practice, and null until a drill finishes.
   */
  readonly drillOutcome: DrillOutcome | null
}

export const useTypingSession = (
  provider: TextProvider,
  service: SessionService = defaultSessionService,
  telemetry: TelemetryService = defaultTelemetryService,
  context: SessionContext = DEFAULT_SESSION_CONTEXT,
  preference?: WordCountPreference,
  mode?: SessionModeHooks,
): TypingSessionController => {
  // The idle cap is a rule of word-count practice: see IDLE_GAP_CAP_MS. State
  // rather than a memo, because React may discard a memo and an engine
  // replaced mid-test would lose the test.
  const [engine] = useState(() =>
    createTypingEngine(
      mode === undefined
        ? { maxGapMs: IDLE_GAP_CAP_MS }
        : { maxGapMs: IDLE_GAP_CAP_MS, isComplete: (snapshot) => mode.isComplete(snapshot) },
    ),
  )

  /**
   * Held in a ref rather than in the effect below's dependencies.
   *
   * A caller that builds its context inline would otherwise hand over a new
   * object on every render, tearing down and re-subscribing the finished
   * handler each time — and a resubscription that lands between the last
   * keystroke and the finish event would lose the session. The ref is written
   * in an effect, never during render.
   */
  const contextRef = useRef(context)
  useEffect(() => {
    contextRef.current = context
  }, [context])
  const modeRef = useRef(mode)
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  const [lastSession, setLastSession] = useState<TypingSession | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [sequences, setSequences] = useState<SequenceReport | null>(null)
  const [drillOutcome, setDrillOutcome] = useState<DrillOutcome | null>(null)
  const initialWordCount = preference?.initial ?? DEFAULT_WORD_COUNT
  const [wordCount, setWordCountState] = useState<WordCount>(initialWordCount)
  const [target, setTarget] = useState<SessionTarget>(() =>
    provider.provide({ wordCount: initialWordCount }),
  )

  // A ref for the same reason as the context above: the callback may be rebuilt
  // by the caller on any render, and nothing here should re-subscribe for it.
  const rememberRef = useRef(preference?.remember)
  useEffect(() => {
    rememberRef.current = preference?.remember
  }, [preference?.remember])

  const loadTest = useCallback(
    (count: WordCount) => {
      engine.reset()
      setTarget(provider.provide({ wordCount: count }))
      setLastSession(null)
      setSaveState('idle')
      setSequences(null)
      setDrillOutcome(null)
    },
    [engine, provider],
  )

  const restart = useCallback(() => {
    loadTest(wordCount)
  }, [loadTest, wordCount])

  const setWordCount = useCallback(
    (count: WordCount) => {
      setWordCountState(count)
      loadTest(count)
      rememberRef.current?.(count)
    },
    [loadTest],
  )

  /**
   * The commands every input adapter shares.
   *
   * How a key arrives is the adapter's business — a window `keydown` for the
   * classic screen, a text field's `beforeinput` for GG.Typing. What a key does
   * to a test is decided here, once, so the two cannot drift: the first
   * character starts the test, a space or backspace before that is swallowed
   * without starting the clock, and once a test is over no key belongs to it.
   * Correctness itself is the engine's; nothing here compares a key with text.
   */
  const inputKey = useCallback(
    (key: string, at: Timestamp): boolean => {
      const status = engine.getSnapshot().status
      if (status !== 'idle' && status !== 'running') return false

      const isBackspace = key === BACKSPACE
      // The engine's own definition, so a key the engine would ignore cannot
      // start a test here.
      if (!isBackspace && !isTypeableCharacter(key)) return false

      if (status === 'idle') {
        // First keystroke starts the test — no button to press first. Not a
        // backspace, and not a space: before any letter a space is ignored by
        // the engine, and starting the clock on it would charge time for nothing.
        if (isBackspace || /\s/u.test(key)) return true
        engine.start(target, at)
      }

      engine.input(key, at)
      return true
    },
    [engine, target],
  )

  const deleteWord = useCallback(
    (at: Timestamp): boolean => {
      // Only while actually typing: on the results there is nothing to delete.
      if (engine.getSnapshot().status !== 'running') return false
      engine.deleteWord(at)
      return true
    },
    [engine],
  )

  /**
   * Drives the clock while a test is running.
   *
   * Started and stopped from engine events rather than from React state, so
   * that a session beginning or ending does not re-render this component and,
   * through it, the whole screen.
   */
  useEffect(() => {
    let intervalId: number | undefined

    const stop = (): void => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId)
        intervalId = undefined
      }
    }

    const start = (): void => {
      stop()
      intervalId = window.setInterval(() => {
        engine.tick(timestamp(performance.now()))
      }, TICK_INTERVAL_MS)
    }

    const unsubscribe = engine.on((event) => {
      if (event.type === 'started' || event.type === 'resumed') start()
      else if (
        event.type === 'finished' ||
        event.type === 'paused' ||
        event.type === 'reset'
      ) {
        stop()
      }
    })

    return () => {
      stop()
      unsubscribe()
    }
  }, [engine])

  /**
   * Records a finished test.
   *
   * Nothing here runs while typing: it is subscribed to the engine's `finished`
   * event, which fires exactly once per completed test. The write is started
   * and not awaited, so a slow or broken store cannot delay the screen — the
   * result is on display before storage has been asked about it.
   *
   * A failure is reported, not thrown. Losing a record is a nuisance; losing
   * the session you just typed because saving it went wrong is not acceptable.
   */
  useEffect(() => {
    const unsubscribe = engine.on((event) => {
      if (event.type !== 'finished' || event.status !== 'completed') return

      const session = createTypingSession({
        result: event.result,
        context: modeRef.current?.finalContext(contextRef.current) ?? contextRef.current,
        completedAt: timestamp(Date.now()),
      })

      setLastSession(session)
      setSaveState('saving')

      service
        .save(session)
        .then(() => setSaveState('saved'))
        .catch((error: unknown) => {
          console.warn('[sessions] failed to save a finished test', error)
          setSaveState('failed')
        })

      /**
       * Keystroke detail is packed and stored separately, and separately
       * allowed to fail: its absence costs a future analysis, while the result
       * itself is already safe either way. Neither write is awaited, and both
       * happen after the last character rather than during any of them.
       */
      const packed = telemetry.capture(event.result)
      telemetry.save(session.id, packed).catch((error: unknown) => {
        console.warn('[telemetry] failed to save keystroke detail', error)
      })

      // Read straight from the keystrokes in hand rather than from storage, so
      // the result appears even if the save failed. Derived once here and used
      // for both readings, rather than walking the log twice.
      const derived = deriveSessionTelemetry(
        event.result.keystrokes,
        event.result.target.text,
      )

      setSequences(analyseSlowSequences(derived))

      const drillTarget = contextRef.current.targetSequence
      setDrillOutcome(
        contextRef.current.mode === 'drill' && drillTarget !== undefined
          ? measureDrill(derived, event.result.target.text, drillTarget)
          : null,
      )
    })

    return unsubscribe
  }, [engine, service, telemetry])

  return {
    engine,
    target,
    wordCount,
    setWordCount,
    restart,
    inputKey,
    deleteWord,
    lastSession,
    saveState,
    sequences,
    drillOutcome,
  }
}

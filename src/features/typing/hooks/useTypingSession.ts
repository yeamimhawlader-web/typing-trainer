/**
 * Owns the engine instance, the keyboard, and the clock for one typing screen.
 *
 * Note what this hook does *not* do: it holds no per-keystroke state in React.
 * Keystrokes go straight into the engine, and components subscribe to the
 * slices they display. Putting the cursor or the character states in `useState`
 * here would re-render the entire screen on every key, which is exactly the
 * thing to avoid.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { BACKSPACE, createTypingEngine, type TypingEngine } from '@core/engine'
import {
  createTypingSession,
  DEFAULT_SESSION_CONTEXT,
  sessionService as defaultSessionService,
  type SessionService,
  type TypingSession,
} from '@core/sessions'
import {
  analyseSlowSequences,
  deriveSessionTelemetry,
  telemetryService as defaultTelemetryService,
  type SequenceReport,
  type TelemetryService,
} from '@core/telemetry'
import type { TextProvider } from '@core/text'
import { timestamp, type SessionTarget, type Timestamp } from '@core/types'

/** How often the clock advances while running, in milliseconds. */
const TICK_INTERVAL_MS = 100

export const WORD_COUNT_OPTIONS = [15, 30, 60] as const
export type WordCount = (typeof WORD_COUNT_OPTIONS)[number]
export const DEFAULT_WORD_COUNT: WordCount = 30

/**
 * Prefers the browser's own timestamp for the key press over the time the
 * handler happened to run. Under load those differ by more than a keystroke
 * interval, and this application measures keystroke intervals for a living.
 *
 * Falls back when the value is not on the same time origin as
 * `performance.now()`, which would otherwise throw the session clock years into
 * the future and leave it there.
 */
const resolveEventTime = (event: KeyboardEvent): Timestamp => {
  const now = performance.now()
  const sameOrigin = event.timeStamp > 0 && Math.abs(event.timeStamp - now) < 1_000
  return timestamp(sameOrigin ? event.timeStamp : now)
}

/** True when the key event belongs to a real text field rather than the test. */
const isEditableTarget = (event: KeyboardEvent): boolean => {
  const target = event.target
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA'
  )
}

/**
 * True when a control has focus and the key would normally operate it.
 *
 * Space and Enter activate a focused button or link. Swallowing them to feed
 * the typing test would break the one thing a keyboard user relies on, so those
 * two keys are left alone whenever a control is what is focused. Every other
 * character still reaches the test, so typing from anywhere keeps working.
 */
const isControlActivation = (event: KeyboardEvent): boolean => {
  if (event.key !== ' ' && event.key !== 'Enter') return false

  const target = event.target
  if (!(target instanceof HTMLElement)) return false

  return (
    target.tagName === 'BUTTON' ||
    target.tagName === 'A' ||
    target.tagName === 'SELECT' ||
    target.getAttribute('role') === 'button'
  )
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
}

export const useTypingSession = (
  provider: TextProvider,
  service: SessionService = defaultSessionService,
  telemetry: TelemetryService = defaultTelemetryService,
): TypingSessionController => {
  const engine = useMemo(() => createTypingEngine(), [])
  const [lastSession, setLastSession] = useState<TypingSession | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [sequences, setSequences] = useState<SequenceReport | null>(null)
  const [wordCount, setWordCountState] = useState<WordCount>(DEFAULT_WORD_COUNT)
  const [target, setTarget] = useState<SessionTarget>(() =>
    provider.provide({ wordCount: DEFAULT_WORD_COUNT }),
  )

  const loadTest = useCallback(
    (count: WordCount) => {
      engine.reset()
      setTarget(provider.provide({ wordCount: count }))
      setLastSession(null)
      setSaveState('idle')
      setSequences(null)
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
    },
    [loadTest],
  )

  /**
   * The listener is re-attached whenever the loaded test changes, which is once
   * per test rather than once per keystroke. Holding `target` and `restart` in
   * refs to avoid that would mean writing to a ref during render — cheaper in
   * theory, wrong in practice, and invisible to the typist either way.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Leave browser and OS shortcuts alone.
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (isEditableTarget(event)) return

      const status = engine.getSnapshot().status

      /**
       * Tab abandons a test in progress and starts a fresh one.
       *
       * Only while actually typing. Once a test finishes there are results on
       * screen with their own controls, and swallowing Tab there would make
       * them unreachable — the same keyboard trap that taking Tab on the idle
       * screen used to create.
       */
      if (event.key === 'Tab') {
        if (status !== 'running') return
        event.preventDefault()
        restart()
        return
      }

      /**
       * Enter starts the next test from the results.
       *
       * Enter does nothing on an empty page, so claiming it costs the browser
       * no behaviour — unlike Tab, which is how people move around. It keeps
       * the repeat loop to a single key while leaving the results navigable.
       */
      if (event.key === 'Enter') {
        if (status !== 'completed' || isControlActivation(event)) return
        event.preventDefault()
        restart()
        return
      }

      // Once a test is over the keyboard belongs to the browser again, so
      // nothing below runs — including the preventDefault that would otherwise
      // stop Space from operating a focused button on the results.
      if (status !== 'idle' && status !== 'running') return

      if (isControlActivation(event)) return

      const isBackspace = event.key === BACKSPACE
      const isCharacter = Array.from(event.key).length === 1
      if (!isBackspace && !isCharacter) return

      // Space would scroll the page and Backspace can navigate back.
      event.preventDefault()

      const at = resolveEventTime(event)

      if (status === 'idle') {
        // First keystroke starts the test — no button to press first.
        if (isBackspace) return
        engine.start(target, at)
      }

      engine.input(event.key, at)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [engine, target, restart])

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
        context: DEFAULT_SESSION_CONTEXT,
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
      // the slowest sequences appear with the result even if the save failed.
      setSequences(
        analyseSlowSequences(
          deriveSessionTelemetry(event.result.keystrokes, event.result.target.text),
        ),
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
    lastSession,
    saveState,
    sequences,
  }
}

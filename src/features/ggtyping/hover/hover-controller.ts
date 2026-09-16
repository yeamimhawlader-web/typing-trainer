/**
 * Hover Mode, connected to a typing session. Framework-free; the GG.Typing
 * screen drives it and draws it.
 *
 * ## Two engines, one definition of correct
 *
 * The text is typed through the session's own engine, exactly as in ordinary
 * practice. Repetitions of a focused word are typed through a second instance
 * of the same engine, whose text is that word and the space after it. So a
 * repetition is judged by the engine's rules — the same wrong letters, extras,
 * early spaces and corrections — and nothing here ever compares a key with a
 * character.
 *
 * ## The text is never rewritten
 *
 * The session's text stays exactly as it was generated. While a word is being
 * repeated the session engine is paused: its clock stops, its cursor stays at
 * the start of the next word, and it records nothing. When the focus is
 * released it resumes, and the next key carries on where the typist left the
 * text. The session's speed, accuracy and keystroke log are therefore those of
 * the pass through the text, by the engine's unchanged definitions; the
 * repetitions are described by the focus records saved with the session.
 *
 * ## What it reads, and what it calls
 *
 * - A `keystroke` event from the session engine: its `index`, `kind` and
 *   `correct`. A wrong character keystroke focuses the word it belongs to.
 * - After a key typed into the text, the session engine's cursor, only while a
 *   focus is pending, to see whether the typist has left the word.
 * - After a key typed into a repetition, that engine's error count and status.
 *
 * The only calls into the session engine are `pause` and `resume`, at the start
 * and end of the repetitions. It never types into it.
 *
 * ## Difficulty
 *
 * Chosen for the controller and changeable between tests. A test is saved with
 * the difficulty it started at, and each focus follows the difficulty it began
 * under; the screen restarts the test when the difficulty changes, so the two
 * are always the same.
 *
 * ## The end of the text
 *
 * A mistake on the last word would otherwise end the test on its last letter,
 * before the word could be repeated. The mode supplies the session's completion
 * rule — every character typed, and nothing focused — so the test ends when
 * the last focus is released instead.
 */

import {
  BACKSPACE,
  createTypingEngine,
  isTypeableCharacter,
  type EngineSnapshot,
  type TypingEngine,
  type Unsubscribe,
  type WordRange,
} from '@core/engine'
import type { HoverFocusRecord, SessionContext } from '@core/sessions'
import { timestamp, type HoverDifficulty, type SessionTarget, type Timestamp } from '@core/types'

import { wordOwning } from '../mistake-streak.ts'
import {
  NORMAL,
  progressOf,
  remainingOf,
  stepHover,
  type HoverEvent,
  type HoverFocus,
  type HoverProgress,
  type HoverSignal,
  type HoverState,
} from './hover-rules.ts'

export interface HoverSnapshot {
  readonly phase: HoverState['phase']
  /** The focused word with its range in the text, or null. */
  readonly focus: (HoverFocus & { readonly start: number; readonly end: number }) | null
  /** Repetitions still to come, as the difficulty counts them. */
  readonly remaining: number
  /** What the progress row shows, or null with nothing focused. */
  readonly progress: HoverProgress | null
  /** Whether the repetition in progress already has a mistake in it. */
  readonly attemptFailed: boolean
  /** Counts focuses, so one can be told from the next. */
  readonly focusId: number
  /** The difficulty the current test is typed at. */
  readonly difficulty: HoverDifficulty
  /** Identifies the current test, so what happens in it can be told from another test's. */
  readonly testId: string
}

export interface HoverSignalEvent {
  readonly signal: HoverSignal
  readonly snapshot: HoverSnapshot
  readonly record: HoverFocusRecord | null
  /**
   * The progress row as of this moment. For a release, as the focus ended —
   * its last repetition included — though the snapshot has nothing focused.
   */
  readonly progress: HoverProgress | null
}

export interface HoverControllerOptions {
  /** Where a new controller starts. Standard when absent. */
  readonly difficulty?: HoverDifficulty
  /** Injectable for tests; defaults to a random UUID. */
  readonly createTestId?: () => string
}

export interface HoverController {
  /** The engine repetitions are typed through. Its text is the focused word and a space. */
  readonly attempt: TypingEngine
  /** Starts following a session engine. Returns the matching stop. */
  connect(engine: TypingEngine): Unsubscribe
  /**
   * One key. During repetitions it types the repetition; otherwise it is handed
   * to `typeIntoText`, the session's own command. Returns whether the key
   * belonged to the test.
   */
  inputKey(key: string, at: Timestamp, typeIntoText: (key: string, at: Timestamp) => boolean): boolean
  /** Word delete, routed the same way. */
  deleteWord(at: Timestamp, deleteInText: (at: Timestamp) => boolean): boolean
  getSnapshot(): HoverSnapshot
  subscribe(listener: () => void): Unsubscribe
  /** Moments — a focus starting, a repetition failing — for motion and announcements. */
  onSignal(listener: (event: HoverSignalEvent) => void): Unsubscribe
  /** Focuses finished so far in this test. */
  records(): readonly HoverFocusRecord[]
  /**
   * The difficulty for the next test. The test under way keeps the one it
   * started with, so the screen restarts it when this changes.
   */
  setDifficulty(difficulty: HoverDifficulty): void
  /** The session's completion rule: every character typed, and nothing focused. */
  isComplete(snapshot: EngineSnapshot): boolean
  /** The context the finished test is saved with: its difficulty and focus records added. */
  finalContext(context: SessionContext): SessionContext
}

/** Source id of the text a repetition is typed against. Never saved. */
export const HOVER_ATTEMPT_SOURCE = 'hover-repetition'

/** An id for one test, for anything that keeps a record of what happened in it. */
export const newTestId = (): string =>
  (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.() ??
  `test-${Date.now()}-${Math.random().toString(36).slice(2)}`

export const createHoverController = ({
  difficulty: initialDifficulty = 'standard',
  createTestId = newTestId,
}: HoverControllerOptions = {}): HoverController => {
  const attempt = createTypingEngine()
  const listeners = new Set<() => void>()
  const signalListeners = new Set<(event: HoverSignalEvent) => void>()

  let main: TypingEngine | null = null
  let state: HoverState = NORMAL
  let records: readonly HoverFocusRecord[] = []
  let words: readonly WordRange[] = []
  let characters: readonly string[] = []
  let focusId = 0
  /** The difficulty chosen for the next test. */
  let nextDifficulty: HoverDifficulty = initialDifficulty
  /** The difficulty the current test started at. */
  let testDifficulty: HoverDifficulty = initialDifficulty
  let testId = createTestId()

  const build = (): HoverSnapshot => {
    const common = { focusId, difficulty: testDifficulty, testId }
    if (state.phase === 'normal') {
      return { ...common, phase: 'normal', focus: null, remaining: 0, progress: null, attemptFailed: false }
    }
    const range = words[state.focus.wordIndex]
    return {
      ...common,
      phase: state.phase,
      focus: { ...state.focus, start: range?.start ?? 0, end: range?.end ?? 0 },
      remaining: remainingOf(state.focus),
      progress: progressOf(state.focus),
      attemptFailed: state.phase === 'repeating' && state.attemptFailed,
    }
  }

  let snapshot = build()

  const targetOf = (focus: HoverFocus): SessionTarget => ({
    text: `${focus.word} `,
    sourceId: HOVER_ATTEMPT_SOURCE,
  })

  /** Applies one event: new state, then listeners, then the engines. */
  const apply = (event: HoverEvent): void => {
    const step = stepHover(state, event)
    if (step.state === state) return

    state = step.state
    if (step.signal === 'activated') focusId += 1
    if (step.record !== null) records = [...records, step.record]
    snapshot = build()

    for (const listener of listeners) listener()
    if (step.signal !== null) {
      const progress = step.final === null ? snapshot.progress : progressOf(step.final)
      for (const listener of signalListeners) {
        listener({ signal: step.signal, snapshot, record: step.record, progress })
      }
    }

    switch (step.signal) {
      case 'repeating':
        main?.pause(timestamp(event.at))
        if (state.phase === 'repeating') attempt.start(targetOf(state.focus), timestamp(event.at))
        return
      case 'released':
        attempt.reset()
        // Last, so the focus is already gone when the session checks whether
        // its text is finished.
        main?.resume(timestamp(event.at))
        return
      case 'ended':
        attempt.reset()
        return
      default:
        // A repetition finished and another follows.
        if (event.type === 'attempt-completed' && state.phase === 'repeating') {
          attempt.start(targetOf(state.focus), timestamp(event.at))
        }
    }
  }

  const leftFocusedWord = (): boolean => {
    if (state.phase !== 'pending' || main === null) return false
    const next = words[state.focus.wordIndex + 1]
    return main.getSnapshot().cursorIndex >= (next?.start ?? characters.length)
  }

  const learnText = (engine: TypingEngine): void => {
    const current = engine.getSnapshot()
    words = current.words
    characters = current.characters
  }

  return {
    attempt,

    connect: (engine) => {
      main = engine
      learnText(engine)

      const stop = engine.on((event) => {
        switch (event.type) {
          case 'started':
            apply({ type: 'end', at: event.at })
            records = []
            testDifficulty = nextDifficulty
            testId = createTestId()
            snapshot = build()
            learnText(engine)
            return

          case 'keystroke': {
            const { keystroke } = event
            // In the text: a first mistake focuses its word, and a further one on
            // the focused word is counted. The rules tell the two apart.
            if (state.phase === 'repeating' || keystroke.kind !== 'character' || keystroke.correct) return
            const wordIndex = wordOwning(words, keystroke.index)
            const range = words[wordIndex]
            if (range === undefined) return
            apply({
              type: 'mistake',
              wordIndex,
              word: characters.slice(range.start, range.end).join(''),
              difficulty: testDifficulty,
              at: event.at,
            })
            return
          }

          case 'reset':
            apply({ type: 'end', at: performance.now() })
            records = []
            return

          case 'finished':
          case 'word-completed':
          case 'paused':
          case 'resumed':
            return
        }
      })

      return () => {
        stop()
        apply({ type: 'end', at: performance.now() })
        if (main === engine) main = null
      }
    },

    inputKey: (key, at, typeIntoText) => {
      if (state.phase !== 'repeating') {
        const handled = typeIntoText(key, at)
        if (leftFocusedWord()) apply({ type: 'left-word', at })
        return handled
      }

      if (key !== BACKSPACE && !isTypeableCharacter(key)) return false

      const errorsBefore = attempt.getSnapshot().errorCount
      attempt.input(key, at)
      const after = attempt.getSnapshot()

      // One event per wrong keystroke: the rules count them all and fail the
      // repetition on the first.
      for (let error = errorsBefore; error < after.errorCount; error += 1) apply({ type: 'attempt-mistake', at })
      if (after.status === 'completed') apply({ type: 'attempt-completed', at })
      return true
    },

    deleteWord: (at, deleteInText) => {
      if (state.phase !== 'repeating') return deleteInText(at)
      attempt.deleteWord(at)
      return true
    },

    getSnapshot: () => snapshot,

    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    onSignal: (listener) => {
      signalListeners.add(listener)
      return () => {
        signalListeners.delete(listener)
      }
    },

    records: () => records,

    setDifficulty: (difficulty) => {
      nextDifficulty = difficulty
      // Before a test is under way there is nothing to keep: the choice applies now.
      const status = main?.getSnapshot().status
      if (status !== 'running' && status !== 'paused') {
        testDifficulty = difficulty
        snapshot = build()
        for (const listener of listeners) listener()
      }
    },

    isComplete: (current) => current.cursorIndex >= current.characters.length && state.phase === 'normal',

    finalContext: (context) => ({ ...context, hover: { difficulty: testDifficulty, focuses: records } }),
  }
}

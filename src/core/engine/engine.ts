/**
 * The typing engine.
 *
 * Behaviour worth knowing before reading the code:
 *
 * **Errors do not block.** A wrong character is marked wrong and the cursor
 * moves on, rather than refusing to advance until the right key is pressed.
 * This is what fast typists expect, and it is the only model that lets the
 * engine measure how someone actually types instead of forcing a correction
 * rhythm on them. Backspace is how mistakes get fixed.
 *
 * **A fixed mistake still happened.** Retyping a character correctly after a
 * backspace marks it `corrected`, not `correct`. It counts toward speed — the
 * text is right — and permanently against accuracy. Speed and accuracy are
 * answering different questions.
 *
 * **The engine owns no clock.** Every method takes the current time from its
 * caller. A session is therefore replayable from its stored keystrokes, and
 * every test below is exact rather than timing-dependent.
 *
 * **Modes plug in, rather than forking the engine.** `isComplete` decides when
 * a session ends. Everything else — scoring, cursor movement, word tracking —
 * is shared by every mode.
 */

import {
  milliseconds as toMilliseconds,
  sessionId as toSessionId,
  timestamp as toTimestamp,
  type CharacterState,
  type Keystroke,
  type SessionId,
  type SessionResult,
  type SessionStatus,
  type SessionTarget,
  type Timestamp,
} from '@core/types'

import { toCharacters } from './characters.ts'
import { calculateAccuracy, calculateWpm } from './metrics.ts'
import {
  BACKSPACE,
  type CompletionPolicy,
  type EngineEvent,
  type EngineEventListener,
  type EngineSnapshot,
  type FinishedStatus,
  type TypingEngine,
  type TypingEngineOptions,
  type Unsubscribe,
} from './types.ts'
import { computeWordRanges, findCurrentWordIndex, type WordRange } from './words.ts'

/** Ends the session once the last character has been typed. */
const defaultIsComplete: CompletionPolicy = (snapshot) =>
  snapshot.cursorIndex >= snapshot.characters.length

/**
 * Session ids come from `crypto.randomUUID` where it exists — it is present in
 * both Node and every browser this targets.
 *
 * It is reached through a locally declared shape rather than the ambient
 * `Crypto` type on purpose: that type comes from the DOM type library, and the
 * engine is compiled without it (see tsconfig.engine.json). Naming it here
 * keeps the engine's type surface free of anything browser-specific.
 */
interface RandomSource {
  readonly randomUUID?: () => string
}

const defaultCreateSessionId = (): SessionId => {
  const { crypto } = globalThis as { crypto?: RandomSource }

  if (typeof crypto?.randomUUID === 'function') {
    return toSessionId(crypto.randomUUID())
  }

  return toSessionId(`session-${Date.now()}-${Math.random().toString(36).slice(2)}`)
}

/** A key is typeable when it is exactly one code point: 'a', 'é', '👍'. */
const isTypeableCharacter = (key: string): boolean => toCharacters(key).length === 1

interface EngineState {
  status: SessionStatus
  target: SessionTarget
  characters: readonly string[]
  words: readonly WordRange[]
  /** Word end index -> word, for detecting a crossed boundary in one lookup. */
  wordEnds: ReadonlyMap<number, WordRange>
  characterStates: CharacterState[]
  /** Whether a position has ever been typed wrongly. Survives a backspace. */
  everWrong: boolean[]
  cursorIndex: number
  keystrokes: Keystroke[]
  sessionId: SessionId | null
  startedAt: Timestamp | null
  /** Running time banked before the current segment, in milliseconds. */
  accumulatedMs: number
  /** Wall clock when the current running segment began; null when not running. */
  runStartedAt: number | null
  /** Latest timestamp the engine has been given. Never moves backwards. */
  lastKnownAt: number
  typedCount: number
  correctKeystrokes: number
  errorCount: number
  finishedStatus: FinishedStatus | null
  result: SessionResult | null
}

const emptyTarget: SessionTarget = { text: '', sourceId: 'none' }

const createState = (target: SessionTarget): EngineState => {
  const characters = toCharacters(target.text)
  const words = computeWordRanges(characters)

  return {
    status: 'idle',
    target,
    characters,
    words,
    wordEnds: new Map(words.map((word) => [word.end, word])),
    characterStates: characters.map(() => 'pending'),
    everWrong: characters.map(() => false),
    cursorIndex: 0,
    keystrokes: [],
    sessionId: null,
    startedAt: null,
    accumulatedMs: 0,
    runStartedAt: null,
    lastKnownAt: 0,
    typedCount: 0,
    correctKeystrokes: 0,
    errorCount: 0,
    finishedStatus: null,
    result: null,
  }
}

export const createTypingEngine = (options: TypingEngineOptions = {}): TypingEngine => {
  const isComplete = options.isComplete ?? defaultIsComplete
  const createSessionId = options.createSessionId ?? defaultCreateSessionId

  let state = createState(emptyTarget)
  let cachedSnapshot: EngineSnapshot | null = null

  const snapshotListeners = new Set<() => void>()
  const eventListeners = new Set<EngineEventListener>()

  const invalidate = (): void => {
    cachedSnapshot = null
  }

  const notify = (): void => {
    for (const listener of snapshotListeners) listener()
  }

  const emit = (event: EngineEvent): void => {
    for (const listener of eventListeners) listener(event)
  }

  /** Running time so far, excluding paused intervals. */
  const elapsed = (): number =>
    state.runStartedAt === null
      ? state.accumulatedMs
      : state.accumulatedMs + Math.max(0, state.lastKnownAt - state.runStartedAt)

  /** Clamped so an out-of-order timestamp cannot rewind the session clock. */
  const advanceClock = (at: Timestamp): void => {
    state.lastKnownAt = Math.max(state.lastKnownAt, at)
    invalidate()
  }

  const buildSnapshot = (): EngineSnapshot => {
    let correctCount = 0
    let incorrectCount = 0
    let correctedCount = 0

    for (const characterState of state.characterStates) {
      if (characterState === 'correct') correctCount += 1
      else if (characterState === 'corrected') {
        correctCount += 1
        correctedCount += 1
      } else if (characterState === 'incorrect') incorrectCount += 1
    }

    const elapsedMs = toMilliseconds(elapsed())

    return {
      status: state.status,
      target: state.target,
      characters: state.characters,
      characterStates: [...state.characterStates],
      cursorIndex: state.cursorIndex,
      words: state.words,
      currentWordIndex: findCurrentWordIndex(state.words, state.cursorIndex),
      keystrokes: [...state.keystrokes],
      correctCount,
      incorrectCount,
      correctedCount,
      typedCount: state.typedCount,
      errorCount: state.errorCount,
      elapsedMs,
      netWpm: calculateWpm(correctCount, elapsedMs),
      rawWpm: calculateWpm(state.typedCount, elapsedMs),
      accuracy: calculateAccuracy(state.correctKeystrokes, state.typedCount),
    }
  }

  const getSnapshot = (): EngineSnapshot => {
    cachedSnapshot ??= buildSnapshot()
    return cachedSnapshot
  }

  const buildResult = (status: FinishedStatus): SessionResult => {
    const snapshot = getSnapshot()

    return {
      id: state.sessionId ?? createSessionId(),
      startedAt: state.startedAt ?? toTimestamp(0),
      durationMs: snapshot.elapsedMs,
      target: state.target,
      keystrokes: snapshot.keystrokes,
      // Lifted straight off the snapshot rather than recomputed: the result and
      // the screen are then guaranteed to be reporting the same test.
      metrics: {
        netWpm: snapshot.netWpm,
        rawWpm: snapshot.rawWpm,
        accuracy: snapshot.accuracy,
        totalCharacters: snapshot.characters.length,
        typedCharacters: snapshot.typedCount,
        correctCharacters: snapshot.correctCount,
        incorrectCharacters: snapshot.incorrectCount,
        correctedCharacters: snapshot.correctedCount,
        errorCount: snapshot.errorCount,
      },
      status,
    }
  }

  const finish = (at: Timestamp, status: FinishedStatus): void => {
    if (state.status !== 'running' && state.status !== 'paused') return

    advanceClock(at)
    state.accumulatedMs = elapsed()
    state.runStartedAt = null
    state.status = status
    state.finishedStatus = status
    invalidate()

    const result = buildResult(status)
    state.result = result

    emit({ type: 'finished', status, result, at })
    notify()
  }

  /** Ends the session if the active mode says it is over. */
  const checkCompletion = (at: Timestamp): void => {
    if (state.status !== 'running') return
    if (isComplete(getSnapshot())) finish(at, 'completed')
  }

  const recordKeystroke = (keystroke: Keystroke, at: Timestamp): void => {
    state.keystrokes.push(keystroke)
    emit({ type: 'keystroke', keystroke, at })
  }

  const handleCharacter = (key: string, at: Timestamp): void => {
    const index = state.cursorIndex
    const expected = state.characters[index]

    // Past the end of the target: nothing to compare against, so nothing is
    // recorded. Reachable when a mode keeps the session open at the end.
    if (expected === undefined) return

    const correct = key === expected

    state.typedCount += 1
    if (correct) {
      state.correctKeystrokes += 1
      state.characterStates[index] =
        state.everWrong[index] === true ? 'corrected' : 'correct'
    } else {
      state.errorCount += 1
      state.everWrong[index] = true
      state.characterStates[index] = 'incorrect'
    }

    state.cursorIndex = index + 1
    invalidate()

    recordKeystroke(
      {
        kind: 'character',
        key,
        expected,
        index,
        correct,
        at: toMilliseconds(elapsed()),
      },
      at,
    )

    const crossedWord = state.wordEnds.get(state.cursorIndex)
    if (crossedWord !== undefined) {
      emit({ type: 'word-completed', word: crossedWord, at })
    }
  }

  const handleBackspace = (at: Timestamp): void => {
    // At the start there is nothing to delete. Not an error, just nothing —
    // so no keystroke is recorded and no metric moves.
    if (state.cursorIndex <= 0) return

    const index = state.cursorIndex - 1
    state.cursorIndex = index
    state.characterStates[index] = 'pending'
    invalidate()

    // `typedCount` and `correctKeystrokes` deliberately do not move. Accuracy
    // is over attempts made, and deleting an attempt does not unmake it.
    recordKeystroke(
      {
        kind: 'backspace',
        key: BACKSPACE,
        expected: null,
        index,
        correct: false,
        at: toMilliseconds(elapsed()),
      },
      at,
    )
  }

  return {
    start: (target, at) => {
      if (toCharacters(target.text).length === 0) {
        throw new RangeError('Cannot start a session with an empty target text')
      }

      state = createState(target)
      state.status = 'running'
      state.sessionId = createSessionId()
      state.startedAt = at
      state.lastKnownAt = at
      state.runStartedAt = at
      invalidate()

      emit({ type: 'started', at })
      checkCompletion(at)
      notify()
    },

    input: (key, at) => {
      if (state.status !== 'running') return

      const backspace = key === BACKSPACE
      // Unknown key names ('Shift', 'ArrowLeft') are not input. Returning
      // before touching the clock keeps them completely inert.
      if (!backspace && !isTypeableCharacter(key)) return

      advanceClock(at)

      if (backspace) handleBackspace(at)
      else handleCharacter(key, at)

      checkCompletion(at)
      notify()
    },

    tick: (at) => {
      if (state.status !== 'running') return

      advanceClock(at)
      checkCompletion(at)
      notify()
    },

    pause: (at) => {
      if (state.status !== 'running') return

      advanceClock(at)
      state.accumulatedMs = elapsed()
      state.runStartedAt = null
      state.status = 'paused'
      invalidate()

      emit({ type: 'paused', at })
      notify()
    },

    resume: (at) => {
      if (state.status !== 'paused') return

      advanceClock(at)
      state.runStartedAt = state.lastKnownAt
      state.status = 'running'
      invalidate()

      emit({ type: 'resumed', at })
      checkCompletion(at)
      notify()
    },

    finish,

    reset: () => {
      state = createState(state.target)
      invalidate()

      emit({ type: 'reset' })
      notify()
    },

    getSnapshot,

    subscribe: (listener): Unsubscribe => {
      snapshotListeners.add(listener)
      return () => {
        snapshotListeners.delete(listener)
      }
    },

    on: (listener): Unsubscribe => {
      eventListeners.add(listener)
      return () => {
        eventListeners.delete(listener)
      }
    },

    toResult: () => state.result,
  }
}

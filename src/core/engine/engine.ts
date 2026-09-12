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
import { ruleForCharacter } from './input-rules.ts'
import {
  computeWordRanges,
  findCurrentWordIndex,
  findWordDeleteIndex,
  type WordRange,
} from './words.ts'

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

/**
 * A key is typeable when it is one code point that could appear in text: 'a',
 * 'é', '👍', a space.
 *
 * Control characters ('\r', '\t', NUL, ESC, DEL), invisible format characters
 * such as a zero-width space, and a combining mark on its own are not. No
 * physical keyboard sends them as a key value, and accepting them used to mark
 * an invisible character wrong.
 */
export const isTypeableCharacter = (key: string): boolean =>
  toCharacters(key).length === 1 && !/[\p{Cc}\p{Cf}\p{M}]/u.test(key)

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
  /**
   * Extra characters typed at each word boundary, where a space was expected.
   * Almost always zero; parallel to `characters` for a constant-time lookup.
   */
  extras: number[]
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
  /** Timestamp of the last real input, for the idle cap. */
  lastInputAt: number
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
    extras: characters.map(() => 0),
    cursorIndex: 0,
    keystrokes: [],
    sessionId: null,
    startedAt: null,
    accumulatedMs: 0,
    runStartedAt: null,
    lastKnownAt: 0,
    lastInputAt: 0,
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
  const maxGapMs = options.maxGapMs ?? null

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

  /**
   * The latest moment that counts as typing time.
   *
   * Without a gap cap, simply the latest timestamp seen. With one, never more
   * than the cap past the last input — a typist who has stopped for longer is
   * not typing, and the time they spend away is not charged to their speed.
   */
  const countedNow = (): number =>
    maxGapMs === null
      ? state.lastKnownAt
      : Math.min(state.lastKnownAt, state.lastInputAt + maxGapMs)

  /** Running time so far, excluding paused intervals and capped idle gaps. */
  const elapsed = (): number =>
    state.runStartedAt === null
      ? state.accumulatedMs
      : state.accumulatedMs + Math.max(0, countedNow() - state.runStartedAt)

  /** Clamped so an out-of-order timestamp cannot rewind the session clock. */
  const advanceClock = (at: Timestamp): void => {
    state.lastKnownAt = Math.max(state.lastKnownAt, at)
    invalidate()
  }

  /**
   * Notes that the typist pressed something, after the clock has advanced.
   *
   * When the gap since the previous input is longer than the cap, the running
   * segment is banked as it stood when the cap ran out and a new segment starts
   * now. The interval in between is treated exactly as if it had been paused —
   * which is what makes the rule survive a background tab, where the tick that
   * would otherwise notice the idle time may not run for a minute.
   */
  const registerInput = (): void => {
    if (
      maxGapMs !== null &&
      state.runStartedAt !== null &&
      state.lastKnownAt - state.lastInputAt > maxGapMs
    ) {
      state.accumulatedMs = elapsed()
      state.runStartedAt = state.lastKnownAt
    }

    state.lastInputAt = state.lastKnownAt
    invalidate()
  }

  /** The state a position takes when the key typed at it was right. */
  const stateWhenCorrect = (index: number): CharacterState => {
    // Extras still standing at a boundary mean the word is not right, however
    // correctly its space was then typed.
    if ((state.extras[index] ?? 0) > 0) return 'incorrect'
    return state.everWrong[index] === true ? 'corrected' : 'correct'
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
      idle:
        state.status === 'running' &&
        maxGapMs !== null &&
        state.lastKnownAt - state.lastInputAt > maxGapMs,
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

  /**
   * One character keystroke, under the word-synchronised rules in
   * `input-rules.ts`.
   *
   * Every keystroke that counts is recorded once, at the position the cursor was
   * on, whatever the rule then does with the cursor. That is what keeps accuracy
   * ("correct keystrokes over all keystrokes"), raw speed and the error count
   * meaning exactly what they meant before: an early space is one wrong
   * keystroke, an extra letter is one wrong keystroke.
   */
  const handleCharacter = (key: string, at: Timestamp): void => {
    const index = state.cursorIndex
    const expected = state.characters[index]

    // Past the end of the target: nothing to compare against, so nothing is
    // recorded. Reachable when a mode keeps the session open at the end.
    if (expected === undefined) return

    const rule = ruleForCharacter(state.characters, state.words, index, key)

    // A space before any letter of the word is not an attempt at anything.
    if (rule.kind === 'ignore') return

    const correct = key === expected

    state.typedCount += 1
    if (correct) {
      state.correctKeystrokes += 1
      state.characterStates[index] = stateWhenCorrect(index)
    } else {
      state.errorCount += 1
      state.everWrong[index] = true
      state.characterStates[index] = 'incorrect'
    }

    let completedWord: WordRange | undefined

    switch (rule.kind) {
      case 'advance':
        state.cursorIndex = index + 1
        completedWord = state.wordEnds.get(state.cursorIndex)
        break

      case 'extra':
        // The cursor holds on the boundary, so the next word is untouched.
        state.extras[index] = (state.extras[index] ?? 0) + 1
        break

      case 'skip-word':
        // The letters never reached are missed. They count as wrong and as
        // ever-wrong, so retyping them later shows as a correction.
        for (let position = index + 1; position < rule.missedEnd; position += 1) {
          state.everWrong[position] = true
          state.characterStates[position] = 'incorrect'
        }
        // The space itself did separate the words.
        for (let position = rule.missedEnd; position < rule.nextWordStart; position += 1) {
          state.characterStates[position] = stateWhenCorrect(position)
        }
        state.cursorIndex = rule.nextWordStart
        completedWord = state.words[findCurrentWordIndex(state.words, index)]
        break
    }

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

    if (completedWord !== undefined) {
      emit({ type: 'word-completed', word: completedWord, at })
    }
  }

  /**
   * One backspace.
   *
   * Extras go first: while the cursor is holding on a boundary with extra
   * characters, a backspace removes one of them and the cursor stays put, the
   * way deleting trailing garbage works in any editor. Otherwise it steps back
   * one position as it always did — and stepping back over a space that still
   * has extras in front of it leaves those extras standing.
   */
  const handleBackspace = (at: Timestamp): void => {
    const here = state.cursorIndex
    let index: number

    if ((state.extras[here] ?? 0) > 0) {
      state.extras[here] = (state.extras[here] ?? 1) - 1
      index = here
      state.characterStates[here] = (state.extras[here] ?? 0) > 0 ? 'incorrect' : 'pending'
    } else {
      // At the start there is nothing to delete. Not an error, just nothing —
      // so no keystroke is recorded and no metric moves.
      if (here <= 0) return

      index = here - 1
      state.cursorIndex = index
      state.characterStates[index] = (state.extras[index] ?? 0) > 0 ? 'incorrect' : 'pending'
    }

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

  /**
   * Deletes back to the start of the previous word.
   *
   * Recorded as **one** keystroke, not one per character removed. That is what
   * happened — a single key — and it is the difference between measuring the
   * typist and measuring the implementation: five synthetic events sharing a
   * timestamp would put a run of zero-millisecond gaps into the very rhythm
   * data this engine exists to produce.
   *
   * Extras go with the word they belong to: from a boundary holding extra
   * characters, one press clears the word and everything typed after it.
   */
  const handleWordDelete = (at: Timestamp): void => {
    const here = state.cursorIndex
    const holdingExtras = (state.extras[here] ?? 0) > 0

    const index = findWordDeleteIndex(state.characters, here)
    if (index >= here && !holdingExtras) return

    const end = holdingExtras ? here + 1 : here
    for (let position = index; position < end; position += 1) {
      state.extras[position] = 0
      state.characterStates[position] = 'pending'
    }

    state.cursorIndex = index
    invalidate()

    // As with a single backspace, `typedCount` and `correctKeystrokes` do not
    // move. Accuracy is over attempts made, and deleting an attempt does not
    // unmake it.
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
      state.lastInputAt = at
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
      registerInput()

      if (backspace) handleBackspace(at)
      else handleCharacter(key, at)

      checkCompletion(at)
      notify()
    },

    deleteWord: (at) => {
      if (state.status !== 'running') return

      advanceClock(at)
      registerInput()
      handleWordDelete(at)
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
      // A deliberate resume starts a fresh idle window.
      state.lastInputAt = state.lastKnownAt
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

/**
 * The persisted session record, and the interface that stores it.
 *
 * This is the layer between the typing engine and whatever holds the data:
 *
 *   engine → SessionResult → session service → SessionRepository → storage
 *
 * `SessionRepository` is the seam that matters. Everything above it deals in
 * `TypingSession` objects; everything below it deals in bytes. A server-backed
 * implementation later replaces one file and changes nothing else.
 */

import type {
  HoverDifficulty,
  Milliseconds,
  SessionId,
  SessionMetrics,
  SessionStatus,
  Timestamp,
} from '@core/types'

/**
 * How the test was set up.
 *
 * Only one value of each is produced today. They are in the model now because
 * adding a field to a record shape after months of history means migrating that
 * history; reserving the shape costs nothing and a migration costs a weekend.
 */
export type SessionMode = 'words' | 'time' | 'quote' | 'drill' | 'hover' | 'syllable'

/**
 * Training modes: sessions whose typing was shaped on purpose — a drill's
 * lopsided text, Hover Mode's repeated words, the Syllable Trainer's long words
 * typed in chunks — rather than ordinary practice.
 *
 * Analyses of how someone ordinarily types leave these out, so a mode built to
 * change the typing cannot quietly change the picture of it.
 */
export const TRAINING_MODES: readonly SessionMode[] = ['drill', 'hover', 'syllable']

export const isTrainingMode = (mode: SessionMode): boolean => TRAINING_MODES.includes(mode)
export type SessionDifficulty = 'normal' | 'punctuation' | 'numbers'
export type KeyboardLayout = 'qwerty' | 'dvorak' | 'colemak'
/** BCP 47 language tag for the practice text. */
export type LanguageCode = string

export interface SessionContext {
  readonly mode: SessionMode
  readonly difficulty: SessionDifficulty
  readonly language: LanguageCode
  readonly keyboardLayout: KeyboardLayout
  /**
   * The character sequence a drill was built around — present only when
   * `mode` is `'drill'`.
   *
   * It lives here rather than on the telemetry blob because it describes how
   * the session was *configured*, which is what this object is for. Telemetry
   * is keyed by session id, so a keystroke log is joined to its target rather
   * than carrying a second copy of it that could disagree.
   *
   * Optional, so every session already on disk still parses unchanged.
   */
  readonly targetSequence?: string
  /**
   * How long a timed test ran for, in seconds — present only when `mode` is
   * `'time'`. What the typist asked for, not what the clock measured: the
   * measurement is the session's own elapsed time.
   *
   * Optional, like `targetSequence`, so every earlier session still parses.
   */
  readonly durationSeconds?: number
  /**
   * What Hover Mode focused on — present only when `mode` is `'hover'`.
   *
   * Optional, like `targetSequence`, so every earlier session still parses.
   */
  readonly hover?: HoverSessionRecord
}

/**
 * One word Hover Mode focused on after a mistake, and how its repetitions went.
 *
 * Counts are of repetitions of the word, each typed through the typing engine
 * and judged by it: a repetition is clean when the engine recorded no mistake in
 * it. See GGTYPING.md for the rules that produce these numbers.
 */
export interface HoverFocusRecord {
  /** The word, as it appears in the text. */
  readonly word: string
  /** Its position among the text's words, counting from 0. */
  readonly wordIndex: number
  /**
   * The repetitions the focus asked for by its end. For Standard and All In, the
   * length of its cycles, clean or not: 3 or 6. For Tired, the clean repetitions
   * required: 3, plus 3 per repetition with a mistake, never more than 10.
   */
  readonly required: number
  /** Cycles of repetitions the focus went through. */
  readonly cycles: number
  /** Repetitions typed, clean or not. */
  readonly attempts: number
  /** Clean repetitions. */
  readonly successes: number
  /** Repetitions with at least one mistake in them. */
  readonly failures: number
  /** Wrong keystrokes on the word: in the text, and in every repetition. */
  readonly mistakes: number
  /** Whether the word cleared by its difficulty's rule. */
  readonly cleared: boolean
  /** Whether the focus stopped at a safety limit rather than clearing. */
  readonly limitReached: boolean
  /** Whether the word went into Golden Nuggets when the focus ended. */
  readonly goldenNugget: boolean
  /** From the mistake that started the focus to its end. */
  readonly focusMs: number
}

export interface HoverSessionRecord {
  /**
   * The difficulty the test was typed at. Absent on the few Hover Mode sessions
   * saved before there were difficulties.
   */
  readonly difficulty?: HoverDifficulty
  /** In the order they happened. Empty when nothing needed a focus. */
  readonly focuses: readonly HoverFocusRecord[]
}

/**
 * One finished test, as stored.
 *
 * `completedAt` is wall-clock epoch milliseconds — the engine's own timestamps
 * are relative to page load and cannot be shown as a date. `startedAt` is
 * derived from it and the duration.
 *
 * Keystrokes are deliberately *not* stored. They are what makes a session
 * replayable, but at roughly 80 bytes each a single test would outweigh the
 * rest of the record fifty times over, and browser storage is measured in a few
 * megabytes. When replay is worth building, it gets its own store.
 */
export interface TypingSession {
  readonly id: SessionId
  readonly startedAt: Timestamp
  readonly completedAt: Timestamp
  readonly durationMs: Milliseconds

  /** The text the typist was given. */
  readonly text: string
  /** Which provider produced it. */
  readonly textSourceId: string

  readonly context: SessionContext
  readonly metrics: SessionMetrics

  readonly status: Extract<SessionStatus, 'completed' | 'abandoned'>
}

/**
 * Storage for finished sessions.
 *
 * Ordering is part of the contract, not an accident of the implementation:
 * `getRecent` and `getAll` both return newest first, by `completedAt`
 * descending. Anything relying on that order can do so safely.
 */
export interface SessionRepository {
  save(session: TypingSession): Promise<void>
  getById(id: SessionId): Promise<TypingSession | null>
  /** Newest first, at most `limit` records. */
  getRecent(limit: number): Promise<readonly TypingSession[]>
  /** Newest first. */
  getAll(): Promise<readonly TypingSession[]>
  /**
   * How many sessions are stored, from the index alone.
   *
   * A list screen shows the most recent few; this is what lets it say how many
   * exist in total without reading every record to find out.
   */
  count(): Promise<number>
  /** Removing an absent session is not an error. */
  remove(id: SessionId): Promise<void>
  clear(): Promise<void>
}

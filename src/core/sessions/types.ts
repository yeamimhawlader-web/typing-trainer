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
export type SessionMode = 'words' | 'time' | 'quote' | 'drill'
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
  /** Removing an absent session is not an error. */
  remove(id: SessionId): Promise<void>
  clear(): Promise<void>
}

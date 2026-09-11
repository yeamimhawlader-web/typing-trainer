/**
 * Session data — the hand-off format between the typing engine and everything
 * downstream of it (persistence, then analytics).
 *
 * This is intentionally a plain data shape with no behaviour. It is the
 * narrowest contract that lets the engine be replaced without touching storage,
 * and storage be replaced without touching the engine.
 */

import type { Accuracy, Milliseconds, SessionId, Timestamp, Wpm } from './primitives.ts'

/** Lifecycle of a session, owned by the engine. */
export type SessionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'abandoned'

/** Per-character outcome, used for both rendering and analytics. */
export type CharacterState = 'pending' | 'correct' | 'incorrect' | 'corrected'

/**
 * What kind of input an event was.
 *
 * Backspaces are recorded — a replay of the session needs them — but they are
 * not attempts at a character, so they are excluded from speed and accuracy.
 * Without this distinction a backspace would have to be stored as an
 * "incorrect character", which would quietly corrupt both metrics.
 */
export type KeystrokeKind = 'character' | 'backspace'

/**
 * A single input event.
 *
 * `at` is an offset from the session start, not a wall-clock time. Offsets are
 * immune to clock changes mid-session, compress well, and are what every
 * latency and rhythm metric actually needs. Paused time is excluded, so the
 * offsets describe time spent typing.
 */
export interface Keystroke {
  readonly kind: KeystrokeKind
  /** The character produced, or the control key name (e.g. 'Backspace'). */
  readonly key: string
  /** The character expected at this position; null for a backspace. */
  readonly expected: string | null
  /** Zero-based index into the target text that this event acted on. */
  readonly index: number
  /** Whether the key matched what was expected. Always false for a backspace. */
  readonly correct: boolean
  readonly at: Milliseconds
}

/** What the typist was asked to reproduce, and where it came from. */
export interface SessionTarget {
  readonly text: string
  /** Identifier of the text source, for later attribution and filtering. */
  readonly sourceId: string
}

/**
 * Everything measured about a session.
 *
 * Defined once and reused by both the engine's result and the persisted
 * session record. That is deliberate: if these fields were listed separately in
 * each place, the two would drift, and "what the screen showed" and "what was
 * stored" would eventually disagree about the same test.
 */
export interface SessionMetrics {
  /** Speed counting only characters that ended up correct. */
  readonly netWpm: Wpm
  /** Speed counting every character typed, right or wrong. */
  readonly rawWpm: Wpm
  readonly accuracy: Accuracy

  /** Characters in the target text. */
  readonly totalCharacters: number
  /** Character attempts made, excluding backspaces. */
  readonly typedCharacters: number
  /** Characters correct at the end, including ones fixed after a mistake. */
  readonly correctCharacters: number
  /** Characters still wrong at the end. */
  readonly incorrectCharacters: number
  /** Characters that were wrong, then fixed. A subset of `correctCharacters`. */
  readonly correctedCharacters: number
  /** Mistakes ever made, including ones later corrected. */
  readonly errorCount: number
}

/**
 * The complete, immutable record of a finished session, as the engine sees it.
 *
 * Note that `startedAt` here is on the engine's clock, which the UI drives from
 * `performance.now()` — milliseconds since the page loaded, not a wall-clock
 * date. Turning a result into something dateable is the session factory's job.
 */
export interface SessionResult {
  readonly id: SessionId
  readonly startedAt: Timestamp
  readonly durationMs: Milliseconds
  readonly target: SessionTarget
  readonly keystrokes: readonly Keystroke[]
  readonly metrics: SessionMetrics
  readonly status: Extract<SessionStatus, 'completed' | 'abandoned'>
}

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
 * A single input event.
 *
 * `at` is an offset from the session start, not a wall-clock time. Offsets are
 * immune to clock changes mid-session, compress well, and are what every
 * latency and rhythm metric actually needs.
 */
export interface Keystroke {
  /** The character produced, or the control key name (e.g. 'Backspace'). */
  readonly key: string
  /** The character that was expected at this position, null past the end. */
  readonly expected: string | null
  /** Zero-based index into the target text. */
  readonly index: number
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
 * The complete, immutable record of a finished session.
 * This is what gets persisted, and the only input analytics will consume.
 */
export interface SessionResult {
  readonly id: SessionId
  readonly startedAt: Timestamp
  readonly durationMs: Milliseconds
  readonly target: SessionTarget
  readonly keystrokes: readonly Keystroke[]
  /** Raw speed, counting every character typed. */
  readonly grossWpm: Wpm
  /** Speed after an error penalty — the number worth training against. */
  readonly netWpm: Wpm
  readonly accuracy: Accuracy
  readonly status: Extract<SessionStatus, 'completed' | 'abandoned'>
}

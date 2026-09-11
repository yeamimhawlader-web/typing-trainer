/**
 * The typing engine contract.
 *
 * This file defines the boundary. There is no implementation yet, and that is
 * deliberate — the next task builds it against this interface.
 *
 * The engine is plain TypeScript: no React, no DOM, no timers owned internally.
 * Three consequences, all of them the reason the boundary exists:
 *
 *   - It is tested by feeding it a list of keystrokes and asserting on the
 *     result. No rendering, no fake browser, no flake.
 *   - Time is passed *in* rather than read from a clock inside, so a session
 *     can be replayed deterministically from stored keystrokes. That is what
 *     makes recomputing historical statistics under a changed metric possible.
 *   - The UI can be rewritten, or a second one added, without touching it.
 *
 * The shape is a snapshot store: mutate internally, expose an immutable
 * snapshot, notify subscribers. React binds to this through
 * `useSyncExternalStore` with no adapter layer and no re-render per keystroke
 * beyond what actually changed.
 *
 * Kept deliberately minimal. Extend it when an implementation demands it, not
 * in anticipation.
 */

import type {
  Accuracy,
  CharacterState,
  Keystroke,
  Milliseconds,
  SessionResult,
  SessionStatus,
  SessionTarget,
  Timestamp,
  Wpm,
} from '@core/types'

export type Unsubscribe = () => void

/** An immutable view of engine state, safe to hand straight to a renderer. */
export interface EngineSnapshot {
  readonly status: SessionStatus
  readonly target: SessionTarget
  /** Index of the character awaiting input. */
  readonly cursorIndex: number
  /** Per-character outcome, parallel to `target.text`. */
  readonly characterStates: readonly CharacterState[]
  readonly keystrokes: readonly Keystroke[]
  readonly elapsedMs: Milliseconds
  readonly liveWpm: Wpm
  readonly accuracy: Accuracy
}

export interface TypingEngine {
  /** Loads a target and moves to 'running'. Resets any previous session. */
  start(target: SessionTarget, at: Timestamp): void

  /**
   * Feeds one input event. `at` is supplied by the caller rather than read from
   * a clock internally — see the note on determinism above.
   */
  input(key: string, at: Timestamp): void

  pause(at: Timestamp): void
  resume(at: Timestamp): void

  /** Ends the session, whether finished or given up on. */
  finish(at: Timestamp, status: Extract<SessionStatus, 'completed' | 'abandoned'>): void

  getSnapshot(): EngineSnapshot

  subscribe(listener: () => void): Unsubscribe

  /** The persistable record, available once the session has ended. */
  toResult(): SessionResult | null
}

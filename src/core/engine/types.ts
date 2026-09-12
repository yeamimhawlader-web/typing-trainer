/**
 * The typing engine's public surface.
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
 * `useSyncExternalStore` with no adapter layer in between.
 */

import type {
  Accuracy,
  CharacterState,
  Keystroke,
  Milliseconds,
  SessionId,
  SessionResult,
  SessionStatus,
  SessionTarget,
  Timestamp,
  Wpm,
} from '@core/types'

import type { WordRange } from './words.ts'

export type Unsubscribe = () => void

/** The key name the engine interprets as a deletion. */
export const BACKSPACE = 'Backspace'

/**
 * An immutable view of engine state, safe to hand straight to a renderer.
 *
 * Everything a UI needs is here, already derived. A component should never
 * need to recompute a statistic, scan the character array, or work out which
 * word the cursor is in — if it does, the missing value belongs in here.
 */
export interface EngineSnapshot {
  readonly status: SessionStatus
  readonly target: SessionTarget

  /** The target split into code points. Indices below refer to this array. */
  readonly characters: readonly string[]
  /** Per-character outcome, parallel to `characters`. */
  readonly characterStates: readonly CharacterState[]
  /** Index of the character awaiting input; equals length when at the end. */
  readonly cursorIndex: number

  /** Word boundaries of the target, computed once when it is loaded. */
  readonly words: readonly WordRange[]
  /** Word the cursor is working on; -1 when the target has no words. */
  readonly currentWordIndex: number

  /** Every input event so far, in order, including backspaces. */
  readonly keystrokes: readonly Keystroke[]

  /** Characters currently correct, including ones fixed after an error. */
  readonly correctCount: number
  /** Characters currently wrong and not yet fixed. */
  readonly incorrectCount: number
  /** Characters that were wrong and then fixed. A subset of `correctCount`. */
  readonly correctedCount: number
  /** Character keystrokes attempted, excluding backspaces. */
  readonly typedCount: number
  /** Mistakes ever made, including ones later corrected. Never decreases. */
  readonly errorCount: number

  /** Time spent typing, excluding any paused intervals. */
  readonly elapsedMs: Milliseconds
  /** Speed counting only characters that are currently correct. */
  readonly netWpm: Wpm
  /** Speed counting every character typed, right or wrong. */
  readonly rawWpm: Wpm
  readonly accuracy: Accuracy
  /**
   * True while a running session has had no input for longer than the gap
   * cap, so the clock has stopped counting. Always false without a cap.
   */
  readonly idle: boolean
}

/**
 * Something worth reacting to, as opposed to the continuous state above.
 *
 * A UI renders from the snapshot; it uses events for the things that are
 * moments rather than states — playing a sound on an error, or navigating away
 * when a session completes.
 */
export type EngineEvent =
  | { readonly type: 'started'; readonly at: Timestamp }
  | {
      readonly type: 'keystroke'
      readonly keystroke: Keystroke
      readonly at: Timestamp
    }
  | {
      readonly type: 'word-completed'
      readonly word: WordRange
      readonly at: Timestamp
    }
  | { readonly type: 'paused'; readonly at: Timestamp }
  | { readonly type: 'resumed'; readonly at: Timestamp }
  | {
      readonly type: 'finished'
      readonly status: FinishedStatus
      readonly result: SessionResult
      readonly at: Timestamp
    }
  | { readonly type: 'reset' }

export type EngineEventListener = (event: EngineEvent) => void

export type FinishedStatus = Extract<SessionStatus, 'completed' | 'abandoned'>

/**
 * Decides when a session is over.
 *
 * This is the seam that lets training modes share one engine. The default ends
 * a session when the last character is typed. A timed mode supplies
 * `(s) => s.elapsedMs >= 60_000`; a word-count mode counts finished words. None
 * of them require a change inside the engine.
 */
export type CompletionPolicy = (snapshot: EngineSnapshot) => boolean

export interface TypingEngineOptions {
  /** Defaults to "every character has been typed". */
  readonly isComplete?: CompletionPolicy
  /** Overridable so tests can assert on a fixed session id. */
  readonly createSessionId?: () => SessionId
  /**
   * Longest gap between inputs that is charged to the session clock.
   *
   * A longer gap counts as exactly this long; the rest is treated as paused.
   * Unset means no cap, which is what a timed mode needs — its clock has to run
   * whether or not anyone is typing. See `IDLE_GAP_CAP_MS` for the value the
   * word-count screen uses.
   */
  readonly maxGapMs?: number
}

/**
 * The idle rule for ordinary practice: any single gap between keystrokes counts
 * as at most three seconds.
 *
 * Three seconds is long enough that no real hesitation reaches it — at 130 WPM
 * a keystroke gap is under a tenth of a second, and a pause to find a word or
 * shift hands is well under two — and short enough that walking away mid-test
 * cannot quietly wreck a result. Before this, eight seconds away saved a
 * 130 WPM test as 80 WPM with nothing to show why.
 *
 * A cap rather than discarding the test, and a cap rather than stopping the
 * clock the moment typing stops: the test stays valid, real hesitation is
 * still counted in full, and the most an interruption can cost is three
 * seconds however long it lasted. Applied to every gap, including the one
 * after a background tab, because it is computed from timestamps when the next
 * key arrives rather than from a timer that a hidden tab may not run.
 */
export const IDLE_GAP_CAP_MS = 3_000

export interface TypingEngine {
  /** Loads a target and moves to 'running', discarding any previous session. */
  start(target: SessionTarget, at: Timestamp): void

  /**
   * Feeds one input event.
   *
   * Accepts a single character or `BACKSPACE`. Any other key name — 'Shift',
   * 'ArrowLeft' — is ignored, so a UI can forward keyboard events without
   * filtering them first. Input is also ignored unless a session is running.
   */
  input(key: string, at: Timestamp): void

  /**
   * Deletes back to the start of the previous word — Ctrl+Backspace.
   *
   * Whitespace immediately behind the cursor is consumed first, so from just
   * after a finished word the space and the word go together, as they do in a
   * text editor. At the very start there is nothing to delete, which is not an
   * error and records nothing.
   *
   * Recorded as one keystroke however many characters it removes. The span is
   * still recoverable from the log, because the index is where the cursor
   * landed and the event before it says where the cursor was.
   */
  deleteWord(at: Timestamp): void
  /**
   * Advances the clock without any input.
   *
   * The engine owns no timer, so a mode that ends on elapsed time needs the
   * caller to drive this; otherwise a typist who stops typing would stop time.
   */
  tick(at: Timestamp): void

  pause(at: Timestamp): void
  resume(at: Timestamp): void

  /** Ends the session, whether finished or given up on. */
  finish(at: Timestamp, status: FinishedStatus): void

  /** Returns to 'idle', clearing progress. The target stays loaded. */
  reset(): void

  getSnapshot(): EngineSnapshot

  /** Snapshot-change subscription, shaped for `useSyncExternalStore`. */
  subscribe(listener: () => void): Unsubscribe

  /** Discrete event subscription. */
  on(listener: EngineEventListener): Unsubscribe

  /** The persistable record, available once the session has ended. */
  toResult(): SessionResult | null
}

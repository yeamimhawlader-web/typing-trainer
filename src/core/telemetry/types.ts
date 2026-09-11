/**
 * Typing telemetry.
 *
 *   keyboard → engine → Keystroke[] → telemetry record → stored → analytics
 *
 * The engine already records the irreducible facts about every input event:
 * what was pressed, what was expected there, which position it acted on,
 * whether it matched, and when it happened on the session clock. **Everything
 * else in this file is derived from those plus the target text** — word index,
 * position within the word, every latency, and which errors were later fixed.
 *
 * That is the whole performance story. Telemetry adds nothing to the typing
 * path: no extra work per keystroke, no extra allocation, no storage write. The
 * derivation runs once, after the last character, on data the engine had
 * collected anyway.
 *
 * ## What is not here, and why
 *
 * No finger, hand, or key-position information. The browser reports which
 * character arrived, not which finger produced it; a typist may use any layout,
 * any technique, or one hand. Inferring anatomy from characters would be
 * invention dressed as measurement.
 *
 * Timing precision is whatever the browser gives. `performance.now()` is
 * coarsened deliberately by browsers — commonly to 100µs, sometimes to 1ms — so
 * these numbers are milliseconds with sub-millisecond noise, not microsecond
 * measurements. Nothing here rounds them up into precision that was never
 * there.
 */

import type { Milliseconds } from '@core/types'

/**
 * One input event, enriched.
 *
 * Positions are code-point indices into the target text, matching the engine.
 */
export interface KeystrokeTelemetry {
  readonly kind: 'character' | 'backspace'
  /** The character produced, or 'Backspace'. */
  readonly key: string
  /** The character expected at this position; null for a backspace. */
  readonly expected: string | null
  /** Whether the key matched what was expected. Always false for a backspace. */
  readonly correct: boolean
  /** Milliseconds since the session started, excluding paused time. */
  readonly at: Milliseconds

  /** Code-point index into the target this event acted on. */
  readonly index: number
  /** Word containing that index, or -1 when the position is whitespace. */
  readonly wordIndex: number
  /** Offset within that word, or -1 when the position is whitespace. */
  readonly indexInWord: number

  /**
   * Time since the previous input event of **any** kind, backspaces included.
   * Null for the first event. This is the raw rhythm of the hands.
   */
  readonly interKeystrokeMs: number | null

  /**
   * Time since the previous **character** event, skipping backspaces. Null for
   * the first character.
   *
   * Distinct from `interKeystrokeMs` on purpose: after a correction the two
   * differ by the whole time spent correcting, and a digraph timing built from
   * the wrong one would be silently wrong.
   */
  readonly sincePreviousCharacterMs: number | null

  /** True when a later correct character landed on this same position. */
  readonly correctedLater: boolean
}

/**
 * One word of the target, and what happened while typing it.
 *
 * Present for every word, including words never reached — those have null times
 * and zero counts, which is the honest record of "not attempted".
 */
export interface WordTelemetry {
  readonly wordIndex: number
  readonly text: string
  /** Code-point range of the word in the target, end exclusive. */
  readonly start: number
  readonly end: number

  readonly firstKeystrokeAt: Milliseconds | null
  readonly lastKeystrokeAt: Milliseconds | null
  /** `lastKeystrokeAt - firstKeystrokeAt`. Null when fewer than two events. */
  readonly typingDurationMs: number | null

  /** Character attempts made inside this word, mistakes included. */
  readonly characterKeystrokes: number
  /** Backspaces that acted on a position inside this word. */
  readonly backspaces: number
  /** Incorrect character attempts inside this word. */
  readonly errors: number
  /** Of those, the ones a later correct keystroke fixed. */
  readonly correctedErrors: number

  /**
   * Gap between the event immediately before this word's first character and
   * that first character — the hesitation before starting the word. Null for
   * the first word typed. Usually measured from the preceding space.
   */
  readonly pauseBeforeMs: number | null

  /**
   * Gap between this word's last character and the next event of any kind —
   * usually the space after it. Null for the last word typed.
   */
  readonly pauseAfterMs: number | null
}

/**
 * One incorrect character attempt, and what became of it.
 *
 * A record per *error*, not per position: typing a position wrongly twice
 * produces two records, which is what makes "how often does this happen"
 * answerable later.
 */
export interface CorrectionTelemetry {
  /** Position that was typed wrongly. */
  readonly index: number
  readonly wordIndex: number
  readonly typedKey: string
  readonly expectedKey: string
  readonly errorAt: Milliseconds

  /** Backspaces on this position between the error and its correction. */
  readonly backspaces: number
  readonly firstBackspaceAt: Milliseconds | null
  /** When a correct character finally landed here; null if it never did. */
  readonly correctedAt: Milliseconds | null

  /**
   * `firstBackspaceAt - errorAt`: how long the mistake went unnoticed.
   * Null when it was never backspaced over.
   */
  readonly detectionLatencyMs: number | null
  /**
   * `correctedAt - errorAt`: the whole cost of the mistake, noticing and
   * retyping together. Null when it was never corrected.
   */
  readonly correctionLatencyMs: number | null

  readonly outcome: 'corrected' | 'uncorrected'
}

/** Counts, so a reader does not have to walk the arrays to get its bearings. */
export interface TelemetrySummary {
  readonly keystrokeCount: number
  readonly characterKeystrokes: number
  readonly backspaceCount: number
  readonly errorCount: number
  readonly correctedErrorCount: number
  readonly uncorrectedErrorCount: number
  /** Session-relative time of the last event. */
  readonly lastEventAt: Milliseconds | null
}

/** The full, derived telemetry for one session. */
export interface SessionTelemetry {
  readonly keystrokes: readonly KeystrokeTelemetry[]
  readonly words: readonly WordTelemetry[]
  readonly corrections: readonly CorrectionTelemetry[]
  readonly summary: TelemetrySummary
}

/**
 * The compact form that goes to storage.
 *
 * One tuple per event: `[millisecondsSincePreviousEvent, position, key]`, where
 * an empty key means a backspace. Nothing derivable is stored — no `expected`,
 * no `correct`, no word index, no latency — because all of it can be rebuilt
 * from the position and the session's own text, and storing it would multiply
 * the cost of a record by roughly ten for no new information.
 *
 * Times are deltas rather than absolutes: consecutive keystrokes differ by two
 * or three digits where absolute times reach five or six.
 *
 * See `STORAGE_COST` for what this works out to per thousand characters.
 */
export type StoredKeystroke = readonly [deltaMs: number, index: number, key: string]

export interface StoredTelemetry {
  /** Bumped when this encoding changes incompatibly. */
  readonly version: number
  readonly keystrokes: readonly StoredKeystroke[]
}

export const TELEMETRY_VERSION = 1

/**
 * Storage a session's telemetry costs, measured rather than estimated — see the
 * test that asserts these numbers stay true.
 *
 * Roughly 13 bytes of JSON per event. A thousand characters of typing with a
 * realistic sprinkling of corrections is about 1,050 events, so about **14 kB
 * per 1,000 characters** — against roughly 400 bytes for the session record
 * itself.
 *
 * That ratio is why telemetry is stored apart from sessions and kept only for
 * recent ones.
 */
export const STORAGE_COST = {
  approximateBytesPerEvent: 13,
  approximateBytesPerThousandCharacters: 14_000,
} as const

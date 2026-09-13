/**
 * What happened to the target transition during a drill.
 *
 * The same measurement as everywhere else in this module — a clean pair, timed
 * by the second keystroke's `sincePreviousCharacterMs` — narrowed to one
 * sequence. Nothing new is defined here, which is the point: a drill result
 * that used a different timing rule from the analysis that prompted the drill
 * could not be compared with it.
 *
 * Two counts are reported, and the gap between them is the interesting part:
 *
 * - `targetOccurrences` is how many times the sequence appears in the drill
 *   text — the opportunities the drill offered.
 * - `correctTransitions` is how many were actually typed cleanly, and so
 *   measured. Mistyping one, correcting it, or pausing across it removes it.
 *
 * A drill with 24 occurrences and 18 clean transitions says something a single
 * median does not: a quarter of the attempts were not clean.
 */

import { countOccurrences } from '@core/text'

import { median } from './distribution.ts'
import type { TypicalRange } from './persistent.ts'
import { collectCleanTransitions } from './sequences.ts'
import type { SessionTelemetry } from './types.ts'

export interface DrillOutcome {
  readonly sequence: string
  /** Times the sequence appears in the drill text — the chances it gave. */
  readonly targetOccurrences: number
  /** Of those, the ones typed cleanly enough to time. */
  readonly correctTransitions: number
  /** Median of those timings; null when none were clean. */
  readonly medianMs: number | null
  /**
   * Median of *every* clean transition in the drill.
   *
   * The drill's own baseline, so the target can be read against the rest of the
   * same session rather than only against history typed on another day.
   */
  readonly sessionMedianMs: number | null
}

/**
 * Measures one sequence within a finished drill.
 *
 * `text` is the drill's target text, which is where the occurrence count comes
 * from — the keystroke log only says what was typed, not what was asked for.
 */
export const measureDrill = (
  telemetry: SessionTelemetry,
  text: string,
  sequence: string,
): DrillOutcome => {
  const { bySequence, all } = collectCleanTransitions(telemetry)
  const timings = bySequence.get(sequence) ?? []

  return {
    sequence,
    targetOccurrences: countOccurrences(text, sequence),
    correctTransitions: timings.length,
    medianMs: timings.length === 0 ? null : median(timings),
    sessionMedianMs: all.length === 0 ? null : median(all),
  }
}

export interface DrillComparison {
  /** The typist's median for this sequence before the drill; null when new. */
  readonly baselineMs: number | null
  readonly drillMs: number | null
  /**
   * `drillMs - baselineMs`. Negative is faster in the drill.
   *
   * A difference between two medians, not evidence of anything durable. One
   * drill against a handful of prior sessions cannot separate improvement from
   * a good five minutes, and nothing here converts it into a percentage — a
   * percentage of a number this noisy reads as precision that is not present.
   */
  readonly differenceMs: number | null
  /** Where this sequence usually falls in ordinary tests; null when unknown. */
  readonly typicalRangeMs: TypicalRange | null
  /**
   * The drill's median against that range: `within` it, or `faster` or `slower`
   * than it. Null when either is missing.
   *
   * This is the noise band the difference alone lacks. A few milliseconds either
   * way is what an unchanged typist produces, and a screen that shows "−9 ms"
   * with nothing beside it invites reading that as progress.
   */
  readonly placement: 'within' | 'faster' | 'slower' | null
}

export const compareToBaseline = (
  outcome: DrillOutcome,
  baselineMs: number | null,
  typicalRangeMs: TypicalRange | null = null,
): DrillComparison => {
  const drillMs = outcome.medianMs

  return {
    baselineMs,
    drillMs,
    differenceMs: baselineMs === null || drillMs === null ? null : drillMs - baselineMs,
    typicalRangeMs,
    placement:
      typicalRangeMs === null || drillMs === null
        ? null
        : drillMs < typicalRangeMs.lowMs
          ? 'faster'
          : drillMs > typicalRangeMs.highMs
            ? 'slower'
            : 'within',
  }
}

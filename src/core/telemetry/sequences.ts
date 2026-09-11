/**
 * Slowest observed character sequences.
 *
 * The first experiment in reading something useful out of telemetry: which
 * two-character transitions took longest, from one session.
 *
 * ## What counts as an observation
 *
 * A digraph observation is a pair of character events that is **clean** — every
 * one of these must hold, and each excludes a specific way the number would
 * otherwise lie:
 *
 * 1. **Adjacent in the keystroke log.** Nothing happened between them, so no
 *    backspace or other event is hiding inside the interval.
 * 2. **Consecutive positions** (`index`, then `index + 1`). This is what
 *    excludes a retype after a correction: a retype lands on the position it is
 *    fixing, so it does not follow the position before it.
 * 3. **Both typed correctly.** A mistyped character measures the wrong
 *    transition — the one the fingers actually made, not the one in the text.
 * 4. **Neither is whitespace.** The gap across a space is dominated by
 *    hesitation before the next word, which is a different phenomenon and
 *    already recorded as `pauseBeforeMs` on the word. Mixing it in here would
 *    fill the slowest list with word starts.
 *
 * The timing is the second keystroke's `sincePreviousCharacterMs` — an existing
 * telemetry definition, not a new one. Under condition 1 it equals
 * `interKeystrokeMs`, and there is a test asserting exactly that.
 *
 * ## What this therefore is not
 *
 * It measures how fast a transition is **when typed correctly**. A digraph
 * fumbled every time simply has few observations, not a large timing. So this
 * finds slow sequences, not difficult ones — which is why nothing here calls
 * them weaknesses.
 */

import type { KeystrokeTelemetry, SessionTelemetry } from './types.ts'

/**
 * Fewest observations a sequence needs before it can be ranked.
 *
 * At three, a median is the middle of three numbers and one yawn sets it. Five
 * is the point where a median starts describing a spread rather than an
 * incident — still small, and chosen for an experiment rather than derived from
 * anything. It is the number most worth arguing with once there is real data.
 *
 * Measured, rather than assumed: a 60-word test at ~130 WPM produces about
 * 180-190 clean transitions spread over ~100 distinct sequences, and only two
 * to eight of those reach five observations. The single most common digraph in
 * a given text often occurs exactly five times, so one mistype drops it below
 * the line. That is the real scale of this experiment — one session barely
 * supports the question, which is the most useful thing it has shown so far.
 */
export const MINIMUM_OBSERVATIONS = 5

export interface SequenceTiming {
  /** The two characters, in order. */
  readonly sequence: string
  /** Middle timing of its observations, in milliseconds. */
  readonly medianMs: number
  readonly observations: number
  /**
   * `medianMs` minus the median of every clean transition in the session.
   * Positive means slower than this typist's own typical transition, which is a
   * more honest comparison than any absolute number.
   */
  readonly deltaMs: number
}

export interface SequenceReport {
  /** Every sequence meeting the observation threshold, slowest first. */
  readonly ranked: readonly SequenceTiming[]

  /**
   * The subset of `ranked` that was actually slower than this typist's own
   * median transition. **This is what a screen should show.**
   *
   * The distinction matters more than it looks. Sorting alone will always
   * produce a top entry, so a session where only one sequence clears the
   * threshold presents it as "slowest observed" even when it is faster than
   * everything else — seen in a real run, where the sole entry was 71 ms
   * against an 85 ms median. Topping a list of one is not evidence of
   * being slow.
   */
  readonly slowerThanTypical: readonly SequenceTiming[]
  /** Median of every clean transition in the session; null when there are none. */
  readonly overallMedianMs: number | null
  /** Clean transitions measured, before grouping. */
  readonly sampleSize: number
  /** Distinct sequences seen, whether or not they met the threshold. */
  readonly distinctSequences: number
  /** The threshold applied, so a reader knows what was excluded. */
  readonly minimumObservations: number
}

export interface SequenceOptions {
  readonly minimumObservations?: number
}

const isWhitespace = (value: string | null): boolean =>
  value === null || /\s/u.test(value)

/** True when this pair may be timed. See the conditions at the top of the file. */
const isCleanPair = (
  previous: KeystrokeTelemetry,
  current: KeystrokeTelemetry,
): boolean =>
  previous.kind === 'character' &&
  current.kind === 'character' &&
  previous.correct &&
  current.correct &&
  current.index === previous.index + 1 &&
  !isWhitespace(previous.key) &&
  !isWhitespace(current.key) &&
  current.sincePreviousCharacterMs !== null

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 1
    ? (sorted[middle] as number)
    : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
}

/**
 * Ranks the session's slowest clean two-character transitions.
 *
 * Ordering is total and reproducible: slowest first, then by how often the
 * sequence was seen, then alphabetically. Two sequences with identical timings
 * never swap places between runs.
 */
export const analyseSlowSequences = (
  telemetry: SessionTelemetry,
  options: SequenceOptions = {},
): SequenceReport => {
  const minimumObservations = options.minimumObservations ?? MINIMUM_OBSERVATIONS
  const timings = new Map<string, number[]>()
  const all: number[] = []

  for (let position = 1; position < telemetry.keystrokes.length; position += 1) {
    const previous = telemetry.keystrokes[position - 1] as KeystrokeTelemetry
    const current = telemetry.keystrokes[position] as KeystrokeTelemetry
    if (!isCleanPair(previous, current)) continue

    const interval = current.sincePreviousCharacterMs as number
    const sequence = `${previous.key}${current.key}`

    const existing = timings.get(sequence)
    if (existing === undefined) timings.set(sequence, [interval])
    else existing.push(interval)

    all.push(interval)
  }

  const overallMedianMs = all.length === 0 ? null : median(all)

  const ranked = [...timings.entries()]
    .filter(([, intervals]) => intervals.length >= minimumObservations)
    .map(([sequence, intervals]) => {
      const medianMs = median(intervals)
      return {
        sequence,
        medianMs,
        observations: intervals.length,
        deltaMs: overallMedianMs === null ? 0 : medianMs - overallMedianMs,
      }
    })
    .sort(
      (a, b) =>
        b.medianMs - a.medianMs ||
        b.observations - a.observations ||
        a.sequence.localeCompare(b.sequence),
    )

  return {
    ranked,
    // Slower than this typist's own typical transition, or it is not a finding.
    slowerThanTypical: ranked.filter((entry) => entry.deltaMs > 0),
    overallMedianMs,
    sampleSize: all.length,
    distinctSequences: timings.size,
    minimumObservations,
  }
}

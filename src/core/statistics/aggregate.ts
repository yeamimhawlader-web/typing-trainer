/**
 * Turning sessions into figures.
 *
 * Plain functions over a readonly array. No React, no formatting, no rounding —
 * a mean is returned at full precision and whatever draws it decides how many
 * digits to show.
 */

import type { TypingSession } from '@core/sessions'

import type { SessionStatistics } from './types.ts'

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0)

/** Arithmetic mean, or null for an empty set. */
export const mean = (values: readonly number[]): number | null =>
  values.length === 0 ? null : sum(values) / values.length

/**
 * Middle value; the mean of the two middle values when the count is even.
 *
 * Sorts a copy. Sorting the argument would reorder the caller's history, which
 * is exactly the kind of quiet mutation this module must not do.
 */
export const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 1
    ? (sorted[middle] as number)
    : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
}

export const maximum = (values: readonly number[]): number | null =>
  values.length === 0 ? null : Math.max(...values)

/** Population standard deviation. Null below two values. */
export const standardDeviation = (values: readonly number[]): number | null => {
  if (values.length < 2) return null

  const average = mean(values) as number
  const variance = sum(values.map((value) => (value - average) ** 2)) / values.length
  return Math.sqrt(variance)
}

/** Linear-interpolation quantile of an already sorted list. */
const quantileOfSorted = (sorted: readonly number[], p: number): number => {
  const position = (sorted.length - 1) * p
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  const weight = position - lower
  return (sorted[lower] as number) * (1 - weight) + (sorted[upper] as number) * weight
}

/**
 * The display guard for averages: which sessions are far outside the rest.
 *
 * ## What it does
 *
 * Tukey's rule for a "far out" value: more than three interquartile ranges
 * below the first quartile or above the third, measured on the typist's own
 * speeds in the range being shown. Those sessions are left out of the average,
 * the average raw speed and consistency — and **nothing else**. The median, the
 * best, the counts, the totals and the trend charts all still use every
 * session, and no stored measurement is changed.
 *
 * ## Why, and why not a cap
 *
 * A mean is dominated by one extreme value. In the audit two implausible
 * sessions pushed the average to 714 WPM while the median stayed at 115, and
 * consistency collapsed to 0%. The realistic cause is the other direction — a
 * test that sat idle drags the average down — but either way one session
 * should not decide the headline.
 *
 * There is no fixed WPM limit anywhere in this. A cap would be a claim about
 * what speeds are possible; this is only a statement about which of *this
 * typist's* results are unlike their others, so a genuinely fast typist is
 * never trimmed for being fast.
 *
 * ## Two guards on the guard
 *
 * Fewer than five sessions: nothing is excluded, because quartiles of three or
 * four numbers describe nothing. And the spread used is at least a tenth of
 * the median, so a typist whose tests all came out identical does not have a
 * single different result thrown away for differing at all.
 */
export const FAR_OUT_IQR_MULTIPLE = 3
export const MINIMUM_SESSIONS_FOR_OUTLIERS = 5
export const MINIMUM_SPREAD_OF_MEDIAN = 0.1

export const splitFarOutliers = <T>(
  items: readonly T[],
  valueOf: (item: T) => number,
): { readonly kept: readonly T[]; readonly excluded: readonly T[] } => {
  if (items.length < MINIMUM_SESSIONS_FOR_OUTLIERS) return { kept: items, excluded: [] }

  const sorted = items.map(valueOf).sort((a, b) => a - b)
  const q1 = quantileOfSorted(sorted, 0.25)
  const q3 = quantileOfSorted(sorted, 0.75)
  const spread = Math.max(q3 - q1, MINIMUM_SPREAD_OF_MEDIAN * quantileOfSorted(sorted, 0.5))
  const low = q1 - FAR_OUT_IQR_MULTIPLE * spread
  const high = q3 + FAR_OUT_IQR_MULTIPLE * spread

  const kept: T[] = []
  const excluded: T[] = []
  for (const item of items) {
    const value = valueOf(item)
    if (value < low || value > high) excluded.push(item)
    else kept.push(item)
  }

  return { kept, excluded }
}

/**
 * How repeatable a set of speeds is, as a ratio in 0..1.
 *
 * `1 - (standard deviation / mean)`, clamped. A typist who hits the same speed
 * every time scores 1; one whose speed swings wildly scores near 0.
 *
 * Null below two sessions — variation across a single measurement is not a
 * small number, it is an undefined one.
 */
export const consistency = (values: readonly number[]): number | null => {
  const deviation = standardDeviation(values)
  if (deviation === null) return null

  const average = mean(values) as number
  if (average <= 0) return null

  return Math.min(1, Math.max(0, 1 - deviation / average))
}

/**
 * Rejects a record whose stored numbers cannot be used.
 *
 * The repository already drops anything that fails to parse, so this is the
 * second line: a record that is shaped correctly but holds a NaN or a negative
 * duration would otherwise turn every average in the range into NaN. One bad
 * row should cost its own row and nothing else.
 */
export const isUsableSession = (session: TypingSession): boolean => {
  const { metrics } = session
  const numbers = [
    session.durationMs,
    session.completedAt,
    metrics.netWpm,
    metrics.rawWpm,
    metrics.accuracy,
    metrics.typedCharacters,
    metrics.errorCount,
    metrics.correctedCharacters,
  ]

  return (
    numbers.every((value) => Number.isFinite(value) && value >= 0) &&
    metrics.accuracy <= 1
  )
}

/**
 * Every figure for a set of sessions, in one pass over each field.
 *
 * Expects sessions already filtered to a range and already checked with
 * `isUsableSession`; `buildStatisticsReport` does both.
 */
export const computeStatistics = (
  sessions: readonly TypingSession[],
): SessionStatistics => {
  const netWpms = sessions.map((session) => session.metrics.netWpm)
  // See `splitFarOutliers`: only the averages and consistency use this.
  const { kept: typical, excluded: farOut } = splitFarOutliers(
    sessions,
    (session) => session.metrics.netWpm,
  )
  const typicalNetWpms = typical.map((session) => session.metrics.netWpm)
  const typicalRawWpms = typical.map((session) => session.metrics.rawWpm)
  const accuracies = sessions.map((session) => session.metrics.accuracy)
  const errors = sessions.map((session) => session.metrics.errorCount)
  const corrected = sessions.map((session) => session.metrics.correctedCharacters)

  return {
    sessionCount: sessions.length,

    totalTypingTimeMs: sum(sessions.map((session) => session.durationMs)),
    totalCharactersTyped: sum(
      sessions.map((session) => session.metrics.typedCharacters),
    ),
    totalErrors: sum(errors),
    totalCorrectedCharacters: sum(corrected),

    averageWpm: mean(typicalNetWpms),
    medianWpm: median(netWpms),
    bestWpm: maximum(netWpms),
    averageRawWpm: mean(typicalRawWpms),
    excludedFromAverages: farOut.map((session) => session.metrics.netWpm),

    averageAccuracy: mean(accuracies),
    bestAccuracy: maximum(accuracies),

    averageErrorsPerSession: mean(errors),
    averageCorrectedPerSession: mean(corrected),

    wpmConsistency: consistency(typicalNetWpms),
  }
}

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
  const rawWpms = sessions.map((session) => session.metrics.rawWpm)
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

    averageWpm: mean(netWpms),
    medianWpm: median(netWpms),
    bestWpm: maximum(netWpms),
    averageRawWpm: mean(rawWpms),

    averageAccuracy: mean(accuracies),
    bestAccuracy: maximum(accuracies),

    averageErrorsPerSession: mean(errors),
    averageCorrectedPerSession: mean(corrected),

    wpmConsistency: consistency(netWpms),
  }
}

/**
 * Statistics over stored sessions.
 *
 *   TypingSession[] → statistics functions → derived statistics → UI
 *
 * Everything here is a plain value computed from records that already exist.
 * Sessions are historical facts: nothing in this module writes, reorders or
 * amends one, and the functions take `readonly` arrays so an accidental sort in
 * place is a compile error rather than a corrupted history.
 *
 * Each figure names what it is. `average*` is the arithmetic mean, `median*` the
 * middle value, `best*` the maximum, `total*` the sum. Anything that cannot be
 * computed from the sessions given — a median of nothing, a consistency from a
 * single test — is `null` rather than zero, because zero is a measurement and
 * null is the absence of one.
 */

import type { SessionId } from '@core/types'

export type TimeRangeKey = 'today' | 'last7Days' | 'last30Days' | 'allTime'

/**
 * A window of time, in epoch milliseconds, with **both ends inclusive**.
 *
 * Bounds are derived from the *local* calendar — see `range.ts` for why that
 * distinction matters and where it is easy to get wrong.
 */
export interface TimeRange {
  readonly key: TimeRangeKey
  readonly label: string
  /** Inclusive lower bound; null means unbounded. */
  readonly from: number | null
  /** Inclusive upper bound. */
  readonly to: number
}

export interface SessionStatistics {
  /** Number of sessions in range. A count. */
  readonly sessionCount: number

  /** Sum of session durations, in milliseconds. */
  readonly totalTypingTimeMs: number
  /** Sum of character attempts, mistakes included. Not text length. */
  readonly totalCharactersTyped: number
  /** Sum of mistakes made, corrections included. */
  readonly totalErrors: number
  /** Sum of characters that were wrong and then fixed. */
  readonly totalCorrectedCharacters: number

  /**
   * Arithmetic mean of session net WPM, leaving out far-out sessions — see
   * `splitFarOutliers`. Median and best use every session.
   */
  readonly averageWpm: number | null
  /** Middle value of session net WPM; the mean of the two middle values when even. */
  readonly medianWpm: number | null
  /** Maximum session net WPM. */
  readonly bestWpm: number | null
  /** Arithmetic mean of session raw WPM, over the same sessions as `averageWpm`. */
  readonly averageRawWpm: number | null
  /**
   * Net WPM of each session left out of the averages and consistency as far out
   * from the rest. Empty when none were, and always empty below five sessions.
   * Exposed so a screen can say so rather than adjusting a figure silently.
   */
  readonly excludedFromAverages: readonly number[]

  /** Arithmetic mean of session accuracy, as a ratio in 0..1. */
  readonly averageAccuracy: number | null
  /** Maximum session accuracy, as a ratio in 0..1. */
  readonly bestAccuracy: number | null

  /** Arithmetic mean of errors per session. */
  readonly averageErrorsPerSession: number | null
  /** Arithmetic mean of corrected characters per session. */
  readonly averageCorrectedPerSession: number | null

  /**
   * How repeatable speed was **across** sessions, as a ratio in 0..1.
   *
   * Derived: `1 - (standard deviation / mean)` of session net WPM, clamped,
   * over the same sessions as `averageWpm`.
   * 1 means every test came out at the same speed.
   *
   * This is deliberately not the consistency figure other typing sites show.
   * Theirs measures variation *within* a test, from per-keystroke timings —
   * which this application does not store, so computing it would mean inventing
   * it. Null below two sessions, where variation is undefined.
   */
  readonly wpmConsistency: number | null
}

/** One session's value, for a chart that plots sessions over time. */
export interface TrendPoint {
  readonly sessionId: SessionId
  /** Epoch milliseconds the session completed. */
  readonly at: number
  readonly value: number
}

/** One local calendar day's activity. */
export interface DailyPoint {
  /** Local calendar day, `YYYY-MM-DD`. Never a UTC date. */
  readonly day: string
  /** Epoch milliseconds at local midnight starting that day. */
  readonly startOfDay: number
  readonly sessionCount: number
  readonly typingTimeMs: number
  /** Arithmetic mean of that day's net WPM; null if the day has no sessions. */
  readonly averageWpm: number | null
}

/**
 * Chart-agnostic data. Plain numbers and dates, in chronological order, with no
 * pixels, scales or colours decided — those belong to whatever draws them.
 */
export interface SessionTrends {
  readonly wpm: readonly TrendPoint[]
  readonly rawWpm: readonly TrendPoint[]
  readonly accuracy: readonly TrendPoint[]
  /** One entry per day that has sessions, oldest first. */
  readonly daily: readonly DailyPoint[]
}

/** Everything the statistics page needs, from one pass over the history. */
export interface StatisticsReport {
  readonly range: TimeRange
  readonly statistics: SessionStatistics
  readonly trends: SessionTrends
  /** Records skipped because their stored numbers were unusable. */
  readonly skippedCount: number
}

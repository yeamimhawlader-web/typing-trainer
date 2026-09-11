/**
 * Statistics tests.
 *
 * Fixtures are chosen so the expected answers can be worked out by hand and
 * checked against the comment beside them — a test that asserts whatever the
 * implementation happens to return proves only that it is deterministic.
 *
 * Dates are built with `new Date(year, month, day, hour)`, which is the *local*
 * constructor. That makes every boundary test valid whatever time zone the
 * suite runs in, which is the point: the code under test works on the local
 * calendar and the test has to as well.
 */

import { describe, expect, it } from 'vitest'

import { DEFAULT_SESSION_CONTEXT, type TypingSession } from '@core/sessions'
import { accuracy, milliseconds, sessionId, timestamp, wpm } from '@core/types'

import {
  computeStatistics,
  consistency,
  isUsableSession,
  mean,
  median,
  standardDeviation,
} from './aggregate.ts'
import {
  createTimeRange,
  filterSessionsByRange,
  shiftLocalDays,
  startOfLocalDay,
  toLocalDayKey,
} from './range.ts'
import { buildStatisticsReport } from './report.ts'
import { computeTrends } from './trends.ts'

interface Fixture {
  readonly id?: string
  readonly completedAt?: number
  readonly durationMs?: number
  readonly netWpm?: number
  readonly rawWpm?: number
  readonly accuracy?: number
  readonly typedCharacters?: number
  readonly errorCount?: number
  readonly correctedCharacters?: number
}

let counter = 0

const session = (fixture: Fixture = {}): TypingSession => {
  counter += 1
  const completedAt = fixture.completedAt ?? 1_700_000_000_000

  return {
    id: sessionId(fixture.id ?? `session-${counter}`),
    startedAt: timestamp(Math.max(0, completedAt - (fixture.durationMs ?? 10_000))),
    completedAt: timestamp(completedAt),
    durationMs: milliseconds(fixture.durationMs ?? 10_000),
    text: 'the quick brown fox',
    textSourceId: 'common-words',
    context: DEFAULT_SESSION_CONTEXT,
    metrics: {
      netWpm: wpm(fixture.netWpm ?? 100),
      rawWpm: wpm(fixture.rawWpm ?? 110),
      accuracy: accuracy(fixture.accuracy ?? 0.95),
      totalCharacters: 19,
      typedCharacters: fixture.typedCharacters ?? 100,
      correctCharacters: 19,
      incorrectCharacters: 0,
      correctedCharacters: fixture.correctedCharacters ?? 2,
      errorCount: fixture.errorCount ?? 5,
    },
    status: 'completed',
  }
}

/** Local wall-clock instant, whatever zone the suite runs in. */
const localTime = (
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
  second = 0,
  ms = 0,
): number => new Date(year, month - 1, day, hour, minute, second, ms).getTime()

describe('descriptive helpers', () => {
  it('means an empty set to null rather than zero', () => {
    expect(mean([])).toBeNull()
    expect(median([])).toBeNull()
  })

  it('computes an arithmetic mean', () => {
    // (10 + 20 + 60) / 3 = 30
    expect(mean([10, 20, 60])).toBe(30)
  })

  it('takes the middle value of an odd-sized set', () => {
    expect(median([30, 10, 20])).toBe(20)
  })

  it('averages the two middle values of an even-sized set', () => {
    // sorted: 10 20 30 40 -> (20 + 30) / 2 = 25
    expect(median([40, 10, 30, 20])).toBe(25)
  })

  it('does not reorder the array it is given', () => {
    const values = [30, 10, 20]

    median(values)

    expect(values).toEqual([30, 10, 20])
  })

  it('has no standard deviation for fewer than two values', () => {
    expect(standardDeviation([])).toBeNull()
    expect(standardDeviation([100])).toBeNull()
  })

  it('computes a population standard deviation', () => {
    // mean 6; deviations -4 -2 0 2 4; squares 16 4 0 4 16 = 40; 40/5 = 8
    expect(standardDeviation([2, 4, 6, 8, 10])).toBeCloseTo(Math.sqrt(8), 10)
  })

  it('scores identical speeds as perfectly consistent', () => {
    expect(consistency([100, 100, 100])).toBe(1)
  })

  it('scores varying speeds below 1', () => {
    // mean 100, sd 10 -> 1 - 0.1 = 0.9
    expect(consistency([90, 110, 90, 110])).toBeCloseTo(0.9, 10)
  })

  it('has no consistency for a single session', () => {
    expect(consistency([120])).toBeNull()
  })

  it('clamps a wildly varying set to zero rather than going negative', () => {
    // mean 100; deviations -100 -100 200; squares 10000 10000 40000 = 60000;
    // 60000/3 = 20000; sd ≈ 141.4, so the raw formula gives about -0.41.
    expect(consistency([0, 0, 300])).toBe(0)
  })

  it('still scores a large but sub-mean spread above zero', () => {
    // For two values the deviation can never exceed the mean, so this stays
    // positive: mean 100.5, sd 99.5.
    expect(consistency([1, 200])).toBeCloseTo(1 - 99.5 / 100.5, 10)
  })
})

describe('computeStatistics', () => {
  it('reports nothing measurable for an empty history', () => {
    const stats = computeStatistics([])

    expect(stats.sessionCount).toBe(0)
    expect(stats.totalTypingTimeMs).toBe(0)
    expect(stats.totalCharactersTyped).toBe(0)
    // Absent, not zero: there is no average of no tests.
    expect(stats.averageWpm).toBeNull()
    expect(stats.medianWpm).toBeNull()
    expect(stats.bestWpm).toBeNull()
    expect(stats.averageAccuracy).toBeNull()
    expect(stats.wpmConsistency).toBeNull()
  })

  it('reports a single session without pretending to a trend', () => {
    const stats = computeStatistics([session({ netWpm: 120, accuracy: 0.98 })])

    expect(stats.sessionCount).toBe(1)
    expect(stats.averageWpm).toBe(120)
    expect(stats.medianWpm).toBe(120)
    expect(stats.bestWpm).toBe(120)
    expect(stats.bestAccuracy).toBe(0.98)
    // One test says nothing about repeatability.
    expect(stats.wpmConsistency).toBeNull()
  })

  it('computes every figure over several sessions', () => {
    const stats = computeStatistics([
      session({
        netWpm: 100,
        rawWpm: 110,
        accuracy: 0.9,
        durationMs: 10_000,
        typedCharacters: 80,
        errorCount: 8,
        correctedCharacters: 3,
      }),
      session({
        netWpm: 120,
        rawWpm: 130,
        accuracy: 1,
        durationMs: 20_000,
        typedCharacters: 100,
        errorCount: 0,
        correctedCharacters: 0,
      }),
      session({
        netWpm: 140,
        rawWpm: 150,
        accuracy: 0.95,
        durationMs: 30_000,
        typedCharacters: 120,
        errorCount: 4,
        correctedCharacters: 3,
      }),
    ])

    expect(stats.sessionCount).toBe(3)
    expect(stats.totalTypingTimeMs).toBe(60_000) // 10 + 20 + 30 seconds
    expect(stats.totalCharactersTyped).toBe(300) // 80 + 100 + 120
    expect(stats.totalErrors).toBe(12) // 8 + 0 + 4
    expect(stats.totalCorrectedCharacters).toBe(6) // 3 + 0 + 3

    expect(stats.averageWpm).toBe(120) // (100 + 120 + 140) / 3
    expect(stats.medianWpm).toBe(120) // middle of 100 120 140
    expect(stats.bestWpm).toBe(140)
    expect(stats.averageRawWpm).toBe(130) // (110 + 130 + 150) / 3

    expect(stats.averageAccuracy).toBeCloseTo(0.95, 10) // (0.9 + 1 + 0.95) / 3
    expect(stats.bestAccuracy).toBe(1)

    expect(stats.averageErrorsPerSession).toBe(4) // 12 / 3
    expect(stats.averageCorrectedPerSession).toBe(2) // 6 / 3
  })

  it('separates the mean from the median when a session is an outlier', () => {
    // 60 80 100 220: mean 115, median 90. A best-ever run should not be able to
    // masquerade as typical.
    const stats = computeStatistics([
      session({ netWpm: 60 }),
      session({ netWpm: 80 }),
      session({ netWpm: 100 }),
      session({ netWpm: 220 }),
    ])

    expect(stats.averageWpm).toBe(115)
    expect(stats.medianWpm).toBe(90)
    expect(stats.bestWpm).toBe(220)
  })

  it('reports one best when two sessions tie for it', () => {
    const stats = computeStatistics([
      session({ netWpm: 130, accuracy: 1 }),
      session({ netWpm: 130, accuracy: 1 }),
      session({ netWpm: 90, accuracy: 0.8 }),
    ])

    expect(stats.bestWpm).toBe(130)
    expect(stats.bestAccuracy).toBe(1)
    expect(stats.sessionCount).toBe(3)
  })

  it('weights every session equally, whatever its length', () => {
    // A 15-word test and a 60-word test both count once. Stated here because
    // the alternative — weighting by characters — is equally defensible and
    // this is the choice that was made.
    const stats = computeStatistics([
      session({ netWpm: 100, typedCharacters: 40 }),
      session({ netWpm: 200, typedCharacters: 400 }),
    ])

    expect(stats.averageWpm).toBe(150)
  })

  it('does not reorder the sessions it is given', () => {
    const sessions = [session({ netWpm: 140 }), session({ netWpm: 100 })]
    const order = sessions.map((s) => s.id)

    computeStatistics(sessions)

    expect(sessions.map((s) => s.id)).toEqual(order)
  })
})

describe('unusable records', () => {
  it('accepts a well-formed session', () => {
    expect(isUsableSession(session())).toBe(true)
  })

  /**
   * Broken records are assembled by overriding a valid one.
   *
   * They cannot be built through the normal constructors: `wpm(NaN)` throws, by
   * design. What is being tested is a record that reached storage some other
   * way — written by an older build, or corrupted — and still has to be
   * survivable.
   */
  const withMetrics = (patch: Record<string, number>): TypingSession => {
    const valid = session()
    return { ...valid, metrics: { ...valid.metrics, ...patch } } as TypingSession
  }

  it.each([
    ['a NaN speed', () => withMetrics({ netWpm: Number.NaN })],
    ['an infinite speed', () => withMetrics({ netWpm: Number.POSITIVE_INFINITY })],
    ['a negative error count', () => withMetrics({ errorCount: -5 })],
    ['an accuracy above 1', () => withMetrics({ accuracy: 1.5 })],
  ])('rejects %s', (_label, build) => {
    expect(isUsableSession(build())).toBe(false)
  })

  it('rejects a negative duration', () => {
    const valid = session()
    const broken = { ...valid, durationMs: -1 } as TypingSession

    expect(isUsableSession(broken)).toBe(false)
  })

  it('skips a broken record instead of poisoning every average', () => {
    const range = createTimeRange('allTime', localTime(2026, 3, 10))
    const valid = session({ completedAt: localTime(2026, 3, 9) })
    const broken = {
      ...valid,
      metrics: { ...valid.metrics, netWpm: Number.NaN },
    } as TypingSession

    const report = buildStatisticsReport(
      [session({ completedAt: localTime(2026, 3, 9), netWpm: 100 }), broken],
      range,
    )

    expect(report.statistics.sessionCount).toBe(1)
    expect(report.statistics.averageWpm).toBe(100)
    expect(report.skippedCount).toBe(1)
  })
})

describe('local calendar boundaries', () => {
  it('writes a day key from the local date, not the UTC one', () => {
    // 00:30 local on the 5th. In any zone behind UTC this instant is still the
    // 4th in UTC, and toISOString would report the wrong day.
    const justAfterMidnight = localTime(2026, 6, 5, 0, 30)

    expect(toLocalDayKey(justAfterMidnight)).toBe('2026-06-05')
  })

  it('keeps a late-evening session on its own local day', () => {
    // 23:30 local on the 5th is already the 6th in UTC east of Greenwich.
    expect(toLocalDayKey(localTime(2026, 6, 5, 23, 30))).toBe('2026-06-05')
  })

  it('starts a day at local midnight', () => {
    const midday = localTime(2026, 6, 5, 12)
    const midnight = localTime(2026, 6, 5, 0, 0, 0, 0)

    expect(startOfLocalDay(midday)).toBe(midnight)
  })

  it('steps calendar days rather than fixed 24-hour blocks', () => {
    // Across a daylight-saving change a local day is 23 or 25 hours, so
    // subtracting 86_400_000 lands in the wrong day. This asserts calendar
    // stepping instead, which holds in every zone.
    const start = localTime(2026, 3, 30, 12)

    expect(toLocalDayKey(shiftLocalDays(start, -1))).toBe('2026-03-29')
    expect(toLocalDayKey(shiftLocalDays(start, -7))).toBe('2026-03-23')
  })

  it('includes a session at exactly local midnight in today', () => {
    const now = localTime(2026, 6, 5, 14)
    const range = createTimeRange('today', now)
    const atMidnight = session({ completedAt: localTime(2026, 6, 5, 0, 0, 0, 0) })

    expect(filterSessionsByRange([atMidnight], range)).toHaveLength(1)
  })

  it('excludes a session from the last millisecond of yesterday', () => {
    const now = localTime(2026, 6, 5, 14)
    const range = createTimeRange('today', now)
    const justBefore = session({
      completedAt: localTime(2026, 6, 4, 23, 59, 59, 999),
    })

    expect(filterSessionsByRange([justBefore], range)).toHaveLength(0)
  })

  it('counts the last 7 days as seven calendar days ending today', () => {
    const now = localTime(2026, 6, 10, 9)
    const range = createTimeRange('last7Days', now)

    // The 4th is the seventh day back counting today as the first; the 3rd is
    // outside it.
    expect(
      filterSessionsByRange(
        [session({ completedAt: localTime(2026, 6, 4, 0, 0) })],
        range,
      ),
    ).toHaveLength(1)
    expect(
      filterSessionsByRange(
        [session({ completedAt: localTime(2026, 6, 3, 23, 59, 59, 999) })],
        range,
      ),
    ).toHaveLength(0)
  })

  it('counts the last 30 days the same way', () => {
    const now = localTime(2026, 6, 30, 9)
    const range = createTimeRange('last30Days', now)

    expect(
      filterSessionsByRange(
        [session({ completedAt: localTime(2026, 6, 1, 0, 0) })],
        range,
      ),
    ).toHaveLength(1)
    expect(
      filterSessionsByRange(
        [session({ completedAt: localTime(2026, 5, 31, 23, 59, 59, 999) })],
        range,
      ),
    ).toHaveLength(0)
  })

  it('bounds all time only at the top', () => {
    const now = localTime(2026, 6, 10, 9)
    const range = createTimeRange('allTime', now)

    expect(range.from).toBeNull()
    expect(
      filterSessionsByRange([session({ completedAt: localTime(2001, 1, 1) })], range),
    ).toHaveLength(1)
  })

  it('excludes a session completed after now', () => {
    // A clock that jumped, or a record from another device.
    const now = localTime(2026, 6, 10, 9)
    const range = createTimeRange('allTime', now)
    const future = session({ completedAt: localTime(2026, 6, 11, 9) })

    expect(filterSessionsByRange([future], range)).toHaveLength(0)
  })

  it('does not disturb the array it filters', () => {
    const sessions = [
      session({ completedAt: localTime(2026, 6, 10) }),
      session({ completedAt: localTime(2026, 6, 1) }),
    ]
    const order = sessions.map((s) => s.id)

    filterSessionsByRange(sessions, createTimeRange('allTime', localTime(2026, 6, 11)))

    expect(sessions.map((s) => s.id)).toEqual(order)
  })
})

describe('trends', () => {
  it('returns nothing for no sessions', () => {
    const trends = computeTrends([])

    expect(trends.wpm).toEqual([])
    expect(trends.daily).toEqual([])
  })

  it('orders points oldest first, whatever order they arrive in', () => {
    const trends = computeTrends([
      session({ id: 'newer', completedAt: localTime(2026, 6, 10), netWpm: 130 }),
      session({ id: 'older', completedAt: localTime(2026, 6, 1), netWpm: 110 }),
    ])

    expect(trends.wpm.map((point) => point.sessionId)).toEqual(['older', 'newer'])
    expect(trends.wpm.map((point) => point.value)).toEqual([110, 130])
  })

  it('carries speed, raw speed and accuracy as separate series', () => {
    const trends = computeTrends([
      session({ netWpm: 120, rawWpm: 135, accuracy: 0.93 }),
    ])

    expect(trends.wpm[0]?.value).toBe(120)
    expect(trends.rawWpm[0]?.value).toBe(135)
    expect(trends.accuracy[0]?.value).toBe(0.93)
  })

  it('groups activity by local day', () => {
    const trends = computeTrends([
      session({
        completedAt: localTime(2026, 6, 1, 9),
        durationMs: 10_000,
        netWpm: 100,
      }),
      session({
        completedAt: localTime(2026, 6, 1, 21),
        durationMs: 20_000,
        netWpm: 140,
      }),
      session({ completedAt: localTime(2026, 6, 3, 9), durationMs: 5_000, netWpm: 90 }),
    ])

    expect(trends.daily).toHaveLength(2)
    expect(trends.daily[0]).toMatchObject({
      day: '2026-06-01',
      sessionCount: 2,
      typingTimeMs: 30_000,
      averageWpm: 120, // (100 + 140) / 2
    })
    expect(trends.daily[1]).toMatchObject({ day: '2026-06-03', sessionCount: 1 })
  })

  it('leaves days without sessions out rather than inventing zeroes', () => {
    const trends = computeTrends([
      session({ completedAt: localTime(2026, 6, 1) }),
      session({ completedAt: localTime(2026, 6, 5) }),
    ])

    // The 2nd to the 4th are absent; how to draw a gap is the chart's decision.
    expect(trends.daily.map((point) => point.day)).toEqual(['2026-06-01', '2026-06-05'])
  })

  it('keeps an evening session on its own local day', () => {
    const trends = computeTrends([
      session({ completedAt: localTime(2026, 6, 5, 23, 45) }),
    ])

    expect(trends.daily[0]?.day).toBe('2026-06-05')
  })
})

describe('buildStatisticsReport', () => {
  const history = [
    session({ id: 'old', completedAt: localTime(2026, 5, 1, 10), netWpm: 90 }),
    session({ id: 'week', completedAt: localTime(2026, 6, 8, 10), netWpm: 110 }),
    session({ id: 'today-1', completedAt: localTime(2026, 6, 10, 8), netWpm: 130 }),
    session({ id: 'today-2', completedAt: localTime(2026, 6, 10, 9), netWpm: 150 }),
  ]
  const now = localTime(2026, 6, 10, 12)

  it('reports only today for the today range', () => {
    const report = buildStatisticsReport(history, createTimeRange('today', now))

    expect(report.statistics.sessionCount).toBe(2)
    expect(report.statistics.averageWpm).toBe(140) // (130 + 150) / 2
    expect(report.trends.wpm.map((point) => point.sessionId)).toEqual([
      'today-1',
      'today-2',
    ])
  })

  it('widens to the week', () => {
    const report = buildStatisticsReport(history, createTimeRange('last7Days', now))

    expect(report.statistics.sessionCount).toBe(3) // excludes the May session
    expect(report.statistics.averageWpm).toBe(130) // (110 + 130 + 150) / 3
  })

  it('includes everything for all time', () => {
    const report = buildStatisticsReport(history, createTimeRange('allTime', now))

    expect(report.statistics.sessionCount).toBe(4)
    expect(report.statistics.averageWpm).toBe(120) // (90 + 110 + 130 + 150) / 4
    expect(report.statistics.bestWpm).toBe(150)
  })

  it('carries the range it was built for', () => {
    const report = buildStatisticsReport(history, createTimeRange('last30Days', now))

    expect(report.range.key).toBe('last30Days')
    expect(report.range.label).toBe('Last 30 days')
  })

  it('reports an empty range without failing', () => {
    const report = buildStatisticsReport([], createTimeRange('today', now))

    expect(report.statistics.sessionCount).toBe(0)
    expect(report.statistics.averageWpm).toBeNull()
    expect(report.trends.daily).toEqual([])
    expect(report.skippedCount).toBe(0)
  })
})

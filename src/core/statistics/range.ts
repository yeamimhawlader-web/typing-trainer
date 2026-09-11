/**
 * Time ranges, on the local calendar.
 *
 * Sessions store `completedAt` as an epoch instant, which is a point in time
 * and carries no date. "Today" is a *calendar* question, and the only calendar
 * a typist cares about is the one on their own wall — a test finished at 11pm
 * on Monday belongs to Monday, not to Tuesday because UTC had already rolled
 * over.
 *
 * So every boundary here is derived with local getters, and day keys are built
 * by hand from `getFullYear`/`getMonth`/`getDate`. **`toISOString().slice(0,10)`
 * is the wrong tool** and the easiest mistake to make: it silently returns the
 * UTC date, which is a different day for a large part of every day, everywhere
 * east or west of Greenwich.
 *
 * Day arithmetic goes through `setDate`, which steps calendar days correctly
 * across daylight-saving changes. Subtracting `n * 86_400_000` does not: on the
 * two days a year a local day is 23 or 25 hours long, it lands an hour off and
 * the boundary falls into the wrong day.
 */

import type { TimeRange, TimeRangeKey } from './types.ts'

const pad = (value: number): string => String(value).padStart(2, '0')

/** Local midnight beginning the day that contains `at`. */
export const startOfLocalDay = (at: number): number => {
  const date = new Date(at)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** Local midnight `days` calendar days from the day containing `at`. */
export const shiftLocalDays = (at: number, days: number): number => {
  const date = new Date(at)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

/** `YYYY-MM-DD` on the local calendar. Never the UTC date. */
export const toLocalDayKey = (at: number): string => {
  const date = new Date(at)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const TIME_RANGE_KEYS: readonly TimeRangeKey[] = [
  'today',
  'last7Days',
  'last30Days',
  'allTime',
]

export const TIME_RANGE_LABELS: Record<TimeRangeKey, string> = {
  today: 'Today',
  last7Days: 'Last 7 days',
  last30Days: 'Last 30 days',
  allTime: 'All time',
}

/**
 * Builds a range ending at `now`.
 *
 * "Last 7 days" means the seven calendar days ending today, today included —
 * so it starts at local midnight six days ago, not at this moment minus 168
 * hours. `now` is passed in rather than read from the clock, for the same
 * reason the typing engine takes its timestamps: it makes the result testable.
 */
export const createTimeRange = (key: TimeRangeKey, now: number): TimeRange => {
  const label = TIME_RANGE_LABELS[key]

  switch (key) {
    case 'today':
      return { key, label, from: startOfLocalDay(now), to: now }
    case 'last7Days':
      return { key, label, from: shiftLocalDays(now, -6), to: now }
    case 'last30Days':
      return { key, label, from: shiftLocalDays(now, -29), to: now }
    case 'allTime':
      return { key, label, from: null, to: now }
  }
}

/**
 * Sessions completed inside the range, both bounds inclusive.
 *
 * Returns a new array; the input is never sorted or otherwise disturbed.
 */
export const filterSessionsByRange = <T extends { readonly completedAt: number }>(
  sessions: readonly T[],
  range: TimeRange,
): readonly T[] =>
  sessions.filter(
    (session) =>
      (range.from === null || session.completedAt >= range.from) &&
      session.completedAt <= range.to,
  )

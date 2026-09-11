/**
 * Presentation helpers for statistics.
 *
 * Formatting only. Every figure arrives already computed by `@core/statistics`;
 * nothing here averages, totals or derives anything.
 */

const dayLabel = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
})

/** A local day key (`YYYY-MM-DD`) as a short readable date. */
export const formatDayKey = (day: string): string => {
  const [year, month, date] = day.split('-').map(Number)
  if (year === undefined || month === undefined || date === undefined) return day
  // Local constructor, to match the local day the key was built from.
  return dayLabel.format(new Date(year, month - 1, date))
}

/**
 * A total across many sessions, which can run to hours — unlike a single test's
 * duration, which never does.
 */
export const formatTotalTime = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

/** Thousands separators, so a six-figure character count stays readable. */
export const formatNumber = (value: number): string => value.toLocaleString()

/** One decimal place, for small per-session averages where 0 vs 0.4 matters. */
export const formatDecimal = (value: number): string => value.toFixed(1)

export const formatPercent = (ratio: number): string => `${Math.round(ratio * 100)}%`

/** Renders an absent figure as a dash rather than inventing a zero. */
export const orDash = <T>(value: T | null, format: (value: T) => string): string =>
  value === null ? '—' : format(value)

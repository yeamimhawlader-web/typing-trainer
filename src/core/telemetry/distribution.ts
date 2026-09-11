/**
 * Small distribution helpers, shared by the single-session and cross-session
 * sequence analyses so the two cannot drift apart.
 *
 * Deliberately not imported from `@core/statistics`: that module is about
 * sessions — WPM, accuracy, streaks — and these are about keystroke intervals.
 * Wiring one core module through the other to save twenty lines would buy a
 * dependency and no clarity.
 */

/**
 * Quantile by linear interpolation between the two nearest ranks.
 *
 * At `p = 0.5` this is the ordinary median, including the even-length case:
 * four values interpolate halfway between the middle two, which is their mean.
 * So `median` and `quantile(0.5)` agree by construction rather than by
 * coincidence.
 *
 * Throws on an empty input. A quantile of nothing has no sensible value, and
 * returning `0` would quietly enter "instant" into a timing calculation.
 */
export const quantileOfSorted = (sorted: readonly number[], p: number): number => {
  if (sorted.length === 0) throw new RangeError('quantile of an empty set')
  if (sorted.length === 1) return sorted[0] as number

  const position = (sorted.length - 1) * p
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  const weight = position - lower

  return (sorted[lower] as number) * (1 - weight) + (sorted[upper] as number) * weight
}

const sortAscending = (values: readonly number[]): number[] =>
  [...values].sort((a, b) => a - b)

export const quantile = (values: readonly number[], p: number): number =>
  quantileOfSorted(sortAscending(values), p)

export const median = (values: readonly number[]): number => quantile(values, 0.5)

/** Quartiles and the spread between them, from one sort. */
export interface Spread {
  readonly p25: number
  readonly median: number
  readonly p75: number
  /** `p75 - p25`. Resistant to the single 400 ms yawn that a range is not. */
  readonly iqr: number
}

export const spreadOf = (values: readonly number[]): Spread => {
  const sorted = sortAscending(values)
  const p25 = quantileOfSorted(sorted, 0.25)
  const p75 = quantileOfSorted(sorted, 0.75)

  return { p25, median: quantileOfSorted(sorted, 0.5), p75, iqr: p75 - p25 }
}

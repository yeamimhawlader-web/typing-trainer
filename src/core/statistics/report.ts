/**
 * The one call the UI makes.
 *
 * Filters to the range once, drops unusable records once, then computes the
 * figures and the trend datasets from that same set — rather than each screen
 * walking the history again for every number it wants to show.
 *
 * The history is small today and this is a straightforward pass over an array.
 * The shape is what matters: a pure function of `(sessions, range)` can be
 * memoised, cached per range, or replaced by an indexed query later without any
 * caller changing.
 */

import type { TypingSession } from '@core/sessions'

import { computeStatistics, isUsableSession } from './aggregate.ts'
import { filterSessionsByRange } from './range.ts'
import { computeTrends } from './trends.ts'
import type { StatisticsReport, TimeRange } from './types.ts'

export const buildStatisticsReport = (
  sessions: readonly TypingSession[],
  range: TimeRange,
): StatisticsReport => {
  const inRange = filterSessionsByRange(sessions, range)
  const usable = inRange.filter(isUsableSession)

  return {
    range,
    statistics: computeStatistics(usable),
    trends: computeTrends(usable),
    skippedCount: inRange.length - usable.length,
  }
}

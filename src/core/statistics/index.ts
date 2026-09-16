/**
 * Statistics — public entry point.
 *
 * Pure functions over stored sessions. Nothing here touches React, storage or
 * the clock, and nothing here modifies a session: history is a record of what
 * happened, and statistics are read off it.
 */

export type {
  DailyPoint,
  SessionStatistics,
  SessionTrends,
  StatisticsReport,
  TimeRange,
  TimeRangeKey,
  TrendPoint,
} from './types.ts'

export {
  computeStatistics,
  consistency,
  FAR_OUT_IQR_MULTIPLE,
  MINIMUM_SESSIONS_FOR_OUTLIERS,
  MINIMUM_SPREAD_OF_MEDIAN,
  splitFarOutliers,
  isUsableSession,
  maximum,
  mean,
  median,
  standardDeviation,
} from './aggregate.ts'

export {
  createTimeRange,
  filterSessionsByRange,
  shiftLocalDays,
  startOfLocalDay,
  TIME_RANGE_KEYS,
  TIME_RANGE_LABELS,
  toLocalDayKey,
} from './range.ts'

export { computeTrends } from './trends.ts'

export { buildStatisticsReport } from './report.ts'

export { PACE_RULES, paceFor, paceIndexAt, paceTargets } from './pace.ts'
export type { PaceRules, PaceTargets } from './pace.ts'

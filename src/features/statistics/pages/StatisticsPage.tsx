/**
 * Statistics.
 *
 * Speed leads, because it is the thing being trained; everything else supports
 * it. The page is a set of figures with two small charts underneath, not a wall
 * of cards — the reader should be able to answer "how am I doing" in about two
 * seconds and then go back to practising.
 *
 * Every number comes from `@core/statistics`, which computes them from stored
 * sessions. No formula lives in this file.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import { ROUTES } from '@app/routes.ts'
import {
  buildStatisticsReport,
  createTimeRange,
  TIME_RANGE_KEYS,
  TIME_RANGE_LABELS,
  type TimeRangeKey,
  type TrendPoint,
} from '@core/statistics'
import { sessionService, type TypingSession } from '@core/sessions'
import { formatCompletedAt } from '@features/results'
import { cx } from '@shared/lib'
import { Page } from '@shared/ui'

import {
  formatDecimal,
  formatNumber,
  formatPercent,
  formatTotalTime,
  orDash,
} from '../format.ts'
import { ActivityChart } from '../components/ActivityChart.tsx'
import { TrendChart } from '../components/TrendChart.tsx'

import styles from './StatisticsPage.module.css'

/** Below this, a line between points is a coincidence rather than a trend. */
const MINIMUM_POINTS_FOR_TREND = 2

type LoadState = 'loading' | 'ready' | 'failed'

const Tile = ({ label, value }: { label: string; value: string }) => (
  <div className={styles.tile}>
    <dt className={styles.label}>{label}</dt>
    <dd className={styles.tileValue}>{value}</dd>
  </div>
)

const describePointDate = (point: TrendPoint): string =>
  formatCompletedAt({ completedAt: point.at } as TypingSession)

export const StatisticsPage = () => {
  const [sessions, setSessions] = useState<readonly TypingSession[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [rangeKey, setRangeKey] = useState<TimeRangeKey>('last7Days')
  /**
   * The instant every range is measured back from, captured when the page
   * loads. Reading the clock during render would make the output depend on
   * when React happened to run, which is the definition of an unstable render.
   */
  const [loadedAt, setLoadedAt] = useState(0)

  useEffect(() => {
    let active = true

    sessionService
      .getAll()
      .then((all) => {
        if (active) {
          setSessions(all)
          setLoadedAt(Date.now())
          setStatus('ready')
        }
      })
      .catch((error: unknown) => {
        console.warn('[statistics] failed to read sessions', error)
        if (active) setStatus('failed')
      })

    return () => {
      active = false
    }
  }, [])

  /**
   * One pass per range change, rather than a walk through the history for every
   * figure on the page.
   */
  const report = useMemo(
    () => buildStatisticsReport(sessions, createTimeRange(rangeKey, loadedAt)),
    [sessions, rangeKey, loadedAt],
  )

  const { statistics, trends, range } = report

  const rangeControls = (
    <div className={styles.ranges} role="group" aria-label="Time range">
      {TIME_RANGE_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className={cx(styles.range, key === rangeKey && styles.rangeSelected)}
          aria-pressed={key === rangeKey}
          onClick={(event) => {
            event.currentTarget.blur()
            setRangeKey(key)
          }}
        >
          {TIME_RANGE_LABELS[key]}
        </button>
      ))}
    </div>
  )

  if (status === 'loading') {
    return (
      <Page title="Statistics">
        <p className={styles.empty}>Loading…</p>
      </Page>
    )
  }

  if (status === 'failed') {
    return (
      <Page title="Statistics">
        <p className={styles.empty}>
          Your history could not be read, so there is nothing to summarise.
        </p>
      </Page>
    )
  }

  if (sessions.length === 0) {
    return (
      <Page title="Statistics">
        <p className={styles.empty}>
          No tests recorded yet. <Link to={ROUTES.practice}>Take one</Link> and your
          figures will appear here.
        </p>
      </Page>
    )
  }

  if (statistics.sessionCount === 0) {
    return (
      <Page title="Statistics">
        {rangeControls}
        <p className={styles.empty}>
          No tests in this range. Your earlier tests are still under{' '}
          <button
            type="button"
            className={styles.range}
            onClick={() => setRangeKey('allTime')}
          >
            all time
          </button>
          .
        </p>
      </Page>
    )
  }

  const enoughForTrend = statistics.sessionCount >= MINIMUM_POINTS_FOR_TREND

  return (
    <Page title="Statistics">
      {rangeControls}

      <div className={styles.headline}>
        <p className={styles.hero}>
          <span className={styles.heroValue}>
            {orDash(statistics.averageWpm, (value) => String(Math.round(value)))}
          </span>
          <span className={styles.heroUnit}>average wpm</span>
        </p>

        <dl className={styles.secondary}>
          <div className={styles.secondaryItem}>
            <dd className={styles.secondaryValue}>
              {orDash(statistics.bestWpm, (value) => String(Math.round(value)))}
            </dd>
            <dt className={styles.label}>best</dt>
          </div>
          <div className={styles.secondaryItem}>
            <dd className={styles.secondaryValue}>
              {orDash(statistics.averageAccuracy, formatPercent)}
            </dd>
            <dt className={styles.label}>accuracy</dt>
          </div>
        </dl>
      </div>

      <dl className={styles.tiles}>
        <Tile label="Tests" value={formatNumber(statistics.sessionCount)} />
        <Tile
          label="Typing time"
          value={formatTotalTime(statistics.totalTypingTimeMs)}
        />
        <Tile
          label="Median wpm"
          value={orDash(statistics.medianWpm, (value) => String(Math.round(value)))}
        />
        <Tile
          label="Average raw wpm"
          value={orDash(statistics.averageRawWpm, (value) => String(Math.round(value)))}
        />
        <Tile
          label="Best accuracy"
          value={orDash(statistics.bestAccuracy, formatPercent)}
        />
        <Tile
          label="Consistency"
          value={orDash(statistics.wpmConsistency, formatPercent)}
        />
        <Tile
          label="Characters typed"
          value={formatNumber(statistics.totalCharactersTyped)}
        />
        <Tile label="Errors" value={formatNumber(statistics.totalErrors)} />
        <Tile
          label="Errors per test"
          value={orDash(statistics.averageErrorsPerSession, formatDecimal)}
        />
        <Tile
          label="Corrected"
          value={formatNumber(statistics.totalCorrectedCharacters)}
        />
        <Tile
          label="Corrected per test"
          value={orDash(statistics.averageCorrectedPerSession, formatDecimal)}
        />
      </dl>

      {enoughForTrend ? (
        <div className={styles.charts}>
          <TrendChart
            title="Speed"
            points={trends.wpm}
            formatValue={(value) => `${Math.round(value)} wpm`}
            describe={(points) =>
              `Speed across ${points.length} tests, from ${Math.round(
                points[0]?.value ?? 0,
              )} to ${Math.round(points[points.length - 1]?.value ?? 0)} words per minute.`
            }
            describePoint={describePointDate}
          />

          <TrendChart
            title="Accuracy"
            points={trends.accuracy}
            formatValue={formatPercent}
            describe={(points) =>
              `Accuracy across ${points.length} tests, from ${formatPercent(
                points[0]?.value ?? 0,
              )} to ${formatPercent(points[points.length - 1]?.value ?? 0)}.`
            }
            describePoint={describePointDate}
          />

          <TrendChart
            title="Raw speed"
            points={trends.rawWpm}
            formatValue={(value) => `${Math.round(value)} wpm`}
            describe={(points) =>
              `Raw speed across ${points.length} tests, from ${Math.round(
                points[0]?.value ?? 0,
              )} to ${Math.round(points[points.length - 1]?.value ?? 0)} words per minute.`
            }
            describePoint={describePointDate}
          />

          <ActivityChart
            title="Tests per day"
            days={trends.daily}
            from={range.from}
            to={range.to}
            total={formatTotalTime(statistics.totalTypingTimeMs)}
          />
        </div>
      ) : (
        <p className={styles.note}>
          One test in this range. Trends appear once there are a few more to compare.
        </p>
      )}

      {report.skippedCount > 0 && (
        <p className={styles.note}>
          {report.skippedCount} stored{' '}
          {report.skippedCount === 1 ? 'session was' : 'sessions were'} unreadable and
          left out of these figures.
        </p>
      )}
    </Page>
  )
}

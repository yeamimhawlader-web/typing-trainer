/**
 * Tests per day.
 *
 * Built from HTML boxes rather than SVG: the marks are plain rectangles on a
 * shared baseline, and flexbox positions them without any scale arithmetic.
 *
 * The axis is always a **contiguous** run of calendar days. The statistics
 * layer returns only days that have sessions — correctly, since inventing empty
 * rows there would take a decision away from the chart — but drawing only those
 * would put a day in August next to a day in September with nothing between
 * them, and read as two consecutive sessions. Gaps are the point of an activity
 * chart, so they are filled in here as empty columns.
 */

import type { DailyPoint } from '@core/statistics'
import { shiftLocalDays, startOfLocalDay, toLocalDayKey } from '@core/statistics'

import { formatDayKey } from '../format.ts'

import styles from './ActivityChart.module.css'

/**
 * Most days drawn at once.
 *
 * Past this the columns are thinner than the gaps between them. A longer
 * history shows its most recent stretch, and says so.
 */
const MAX_COLUMNS = 60

const DAY_MS = 86_400_000

export interface ActivityChartProps {
  readonly title: string
  readonly days: readonly DailyPoint[]
  /** Inclusive lower bound of the range; null for all time. */
  readonly from: number | null
  readonly to: number
  readonly total: string
}

interface Column {
  readonly day: string
  readonly count: number
}

interface Axis {
  readonly columns: readonly Column[]
  /** True when the history is longer than the window drawn. */
  readonly truncated: boolean
}

const buildAxis = (
  days: readonly DailyPoint[],
  from: number | null,
  to: number,
): Axis => {
  const counts = new Map(days.map((day) => [day.day, day.sessionCount]))
  const lastDay = startOfLocalDay(to)

  // All time starts at the earliest day that has anything in it.
  const earliest = days[0]?.startOfDay ?? lastDay
  const requested = from === null ? earliest : startOfLocalDay(from)

  // Rounded because a daylight-saving change makes a local day 23 or 25 hours;
  // this only decides whether to clamp, so an hour either way is immaterial.
  const spanInDays = Math.round((lastDay - requested) / DAY_MS) + 1
  const truncated = spanInDays > MAX_COLUMNS
  const start = truncated ? shiftLocalDays(lastDay, -(MAX_COLUMNS - 1)) : requested

  const columns: Column[] = []
  for (
    let at = start;
    at <= to && columns.length < MAX_COLUMNS;
    at = shiftLocalDays(at, 1)
  ) {
    const key = toLocalDayKey(at)
    columns.push({ day: key, count: counts.get(key) ?? 0 })
  }

  return { columns, truncated }
}

const describeDay = (day: string, count: number): string =>
  `${formatDayKey(day)}: ${count} ${count === 1 ? 'test' : 'tests'}`

export const ActivityChart = ({ title, days, from, to, total }: ActivityChartProps) => {
  const { columns, truncated } = buildAxis(days, from, to)
  const busiest = Math.max(1, ...columns.map((column) => column.count))

  const active = columns.filter((column) => column.count > 0)
  const summary =
    `${title}, ${columns.length} days` +
    (truncated ? ' (most recent shown)' : '') +
    `. ${active.map((column) => describeDay(column.day, column.count)).join(', ')}.`

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.heading}>
        <span className={styles.title}>{title}</span>
        <span className={styles.total}>{total}</span>
      </figcaption>

      <div className={styles.plot} role="img" aria-label={summary}>
        {columns.map((column) => (
          <div key={column.day} className={styles.column}>
            <div
              className={column.count === 0 ? styles.empty : styles.bar}
              style={{ height: `${(column.count / busiest) * 100}%` }}
              title={describeDay(column.day, column.count)}
            />
          </div>
        ))}
      </div>

      <div className={styles.axis} />

      <div className={styles.bounds} aria-hidden>
        <span>{formatDayKey(columns[0]?.day ?? '')}</span>
        <span>{formatDayKey(columns[columns.length - 1]?.day ?? '')}</span>
      </div>

      <table className="visually-hidden">
        <caption>{title}</caption>
        <tbody>
          {columns.map((column) => (
            <tr key={column.day}>
              <th scope="row">{formatDayKey(column.day)}</th>
              <td>{column.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/**
 * One measure over time, as a single line.
 *
 * A single series, so there is no legend and no categorical palette — the
 * heading names what is plotted, and colour carries no meaning that the text
 * does not already carry.
 *
 * Deliberately small. The numbers above it are the statistics; this shows their
 * shape, and a chart that dominated them would have the emphasis backwards.
 *
 * The data arrives already derived by `@core/statistics`. Nothing here computes
 * a metric — only positions.
 */

import type { TrendPoint } from '@core/statistics'

import styles from './TrendChart.module.css'

/** Plot geometry, in viewBox units. */
const WIDTH = 600
const HEIGHT = 120
const PADDING_Y = 10

export interface TrendChartProps {
  readonly title: string
  readonly points: readonly TrendPoint[]
  /** Formats a value for labels, bounds and the accessible description. */
  readonly formatValue: (value: number) => string
  /** Describes the whole series for assistive technology. */
  readonly describe: (points: readonly TrendPoint[]) => string
  /** Labels each point in the hidden table and hover text. */
  readonly describePoint: (point: TrendPoint) => string
}

export const TrendChart = ({
  title,
  points,
  formatValue,
  describe,
  describePoint,
}: TrendChartProps) => {
  const values = points.map((point) => point.value)
  const lowest = Math.min(...values)
  const highest = Math.max(...values)

  // A flat series would divide by zero; give it a band so the line sits in the
  // middle rather than collapsing onto an edge.
  const span = highest - lowest || Math.max(1, highest * 0.1)

  const x = (index: number): number =>
    points.length === 1 ? WIDTH / 2 : (index / (points.length - 1)) * WIDTH

  const y = (value: number): number =>
    HEIGHT - PADDING_Y - ((value - lowest) / span) * (HEIGHT - PADDING_Y * 2)

  const line = points.map((point, index) => `${x(index)},${y(point.value)}`).join(' ')
  const area = `${line} ${WIDTH},${HEIGHT} 0,${HEIGHT}`
  const last = points[points.length - 1]

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.heading}>
        <span className={styles.title}>{title}</span>
        {last !== undefined && (
          <span className={styles.latest}>{formatValue(last.value)}</span>
        )}
      </figcaption>

      <svg
        className={styles.plot}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={describe(points)}
      >
        <polyline className={styles.area} points={area} />
        <polyline className={styles.line} points={line} />

        {last !== undefined && (
          <circle
            className={styles.endpoint}
            cx={x(points.length - 1)}
            cy={y(last.value)}
            r={4}
          />
        )}

        <line className={styles.axis} x1={0} y1={HEIGHT} x2={WIDTH} y2={HEIGHT} />
      </svg>

      <div className={styles.bounds} aria-hidden>
        <span>{formatValue(lowest)}</span>
        <span>{formatValue(highest)}</span>
      </div>

      {/* The same numbers as a table, for anyone who cannot read the shape. */}
      <table className="visually-hidden">
        <caption>{title}</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.sessionId}>
              <th scope="row">{describePoint(point)}</th>
              <td>{formatValue(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/**
 * The shape of the test just finished: speed second by second, with the
 * mistakes marked where they happened.
 *
 * The figures above it say how the test went; this says where. A test that
 * averaged sixty can be a steady sixty or a burst of ninety that fell apart at
 * the fourth word, and the difference is the whole lesson — so the line is the
 * speed of the moment, not the running average.
 *
 * Small, like the trend charts: it explains the numbers rather than replacing
 * them. Everything plotted is derived in `@core/telemetry`; nothing here
 * computes a measure, only positions.
 */

import type { TestShape } from '@core/telemetry'

import styles from './TestShapeChart.module.css'

/** Plot geometry, in viewBox units. */
const WIDTH = 600
const HEIGHT = 120
const PADDING_Y = 12

export interface TestShapeChartProps {
  readonly shape: TestShape
}

const describe = (shape: TestShape): string => {
  const seconds = shape.points.length
  const mistakes = shape.errorSeconds.length
  const where =
    mistakes === 0
      ? 'no mistakes'
      : `${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'}, at ${[...new Set(shape.errorSeconds)]
          .map((second) => `${second + 1}s`)
          .join(', ')}`

  return `Speed through the test: ${seconds} seconds, peaking at ${shape.peakWpm} words a minute, with ${where}.`
}

export const TestShapeChart = ({ shape }: TestShapeChartProps) => {
  if (shape.points.length < 2) return null

  const top = Math.max(shape.peakWpm, 1)
  const x = (second: number): number =>
    ((second - 1) / Math.max(1, shape.points.length - 1)) * WIDTH
  const y = (wpm: number): number => HEIGHT - PADDING_Y - (wpm / top) * (HEIGHT - PADDING_Y * 2)

  const line = shape.points.map((point) => `${x(point.second)},${y(point.wpm)}`).join(' ')
  const area = `${line} ${WIDTH},${HEIGHT} 0,${HEIGHT}`
  // A mistake is drawn on the second it happened, on the line's own height there.
  const mistakes = shape.points.filter((point) => point.errors > 0)

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.heading}>
        <span className={styles.title}>Speed through the test</span>
        <span className={styles.peak}>{shape.peakWpm} wpm peak</span>
      </figcaption>

      <svg
        className={styles.plot}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={describe(shape)}
      >
        <polyline className={styles.area} points={area} />
        <polyline className={styles.line} points={line} />

        {mistakes.map((point) => (
          <circle
            key={point.second}
            className={styles.mistake}
            cx={x(point.second)}
            cy={y(point.wpm)}
            r={5}
          >
            <title>
              {point.errors === 1 ? 'A mistake' : `${point.errors} mistakes`} at {point.second}s
            </title>
          </circle>
        ))}

        <line className={styles.axis} x1={0} y1={HEIGHT} x2={WIDTH} y2={HEIGHT} />
      </svg>

      <div className={styles.bounds} aria-hidden="true">
        <span>0s</span>
        <span className={styles.mistakeKey} data-any={shape.errorSeconds.length > 0}>
          mistakes
        </span>
        <span>{shape.points.length}s</span>
      </div>

      {/* The same seconds as a table, for anyone who cannot read the shape. */}
      <table className="visually-hidden">
        <caption>Speed through the test</caption>
        <tbody>
          {shape.points.map((point) => (
            <tr key={point.second}>
              <th scope="row">{point.second}s</th>
              <td>
                {point.wpm} wpm
                {point.errors > 0 && `, ${point.errors} mistyped`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

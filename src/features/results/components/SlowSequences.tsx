/**
 * The slowest character transitions of one test.
 *
 * An experiment: does this tell a fast typist anything they did not know? It is
 * shown as a footnote to the result rather than a second headline, and the
 * wording stays at what the data supports — "slowest observed", not "weakest".
 * One test cannot tell the difference between a hard transition and a slow
 * moment.
 *
 * Renders nothing at all when there is not enough to say. An empty section with
 * a "no data" message would be worse than silence.
 */

import type { SequenceReport } from '@core/telemetry'

import styles from './SlowSequences.module.css'

/** More than a handful stops being a finding and starts being a list. */
const MAX_SHOWN = 5

export interface SlowSequencesProps {
  readonly report: SequenceReport | null
}

const formatMs = (value: number): string => `${Math.round(value)} ms`

const formatDelta = (value: number): string =>
  `${value >= 0 ? '+' : '−'}${Math.abs(Math.round(value))} ms`

export const SlowSequences = ({ report }: SlowSequencesProps) => {
  // `slowerThanTypical`, not `ranked`: sorting alone always produces a top
  // entry, even when it is faster than everything else in the session.
  if (report === null || report.slowerThanTypical.length === 0) return null

  const shown = report.slowerThanTypical.slice(0, MAX_SHOWN)

  return (
    <section className={styles.section} aria-labelledby="slow-sequences-heading">
      <h3 className={styles.heading} id="slow-sequences-heading">
        Slowest letter pairs in this test
      </h3>

      <ul className={styles.list}>
        {shown.map((entry) => (
          <li key={entry.sequence} className={styles.row}>
            <span className={styles.sequence}>{entry.sequence}</span>
            <span className={styles.timing}>
              {formatMs(entry.medianMs)}{' '}
              <span className={styles.delta}>({formatDelta(entry.deltaMs)})</span>
            </span>
            <span className={styles.count}>
              {entry.observations}×
              <span className="visually-hidden"> observations</span>
            </span>
          </li>
        ))}
      </ul>

      <p className={styles.caveat}>
        Time between the two keys, from this test only, for pairs typed correctly at
        least {report.minimumObservations} times. Your usual is{' '}
        {formatMs(report.overallMedianMs ?? 0)}. One test isn't enough to call any of
        these a weakness. Your Statistics page tracks them across tests.
      </p>
    </section>
  )
}

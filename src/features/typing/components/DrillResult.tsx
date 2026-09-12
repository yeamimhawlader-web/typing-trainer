/**
 * What happened to the target transition during a drill.
 *
 * Sits under the ordinary result, not instead of it: speed and accuracy are
 * still the headline, because a drill is a typing test and the normal numbers
 * are the ones that say whether it went well.
 *
 * The wording is flat on purpose. "Drill result", never "you fixed it". One
 * drill against a handful of earlier sessions cannot tell a real improvement
 * from a good five minutes, and the comparison is shown as two numbers and
 * their difference rather than converted into a percentage — a percentage of a
 * figure this noisy reads as precision that is not there.
 */

import type { DrillComparison, DrillOutcome } from '@core/telemetry'

import styles from './DrillResult.module.css'

export interface DrillResultProps {
  readonly outcome: DrillOutcome
  readonly comparison: DrillComparison
}

const formatMs = (value: number): string => `${Math.round(value)} ms`

const formatDifference = (value: number): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(Math.round(value))} ms`

export const DrillResult = ({ outcome, comparison }: DrillResultProps) => {
  const { sequence, targetOccurrences, correctTransitions, medianMs } = outcome
  const missed = targetOccurrences - correctTransitions

  return (
    <section className={styles.section} aria-labelledby="drill-result-heading">
      <h3 className={styles.heading} id="drill-result-heading">
        Drill result
      </h3>

      <div className={styles.headline}>
        <span className={styles.sequence}>{sequence}</span>

        <dl className={styles.figures}>
          <div className={styles.figure}>
            <dt className={styles.label}>This drill</dt>
            <dd className={styles.value}>
              {medianMs === null ? '—' : formatMs(medianMs)}
            </dd>
          </div>

          <div className={styles.figure}>
            <dt className={styles.label}>Your baseline</dt>
            <dd className={styles.value}>
              {comparison.baselineMs === null ? '—' : formatMs(comparison.baselineMs)}
            </dd>
          </div>

          <div className={styles.figure}>
            <dt className={styles.label}>Difference</dt>
            <dd className={styles.value}>
              {medianMs === null || comparison.baselineMs === null
                ? '—'
                : // From the two rounded figures beside it, so the three always
                  // subtract correctly on screen. That can move the figure by at
                  // most one millisecond from the exact difference.
                  formatDifference(Math.round(medianMs) - Math.round(comparison.baselineMs))}
            </dd>
          </div>
        </dl>
      </div>

      <p className={styles.evidence}>
        {targetOccurrences} {targetOccurrences === 1 ? 'occurrence' : 'occurrences'} in
        this drill, {correctTransitions} typed cleanly
        {missed > 0 ? ` and ${missed} not` : ''}.
      </p>

      <p className={styles.caveat}>
        {comparison.baselineMs === null
          ? 'There is no earlier record of this transition to compare against yet.'
          : 'A comparison between two medians, not proof of a lasting change. One drill against your earlier sessions cannot tell an improvement from a good few minutes.'}
      </p>
    </section>
  )
}

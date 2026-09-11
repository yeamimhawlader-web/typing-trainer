/**
 * Transitions that are consistently slower than this typist's own baseline.
 *
 * The cross-session follow-up to the single-test experiment, which found that
 * one session ranks mostly noise. This one asks the same question of
 * accumulated history and shows its working: every row carries the evidence
 * behind it, so a reader can decide for themselves whether to believe it.
 *
 * It has three honest answers and gives whichever is true, never dressing one
 * up as another:
 *
 * - not enough history yet, said plainly;
 * - enough history, and nothing stood out — a real and common result;
 * - these sequences, with their evidence.
 *
 * Nothing here says "weakness", and nothing suggests what to practise.
 */

import type { PersistentSequenceReport } from '@core/telemetry'

import styles from './PersistentSequences.module.css'

/** Beyond a handful this stops being a finding and becomes a list. */
const MAX_SHOWN = 5

export interface PersistentSequencesProps {
  /** Null while the analysis is still loading. */
  readonly report: PersistentSequenceReport | null
}

const formatMs = (value: number): string => `${Math.round(value)} ms`

const formatDelta = (value: number): string =>
  `${value >= 0 ? '+' : '−'}${Math.abs(Math.round(value))} ms`

const Section = ({ children }: { children: React.ReactNode }) => (
  <section className={styles.section} aria-labelledby="persistent-sequences-heading">
    <h2 className={styles.heading} id="persistent-sequences-heading">
      Sequences consistently slower than your baseline
    </h2>
    {children}
  </section>
)

export const PersistentSequences = ({ report }: PersistentSequencesProps) => {
  if (report === null) return null

  const { thresholds } = report

  if (!report.hasEnoughHistory) {
    return (
      <Section>
        <p className={styles.note}>
          Not enough history yet. This needs keystroke detail from at least{' '}
          {thresholds.minimumSessions} tests in this range, and has{' '}
          {report.sessionsWithTelemetry}. Keep practising and it will appear —
          one test on its own is too small a sample to tell a slow transition
          from a slow moment.
        </p>
      </Section>
    )
  }

  if (report.candidates.length === 0) {
    return (
      <Section>
        <p className={styles.note}>
          Nothing stood out across {report.sessionsWithTelemetry} tests. Of{' '}
          {report.metEvidenceThreshold}{' '}
          {report.metEvidenceThreshold === 1 ? 'sequence' : 'sequences'} with enough
          data to judge, none was reliably slower than your{' '}
          {formatMs(report.baselineMs ?? 0)} typical transition. That is a result,
          not a gap — an even keyboard is what it looks like.
        </p>
      </Section>
    )
  }

  const shown = report.candidates.slice(0, MAX_SHOWN)

  return (
    <Section>
      <ul className={styles.list}>
        {shown.map((entry) => (
          <li key={entry.sequence} className={styles.row}>
            <span className={styles.sequence}>{entry.sequence}</span>

            <span className={styles.timing}>
              {formatMs(entry.medianMs)}{' '}
              <span className={styles.delta}>
                ({formatDelta(entry.deltaMs)} vs baseline)
              </span>
            </span>

            <span className={styles.evidence}>
              {entry.observations} observations across {entry.sessions} tests, slower
              in {entry.slowerSessions} of {entry.sessions}
            </span>
          </li>
        ))}
      </ul>

      <p className={styles.caveat}>
        Median time between the two keys, taken per test and then across tests, so
        one long session cannot outvote the rest. Compared against your own{' '}
        {formatMs(report.baselineMs ?? 0)} typical transition over the same{' '}
        {report.sessionsWithTelemetry} tests — not a fixed target. Counted only
        where both keys were typed correctly and in sequence, needing at least{' '}
        {thresholds.minimumObservations} observations across{' '}
        {thresholds.minimumSessions} tests. These are heuristic measures, not a
        diagnosis: a sequence can be slow because it is awkward, or because it
        turns up in words you have to think about.
      </p>
    </Section>
  )
}

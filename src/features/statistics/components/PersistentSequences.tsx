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
 * - these sequences, with their evidence, grouped by how much that evidence
 *   will bear. Only `strong` rows get a Train button; `possible` rows are
 *   labelled as needing more tests and keep only a quiet link, so a difference
 *   that may be noise is not presented as something to act on.
 *
 * Nothing here says "weakness", and nothing tells the reader what to practise.
 *
 * ## In plain words
 *
 * It is written for someone who has never heard the word telemetry. The
 * analysis is a statistician's — transitions, baselines, evidence tiers — and
 * the page used to speak it: "sequences consistently slower than your
 * baseline". What a typist wants to know is which letter pairs slow them down,
 * so that is what it says, and "strong" and "possible" are "Clear pattern" and
 * "Maybe". Every number is still the one the analysis produced. How it is
 * worked out is one press away rather than two paragraphs in the way, except
 * the one number a reader needs to check a row — their usual time between
 * keys — which stays in sight.
 */

import { Link } from 'react-router'

import { drillPath } from '@app/routes.ts'
import {
  EVIDENCE_TIERS,
  type PersistentSequenceReport,
  type SequenceEvidence,
} from '@core/telemetry'
import { isDrillableSequence } from '@core/text'
import { ButtonLink } from '@shared/ui'

import styles from './PersistentSequences.module.css'

/** Beyond a handful this stops being a finding and becomes a list. */
const MAX_SHOWN = 5

export interface PersistentSequencesProps {
  /** Null while the analysis is still loading. */
  readonly report: PersistentSequenceReport | null
}

const formatMs = (value: number): string => `${Math.round(value)} ms`

const formatPercent = (ratio: number): string => `${Math.round(ratio * 100)}%`

const formatDelta = (value: number): string =>
  `${value >= 0 ? '+' : '−'}${Math.abs(Math.round(value))} ms`

const tests = (count: number): string => `${count} ${count === 1 ? 'test' : 'tests'}`

const pairs = (count: number): string => `${count} ${count === 1 ? 'pair' : 'pairs'}`

/** "4 tests" from nothing, "2 more tests" from two of four, never "0 more". */
const stillToTake = (needed: number, had: number): string => {
  const left = Math.max(1, needed - had)
  return had === 0 ? tests(left) : `${left} more ${left === 1 ? 'test' : 'tests'}`
}

const Section = ({ children }: { children: React.ReactNode }) => (
  <section className={styles.section} aria-labelledby="persistent-sequences-heading">
    <h2 className={styles.heading} id="persistent-sequences-heading">
      Letter pairs that slow you down
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
          {/* What is still to do, not what is required and what is had: the
              reader should not have to subtract. */}
          Take {stillToTake(thresholds.minimumSessions, report.sessionsWithTelemetry)} and this
          will show which letter pairs slow you down. One test can't tell a habit from a
          one-off.
        </p>
      </Section>
    )
  }

  if (report.candidates.length === 0) {
    return (
      <Section>
        <p className={styles.note}>
          No letter pair stands out across your {tests(report.sessionsWithTelemetry)}. We
          checked {report.metEvidenceThreshold}, and none is reliably slower than your
          usual {formatMs(report.baselineMs ?? 0)} between keys. That's good news: your
          typing is even.
        </p>
      </Section>
    )
  }

  // Strong rows are sorted first, so the cap never hides one behind a
  // possible row.
  const shown = report.candidates.slice(0, MAX_SHOWN)
  const strong = shown.filter((entry) => entry.tier === 'strong')
  const possible = shown.filter((entry) => entry.tier === 'possible')

  const row = (entry: SequenceEvidence) => (
    <li key={entry.sequence} className={styles.row}>
      <span className={styles.sequence}>{entry.sequence}</span>

      <span className={styles.timing}>
        {formatMs(entry.medianMs)}{' '}
        <span className={styles.delta}>
          (
          {formatDelta(
            Math.round(entry.medianMs) - Math.round(report.baselineMs ?? entry.medianMs),
          )}{' '}
          vs your usual)
        </span>
      </span>

      <span className={styles.evidence}>
        seen {entry.observations} times in {tests(entry.sessions)} · slower in{' '}
        {entry.slowerSessions}
      </span>

      {/* Offered only where a drill can actually be built from real words. A
          button that leads to "no drill for that sequence" would be worse than
          no button. Prominent only where the evidence is strong; a possible
          row keeps a quiet way in rather than none. */}
      {isDrillableSequence(entry.sequence) &&
        (entry.tier === 'strong' ? (
          <ButtonLink
            to={drillPath(entry.sequence)}
            variant="secondary"
            className={styles.train}
            aria-label={`Train ${entry.sequence}`}
          >
            Train
          </ButtonLink>
        ) : (
          <Link
            to={drillPath(entry.sequence)}
            className={styles.tryDrill}
            aria-label={`Try a drill for ${entry.sequence}`}
          >
            Try a drill
          </Link>
        ))}
    </li>
  )

  return (
    <Section>
      {/* The one number a reader needs to check a row — 118 ms, +24 ms —
          kept in sight rather than in the explanation below. */}
      <p className={styles.usual}>
        Compared with your usual {formatMs(report.baselineMs ?? 0)} between keys.
      </p>

      {strong.length > 0 ? (
        <>
          <h3 className={styles.group}>Clear pattern</h3>
          <ul className={styles.list}>{strong.map(row)}</ul>
        </>
      ) : (
        <p className={styles.note}>
          Nothing clear yet. The pairs below might be real, or just the normal ups and
          downs of {tests(report.sessionsWithTelemetry)}.
        </p>
      )}

      {possible.length > 0 && (
        <>
          <h3 className={styles.group}>Maybe — needs more tests</h3>
          <ul className={`${styles.list} ${styles.possible}`}>{possible.map(row)}</ul>
        </>
      )}

      <details className={styles.how}>
        <summary className={styles.howSummary}>How is this worked out?</summary>

        <p className={styles.caveat}>
          <strong>Clear pattern</strong> means at least{' '}
          {formatPercent(EVIDENCE_TIERS.strong.minimumRelativeDelta)} slower than your usual
          time between keys, in so many tests that luck is an unlikely explanation — even
          after allowing for the {pairs(report.metEvidenceThreshold)} we checked.{' '}
          <strong>Maybe</strong> means at least{' '}
          {formatPercent(EVIDENCE_TIERS.possible.minimumRelativeDelta)} slower on thinner
          evidence, and it may turn out to be nothing.
        </p>

        <p className={styles.caveat}>
          We take the middle time for each pair in each test, and then the middle of
          those, so one long test can't outweigh the rest. It's compared with your own
          usual speed over the same {tests(report.sessionsWithTelemetry)}, not a fixed
          target, and only counted when both keys were typed correctly, one after the
          other, at least {thresholds.minimumObservations} times across{' '}
          {tests(thresholds.minimumSessions)}. A pair can be slow because it's awkward to
          reach, or because it turns up in words you have to think about.
        </p>
      </details>
    </Section>
  )
}

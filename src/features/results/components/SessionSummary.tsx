/**
 * The result of one test.
 *
 * Used in two places — the panel shown when a test finishes, and the session
 * detail page — so a result looks the same wherever it is read.
 *
 * Every figure comes from `session.metrics`, already computed by the engine and
 * stored. Nothing here recalculates speed, accuracy or a character count; the
 * only arithmetic is turning stored counts into bar widths, which is a fact
 * about the picture rather than a fact about the test.
 */

import type { TypingSession } from '@core/sessions'
import type { SequenceReport } from '@core/telemetry'

import {
  formatAccuracy,
  formatCompletedAt,
  formatCount,
  formatDuration,
  formatMode,
  formatSource,
  formatWpm,
  toIsoString,
} from '../format.ts'

import { SlowSequences } from './SlowSequences.tsx'

import styles from './SessionSummary.module.css'

interface CompositionSegment {
  readonly key: string
  readonly label: string
  readonly count: number
  readonly className: string
  readonly swatch: string
}

/**
 * Splits the text into what happened to it.
 *
 * `correctCharacters` includes the ones that were fixed, so the clean count is
 * the difference. A remainder is possible if a mode ends a test before the text
 * runs out; it is simply left as the bar's background.
 */
const toSegments = (session: TypingSession): readonly CompositionSegment[] => {
  const { correctCharacters, correctedCharacters, incorrectCharacters } =
    session.metrics
  const cleanlyCorrect = Math.max(0, correctCharacters - correctedCharacters)

  return [
    {
      key: 'correct',
      // Not "Correct": that word means currently correct everywhere on this
      // screen, corrections included. This segment is the part that was right
      // on the first try, and it plus Corrected is the Correct figure below.
      label: 'First try',
      count: cleanlyCorrect,
      className: styles.segmentCorrect ?? '',
      swatch: styles.segmentCorrect ?? '',
    },
    {
      key: 'corrected',
      label: 'Corrected',
      count: correctedCharacters,
      className: styles.segmentCorrected ?? '',
      swatch: styles.segmentCorrected ?? '',
    },
    {
      key: 'incorrect',
      label: 'Incorrect',
      count: incorrectCharacters,
      className: styles.segmentIncorrect ?? '',
      swatch: styles.segmentIncorrect ?? '',
    },
  ]
}

const CompositionBar = ({ session }: { session: TypingSession }) => {
  const segments = toSegments(session)
  const total = Math.max(1, session.metrics.totalCharacters)

  const count = (key: string): number =>
    segments.find((segment) => segment.key === key)?.count ?? 0
  const firstTry = count('correct')
  const corrected = count('corrected')
  const incorrect = count('incorrect')
  const correct = firstTry + corrected

  return (
    <>
      <div
        className={styles.bar}
        role="img"
        // Stated with the same meaning of "correct" as the figures below it:
        // corrections included, with the first-try and corrected parts named.
        aria-label={`${correct} correct (${firstTry} first try, ${corrected} corrected), ${incorrect} incorrect`}
      >
        {segments
          .filter((segment) => segment.count > 0)
          .map((segment) => (
            <div
              key={segment.key}
              className={`${styles.segment} ${segment.className}`}
              style={{ width: `${(segment.count / total) * 100}%` }}
            />
          ))}
      </div>

      <p className={styles.legend} aria-hidden>
        {segments.map((segment) => (
          <span key={segment.key} className={styles.legendItem}>
            <span className={`${styles.swatch} ${segment.swatch}`} />
            {segment.label} <span className={styles.legendValue}>{segment.count}</span>
          </span>
        ))}
      </p>
    </>
  )
}

interface DetailProps {
  readonly label: string
  readonly children: React.ReactNode
}

const Detail = ({ label, children }: DetailProps) => (
  <div className={styles.detail}>
    <dt className={styles.label}>{label}</dt>
    <dd className={styles.detailValue}>{children}</dd>
  </div>
)

export interface SessionSummaryProps {
  readonly session: TypingSession
  /** Labels the region for assistive technology. */
  readonly label?: string
  /**
   * Slowest transitions of this test, when telemetry was kept for it. Absent
   * for sessions recorded before telemetry existed.
   */
  readonly sequences?: SequenceReport | null
}

export const SessionSummary = ({
  session,
  label = 'Test result',
  sequences = null,
}: SessionSummaryProps) => {
  const { metrics } = session

  return (
    <section className={styles.summary} aria-label={label}>
      <div className={styles.headline}>
        <p className={styles.primary}>
          <span className={styles.primaryValue}>{formatWpm(metrics.netWpm)}</span>
          <span className={styles.primaryUnit}>wpm</span>
        </p>

        <dl className={styles.secondary}>
          <div className={styles.secondaryItem}>
            <dd className={styles.secondaryValue}>
              {formatAccuracy(metrics.accuracy)}
            </dd>
            <dt className={styles.label}>accuracy</dt>
          </div>
          <div className={styles.secondaryItem}>
            <dd className={styles.secondaryValue}>{formatWpm(metrics.rawWpm)}</dd>
            <dt className={styles.label}>raw wpm</dt>
          </div>
        </dl>
      </div>

      <CompositionBar session={session} />

      <dl className={styles.details}>
        <Detail label="Duration">{formatDuration(session.durationMs)}</Detail>
        <Detail label="Characters">{formatCount(metrics.totalCharacters)}</Detail>
        <Detail label="Correct">{formatCount(metrics.correctCharacters)}</Detail>
        <Detail label="Incorrect">{formatCount(metrics.incorrectCharacters)}</Detail>
        <Detail label="Corrected">{formatCount(metrics.correctedCharacters)}</Detail>
        <Detail label="Errors">{formatCount(metrics.errorCount)}</Detail>
        <Detail label="Mode">{formatMode(session)}</Detail>
        <Detail label="Source">{formatSource(session)}</Detail>
        <Detail label="Completed">
          <time dateTime={toIsoString(session)}>{formatCompletedAt(session)}</time>
        </Detail>
      </dl>

      <SlowSequences report={sequences} />
    </section>
  )
}

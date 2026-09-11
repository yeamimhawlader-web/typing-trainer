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
      label: 'Correct',
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

  return (
    <>
      <div
        className={styles.bar}
        role="img"
        aria-label={segments
          .map((segment) => `${segment.count} ${segment.label.toLowerCase()}`)
          .join(', ')}
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
}

export const SessionSummary = ({
  session,
  label = 'Test result',
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
    </section>
  )
}

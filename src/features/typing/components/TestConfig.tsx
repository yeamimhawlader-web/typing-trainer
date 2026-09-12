/**
 * The test configuration entry point.
 *
 * Deliberately one setting. It is the place further options will hang from —
 * text source, punctuation, a time limit — but shipping empty scaffolding for
 * settings that do not exist yet would be clutter pretending to be a feature.
 */

import { cx } from '@shared/lib'

import { WORD_COUNT_OPTIONS, type WordCount } from '../hooks/useTypingSession.ts'

import styles from './TestConfig.module.css'

export interface TestConfigProps {
  readonly wordCount: WordCount
  readonly onWordCountChange: (count: WordCount) => void
  readonly onRestart: () => void
  /**
   * Names the drill this test is, replacing the length control.
   *
   * A drill is a fixed piece of material, so a 15/30/60 choice would either
   * do nothing or quietly generate different text — and different text is
   * the one thing that would make the before-and-after comparison meaningless.
   */
  readonly drillSequence?: string | null
}

export const TestConfig = ({
  wordCount,
  onWordCountChange,
  onRestart,
  drillSequence = null,
}: TestConfigProps) => (
  <div className={styles.bar}>
    <span className={styles.label} id="word-count-label">
      {drillSequence === null ? 'Words' : 'Drill'}
    </span>

    <div className={styles.group} role="group" aria-labelledby="word-count-label">
      {drillSequence !== null && <span className={styles.target}>{drillSequence}</span>}
      {drillSequence === null &&
        WORD_COUNT_OPTIONS.map((count) => (
        <button
          key={count}
          type="button"
          className={cx(styles.option, count === wordCount && styles.selected)}
          aria-pressed={count === wordCount}
          onClick={(event) => {
            // Hand focus back, so the next Space types instead of re-pressing
            // this button.
            event.currentTarget.blur()
            onWordCountChange(count)
          }}
          >
            {count}
          </button>
        ))}
    </div>

    <span className={styles.divider} aria-hidden />

    <button
      type="button"
      className={styles.option}
      onClick={(event) => {
        event.currentTarget.blur()
        onRestart()
      }}
    >
      restart
    </button>
  </div>
)

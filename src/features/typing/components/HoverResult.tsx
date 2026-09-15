/**
 * What Hover Mode focused on during a test, and how the repetitions went.
 *
 * Sits under the ordinary result, like a drill's: speed and accuracy stay the
 * headline. They describe the pass through the text — the repetitions are typed
 * while the text is paused — and this section describes the repetitions, one
 * row per focused word, from the record saved with the session.
 *
 * Flat wording, and no score. It says the difficulty, which words were caught,
 * the cycles each went through, how many repetitions were clean and how many
 * had a mistake, whether the word cleared, and whether it was kept in Golden
 * Nuggets to come back to.
 */

import { Link } from 'react-router'

import { ROUTES } from '@app/routes.ts'
import type { HoverSessionRecord } from '@core/sessions'
import { HOVER_DIFFICULTY_DETAILS } from '@features/ggtyping'

import styles from './HoverResult.module.css'

export interface HoverResultProps {
  readonly record: HoverSessionRecord
}

const formatSeconds = (milliseconds: number): string => `${(milliseconds / 1000).toFixed(1)} s`

export const HoverResult = ({ record }: HoverResultProps) => {
  const { focuses, difficulty } = record
  const totalMs = focuses.reduce((sum, focus) => sum + focus.focusMs, 0)
  const kept = focuses.filter((focus) => focus.goldenNugget).length

  // A word can be focused more than once in a test; its position and how many
  // times it came before make each row's identity.
  const seen = new Map<number, number>()
  const rows = focuses.map((focus) => {
    const occurrence = seen.get(focus.wordIndex) ?? 0
    seen.set(focus.wordIndex, occurrence + 1)
    return { focus, key: `${focus.wordIndex}.${occurrence}` }
  })

  return (
    <section className={styles.section} aria-labelledby="hover-result-heading">
      <h3 className={styles.heading} id="hover-result-heading">
        Hover Mode
      </h3>

      {difficulty !== undefined && (
        <p className={styles.difficulty}>
          Difficulty <span className={styles.difficultyName}>{HOVER_DIFFICULTY_DETAILS[difficulty].label}</span>
          <span className={styles.note}> — {HOVER_DIFFICULTY_DETAILS[difficulty].description.toLowerCase()}</span>
        </p>
      )}

      {focuses.length === 0 ? (
        <p className={styles.note}>No word needed a focus: nothing was mistyped.</p>
      ) : (
        <>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <caption className="visually-hidden">Words focused after a mistake, in order</caption>
              <thead>
                <tr>
                  <th scope="col">Word</th>
                  <th scope="col" className={styles.numeric}>
                    Cycles
                  </th>
                  <th scope="col" className={styles.numeric}>
                    Clean
                  </th>
                  <th scope="col" className={styles.numeric}>
                    With a mistake
                  </th>
                  <th scope="col">Cleared</th>
                  <th scope="col">Golden Nuggets</th>
                  <th scope="col" className={styles.numeric}>
                    Focus time
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ focus, key }) => (
                  <tr key={key}>
                    <td>
                      <span className={styles.word}>{focus.word}</span>
                    </td>
                    <td className={styles.numeric}>{focus.cycles}</td>
                    <td className={styles.numeric}>
                      {focus.successes}
                      <span className={styles.of}> of {focus.attempts}</span>
                    </td>
                    <td className={styles.numeric}>{focus.failures}</td>
                    <td>{focus.cleared ? 'Yes' : focus.limitReached ? 'Not yet — limit reached' : 'Not yet'}</td>
                    <td>{focus.goldenNugget ? 'Kept' : '—'}</td>
                    <td className={styles.numeric}>{formatSeconds(focus.focusMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className={styles.note}>
            {focuses.length} {focuses.length === 1 ? 'word' : 'words'} focused, {formatSeconds(totalMs)} in all. Speed
            and accuracy above are for the text; the repetitions are counted here.
            {kept > 0 && (
              <>
                {' '}
                {kept === 1 ? 'One word was' : `${kept} words were`} kept in{' '}
                <Link to={ROUTES.ggNuggets} className={styles.link}>
                  Golden Nuggets
                </Link>{' '}
                to come back to.
              </>
            )}
          </p>
        </>
      )}
    </section>
  )
}

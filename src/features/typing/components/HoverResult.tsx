/**
 * What Hover Mode focused on during a test, and how the repetitions went.
 *
 * Sits under the ordinary result, like a drill's: speed and accuracy stay the
 * headline. They describe the pass through the text — the repetitions are typed
 * while the text is paused — and this section describes the repetitions, one
 * row per focused word, from the record saved with the session.
 *
 * Flat wording, and no score. It says which words were caught, how many clean
 * repetitions each needed by the end, how many were clean, how many had a
 * mistake in them, and how long each focus held the typist.
 */

import type { HoverSessionRecord } from '@core/sessions'

import styles from './HoverResult.module.css'

export interface HoverResultProps {
  readonly record: HoverSessionRecord
}

const formatSeconds = (milliseconds: number): string => `${(milliseconds / 1000).toFixed(1)} s`

export const HoverResult = ({ record }: HoverResultProps) => {
  const { focuses } = record
  const totalMs = focuses.reduce((sum, focus) => sum + focus.focusMs, 0)

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
                    Clean repetitions
                  </th>
                  <th scope="col" className={styles.numeric}>
                    With a mistake
                  </th>
                  <th scope="col" className={styles.numeric}>
                    Required
                  </th>
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
                      {!focus.completed && (
                        <span className={styles.flag}>{focus.limitReached ? 'limit reached' : 'unfinished'}</span>
                      )}
                    </td>
                    <td className={styles.numeric}>{focus.successes}</td>
                    <td className={styles.numeric}>{focus.failures}</td>
                    <td className={styles.numeric}>{focus.required}</td>
                    <td className={styles.numeric}>{formatSeconds(focus.focusMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className={styles.note}>
            {focuses.length} {focuses.length === 1 ? 'word' : 'words'} focused, {formatSeconds(totalMs)} in all. Speed
            and accuracy above are for the text; the repetitions are counted here.
          </p>
        </>
      )}
    </section>
  )
}

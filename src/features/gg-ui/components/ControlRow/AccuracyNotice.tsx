/**
 * A word about accuracy, when accuracy is worth a word.
 *
 * Subscribed to the state rather than to the figure, so it renders when the
 * state changes and at no other time: a typist drifting from 97% to 96.4% moves
 * the number a dozen times and this not at all. One transition per change,
 * which is also what makes it bearable to read.
 *
 * ## Said afterwards, not during
 *
 * The words wait for the test to finish. Mid-test they are a sentence arriving
 * in the corner of the eye of someone whose eyes are busy, and they arrive at
 * the worst moment — the one where accuracy has just dropped, which is the one
 * where concentration is worth most. They are also, read at that moment, a
 * judgement on a few keystrokes rather than on a test: a stumble in the first
 * line reads as critical and has washed out by the end.
 *
 * Waiting fixes both. What is said once the test is over is true of the test,
 * and lands where a verdict belongs. The accuracy figure itself goes on turning
 * live, for anyone who wants to watch it; only the sentence waits.
 *
 * It is never a popup and never moves anything: the line is always there, empty
 * while nothing needs saying, so arriving text pushes nothing around. What it
 * says is plain — the cost, not a telling-off — and the state is carried by a
 * mark and a word as well as by colour.
 */

import type { EngineSnapshot, TypingEngine } from '@core/engine'
import { selectAccuracyState, useEngineValue, type AccuracyState } from '@features/typing'

import styles from './AccuracyNotice.module.css'

const WORDS: Readonly<Record<AccuracyState, string | null>> = {
  normal: null,
  caution: 'Keep an eye on accuracy.',
  critical: 'Accuracy is costing you speed.',
}

/** Over, either way: the words are as true of a test left as of one finished. */
const isOver = (snapshot: EngineSnapshot): boolean =>
  snapshot.status === 'completed' || snapshot.status === 'abandoned'

export const AccuracyNotice = ({ engine }: { engine: TypingEngine }) => {
  // Two values, each changing at most a handful of times in a test, and neither
  // of them on a keystroke.
  const state = useEngineValue(engine, selectAccuracyState)
  const over = useEngineValue(engine, isOver)
  // Silent while typing, down to the state the line is drawn in.
  const said = over ? state : 'normal'
  const words = WORDS[said]

  return (
    <p className={styles.notice} data-state={said} role="status" aria-label="Accuracy">
      {words !== null && (
        <>
          {/* A mark, so the state is not carried by colour alone. */}
          <span className={styles.mark} aria-hidden="true" data-state={state} />
          {words}
        </>
      )}
    </p>
  )
}

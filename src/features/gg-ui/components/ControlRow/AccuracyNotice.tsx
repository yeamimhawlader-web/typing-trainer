/**
 * A word about accuracy, when accuracy is worth a word.
 *
 * Subscribed to the state rather than to the figure, so it renders when the
 * state changes and at no other time: a typist drifting from 97% to 96.4% moves
 * the number a dozen times and this not at all. One transition per change,
 * which is also what makes it bearable to read.
 *
 * It is never a popup and never moves anything: the line is always there, empty
 * while nothing needs saying, so arriving text pushes nothing around. What it
 * says is plain — the cost, not a telling-off — and the state is carried by a
 * mark and a word as well as by colour.
 */

import type { TypingEngine } from '@core/engine'
import { selectAccuracyState, useEngineValue, type AccuracyState } from '@features/typing'

import styles from './AccuracyNotice.module.css'

const WORDS: Readonly<Record<AccuracyState, string | null>> = {
  normal: null,
  caution: 'Keep an eye on accuracy.',
  critical: 'Accuracy is costing you speed.',
}

export const AccuracyNotice = ({ engine }: { engine: TypingEngine }) => {
  const state = useEngineValue(engine, selectAccuracyState)
  const words = WORDS[state]

  return (
    <p className={styles.notice} data-state={state} role="status" aria-label="Accuracy">
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

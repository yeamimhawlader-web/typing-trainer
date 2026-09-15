/**
 * The line under the text that says what the keyboard will do.
 *
 * Subscribes to status and idleness alone, so it does not hold up the tree.
 * Shared by both typing screens: the pause rule and the keys are the same
 * whichever screen a test is typed on.
 */

import type { TypingEngine } from '@core/engine'

import { useEngineValue } from '../hooks/useEngineValue.ts'

import styles from './SessionHint.module.css'

export const SessionHint = ({ engine }: { engine: TypingEngine }) => {
  const status = useEngineValue(engine, (snapshot) => snapshot.status)
  const idle = useEngineValue(engine, (snapshot) => snapshot.idle)

  // Once a test is finished the results panel carries the instructions, so this
  // line gets out of the way rather than repeating them.
  if (status === 'completed') return null

  if (status === 'running') {
    return idle ? (
      // The clock stopped counting when the idle cap ran out; saying so is what
      // makes a frozen timer read as intended rather than as a fault.
      <p className={styles.hint}>
        Paused — keep typing to continue, or <kbd className={styles.key}>Tab</kbd> to
        restart.
      </p>
    ) : (
      <p className={styles.hint}>
        <kbd className={styles.key}>Tab</kbd> to restart.
      </p>
    )
  }

  // No Tab hint here: while idle there is nothing to restart, and Tab is left
  // to move focus so the page stays navigable by keyboard.
  return <p className={styles.hint}>Start typing to begin.</p>
}

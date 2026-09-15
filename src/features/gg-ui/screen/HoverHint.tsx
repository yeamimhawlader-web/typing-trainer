/**
 * The line under the field, in Hover Mode.
 *
 * Says what the keyboard will do next, like the ordinary hint it stands in for
 * while a word is focused. How many repetitions are left is the nodes' to show,
 * not this line's, so it never counts.
 */

import { useSyncExternalStore } from 'react'

import type { TypingEngine } from '@core/engine'
import type { HoverController } from '@features/ggtyping'
import { SessionHint } from '@features/typing'

import styles from './HoverHint.module.css'

export interface HoverHintProps {
  readonly engine: TypingEngine
  readonly hover: HoverController
}

export const HoverHint = ({ engine, hover }: HoverHintProps) => {
  const phase = useSyncExternalStore(hover.subscribe, () => hover.getSnapshot().phase)
  const word = useSyncExternalStore(hover.subscribe, () => hover.getSnapshot().focus?.word ?? null)

  if (phase === 'normal' || word === null) return <SessionHint engine={engine} />

  return (
    <p className={styles.hint}>
      {phase === 'pending' ? (
        <>
          Finish <span className={styles.word}>{word}</span>, then type it again.
        </>
      ) : (
        <>
          Type <span className={styles.word}>{word}</span> again until its dots are filled.{' '}
          <kbd className={styles.key}>Tab</kbd> to restart.
        </>
      )}
    </p>
  )
}

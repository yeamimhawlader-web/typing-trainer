/**
 * The typing text — the visual centre of the screen, and the hot path.
 *
 * Every character subscribes to the engine independently. A keystroke changes
 * the state of one character and moves the caret, so exactly two of these
 * components re-render; the other two hundred are untouched. Rendering the list
 * from a parent that re-renders on each keystroke would instead rebuild every
 * element in the text, sixty times a second at speed.
 */

import { memo } from 'react'

import type { TypingEngine } from '@core/engine'
import { cx } from '@shared/lib'

import { useEngineValue } from '../hooks/useEngineValue.ts'

import styles from './TypingSurface.module.css'

interface CharacterProps {
  readonly engine: TypingEngine
  readonly character: string
  readonly index: number
}

const Character = ({ engine, character, index }: CharacterProps) => {
  const state = useEngineValue(engine, (snapshot) => {
    // Before the first keystroke the engine holds no target, so every position
    // reads as pending — which is exactly what should be on screen.
    return snapshot.characterStates[index] ?? 'pending'
  })
  const isCursor = useEngineValue(engine, (snapshot) => snapshot.cursorIndex === index)

  return (
    <span className={cx(styles.character, styles[state], isCursor && styles.cursor)}>
      {character}
    </span>
  )
}

/** Carries the caret once the last character has been typed. */
const EndCaret = ({ engine, total }: { engine: TypingEngine; total: number }) => {
  const isCursor = useEngineValue(
    engine,
    (snapshot) => total > 0 && snapshot.cursorIndex >= total,
  )

  return <span className={cx(styles.endCaret, isCursor && styles.cursor)} aria-hidden />
}

interface CharacterListProps {
  readonly engine: TypingEngine
  readonly characters: readonly string[]
}

/**
 * Memoised so that a status change on the wrapper — which happens when a test
 * starts and when it ends — does not rebuild every character element.
 */
const CharacterList = memo(({ engine, characters }: CharacterListProps) => (
  <>
    {characters.map((character, index) => (
      /* Position *is* the identity here: characters never reorder, the index is
         what each one subscribes to the engine by, and loading a new test
         replaces the whole array. */
      // eslint-disable-next-line react/no-array-index-key
      <Character key={index} engine={engine} character={character} index={index} />
    ))}
    <EndCaret engine={engine} total={characters.length} />
  </>
))

CharacterList.displayName = 'CharacterList'

export interface TypingSurfaceProps {
  readonly engine: TypingEngine
  readonly characters: readonly string[]
}

export const TypingSurface = ({ engine, characters }: TypingSurfaceProps) => {
  const status = useEngineValue(engine, (snapshot) => snapshot.status)

  return (
    <div className={styles.surface} data-status={status}>
      <CharacterList engine={engine} characters={characters} />
    </div>
  )
}

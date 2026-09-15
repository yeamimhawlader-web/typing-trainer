/**
 * The typing text — the visual centre of the screen, and the hot path.
 *
 * Every character subscribes to the engine independently. A keystroke changes
 * the state of one character and moves the caret, so exactly two of these
 * components re-render; the other two hundred are untouched. Rendering the list
 * from a parent that re-renders on each keystroke would instead rebuild every
 * element in the text, sixty times a second at speed.
 *
 * Words are wrapped so the GGTyping word jump can move one as a unit. The
 * wrappers hold no state and subscribe to nothing; see `@features/ggtyping`.
 */

import { memo, useCallback, useMemo, type ReactNode } from 'react'

import { computeWordRanges, type TypingEngine } from '@core/engine'
import { useWordJumps, type WordJumpController } from '@features/ggtyping'
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

interface WordProps {
  readonly index: number
  readonly jumps: WordJumpController
  readonly children: ReactNode
}

/**
 * One word's characters, in an element that can move as a unit.
 *
 * `inline-block` because a transform does not apply to a plain inline box, and
 * it is inline-block always — not only while jumping — because switching
 * display mid-test would reflow the line. It subscribes to nothing, so it never
 * re-renders on a keystroke; a jump reaches it through its ref, not its props.
 */
const Word = ({ index, jumps, children }: WordProps) => {
  const register = useCallback(
    (element: HTMLSpanElement | null) => (element === null ? undefined : jumps.register(index, element)),
    [index, jumps],
  )

  return (
    <span ref={register} className={styles.word} data-word={index}>
      {children}
    </span>
  )
}

interface CharacterListProps {
  readonly engine: TypingEngine
  readonly characters: readonly string[]
  readonly jumps: WordJumpController
}

/**
 * Memoised so that a status change on the wrapper — which happens when a test
 * starts and when it ends — does not rebuild every character element.
 *
 * Characters are grouped into words so a word can move as a unit; the spaces
 * between words stay outside them, so a mistyped space never jumps with the
 * word before it and the line breaks where it always did.
 */
const CharacterList = memo(({ engine, characters, jumps }: CharacterListProps) => {
  const words = useMemo(() => computeWordRanges(characters), [characters])

  /* Position *is* the identity here: characters never reorder, the index is
     what each one subscribes to the engine by, and loading a new test replaces
     the whole array. */
  const characterAt = (index: number) => (
    <Character key={index} engine={engine} character={characters[index] as string} index={index} />
  )

  const nodes: ReactNode[] = []
  let position = 0

  for (const word of words) {
    for (; position < word.start; position += 1) nodes.push(characterAt(position))

    const letters: ReactNode[] = []
    for (; position < word.end; position += 1) letters.push(characterAt(position))

    nodes.push(
      <Word key={`word-${word.index}`} index={word.index} jumps={jumps}>
        {letters}
      </Word>,
    )
  }

  for (; position < characters.length; position += 1) nodes.push(characterAt(position))

  return (
    <>
      {nodes}
      <EndCaret engine={engine} total={characters.length} />
    </>
  )
})

CharacterList.displayName = 'CharacterList'

export interface TypingSurfaceProps {
  readonly engine: TypingEngine
  readonly characters: readonly string[]
}

export const TypingSurface = ({ engine, characters }: TypingSurfaceProps) => {
  const status = useEngineValue(engine, (snapshot) => snapshot.status)
  const jumps = useWordJumps(engine)

  return (
    <div className={styles.surface} data-status={status}>
      <CharacterList engine={engine} characters={characters} jumps={jumps} />
    </div>
  )
}

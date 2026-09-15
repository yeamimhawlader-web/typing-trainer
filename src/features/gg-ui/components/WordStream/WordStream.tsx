/**
 * The word stream — with the active pill, one of the two places the UI is
 * allowed to be bold.
 *
 * It draws the typing engine's state and decides nothing. The text is the
 * engine's target, each character shows the engine's state for it — pending,
 * correct, incorrect or corrected — and the block cursor sits at the engine's
 * cursor. No key is compared with the text anywhere in this file.
 *
 * Each character subscribes to its own state, so a keystroke re-renders the one
 * character it changed. The cursor and the line position are moved by
 * `useStreamCursor`, outside React. The text size is a data attribute on the
 * block, so changing it re-renders nothing below it and the block itself keeps
 * its height.
 *
 * Words are wrapped so the GGTyping word jump can move one as a unit. It is the
 * same controller the classic screen uses, driven by the same engine events.
 *
 * In Hover Mode the stream also carries the focused word's layer (see
 * `HoverFocus`), and follows the mode's view of where to keep the text. Without
 * a hover controller none of that exists and the stream is exactly as above.
 */

import { memo, useCallback, useMemo, useState, type MouseEvent, type ReactNode } from 'react'

import { computeWordRanges, toCharacters, type TypingEngine, type WordRange } from '@core/engine'
import type { TextSize } from '@core/types'
import { useWordJumps, type HoverController, type WordJumpController } from '@features/ggtyping'
import { useEngineValue } from '@features/typing'
import { cx } from '@shared/lib'

import { createHoverView } from './hover-view.ts'
import { HoverFocus } from './HoverFocus.tsx'
import { engineCursorSource } from './stream-cursor.ts'
import { useStreamCursor } from './useStreamCursor.ts'

import styles from './WordStream.module.css'

interface CharacterProps {
  readonly engine: TypingEngine
  readonly index: number
  readonly character: string
}

const Character = ({ engine, index, character }: CharacterProps) => {
  // Before the first keystroke the engine holds no target, so every position
  // reads as pending — which is exactly what should be on screen.
  const state = useEngineValue(engine, (snapshot) => snapshot.characterStates[index] ?? 'pending')

  return (
    <span className={cx(styles.character, styles[state])} data-i={index} data-state={state}>
      {character}
    </span>
  )
}

interface WordProps {
  readonly index: number
  readonly jumps: WordJumpController
  readonly children: ReactNode
}

/**
 * One word's characters, in an element the word jump can move. It subscribes to
 * nothing, so it never re-renders on a keystroke; a jump reaches it by its ref.
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
  readonly words: readonly WordRange[]
  readonly jumps: WordJumpController
}

const CharacterList = memo(({ engine, characters, words, jumps }: CharacterListProps) => {
  /* Position is the identity here: characters never reorder, the index is what
     each one subscribes by, and a new test replaces the whole array. */
  const characterAt = (index: number) => (
    <Character key={index} engine={engine} index={index} character={characters[index] as string} />
  )

  const nodes: ReactNode[] = []
  let position = 0

  for (const word of words) {
    // The spaces between words stay outside them: that is where a line may
    // break, and a mistyped space never jumps with the word before it.
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

  return <>{nodes}</>
})

CharacterList.displayName = 'CharacterList'

export interface WordStreamProps {
  readonly engine: TypingEngine
  /** The loaded test's text, exactly as the engine was given it. */
  readonly text: string
  readonly size: TextSize
  readonly onActivate?: () => void
  /** Hover Mode's controller, when the stream is Hover Mode's. */
  readonly hover?: HoverController | undefined
}

export const WordStream = ({ engine, text, size, onActivate, hover }: WordStreamProps) => {
  const characters = useMemo(() => toCharacters(text), [text])
  const words = useMemo(() => computeWordRanges(characters), [characters])
  // Hover Mode reacts to a word's first mistake itself, so the jump on the third
  // in a row is left to ordinary practice.
  const jumps = useWordJumps(engine, undefined, hover === undefined)
  const [view] = useState(() => (hover === undefined ? null : createHoverView(engine)))
  const source = useMemo(() => view ?? engineCursorSource(engine), [engine, view])
  const cursor = useStreamCursor(source, text, size)
  const { attachViewport, attachContent, attachCursor } = cursor
  const status = useEngineValue(engine, (snapshot) => snapshot.status)

  // Clicking the words means "I want to type": keep focus in the input rather
  // than letting the click drop it onto the page.
  const activate = (event: MouseEvent) => {
    if (onActivate === undefined) return
    event.preventDefault()
    onActivate()
  }

  return (
    <section
      className={styles.block}
      data-size={size}
      data-status={status}
      aria-label="Words to type"
      onMouseDown={activate}
    >
      <div ref={attachViewport} className={styles.viewport}>
        <span ref={attachCursor} className={styles.cursor} data-placed="false" aria-hidden="true" />
        <div ref={attachContent} className={styles.content}>
          <CharacterList engine={engine} characters={characters} words={words} jumps={jumps} />
          {hover !== undefined && view !== null && (
            <HoverFocus engine={engine} hover={hover} view={view} cursor={cursor} />
          )}
        </div>
      </div>
    </section>
  )
}

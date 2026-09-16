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
 *
 * ## Syllables
 *
 * In the Syllable Trainer each word is also drawn as the chunks it is typed in:
 * the same characters, subscribed the same way, grouped into syllables with a
 * small breathing space between them. The space is not a character — the
 * engine is never given it — so it is never typed, never scored and never
 * where the cursor stops. A syllable knows only whether it is still to come,
 * in hand, or typed; a word knows only whether it is ahead, being typed,
 * resolved clean or missed (`@core/syllables`). Each re-renders when that
 * answer changes, which is once or twice a word, and the characters inside
 * them never re-render for it.
 */

import { Fragment, memo, useCallback, useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'

import { computeWordRanges, toCharacters, type TypingEngine, type WordRange } from '@core/engine'
import {
  guidanceStrength,
  SYLLABLE_RHYTHM,
  syllableRanges,
  syllableState,
  wordResolution,
  type SyllableLayout,
  type SyllableRange,
} from '@core/syllables'
import type { TextSize } from '@core/types'
import { useWordJumps, type HoverController, type WordJumpController } from '@features/ggtyping'
import { useEngineValue } from '@features/typing'
import { cx } from '@shared/lib'

import { createHoverView } from './hover-view.ts'
import { HoverFocus } from './HoverFocus.tsx'
import { PaceCaret } from './PaceCaret.tsx'
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

interface SyllableProps {
  readonly engine: TypingEngine
  readonly range: SyllableRange
  readonly shift: number
  readonly children: ReactNode
}

/** One chunk of a word: still to come, in hand, or typed. */
const Syllable = ({ engine, range, shift, children }: SyllableProps) => {
  const state = useEngineValue(engine, (snapshot) => syllableState(snapshot.cursorIndex, range.start, range.end))
  // How many gaps it slides by when its word closes up about its middle.
  const style = { '--gg-syllable-shift': shift } as CSSProperties

  return (
    <span className={styles.syllable} data-syllable={state} style={style}>
      {children}
    </span>
  )
}

interface SyllableWordProps {
  readonly engine: TypingEngine
  readonly word: WordRange
  readonly ranges: readonly SyllableRange[]
  /** Each syllable's characters, already made, so a change here re-renders none of them. */
  readonly letters: readonly ReactNode[][]
}

/** A word as its syllables, with a breath between each, and how far it has got. */
const SyllableWord = ({ engine, word, ranges, letters }: SyllableWordProps) => {
  const resolution = useEngineValue(engine, (snapshot) => wordResolution(snapshot, word.start, word.end))
  // How strongly the boundaries breathe: fully for the first words, fading after.
  const guide = { '--gg-syllable-guide': guidanceStrength(word.index) } as CSSProperties

  return (
    <span className={styles.syllables} data-resolution={resolution} style={guide}>
      {ranges.map((range, index) => (
        <Fragment key={range.start}>
          {index > 0 && <span className={styles.breath} aria-hidden="true" />}
          <Syllable engine={engine} range={range} shift={(ranges.length - 1) / 2 - index}>
            {letters[index]}
          </Syllable>
        </Fragment>
      ))}
    </span>
  )
}

interface CharacterListProps {
  readonly engine: TypingEngine
  readonly characters: readonly string[]
  readonly words: readonly WordRange[]
  readonly jumps: WordJumpController
  readonly syllables: SyllableLayout | undefined
}

const CharacterList = memo(({ engine, characters, words, jumps, syllables }: CharacterListProps) => {
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

    const starts = syllables?.[word.index]
    if (starts !== undefined && starts.length > 1) {
      const ranges = syllableRanges(word.start, word.end, starts)
      const letters: ReactNode[][] = []
      for (const range of ranges) {
        const chunk: ReactNode[] = []
        for (; position < range.end; position += 1) chunk.push(characterAt(position))
        letters.push(chunk)
      }
      nodes.push(
        <Word key={`word-${word.index}`} index={word.index} jumps={jumps}>
          <SyllableWord engine={engine} word={word} ranges={ranges} letters={letters} />
        </Word>,
      )
      continue
    }

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

/** The rhythm's own timing, handed to the stylesheet rather than written into it. */
const SYLLABLE_TIMING = { '--gg-syllable-breath': `${SYLLABLE_RHYTHM.guidance.breathMs}ms` } as CSSProperties

export interface WordStreamProps {
  readonly engine: TypingEngine
  /** The loaded test's text, exactly as the engine was given it. */
  readonly text: string
  readonly size: TextSize
  readonly onActivate?: () => void
  /** Hover Mode's controller, when the stream is Hover Mode's. */
  readonly hover?: HoverController | undefined
  /** Where each word's syllables start, when the stream is the Syllable Trainer's. */
  readonly syllables?: SyllableLayout | undefined
  /** The pace caret's speed in words per minute, or null for none. */
  readonly pace?: number | null | undefined
}

export const WordStream = ({ engine, text, size, onActivate, hover, syllables, pace = null }: WordStreamProps) => {
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
      data-syllables={syllables === undefined ? undefined : true}
      style={syllables === undefined ? undefined : SYLLABLE_TIMING}
      aria-label="Words to type"
      onMouseDown={activate}
    >
      <div ref={attachViewport} className={styles.viewport}>
        <span ref={attachCursor} className={styles.cursor} data-placed="false" aria-hidden="true" />
        <div ref={attachContent} className={styles.content}>
          <CharacterList engine={engine} characters={characters} words={words} jumps={jumps} syllables={syllables} />
          {pace !== null && pace > 0 && (
            <PaceCaret engine={engine} cursor={cursor} wpm={pace} length={characters.length} />
          )}
          {hover !== undefined && view !== null && (
            <HoverFocus engine={engine} hover={hover} view={view} cursor={cursor} />
          )}
        </div>
      </div>
    </section>
  )
}

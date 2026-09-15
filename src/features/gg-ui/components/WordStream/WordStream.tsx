/**
 * The word stream — with the active pill, one of the two places the UI is
 * allowed to be bold.
 *
 * Each character subscribes to its own mark, so a keystroke re-renders the one
 * character it changed. The cursor and the line position are moved by
 * `useStreamCursor`, outside React. The text size is a data attribute on the
 * block, so changing it re-renders nothing below it and the block itself keeps
 * its height.
 */

import { Fragment, memo, useMemo, useSyncExternalStore, type MouseEvent } from 'react'

import { cx } from '@shared/lib'

import type { StreamSize } from '../../state/shell.store.ts'
import type { TypingSource } from '../../typing/typing-source.ts'
import { useStreamCursor } from './useStreamCursor.ts'

import styles from './WordStream.module.css'

interface CharacterProps {
  readonly source: TypingSource
  readonly index: number
  readonly character: string
}

const Character = ({ source, index, character }: CharacterProps) => {
  const mark = useSyncExternalStore(source.subscribe, () => source.getMark(index))

  return (
    <span className={cx(styles.character, styles[mark])} data-i={index}>
      {character}
    </span>
  )
}

interface CharacterListProps {
  readonly source: TypingSource
}

const CharacterList = memo(({ source }: CharacterListProps) => {
  const words = useMemo(() => {
    const result: { readonly characters: readonly string[]; readonly start: number }[] = []
    for (const word of source.words) {
      const previous = result[result.length - 1]
      const start = previous === undefined ? 0 : previous.start + previous.characters.length + 1
      result.push({ characters: Array.from(word), start })
    }
    return result
  }, [source])

  return (
    <>
      {words.map(({ characters, start }, wordIndex) => (
        // Words and characters never reorder, and new text replaces the whole
        // list, so position is the identity.
        // eslint-disable-next-line react/no-array-index-key
        <Fragment key={wordIndex}>
          <span className={styles.word}>
            {characters.map((character, offset) => (
              // eslint-disable-next-line react/no-array-index-key
              <Character key={offset} source={source} index={start + offset} character={character} />
            ))}
          </span>
          {/* Outside the word, which never wraps inside itself: this space is
              where the line is allowed to break. */}
          {wordIndex < words.length - 1 && (
            <Character source={source} index={start + characters.length} character=" " />
          )}
        </Fragment>
      ))}
    </>
  )
})

CharacterList.displayName = 'CharacterList'

export interface WordStreamProps {
  readonly source: TypingSource
  readonly size: StreamSize
  readonly onActivate?: () => void
}

export const WordStream = ({ source, size, onActivate }: WordStreamProps) => {
  const { attachViewport, attachContent, attachCursor } = useStreamCursor(source, size)

  // Clicking the words means "I want to type": keep focus in the input rather
  // than letting the click drop it onto the page.
  const activate = (event: MouseEvent) => {
    if (onActivate === undefined) return
    event.preventDefault()
    onActivate()
  }

  return (
    <section className={styles.block} data-size={size} aria-label="Words to type" onMouseDown={activate}>
      <div ref={attachViewport} className={styles.viewport}>
        <span ref={attachCursor} className={styles.cursor} data-placed="false" aria-hidden="true" />
        <div ref={attachContent} className={styles.content}>
          <CharacterList source={source} />
        </div>
      </div>
    </section>
  )
}

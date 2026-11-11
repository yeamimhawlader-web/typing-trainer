/**
 * The demonstration word on a keyboard: which keys it is typed on, and how far
 * it is from each to the next.
 *
 * The same demonstration as the word beside it, seen from the hands' side. The
 * three letter rows lie tilted away, as a keyboard does in front of a typist;
 * a key goes down as its letter is typed, and a line is drawn from the key
 * before it. Inside a chunk the line is solid — one unbroken run. Between two
 * chunks it is faint, because that distance is crossed during the breath.
 * Underneath, the distance covered so far counts up in key widths.
 *
 * Every figure is the layout's own (`@core/keyboard`): straight lines between
 * key centres on a staggered QWERTY board. It is a distance and is labelled as
 * one — not how hard the word is, and not how fast it will be typed.
 *
 * It draws what it is told: the word, and how many of its letters are typed.
 * It keeps no clock of its own, so it can never be out of step with the word.
 * Decoration for the eye; the figure is also given as text.
 */

import type { CSSProperties } from 'react'

import { KEYBOARD_ROWS, keyDistance, keyPath, type KeyPosition } from '@core/keyboard'
import { syllableStarts, type SyllableWord } from '@core/syllables'

import styles from './KeyTravel.module.css'

/** The three letter rows: the number row is not part of any word here. */
const LETTER_ROWS = KEYBOARD_ROWS.filter((row) => row.y > 0)
const FIRST_ROW = Math.min(...LETTER_ROWS.map((row) => row.y))
/** The board's size in key widths: from the first key's left edge to the last key's right. */
const BOARD = {
  width: Math.max(...LETTER_ROWS.map((row) => row.offset + row.keys.length)) - Math.min(...LETTER_ROWS.map((row) => row.offset)),
  height: LETTER_ROWS.length,
  left: Math.min(...LETTER_ROWS.map((row) => row.offset)) - 0.5,
}

/** A key's centre on the board, in key widths from its top-left corner. */
const centre = (position: KeyPosition) => ({ x: position.x - BOARD.left, y: position.y - FIRST_ROW + 0.5 })

type KeyState = 'idle' | 'typed' | 'pressed'

export interface KeyTravelProps {
  readonly word: SyllableWord
  /** How many of the word's letters are typed. */
  readonly typed: number
  /** Whether a letter has just gone down, as against the word standing as a diagram. */
  readonly pressing: boolean
  /** How long a letter takes in the demonstration, so a line is drawn in the time its key takes. */
  readonly letterMs: number
}

export const KeyTravel = ({ word, typed, pressing, letterMs }: KeyTravelProps) => {
  const path = keyPath(word.word)
  const starts = syllableStarts(word.syllables)
  /** Which chunk each letter belongs to. */
  const chunkOf = (letter: number): number => starts.findLastIndex((start) => start <= letter)

  const segments = path.slice(1).map((to, index) => {
    const from = path[index] as KeyPosition
    return {
      index: index + 1,
      from: centre(from),
      to: centre(to),
      length: keyDistance(from, to),
      bridge: chunkOf(index + 1) !== chunkOf(index),
      drawn: index + 1 < typed,
    }
  })
  const covered = segments.filter((segment) => segment.drawn).reduce((total, segment) => total + segment.length, 0)

  const pressedKey = pressing && typed > 0 ? path[typed - 1]?.key : undefined
  const typedKeys = new Set(path.slice(0, typed).map((position) => position.key))
  const stateOf = (key: string): KeyState =>
    key === pressedKey ? 'pressed' : typedKeys.has(key) ? 'typed' : 'idle'

  return (
    <div className={styles.travel} style={{ '--gg-key-letter': `${letterMs}ms` } as CSSProperties}>
      <div className={styles.scene} aria-hidden="true">
        <div
          className={styles.board}
          style={{ '--gg-board-width': BOARD.width, '--gg-board-height': BOARD.height } as CSSProperties}
        >
          {LETTER_ROWS.flatMap((row) =>
            [...row.keys].map((key, column) => (
              <span
                key={key}
                className={styles.key}
                data-state={stateOf(key)}
                style={
                  {
                    '--gg-key-x': row.offset + column - 0.5 - BOARD.left,
                    '--gg-key-y': row.y - FIRST_ROW,
                  } as CSSProperties
                }
              >
                {key}
              </span>
            )),
          )}

          <svg
            className={styles.path}
            viewBox={`0 0 ${BOARD.width} ${BOARD.height}`}
            preserveAspectRatio="none"
            focusable="false"
          >
            {segments.map((segment) => (
              <line
                key={`${word.word}-${segment.index}`}
                className={styles.segment}
                data-bridge={segment.bridge}
                data-drawn={segment.drawn}
                x1={segment.from.x}
                y1={segment.from.y}
                x2={segment.to.x}
                y2={segment.to.y}
                pathLength={1}
              />
            ))}
          </svg>
        </div>
      </div>

      <p className={styles.readout}>
        <span className={styles.value}>{covered.toFixed(1)}</span>
        <span className={styles.unit}>key widths travelled</span>
      </p>
    </div>
  )
}

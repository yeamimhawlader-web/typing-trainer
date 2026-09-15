/**
 * The cursor controller, over a real typing engine and a fake layout.
 *
 * jsdom has no layout, so each character's rectangle is supplied: four
 * characters per 40px line, 10px wide. The cursor position comes from the
 * engine, as it does on screen. What is under test is the arithmetic and the
 * performance promise — a keystroke moves the cursor without reading layout.
 */

import { describe, expect, it, vi } from 'vitest'

import { createTypingEngine } from '@core/engine'
import { timestamp } from '@core/types'

import { createStreamCursor, lineIndexOf } from './stream-cursor.ts'

const CHARACTER_WIDTH = 10
const LINE = 40
const PER_LINE = 4

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect

/** A content element whose characters report a four-per-line layout. */
const stream = (count: number) => {
  const viewport = document.createElement('div')
  const content = document.createElement('div')
  const cursor = document.createElement('span')
  const reads = { count: 0 }

  // Every rectangle read is counted, the container's as well as each character's.
  content.getBoundingClientRect = () => {
    reads.count += 1
    return rect(0, 0, 400, 400)
  }
  for (let index = 0; index < count; index += 1) {
    const span = document.createElement('span')
    span.dataset.i = String(index)
    const column = index % PER_LINE
    const line = Math.floor(index / PER_LINE)
    span.getBoundingClientRect = () => {
      reads.count += 1
      return rect(column * CHARACTER_WIDTH, line * LINE + 6, CHARACTER_WIDTH, 30)
    }
    content.append(span)
  }

  viewport.append(cursor, content)
  return { viewport, content, cursor, reads }
}

/** The x and y a translate3d() moves an element by, however the DOM spells the units. */
const offset = (element: HTMLElement): readonly number[] =>
  (element.style.transform.match(/-?[\d.]+/g) ?? []).slice(1, 3).map(Number)

const connect = (count: number, words: string[]) => {
  const elements = stream(count)
  const controller = createStreamCursor()
  controller.attachViewport(elements.viewport)
  controller.attachContent(elements.content)
  controller.attachCursor(elements.cursor)
  const engine = createTypingEngine()
  let clock = 0
  const type = (keys: string | readonly string[]) => {
    for (const key of typeof keys === 'string' ? Array.from(keys) : keys) {
      clock += 100
      if (engine.getSnapshot().status === 'idle') engine.start({ text: words.join(' '), sourceId: 'test' }, timestamp(clock))
      engine.input(key, timestamp(clock))
    }
  }
  const stop = controller.follow(engine)
  controller.measure()
  return { ...elements, controller, engine, type, stop }
}

describe('stream cursor', () => {
  it('sizes the block to a character and puts it on the first one', () => {
    const { cursor } = connect(7, ['abc', 'def'])

    expect(cursor.style.width).toBe('10px')
    expect(cursor.style.height).toBe('30px')
    expect(offset(cursor)).toEqual([0, 6])
    expect(cursor.dataset.placed).toBe('true')
  })

  it('follows the current character along a line', () => {
    const { cursor, type } = connect(7, ['abc', 'def'])

    type('ab')

    expect(offset(cursor)).toEqual([20, 6])
  })

  it('shifts the content up a line on reaching the next one, keeping the cursor on the top line', () => {
    const { cursor, content, type } = connect(7, ['abc', 'def'])

    type('abc ')

    expect(offset(content)).toEqual([0, -40])
    expect(offset(cursor)).toEqual([0, 6])
  })

  it('shifts back down when the typist backspaces onto the previous line', () => {
    const { content, type } = connect(7, ['abc', 'def'])

    type('abc ')
    type(['Backspace'])

    expect(offset(content)).toEqual([0, 0])
  })

  it('hides the line above the first visible one, and shows it again on the way back', () => {
    const { content, type } = connect(7, ['abc', 'def'])
    const visibility = () => Array.from(content.children, (span) => (span as HTMLElement).style.visibility)

    expect(visibility()).toEqual(['', '', '', '', '', '', ''])

    type('abc ')
    expect(visibility()).toEqual(['hidden', 'hidden', 'hidden', 'hidden', '', '', ''])

    type(['Backspace'])
    expect(visibility()).toEqual(['', '', '', '', '', '', ''])
  })

  it('draws where the engine puts the cursor, not one step per key', () => {
    const { cursor, content, engine, type } = connect(7, ['abc', 'def'])

    // A space typed mid-word: the engine skips to the next word.
    type('ab ')

    expect(engine.getSnapshot().cursorIndex).toBe(4)
    expect(offset(content)).toEqual([0, -40])
    expect(offset(cursor)).toEqual([0, 6])
  })

  it('writes nothing when the engine announces a change that does not move the cursor', () => {
    const { cursor, content, engine, type } = connect(7, ['abc', 'def'])
    type('a')
    cursor.style.transform = 'none'
    content.style.transform = 'none'

    engine.tick(timestamp(5_000))

    expect(cursor.style.transform).toBe('none')
    expect(content.style.transform).toBe('none')
  })

  it('stops following the engine once stopped', () => {
    const { cursor, stop, type } = connect(7, ['abc', 'def'])
    type('a')

    stop()
    type('b')

    expect(offset(cursor)).toEqual([10, 6])
  })

  it('reads no layout at all on a keystroke', () => {
    const { reads, type } = connect(7, ['abc', 'def'])
    const afterMeasuring = reads.count

    type('abc de')

    expect(afterMeasuring).toBeGreaterThan(0)
    expect(reads.count).toBe(afterMeasuring)
  })

  it('places the cursor after the last character at the end of the text', () => {
    const { cursor, type } = connect(3, ['abc'])

    type('abc')

    expect(offset(cursor)).toEqual([30, 6])
  })

  it('does not slide when re-measuring: a new layout is not the cursor moving', () => {
    const { cursor, controller } = connect(7, ['abc', 'def'])
    const transitions: string[] = []
    const descriptor = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'transition')
    const spy = vi.spyOn(cursor.style, 'transition', 'set').mockImplementation((value: string) => {
      transitions.push(value)
      descriptor?.set?.call(cursor.style, value)
    })

    controller.measure()
    spy.mockRestore()

    expect(transitions).toEqual(['none', ''])
  })
})

describe('lineIndexOf', () => {
  it('finds the line a position is on, tolerating sub-pixel differences', () => {
    const tops = [6, 46, 86]

    expect(lineIndexOf(tops, 6)).toBe(0)
    expect(lineIndexOf(tops, 45.8)).toBe(1)
    expect(lineIndexOf(tops, 90)).toBe(2)
  })
})

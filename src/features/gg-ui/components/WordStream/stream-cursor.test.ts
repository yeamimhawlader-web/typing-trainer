/**
 * The cursor controller, over a fake layout.
 *
 * jsdom has no layout, so each character's rectangle is supplied: four
 * characters per 40px line, 10px wide. What is under test is the arithmetic and
 * the performance promise — a keystroke moves the cursor without reading layout.
 */

import { describe, expect, it, vi } from 'vitest'

import { createStubTypingSource } from '../../typing/typing-source.ts'
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
  const source = createStubTypingSource(words)
  controller.setSource(source)
  source.subscribe(controller.place)
  return { ...elements, controller, source }
}

describe('stream cursor', () => {
  it('sizes the block to a character and puts it on the first one', () => {
    const { cursor } = connect(8, ['abc', 'def'])

    expect(cursor.style.width).toBe('10px')
    expect(cursor.style.height).toBe('30px')
    expect(offset(cursor)).toEqual([0, 6])
    expect(cursor.dataset.placed).toBe('true')
  })

  it('follows the current character along a line', () => {
    const { cursor, source } = connect(8, ['abc', 'def'])

    source.onKeyPress('a')
    source.onKeyPress('b')

    expect(offset(cursor)).toEqual([20, 6])
  })

  it('shifts the content up a line on reaching the next one, keeping the cursor on the top line', () => {
    const { cursor, content, source } = connect(8, ['abc', 'def'])

    for (const key of 'abc ') source.onKeyPress(key)

    expect(offset(content)).toEqual([0, -40])
    expect(offset(cursor)).toEqual([0, 6])
  })

  it('shifts back down when the typist backspaces onto the previous line', () => {
    const { content, source } = connect(8, ['abc', 'def'])

    for (const key of 'abc ') source.onKeyPress(key)
    source.onKeyPress('Backspace')

    expect(offset(content)).toEqual([0, 0])
  })

  it('reads no layout at all on a keystroke', () => {
    const { reads, source } = connect(8, ['abc', 'def'])
    const afterMeasuring = reads.count

    for (const key of 'abc de') source.onKeyPress(key)

    expect(afterMeasuring).toBeGreaterThan(0)
    expect(reads.count).toBe(afterMeasuring)
  })

  it('places the cursor after the last character at the end of the text', () => {
    const { cursor, source } = connect(3, ['abc'])

    for (const key of 'abc') source.onKeyPress(key)

    expect(offset(cursor)).toEqual([30, 6])
  })

  it('does not slide when re-measuring: a new layout is not the cursor moving', () => {
    const { cursor, controller } = connect(8, ['abc', 'def'])
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

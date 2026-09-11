import { describe, expect, it } from 'vitest'

import { toCharacters } from './characters.ts'
import {
  computeWordRanges,
  findCurrentWordIndex,
  findWordDeleteIndex,
} from './words.ts'

const wordsOf = (text: string) => computeWordRanges(toCharacters(text))

describe('computeWordRanges', () => {
  it('finds each word and its boundaries', () => {
    expect(wordsOf('the quick brown')).toEqual([
      { index: 0, start: 0, end: 3, text: 'the' },
      { index: 1, start: 4, end: 9, text: 'quick' },
      { index: 2, start: 10, end: 15, text: 'brown' },
    ])
  })

  it('handles a single word', () => {
    expect(wordsOf('hello')).toEqual([{ index: 0, start: 0, end: 5, text: 'hello' }])
  })

  it('returns nothing for empty text', () => {
    expect(wordsOf('')).toEqual([])
  })

  it('returns nothing for whitespace-only text', () => {
    expect(wordsOf('   ')).toEqual([])
  })

  it('collapses runs of whitespace rather than inventing empty words', () => {
    expect(wordsOf('a    b')).toEqual([
      { index: 0, start: 0, end: 1, text: 'a' },
      { index: 1, start: 5, end: 6, text: 'b' },
    ])
  })

  it('ignores leading and trailing whitespace', () => {
    expect(wordsOf('  hi  ')).toEqual([{ index: 0, start: 2, end: 4, text: 'hi' }])
  })

  it('treats newlines and tabs as boundaries', () => {
    expect(wordsOf('a\nb\tc')).toHaveLength(3)
  })

  it('keeps punctuation attached to its word', () => {
    expect(wordsOf("don't stop.")).toEqual([
      { index: 0, start: 0, end: 5, text: "don't" },
      { index: 1, start: 6, end: 11, text: 'stop.' },
    ])
  })

  it('counts a multi-code-point character as one position', () => {
    expect(wordsOf('a👍 b')).toEqual([
      { index: 0, start: 0, end: 2, text: 'a👍' },
      { index: 1, start: 3, end: 4, text: 'b' },
    ])
  })
})

describe('findCurrentWordIndex', () => {
  const words = wordsOf('the quick brown')

  it('reports the word containing the cursor', () => {
    expect(findCurrentWordIndex(words, 0)).toBe(0)
    expect(findCurrentWordIndex(words, 2)).toBe(0)
    expect(findCurrentWordIndex(words, 5)).toBe(1)
  })

  it('reports the upcoming word when the cursor sits on a space', () => {
    expect(findCurrentWordIndex(words, 3)).toBe(1)
  })

  it('reports the last word at the end of the text', () => {
    expect(findCurrentWordIndex(words, 15)).toBe(2)
    expect(findCurrentWordIndex(words, 99)).toBe(2)
  })

  it('reports -1 when there are no words', () => {
    expect(findCurrentWordIndex([], 0)).toBe(-1)
  })
})

describe('findWordDeleteIndex', () => {
  const deleteFrom = (text: string, cursorIndex: number) =>
    findWordDeleteIndex(toCharacters(text), cursorIndex)

  it('deletes back to the start of the word being typed', () => {
    // "hello wor|" → "hello "
    expect(deleteFrom('hello world', 9)).toBe(6)
  })

  it('takes the trailing space and the word before it together', () => {
    // "hello |" → "". One press, not two: the space alone would be a wasted key.
    expect(deleteFrom('hello world', 6)).toBe(0)
  })

  it('clears a single word from its end', () => {
    expect(deleteFrom('hello', 5)).toBe(0)
  })

  it('stops at the previous word rather than clearing everything', () => {
    // "one two thr|" leaves "one two ".
    expect(deleteFrom('one two three', 11)).toBe(8)
  })

  it('does nothing at the very start', () => {
    expect(deleteFrom('hello world', 0)).toBe(0)
  })

  it('crosses a run of several spaces in one press', () => {
    expect(deleteFrom('a    b', 5)).toBe(0)
  })

  it('leaves a word intact when the cursor is at its end', () => {
    expect(deleteFrom('a    b', 6)).toBe(5)
  })

  it('clears whitespace-only text to the start', () => {
    expect(deleteFrom('   ', 3)).toBe(0)
  })

  it('clamps a cursor past the end of the text', () => {
    expect(deleteFrom('hello', 99)).toBe(0)
  })

  it('counts code points, not UTF-16 units', () => {
    // 'née 👍' is five code points; the thumbs-up is one character, not two
    // halves, so deleting it must land on 4 rather than inside it.
    expect(deleteFrom('née 👍', 5)).toBe(4)
  })
})

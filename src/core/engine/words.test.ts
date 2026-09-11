import { describe, expect, it } from 'vitest'

import { toCharacters } from './characters.ts'
import { computeWordRanges, findCurrentWordIndex } from './words.ts'

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

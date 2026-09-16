/**
 * Golden Nuggets practice text: the typist's nugget words, met mid-flow.
 */

import { describe, expect, it } from 'vitest'

import {
  createGoldenNuggetsProvider,
  GOLDEN_NUGGETS_IN_A_TEST,
  GOLDEN_NUGGETS_PROVIDER_ID,
} from './providers/golden-nuggets.provider.ts'

const BETWEEN = ['the', 'and', 'of', 'to', 'in']

/** A fixed run of draws, repeated. */
const draws = (values: readonly number[]) => {
  let index = 0
  return () => values[index++ % values.length] as number
}

const wordsOf = (words: readonly string[], count: number, random = draws([0.1, 0.7, 0.4, 0.9, 0.25])) =>
  createGoldenNuggetsProvider({ words, between: BETWEEN, random }).provide({ wordCount: count }).text.split(' ')

describe('Golden Nuggets practice text', () => {
  it('is its own source, of the length asked for', () => {
    const target = createGoldenNuggetsProvider({ words: ['because'], between: BETWEEN }).provide({ wordCount: 15 })

    expect(target.sourceId).toBe(GOLDEN_NUGGETS_PROVIDER_ID)
    expect(target.text.split(' ')).toHaveLength(15)
  })

  it('puts a nugget in every other place, with ordinary words between', () => {
    const nuggets = ['because', 'separate', 'rhythm']
    const words = wordsOf(nuggets, 20)

    words.forEach((word, position) => {
      if (position % 2 === 0) expect(nuggets).toContain(word)
      else expect(BETWEEN).toContain(word)
    })
  })

  it('brings every nugget round before any comes again', () => {
    const nuggets = ['alpha', 'bravo', 'charlie', 'delta']
    const placed = wordsOf(nuggets, 16).filter((_, position) => position % 2 === 0)

    expect(new Set(placed.slice(0, 4))).toEqual(new Set(nuggets))
    expect(new Set(placed.slice(4, 8))).toEqual(new Set(nuggets))
  })

  it('never puts a word straight after itself, even with a single nugget', () => {
    for (const nuggets of [['because'], ['because', 'the']]) {
      const words = wordsOf(nuggets, 40)
      words.forEach((word, position) => {
        if (position > 0) expect(word).not.toBe(words[position - 1])
      })
    }
  })

  it('keeps the words between apart from the nuggets', () => {
    const words = wordsOf(['the', 'because'], 30)

    expect(words.filter((_, position) => position % 2 === 1)).not.toContain('the')
  })

  it('takes each word once, in lower case, and at most the most important few', () => {
    const many = Array.from({ length: 40 }, (_, index) => `word${String.fromCharCode(97 + (index % 26))}${index}`)
    const nuggets = new Set(wordsOf(['Because', 'because', ...many], 200).filter((_, position) => position % 2 === 0))

    expect(nuggets.has('because')).toBe(true)
    expect(nuggets.size).toBe(GOLDEN_NUGGETS_IN_A_TEST)
  })

  it('is the same text for the same draws', () => {
    expect(wordsOf(['because', 'rhythm', 'separate'], 30)).toEqual(wordsOf(['because', 'rhythm', 'separate'], 30))
  })

  it('refuses to practise nothing', () => {
    expect(() => createGoldenNuggetsProvider({ words: [] })).toThrow(RangeError)
    expect(() => createGoldenNuggetsProvider({ words: ['the'], between: ['the'] })).toThrow(RangeError)
    expect(() => createGoldenNuggetsProvider({ words: ['because'], between: BETWEEN }).provide({ wordCount: 0 })).toThrow(
      RangeError,
    )
  })
})

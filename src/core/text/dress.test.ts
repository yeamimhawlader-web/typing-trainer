/**
 * Punctuation and numbers: words dressed as the text they appear in.
 */

import { describe, expect, it } from 'vitest'

import { dressWords, DRESS_RULES, numberWord } from './dress.ts'
import { createCommonWordsProvider } from './providers/common-words.provider.ts'

/** A small linear congruential generator, so a seed gives the same text twice. */
const seeded = (seed: number) => (): number => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

const WORDS = Array.from({ length: 400 }, (_, index) => ['time', 'people', 'about', 'would', 'water', 'place'][index % 6] as string)

describe('dressing words', () => {
  it('changes nothing when neither is asked for', () => {
    expect(dressWords(WORDS, { punctuation: false, numbers: false }, seeded(1))).toEqual(WORDS)
  })

  it('never changes how many words there are, so a word test is still the length chosen', () => {
    for (const options of [
      { punctuation: true, numbers: false },
      { punctuation: false, numbers: true },
      { punctuation: true, numbers: true },
    ]) {
      expect(dressWords(WORDS, options, seeded(2))).toHaveLength(WORDS.length)
      expect(dressWords(WORDS, options, seeded(2)).every((word) => !/\s/.test(word) && word.length > 0)).toBe(true)
    }
  })

  describe('with punctuation', () => {
    const dressed = dressWords(WORDS, { punctuation: true, numbers: false }, seeded(3))

    it('writes sentences: a capital first, a capital after every full stop, question or exclamation', () => {
      expect(dressed[0]).toMatch(/^[A-Z]/)
      dressed.forEach((word, position) => {
        const previous = dressed[position - 1]
        if (previous !== undefined && /[.?!]$/.test(previous)) expect(word).toMatch(/^[A-Z]/)
        if (previous !== undefined && /[a-z,;:]$/.test(previous)) expect(word).toMatch(/^[a-z]/)
      })
    })

    it('ends the text as a sentence ends, never on a comma or semicolon', () => {
      expect(dressed.at(-1)).toMatch(/[.?]$/)
    })

    it(`keeps sentences between ${DRESS_RULES.sentence.min} and ${DRESS_RULES.sentence.max} words`, () => {
      const lengths: number[] = []
      let length = 0
      dressed.slice(0, -1).forEach((word) => {
        length += 1
        if (/[.?!;:]$/.test(word)) {
          lengths.push(length)
          length = 0
        }
      })
      expect(Math.min(...lengths)).toBeGreaterThanOrEqual(DRESS_RULES.sentence.min)
      expect(Math.max(...lengths)).toBeLessThanOrEqual(DRESS_RULES.sentence.max)
    })

    it('puts commas and endings in at about the rate prose does, not everywhere', () => {
      const commas = dressed.filter((word) => word.endsWith(',')).length / dressed.length
      const stops = dressed.filter((word) => word.endsWith('.')).length

      expect(commas).toBeGreaterThan(0.03)
      expect(commas).toBeLessThan(0.2)
      expect(stops).toBeGreaterThan(dressed.filter((word) => word.endsWith('?')).length)
    })

    it('only ever attaches marks to words, and leaves the letters of each word as they were', () => {
      dressed.forEach((word, position) => {
        expect(word.replace(/[.,?!;:]$/, '').toLowerCase()).toBe(WORDS[position])
      })
    })
  })

  describe('with numbers', () => {
    it('puts figures in place of about one word in eight', () => {
      const dressed = dressWords(WORDS, { punctuation: false, numbers: true }, seeded(4))
      const figures = dressed.filter((word) => /\d/.test(word)).length / dressed.length

      expect(figures).toBeGreaterThan(0.06)
      expect(figures).toBeLessThan(0.2)
    })

    it('uses the figures prose uses: counts, amounts, years, decimals, percentages', () => {
      const random = seeded(5)
      const figures = Array.from({ length: 500 }, () => numberWord(random))

      expect(figures.every((figure) => /^(\d{1,4}|\d{1,2}\.\d|\d{1,3}%)$/.test(figure))).toBe(true)
      expect(figures.some((figure) => /^(19|20)\d\d$/.test(figure))).toBe(true)
      expect(figures.some((figure) => figure.includes('.'))).toBe(true)
      expect(figures.some((figure) => figure.endsWith('%'))).toBe(true)
    })
  })

  it('is the same text for the same draws', () => {
    const options = { punctuation: true, numbers: true }

    expect(dressWords(WORDS, options, seeded(6))).toEqual(dressWords(WORDS, options, seeded(6)))
  })
})

describe('the common-words provider, dressed', () => {
  it('says what it is giving, and gives words of the length asked', () => {
    const provider = createCommonWordsProvider({ punctuation: true, numbers: true, random: seeded(7) })
    const target = provider.provide({ wordCount: 60 })

    expect(provider.label).toBe('Common words, punctuation and numbers')
    expect(target.text.split(' ')).toHaveLength(60)
    expect(target.text).toMatch(/^[A-Z0-9]/)
    expect(target.text).toMatch(/[.?]$/)
  })

  it('is plain words when nothing is asked for, as it always was', () => {
    const provider = createCommonWordsProvider({ random: seeded(8) })

    expect(provider.label).toBe('Common words')
    expect(provider.provide({ wordCount: 30 }).text).toMatch(/^[a-z ]+$/)
  })
})

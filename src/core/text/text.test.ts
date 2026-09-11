import { describe, expect, it } from 'vitest'

import { createWordText } from './generator.ts'
import { createCommonWordsProvider } from './providers/common-words.provider.ts'
import { COMMON_WORDS } from './word-list.ts'

/** A deterministic stand-in for Math.random, cycling through fixed values. */
const sequence = (values: readonly number[]): (() => number) => {
  let index = 0
  return () => {
    const value = values[index % values.length] ?? 0
    index += 1
    return value
  }
}

describe('createWordText', () => {
  it('produces the requested number of words', () => {
    expect(createWordText({ count: 10 }).split(' ')).toHaveLength(10)
  })

  it('separates words with single spaces', () => {
    expect(createWordText({ count: 5 })).not.toMatch(/\s{2}|^\s|\s$/u)
  })

  it('draws only from the supplied word list', () => {
    const words = ['alpha', 'beta', 'gamma']

    for (const word of createWordText({ count: 20, words }).split(' ')) {
      expect(words).toContain(word)
    }
  })

  it('is deterministic given a fixed random source', () => {
    const options = { count: 6, random: sequence([0.1, 0.5, 0.9]) }

    expect(createWordText(options)).toBe(
      createWordText({ count: 6, random: sequence([0.1, 0.5, 0.9]) }),
    )
  })

  it('never repeats a word immediately, even on a pathological random source', () => {
    // A source that always returns 0 would pick the same index every time.
    // The exclusion has to be structural rather than a retry to survive this.
    const text = createWordText({
      count: 50,
      words: ['one', 'two', 'three'],
      random: () => 0,
    })

    expect(text).not.toMatch(/\b(\w+) \1\b/u)
  })

  it('never repeats a word immediately across the real word list', () => {
    const text = createWordText({ count: 400 })

    expect(text).not.toMatch(/\b(\w+) \1\b/u)
  })

  it('stays in range when the random source returns its upper bound', () => {
    const text = createWordText({ count: 20, random: () => 0.999999999 })

    expect(text.split(' ')).toHaveLength(20)
    expect(text).not.toContain('undefined')
  })

  it('terminates on a single-word list rather than looping forever', () => {
    expect(createWordText({ count: 3, words: ['solo'] })).toBe('solo solo solo')
  })

  it('rejects a non-positive count', () => {
    expect(() => createWordText({ count: 0 })).toThrow(RangeError)
    expect(() => createWordText({ count: -1 })).toThrow(RangeError)
  })

  it('rejects an empty word list', () => {
    expect(() => createWordText({ count: 5, words: [] })).toThrow(RangeError)
  })
})

describe('COMMON_WORDS', () => {
  it('is large enough for varied practice', () => {
    expect(COMMON_WORDS.length).toBeGreaterThan(100)
  })

  it('contains only plain lower-case ASCII words', () => {
    for (const word of COMMON_WORDS) {
      expect(word).toMatch(/^[a-z]+$/u)
    }
  })

  it('contains no duplicates', () => {
    // A duplicated entry would let the same word appear twice in a row from
    // two different indices, defeating the exclusion in the generator.
    const duplicates = COMMON_WORDS.filter(
      (word, index) => COMMON_WORDS.indexOf(word) !== index,
    )

    expect(duplicates).toEqual([])
  })
})

describe('common words provider', () => {
  it('returns a target the engine can accept', () => {
    const provider = createCommonWordsProvider()

    const target = provider.provide({ wordCount: 12 })

    expect(target.text.split(' ')).toHaveLength(12)
    expect(target.sourceId).toBe('common-words')
  })

  it('records its own id on the target, for later attribution', () => {
    const provider = createCommonWordsProvider()

    expect(provider.provide({ wordCount: 3 }).sourceId).toBe(provider.id)
  })

  it('uses an injected random source', () => {
    const provider = createCommonWordsProvider({
      words: ['alpha', 'beta'],
      random: sequence([0, 0.9]),
    })

    expect(provider.provide({ wordCount: 4 }).text).toBe('alpha beta alpha beta')
  })
})

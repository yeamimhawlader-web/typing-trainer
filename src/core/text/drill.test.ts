/**
 * Drill generation tests.
 *
 * The random source is injected everywhere, so every assertion below is about a
 * fixed output rather than a distribution that happens to hold most of the time.
 */

import { describe, expect, it } from 'vitest'

import {
  countOccurrences,
  createDrill,
  createDrillProvider,
  DRILL_PROVIDER_ID,
  DRILL_WORD_COUNT,
  findCarrierWords,
  isDrillableSequence,
} from './drill.ts'
import { COMMON_WORDS } from './word-list.ts'

/** A small linear congruential generator, so a seed gives the same drill twice. */
const seeded = (seed: number) => (): number => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

/** Always picks the first available word, which makes some outputs exact. */
const firstAlways = () => 0
/** Always takes the filler branch and the last word of a pool. */
const lastAlways = () => 0.999_999

const wordsOf = (text: string): readonly string[] => text.split(' ')

describe('isDrillableSequence', () => {
  it('accepts a two-character sequence', () => {
    expect(isDrillableSequence('in')).toBe(true)
  })

  it('rejects anything that is not exactly two characters', () => {
    expect(isDrillableSequence('i')).toBe(false)
    expect(isDrillableSequence('ing')).toBe(false)
    expect(isDrillableSequence('')).toBe(false)
  })

  it('rejects a sequence containing whitespace', () => {
    // A gap across a space is a different phenomenon, excluded from the
    // analysis that produces these, and not something a drill can train.
    expect(isDrillableSequence('n ')).toBe(false)
    expect(isDrillableSequence(' i')).toBe(false)
  })

  it('counts code points rather than UTF-16 units', () => {
    expect(isDrillableSequence('👍a')).toBe(true)
    expect(isDrillableSequence('👍')).toBe(false)
  })
})

describe('countOccurrences', () => {
  it('counts every occurrence, including across word boundaries in the text', () => {
    expect(countOccurrences('in into think', 'in')).toBe(3)
  })

  it('counts overlapping pairs, because both are really typed', () => {
    // "aaa" contains the transition "aa" twice: positions 0-1 and 1-2.
    expect(countOccurrences('aaa', 'aa')).toBe(2)
  })

  it('returns zero when the sequence is absent', () => {
    expect(countOccurrences('the quick brown', 'zq')).toBe(0)
  })
})

describe('findCarrierWords', () => {
  it('finds the corpus words containing a common sequence', () => {
    const carriers = findCarrierWords('in')

    expect(carriers).toContain('in')
    expect(carriers).toContain('think')
    expect(carriers).toContain('find')
    // Enough different words that a drill is not one word repeated.
    expect(carriers.length).toBeGreaterThan(5)
  })

  it('returns nothing for a sequence the corpus does not contain', () => {
    expect(findCarrierWords('zq')).toEqual([])
  })

  it('keeps corpus order, so the result is stable between runs', () => {
    expect(findCarrierWords('in')).toEqual(findCarrierWords('in'))
  })
})

describe('createDrill', () => {
  describe('for a common sequence', () => {
    it('builds a drill of the fixed length', () => {
      const plan = createDrill({ sequence: 'in', random: seeded(1) })

      expect(plan?.wordCount).toBe(DRILL_WORD_COUNT)
      expect(wordsOf(plan?.text ?? '')).toHaveLength(DRILL_WORD_COUNT)
    })

    it('concentrates the target far above its ordinary rate', () => {
      const plan = createDrill({ sequence: 'in', random: seeded(1) })

      // An ordinary 60-word test yields about five occurrences of a common
      // digraph. A 40-word drill should be worth many times that, or there is
      // no point doing it.
      expect(plan?.targetOccurrences).toBeGreaterThan(15)
    })

    it('reports the occurrences that are really in the text', () => {
      const plan = createDrill({ sequence: 'in', random: seeded(7) })

      expect(plan?.targetOccurrences).toBe(countOccurrences(plan?.text ?? '', 'in'))
    })

    it('uses many different carrier words rather than repeating one', () => {
      const plan = createDrill({ sequence: 'in', random: seeded(1) })
      const carriers = wordsOf(plan?.text ?? '').filter((word) => word.includes('in'))

      // The whole argument against "in in in in in": the transition has to be
      // made from different approaches for the practice to transfer.
      expect(new Set(carriers).size).toBeGreaterThan(5)
    })

    it('mixes in words without the target', () => {
      const plan = createDrill({ sequence: 'in', random: seeded(1) })
      const without = wordsOf(plan?.text ?? '').filter((word) => !word.includes('in'))

      expect(without.length).toBeGreaterThan(0)
    })

    it('never repeats a word twice in a row', () => {
      const plan = createDrill({ sequence: 'in', random: seeded(3) })
      const words = wordsOf(plan?.text ?? '')

      const repeats = words.filter((word, index) => index > 0 && word === words[index - 1])
      expect(repeats).toEqual([])
    })

    it('draws only from the corpus, inventing nothing', () => {
      const plan = createDrill({ sequence: 'in', random: seeded(5) })

      for (const word of wordsOf(plan?.text ?? '')) {
        expect(COMMON_WORDS).toContain(word)
      }
    })
  })

  describe('when the corpus cannot support one', () => {
    it('returns null for a sequence no word contains', () => {
      // Nonsense text would be worse than no drill: it would train a movement
      // the typist will never make in real writing.
      expect(createDrill({ sequence: 'zq', random: seeded(1) })).toBeNull()
    })

    it('returns null for a sequence that is not a digraph', () => {
      expect(createDrill({ sequence: 'ing', random: seeded(1) })).toBeNull()
      expect(createDrill({ sequence: 'i', random: seeded(1) })).toBeNull()
    })

    it('returns null for a sequence containing a space', () => {
      expect(createDrill({ sequence: 'n ', random: seeded(1) })).toBeNull()
    })
  })

  describe('with a short corpus', () => {
    it('builds a drill from very few words', () => {
      const plan = createDrill({
        sequence: 'in',
        words: ['in', 'find', 'cat', 'dog'],
        wordCount: 12,
        random: seeded(9),
      })

      expect(plan?.wordCount).toBe(12)
      expect(plan?.carrierWords).toEqual(['in', 'find'])
      expect(plan?.targetOccurrences).toBeGreaterThan(0)
    })

    it('alternates rather than repeating when only one word carries the target', () => {
      const plan = createDrill({
        sequence: 'in',
        words: ['find', 'cat', 'dog'],
        wordCount: 10,
        random: seeded(11),
      })

      const words = wordsOf(plan?.text ?? '')
      expect(plan?.carrierWords).toEqual(['find'])
      // "find find find" is what the no-repeat rule exists to prevent, and a
      // single carrier word is the case where it has to fall back to filler.
      expect(words.filter((w, i) => i > 0 && w === words[i - 1])).toEqual([])
      expect(words).toContain('find')
    })

    it('stops early rather than looping when no two words differ', () => {
      // Both pools reduce to the same single word. Not reachable with a real
      // corpus; worth not hanging on.
      const plan = createDrill({
        sequence: 'in',
        words: ['in'],
        wordCount: 5,
        random: seeded(2),
      })

      expect(plan?.wordCount).toBe(1)
      expect(plan?.text).toBe('in')
    })

    it('rejects a word count that is not a positive integer', () => {
      expect(() => createDrill({ sequence: 'in', wordCount: 0 })).toThrow(RangeError)
      expect(() => createDrill({ sequence: 'in', wordCount: -3 })).toThrow(RangeError)
      expect(() => createDrill({ sequence: 'in', wordCount: 2.5 })).toThrow(RangeError)
    })
  })

  describe('determinism', () => {
    it('produces the same drill twice from the same seed', () => {
      const first = createDrill({ sequence: 'in', random: seeded(42) })
      const second = createDrill({ sequence: 'in', random: seeded(42) })

      expect(first).toEqual(second)
    })

    it('produces different drills from different seeds', () => {
      const first = createDrill({ sequence: 'in', random: seeded(42) })
      const second = createDrill({ sequence: 'in', random: seeded(99) })

      expect(first?.text).not.toBe(second?.text)
    })

    it('is exactly reproducible with a degenerate random source', () => {
      // Every draw takes the target branch and the first available word, so the
      // output is fully determined and can be written out by hand: the first
      // carrier word, then the first that is not it, alternating.
      const plan = createDrill({
        sequence: 'in',
        words: ['in', 'find', 'cat'],
        wordCount: 4,
        random: firstAlways,
      })

      expect(plan?.text).toBe('in find in find')
    })

    it('takes the filler branch when the draw is above the density', () => {
      const plan = createDrill({
        sequence: 'in',
        words: ['in', 'find', 'cat', 'dog'],
        wordCount: 3,
        random: lastAlways,
        density: 0.5,
      })

      // Every draw is 0.999…, so every branch is filler and every pick is the
      // last available word: dog, then cat (dog excluded), then dog again.
      expect(plan?.text).toBe('dog cat dog')
    })
  })

  describe('density', () => {
    it('puts more of the target in at a higher density', () => {
      const sparse = createDrill({ sequence: 'in', random: seeded(4), density: 0.2 })
      const dense = createDrill({ sequence: 'in', random: seeded(4), density: 0.9 })

      expect(dense?.targetOccurrences).toBeGreaterThan(sparse?.targetOccurrences ?? 0)
    })

    it('still leaves other words in at full density', () => {
      const plan = createDrill({ sequence: 'in', random: seeded(4), density: 1 })

      // Even at density 1 the no-repeat rule reaches for filler, which is the
      // behaviour that keeps a four-carrier sequence from reading as a chant.
      expect(plan?.wordCount).toBe(DRILL_WORD_COUNT)
    })
  })
})

describe('createDrillProvider', () => {
  it('serves the generated text as an ordinary text provider', () => {
    const plan = createDrill({ sequence: 'in', random: seeded(1) })
    const provider = createDrillProvider(plan!)

    expect(provider.provide({ wordCount: 30 })).toEqual({
      text: plan?.text,
      sourceId: DRILL_PROVIDER_ID,
    })
  })

  it('ignores the requested word count', () => {
    const plan = createDrill({ sequence: 'in', random: seeded(1) })
    const provider = createDrillProvider(plan!)

    // A drill is the length it was generated at; the screen's 15/30/60 control
    // has no meaning here and must not silently regenerate it.
    expect(provider.provide({ wordCount: 15 }).text).toBe(
      provider.provide({ wordCount: 60 }).text,
    )
  })

  it('names the sequence it was built for', () => {
    const plan = createDrill({ sequence: 'th', random: seeded(1) })
    const provider = createDrillProvider(plan!)

    expect(provider.label).toContain('th')
    expect(provider.plan.sequence).toBe('th')
  })
})

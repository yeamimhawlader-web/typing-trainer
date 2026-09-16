/**
 * Practice text made of the typist's Golden Nuggets: the words that keep
 * costing them.
 *
 * Every other word is a nugget, the ones between are ordinary common words, so
 * each nugget is met the way it is met in real text — arriving mid-flow, after
 * another word — rather than drilled as a list. The nuggets come round in a
 * shuffled order, each one before any comes again, so a long test gives every
 * word its turns instead of favouring whichever the dice liked. The words
 * between are never nuggets, so no word ever follows itself.
 *
 * The words are given when the provider is made — they are read from storage
 * by whoever makes it — so `provide` stays synchronous, as every provider's is.
 */

import type { RandomSource } from '../generator.ts'
import type { TextProvider, TextRequest } from '../types.ts'
import { COMMON_WORDS } from '../word-list.ts'

export const GOLDEN_NUGGETS_PROVIDER_ID = 'golden-nuggets'

export interface GoldenNuggetsProviderOptions {
  /** The nugget words, most important first. At least one. */
  readonly words: readonly string[]
  /** The words between them. */
  readonly between?: readonly string[]
  /** Injectable so tests get a fixed sequence. */
  readonly random?: RandomSource
}

/** At most this many nuggets, most important first, so a test comes back to each. */
export const GOLDEN_NUGGETS_IN_A_TEST = 24

const pick = (random: RandomSource, length: number): number => Math.min(length - 1, Math.floor(random() * length))

export const createGoldenNuggetsProvider = ({
  words,
  between = COMMON_WORDS,
  random = Math.random,
}: GoldenNuggetsProviderOptions): TextProvider => {
  const nuggets = [...new Set(words.map((word) => word.toLowerCase()).filter((word) => word.length > 0))].slice(
    0,
    GOLDEN_NUGGETS_IN_A_TEST,
  )
  if (nuggets.length === 0) throw new RangeError('Golden Nuggets practice needs at least one word')
  // Ordinary words that are not themselves nuggets, so the two kinds stay apart.
  const fillers = between.filter((word) => !nuggets.includes(word))
  if (fillers.length === 0) throw new RangeError('Golden Nuggets practice needs words to put between them')

  return {
    id: GOLDEN_NUGGETS_PROVIDER_ID,
    label: 'Your Golden Nuggets',

    provide: ({ wordCount }: TextRequest) => {
      if (!Number.isInteger(wordCount) || wordCount <= 0) {
        throw new RangeError(`Word count must be a positive integer, got ${wordCount}`)
      }

      const chosen: string[] = []
      let bag: string[] = []
      for (let position = 0; position < wordCount; position += 1) {
        if (position % 2 === 0) {
          // Drawn from what is left of this round, so every nugget comes up before any comes again.
          if (bag.length === 0) bag = [...nuggets]
          chosen.push(bag.splice(pick(random, bag.length), 1)[0] as string)
        } else {
          chosen.push(fillers[pick(random, fillers.length)] as string)
        }
      }

      return { text: chosen.join(' '), sourceId: GOLDEN_NUGGETS_PROVIDER_ID }
    },
  }
}

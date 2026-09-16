/**
 * The built-in sample provider: random common English words.
 *
 * The simplest provider that produces usable practice material — and, when
 * asked, the same words dressed with punctuation and numbers (see dress.ts).
 */

import { dressWords } from '../dress.ts'
import { createWordText } from '../generator.ts'
import type { RandomSource } from '../generator.ts'
import type { TextProvider, TextRequest } from '../types.ts'
import { COMMON_WORDS } from '../word-list.ts'

export const COMMON_WORDS_PROVIDER_ID = 'common-words'

export interface CommonWordsProviderOptions {
  readonly words?: readonly string[]
  /** Injectable so tests get a fixed sequence. */
  readonly random?: RandomSource
  /** Sentences: capitals, commas and endings. */
  readonly punctuation?: boolean
  /** Figures in place of some words. */
  readonly numbers?: boolean
}

export const createCommonWordsProvider = (
  options: CommonWordsProviderOptions = {},
): TextProvider => {
  const words = options.words ?? COMMON_WORDS
  const random = options.random ?? Math.random
  const dress = { punctuation: options.punctuation === true, numbers: options.numbers === true }
  const dressed = dress.punctuation || dress.numbers

  return {
    id: COMMON_WORDS_PROVIDER_ID,
    label: dress.punctuation && dress.numbers
      ? 'Common words, punctuation and numbers'
      : dress.punctuation
        ? 'Common words, with punctuation'
        : dress.numbers
          ? 'Common words, with numbers'
          : 'Common words',

    provide: ({ wordCount }: TextRequest) => {
      const text = createWordText({ count: wordCount, words, random })
      return {
        text: dressed ? dressWords(text.split(' '), dress, random).join(' ') : text,
        sourceId: COMMON_WORDS_PROVIDER_ID,
      }
    },
  }
}

/**
 * The built-in sample provider: random common English words.
 *
 * The simplest provider that produces usable practice material — and, when
 * asked, the same words dressed with punctuation and numbers (see dress.ts).
 *
 * Its words are the normal vocabulary, the most frequent two hundred, or the
 * advanced one (advanced-words.ts). An advanced test is its own source, with
 * its own id, so history can tell the two apart.
 */

import type { Vocabulary } from '@core/types'

import { ADVANCED_WORDS } from '../advanced-words.ts'
import { dressWords } from '../dress.ts'
import { createWordText } from '../generator.ts'
import type { RandomSource } from '../generator.ts'
import type { TextProvider, TextRequest } from '../types.ts'
import { COMMON_WORDS } from '../word-list.ts'

export const COMMON_WORDS_PROVIDER_ID = 'common-words'
export const ADVANCED_WORDS_PROVIDER_ID = 'advanced-words'

export interface CommonWordsProviderOptions {
  readonly words?: readonly string[]
  /** The normal vocabulary, or the advanced one. Normal unless asked. */
  readonly vocabulary?: Vocabulary
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
  const advanced = options.vocabulary === 'advanced'
  const words = options.words ?? (advanced ? ADVANCED_WORDS : COMMON_WORDS)
  const random = options.random ?? Math.random
  const dress = {
    punctuation: options.punctuation === true,
    numbers: options.numbers === true,
  }
  const dressed = dress.punctuation || dress.numbers
  const id = advanced ? ADVANCED_WORDS_PROVIDER_ID : COMMON_WORDS_PROVIDER_ID
  const name = advanced ? 'Advanced words' : 'Common words'

  return {
    id,
    label:
      dress.punctuation && dress.numbers
        ? `${name}, punctuation and numbers`
        : dress.punctuation
          ? `${name}, with punctuation`
          : dress.numbers
            ? `${name}, with numbers`
            : name,

    provide: ({ wordCount }: TextRequest) => {
      const text = createWordText({ count: wordCount, words, random })
      return {
        text: dressed ? dressWords(text.split(' '), dress, random).join(' ') : text,
        sourceId: id,
      }
    },
  }
}

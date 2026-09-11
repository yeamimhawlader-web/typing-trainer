/**
 * The built-in sample provider: random common English words.
 *
 * This is the only provider for now, and deliberately the simplest one that
 * produces usable practice material.
 */

import { createWordText } from '../generator.ts'
import type { RandomSource } from '../generator.ts'
import type { TextProvider, TextRequest } from '../types.ts'
import { COMMON_WORDS } from '../word-list.ts'

export const COMMON_WORDS_PROVIDER_ID = 'common-words'

export interface CommonWordsProviderOptions {
  readonly words?: readonly string[]
  /** Injectable so tests get a fixed sequence. */
  readonly random?: RandomSource
}

export const createCommonWordsProvider = (
  options: CommonWordsProviderOptions = {},
): TextProvider => {
  const words = options.words ?? COMMON_WORDS

  return {
    id: COMMON_WORDS_PROVIDER_ID,
    label: 'Common words',

    provide: ({ wordCount }: TextRequest) => ({
      text: createWordText({
        count: wordCount,
        words,
        ...(options.random === undefined ? {} : { random: options.random }),
      }),
      sourceId: COMMON_WORDS_PROVIDER_ID,
    }),
  }
}

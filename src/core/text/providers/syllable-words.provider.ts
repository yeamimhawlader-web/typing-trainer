/**
 * The Syllable Trainer's text: words drawn from its syllable corpus.
 *
 * The same drawing as common words — at random, never the same word twice in a
 * row — from a different list: every word one the trainer knows the syllables
 * of, so every word on screen can be shown as the chunks it is typed in.
 */

import { SYLLABLE_CORPUS, type SyllableWord } from '@core/syllables'

import { createWordText, type RandomSource } from '../generator.ts'
import type { TextProvider, TextRequest } from '../types.ts'

export const SYLLABLE_WORDS_PROVIDER_ID = 'syllable-words'

export interface SyllableWordsProviderOptions {
  readonly corpus?: readonly SyllableWord[]
  /** Injectable so tests get a fixed sequence. */
  readonly random?: RandomSource
}

export const createSyllableWordsProvider = (options: SyllableWordsProviderOptions = {}): TextProvider => {
  const words = (options.corpus ?? SYLLABLE_CORPUS).map((entry) => entry.word)

  return {
    id: SYLLABLE_WORDS_PROVIDER_ID,
    label: 'Common words, in syllables',

    provide: ({ wordCount }: TextRequest) => ({
      text: createWordText({
        count: wordCount,
        words,
        ...(options.random === undefined ? {} : { random: options.random }),
      }),
      sourceId: SYLLABLE_WORDS_PROVIDER_ID,
    }),
  }
}

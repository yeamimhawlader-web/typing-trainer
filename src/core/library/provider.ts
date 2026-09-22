/**
 * Your own text, as practice material.
 *
 * A passage is typed as written — that is the whole point of keeping it — so
 * the provider hands back the body and ignores the requested length. A word
 * list is drawn from at random like the built-in vocabularies, so the length
 * chosen still decides the test.
 *
 * Both record the same source id, so history can say a test was your own text
 * without keeping a copy of it beside the session.
 */

import { createWordText, type RandomSource } from '@core/text'

import type { LibraryText } from './types.ts'

export const LIBRARY_PROVIDER_ID = 'your-text'

export interface LibraryProviderOptions {
  /** Injectable so tests get a fixed sequence. */
  readonly random?: RandomSource
}

export interface LibraryProvider {
  readonly id: string
  readonly label: string
  readonly provide: (request: { readonly wordCount: number }) => {
    readonly text: string
    readonly sourceId: string
  }
}

export const createLibraryProvider = (
  text: LibraryText,
  options: LibraryProviderOptions = {},
): LibraryProvider => {
  const random = options.random ?? Math.random
  const words = text.body.split(' ').filter((word) => word.length > 0)

  return {
    id: LIBRARY_PROVIDER_ID,
    label: text.title,
    provide: ({ wordCount }) => ({
      text:
        text.kind === 'words'
          ? createWordText({ count: wordCount, words, random })
          : text.body,
      sourceId: LIBRARY_PROVIDER_ID,
    }),
  }
}

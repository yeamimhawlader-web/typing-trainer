/**
 * Where the syllables are in a test's text.
 *
 * The engine is given the text as it always is — words and spaces, nothing
 * inserted — so every keystroke is compared, recorded and scored exactly as in
 * any other test. The syllables are laid over it: for each word, where each of
 * its syllables begins. Nothing here is typed, and nothing here decides whether
 * a key was right.
 *
 * Computed once, when a test's text is loaded; never on a keystroke.
 */

import { computeWordRanges, toCharacters } from '@core/engine'

import { SYLLABLE_CORPUS, type SyllableWord } from './corpus.ts'

/**
 * For each word of a text, in order, the position within the word at which each
 * of its syllables starts. The first is always 0; a word of one syllable, or
 * one the corpus does not know, is `[0]`.
 */
export type SyllableLayout = readonly (readonly number[])[]

/** Where each syllable starts within its word, counted in characters (code points), not UTF-16 units. */
export const syllableStarts = (syllables: readonly string[]): readonly number[] => {
  const starts: number[] = []
  let at = 0
  for (const syllable of syllables) {
    starts.push(at)
    at += toCharacters(syllable).length
  }
  return starts.length === 0 ? [0] : starts
}

export type SyllableLookup = ReadonlyMap<string, readonly number[]>

export const createSyllableLookup = (corpus: readonly SyllableWord[]): SyllableLookup =>
  new Map(corpus.map((entry) => [entry.word, syllableStarts(entry.syllables)]))

const DEFAULT_LOOKUP = createSyllableLookup(SYLLABLE_CORPUS)

const WHOLE_WORD: readonly number[] = Object.freeze([0])

export const layoutSyllables = (text: string, lookup: SyllableLookup = DEFAULT_LOOKUP): SyllableLayout =>
  computeWordRanges(toCharacters(text)).map((word) => lookup.get(word.text) ?? WHOLE_WORD)

/** A word's syllables as ranges of the text: where each starts and where it ends, exclusive. */
export interface SyllableRange {
  readonly start: number
  readonly end: number
}

export const syllableRanges = (wordStart: number, wordEnd: number, starts: readonly number[]): readonly SyllableRange[] =>
  starts.map((offset, index) => ({
    start: wordStart + offset,
    end: index + 1 < starts.length ? wordStart + (starts[index + 1] as number) : wordEnd,
  }))

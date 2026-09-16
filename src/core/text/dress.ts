/**
 * Punctuation and numbers: ordinary words dressed as the text they appear in.
 *
 * Real prose is not a stream of lower-case words. It has sentences that start
 * with a capital and end with a full stop, commas where a breath goes, the odd
 * question, and figures — years, counts, prices. A typist fast on bare words
 * can still stall on every Shift and every comma, which is why these are a
 * drill of their own (see word-list.ts, which keeps the default plain).
 *
 * The words are drawn as always; this only dresses them. Numbers take the place
 * of some words and punctuation attaches to others, so the word count — what a
 * word test is measured in — is exactly what was asked for. Sentence lengths,
 * how often a comma comes and which endings are used are set down in one place
 * (`DRESS_RULES`), with frequencies near ordinary written English, so the
 * practice meets them as often as prose does and not more.
 *
 * Deterministic for a given random source, like every text generator here.
 */

import type { RandomSource } from './generator.ts'

export interface DressOptions {
  readonly punctuation: boolean
  readonly numbers: boolean
}

export const DRESS_RULES = {
  /** Words in a sentence, both ends included. */
  sentence: { min: 4, max: 12 },
  /** How often a word inside a sentence is followed by a comma. */
  comma: 0.1,
  /**
   * How a sentence ends, by weight. A semicolon or colon carries on without a
   * capital; the others end the sentence.
   */
  endings: [
    { mark: '.', weight: 76, ends: true },
    { mark: '?', weight: 12, ends: true },
    { mark: '!', weight: 4, ends: true },
    { mark: ';', weight: 4, ends: false },
    { mark: ':', weight: 4, ends: false },
  ],
  /** How often a word is replaced by a number. */
  number: 0.12,
} as const

const between = (random: RandomSource, low: number, high: number): number =>
  low + Math.min(high - low, Math.floor(random() * (high - low + 1)))

/** A figure of the kinds prose uses: small counts, larger amounts, years, decimals, percentages. */
export const numberWord = (random: RandomSource): string => {
  const kind = random()
  if (kind < 0.4) return String(between(random, 1, 99))
  if (kind < 0.65) return String(between(random, 100, 9999))
  if (kind < 0.85) return String(between(random, 1900, 2029))
  if (kind < 0.95) return `${between(random, 0, 99)}.${between(random, 0, 9)}`
  return `${between(random, 1, 100)}%`
}

const ending = (random: RandomSource) => {
  const total = DRESS_RULES.endings.reduce((sum, option) => sum + option.weight, 0)
  let draw = random() * total
  for (const option of DRESS_RULES.endings) {
    draw -= option.weight
    if (draw < 0) return option
  }
  return DRESS_RULES.endings[0]
}

const capitalise = (word: string): string => {
  const [first = '', ...rest] = Array.from(word)
  return first.toLocaleUpperCase('en') + rest.join('')
}

export const dressWords = (words: readonly string[], options: DressOptions, random: RandomSource): string[] => {
  const withNumbers = options.numbers
    ? words.map((word) => (random() < DRESS_RULES.number ? numberWord(random) : word))
    : [...words]
  if (!options.punctuation) return withNumbers

  const dressed: string[] = []
  let left = 0
  let capital = true
  withNumbers.forEach((word, position) => {
    if (left === 0) left = between(random, DRESS_RULES.sentence.min, DRESS_RULES.sentence.max)
    let next = capital ? capitalise(word) : word
    capital = false
    left -= 1
    const last = position === withNumbers.length - 1
    if (last) {
      // The text ends as a sentence does, never on a semicolon.
      next += random() < 0.85 ? '.' : '?'
    } else if (left === 0) {
      const chosen = ending(random)
      next += chosen.mark
      capital = chosen.ends
    } else if (random() < DRESS_RULES.comma) {
      next += ','
    }
    dressed.push(next)
  })
  return dressed
}

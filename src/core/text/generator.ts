/**
 * Practice text generation.
 *
 * Domain code, not UI code: it takes a word count and returns a string. The
 * random source is injectable, so tests are deterministic and a future "repeat
 * yesterday's text" feature can replay an exact sequence from a seed.
 */

import { COMMON_WORDS } from './word-list.ts'

/** Returns a number in [0, 1). Matches `Math.random`. */
export type RandomSource = () => number

export interface WordTextOptions {
  readonly count: number
  readonly words?: readonly string[]
  readonly random?: RandomSource
}

/**
 * Picks an index that is never the previous one.
 *
 * Rather than drawing again on a collision — which only *usually* avoids a
 * repeat, and can fail twice in a row — this draws from a range one shorter
 * than the list and shifts past the excluded slot. The result is guaranteed
 * different, takes constant time, and allocates nothing.
 */
const pickIndex = (
  random: RandomSource,
  length: number,
  previousIndex: number,
): number => {
  if (length === 1) return 0

  if (previousIndex < 0) {
    // `Math.min` guards against a random source that returns exactly 1.
    return Math.min(length - 1, Math.floor(random() * length))
  }

  const drawn = Math.min(length - 2, Math.floor(random() * (length - 1)))
  return drawn >= previousIndex ? drawn + 1 : drawn
}

/**
 * Picks `count` words at random.
 *
 * The same word never appears twice in a row. Typing "the the" is not a useful
 * drill — it trains a repetition that does not occur in real text, and it reads
 * as a rendering bug rather than a deliberate choice. The one exception is a
 * single-word list, where there is no alternative.
 */
export const createWordText = ({
  count,
  words = COMMON_WORDS,
  random = Math.random,
}: WordTextOptions): string => {
  if (!Number.isInteger(count) || count <= 0) {
    throw new RangeError(`Word count must be a positive integer, got ${count}`)
  }
  if (words.length === 0) {
    throw new RangeError('Cannot generate text from an empty word list')
  }

  const chosen: string[] = []
  let previousIndex = -1

  for (let position = 0; position < count; position += 1) {
    const index = pickIndex(random, words.length, previousIndex)
    chosen.push(words[index] as string)
    previousIndex = index
  }

  return chosen.join(' ')
}

/**
 * Word boundaries over the target text.
 *
 * A word is a maximal run of non-whitespace characters. Indices are positions
 * in the *code point* array, not the JavaScript string — see characters.ts for
 * why that distinction matters.
 *
 * Word ranges are computed once when a target is loaded, not per keystroke.
 */

export interface WordRange {
  /** Position of this word in the target, zero-based. */
  readonly index: number
  /** First character of the word, inclusive. */
  readonly start: number
  /** One past the last character of the word, exclusive. */
  readonly end: number
  readonly text: string
}

const isWhitespace = (character: string): boolean => /\s/u.test(character)

export const computeWordRanges = (
  characters: readonly string[],
): readonly WordRange[] => {
  const words: WordRange[] = []
  let start: number | null = null

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index]
    const whitespace = character === undefined || isWhitespace(character)

    if (!whitespace && start === null) {
      start = index
    } else if (whitespace && start !== null) {
      words.push({
        index: words.length,
        start,
        end: index,
        text: characters.slice(start, index).join(''),
      })
      start = null
    }
  }

  if (start !== null) {
    words.push({
      index: words.length,
      start,
      end: characters.length,
      text: characters.slice(start).join(''),
    })
  }

  return words
}

/**
 * The word the cursor is working on.
 *
 * Inside a word, that word. On the whitespace between two words, the word about
 * to be typed. At the very end of the text, the final word. Returns -1 when the
 * target contains no words at all (whitespace only).
 */
export const findCurrentWordIndex = (
  words: readonly WordRange[],
  cursorIndex: number,
): number => {
  if (words.length === 0) return -1

  for (const word of words) {
    if (cursorIndex < word.end) return word.index
  }

  return words.length - 1
}

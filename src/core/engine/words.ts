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
 * Where a word-wise delete should leave the cursor.
 *
 * Walks back over any whitespace, then back over the run of non-whitespace
 * before it — what Ctrl+Backspace does in every text editor, and the reason a
 * space and the word in front of it go together rather than taking two presses.
 *
 * From the end of "hello wor" that is the start of "wor". From just after
 * "hello " it is 0, because the trailing space is consumed first and the word
 * before it then goes with it. Already at 0, it stays at 0: nothing to delete
 * is not an error, just nothing.
 *
 * Boundaries come from the **target** text rather than from what was typed. The
 * typist is reproducing this text, so its word structure is the one they are
 * working in — and a mistyped character does not move a word boundary.
 */
export const findWordDeleteIndex = (
  characters: readonly string[],
  cursorIndex: number,
): number => {
  let index = Math.max(0, Math.min(cursorIndex, characters.length))

  while (index > 0 && isWhitespace(characters[index - 1] as string)) index -= 1
  while (index > 0 && !isWhitespace(characters[index - 1] as string)) index -= 1

  return index
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

/**
 * Where a keystroke lands, and where the cursor goes next.
 *
 * ## The problem this solves
 *
 * The engine compares each keystroke with the character at the cursor and
 * moves on by one. On its own that rule has no way back into alignment: a
 * typist who drops one letter, adds one, or reaches for the space bar a letter
 * early is from then on comparing every key with the wrong position, and a
 * single slip turns the rest of the test red. Measured before this existed: one
 * extra letter left 52 of the next 60 characters wrong, and one unnoticed
 * dropped letter turned a 130 WPM test into 9 WPM at 7% accuracy.
 *
 * ## The rule
 *
 * **The space bar re-synchronises to word boundaries.** Between spaces,
 * comparison stays character by character exactly as before. Two situations
 * change, and both are about the boundary:
 *
 * - **A letter where a space belongs is an extra.** It is recorded as a wrong
 *   keystroke, but the cursor stays on the boundary, so the next word is not
 *   touched. The typist's own space, when it comes, moves on as normal.
 * - **A space part-way through a word ends that word.** The letters not reached
 *   are marked missed, and the cursor moves to the start of the next word, so
 *   the next word is compared with the next word.
 *
 * A space where no word has been started yet — a double space, or one before
 * the first letter — is ignored rather than skipping a word the typist has not
 * touched.
 *
 * This is how word-based typing sites behave, and it is deliberately no
 * cleverer. Two errors still shift alignment by a whole word until corrected,
 * exactly as they do on those sites: a *missed* space, which merges two words
 * into one, and a space *inside* a word, which splits one into two. Both are
 * indistinguishable from the contained cases at the moment the key arrives,
 * and guessing at intent would sometimes misalign a typist who had made no
 * error at all. Ctrl+Backspace recovers either in one press.
 *
 * ## Why this is a separate module
 *
 * The rule is needed in two places — the engine, which applies it live, and the
 * telemetry layer, which replays a stored keystroke log and has to know where
 * the cursor went after each key. One definition means the two cannot drift.
 */

import { findCurrentWordIndex, type WordRange } from './words.ts'

const isWhitespace = (character: string | undefined): boolean =>
  character !== undefined && /\s/u.test(character)

export type CharacterRule =
  /** Compare with the expected character and move on by one. */
  | { readonly kind: 'advance' }
  /** A non-space where a space belongs: recorded, and the cursor holds. */
  | { readonly kind: 'extra' }
  /**
   * A space inside a started word: the word ends here. Positions from the one
   * after the keystroke up to `missedEnd` were never typed; the cursor moves to
   * `nextWordStart`, or to the end of the text after the last word.
   */
  | { readonly kind: 'skip-word'; readonly missedEnd: number; readonly nextWordStart: number }
  /** A space before any letter of the word: not input at all. */
  | { readonly kind: 'ignore' }

/**
 * Which rule applies to a character keystroke at `index`.
 *
 * Pure, and a function of the text and the keystroke alone, so a stored log can
 * be replayed through it and arrive where the live engine did.
 */
export const ruleForCharacter = (
  characters: readonly string[],
  words: readonly WordRange[],
  index: number,
  key: string,
): CharacterRule => {
  const expected = characters[index]
  if (expected === undefined) return { kind: 'ignore' }

  const keyIsSpace = isWhitespace(key)
  const expectedIsSpace = isWhitespace(expected)

  if (keyIsSpace && !expectedIsSpace) {
    const atWordStart = index === 0 || isWhitespace(characters[index - 1])
    if (atWordStart) return { kind: 'ignore' }

    const word = words[findCurrentWordIndex(words, index)]
    if (word === undefined) return { kind: 'advance' }

    const next = words[word.index + 1]
    return {
      kind: 'skip-word',
      missedEnd: word.end,
      nextWordStart: next?.start ?? characters.length,
    }
  }

  if (!keyIsSpace && expectedIsSpace) return { kind: 'extra' }

  return { kind: 'advance' }
}

/** Where the cursor stands after a character keystroke at `index`. */
export const cursorAfterCharacter = (
  characters: readonly string[],
  words: readonly WordRange[],
  index: number,
  key: string,
): number => {
  const rule = ruleForCharacter(characters, words, index, key)

  switch (rule.kind) {
    case 'advance':
      return index + 1
    case 'skip-word':
      return rule.nextWordStart
    case 'extra':
    case 'ignore':
      return index
  }
}

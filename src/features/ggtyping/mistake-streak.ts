/**
 * Consecutive mistakes on a word — the trigger for the word jump.
 *
 * ## What counts as a mistake
 *
 * Only what the engine already decided. A mistake is a character keystroke the
 * engine recorded with `correct: false`: a wrong letter, a letter where a space
 * belongs, a space part-way through a word. Nothing here compares a key with
 * the text. There is one definition of a wrong keystroke in this application
 * and it lives in the engine; this module counts them.
 *
 * ## Which word a mistake belongs to
 *
 * The word the keystroke acted on — the last word starting at or before the
 * keystroke's position. A letter typed into the space after `hello` is a
 * mistake on `hello`: that is where the typist still is, and where an extra
 * letter visibly belongs.
 *
 * ## When a streak ends
 *
 * - **The word is completed correctly.** Reported by the caller from the
 *   engine's own character states, never re-derived here.
 * - **A keystroke lands on a different word**, including a backspace back into
 *   the previous one. Leaving a word ends its streak; coming back starts fresh.
 * - **The test starts, restarts or finishes** — `clear`.
 *
 * Correct keystrokes inside a word do not end it. Typing `x`, deleting it and
 * typing `x` again three times over is exactly the struggle this reacts to,
 * and the correct letters around each attempt do not make it less of one.
 *
 * ## Why every third, not every one after the third
 *
 * The third consecutive mistake jumps, and so do the sixth and the ninth. A
 * jump on every further mistake would restart the motion several times a
 * second for a typist mashing at 150 WPM, which reads as a glitch rather than a
 * reaction, and turns feedback into noise. One jump per three keeps each
 * reaction tied to a clear cause.
 *
 * Streaks are kept per word index, never as one count for the whole test, so
 * one word's struggle can never make another word move.
 */

import type { WordRange } from '@core/engine'

/** Consecutive mistakes on one word that make it jump, and every multiple. */
export const MISTAKES_PER_JUMP = 3

/**
 * The word a position belongs to: the last word starting at or before it.
 *
 * A space after a word belongs to that word. A position before the first word
 * (leading whitespace, which the practice text never has) belongs to the first.
 * Binary search, because this runs on every keystroke.
 */
export const wordOwning = (words: readonly WordRange[], position: number): number => {
  if (words.length === 0) return -1

  let low = 0
  let high = words.length - 1
  let found = 0

  while (low <= high) {
    const middle = (low + high) >> 1
    const word = words[middle] as WordRange
    if (word.start <= position) {
      found = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  return found
}

export interface MistakeStreaks {
  /**
   * One keystroke the engine recorded, on `wordIndex`.
   *
   * Returns true when this keystroke should make the word jump.
   */
  keystroke(wordIndex: number, kind: 'character' | 'backspace', correct: boolean): boolean
  /** The engine reports `wordIndex` finished with every character right. */
  completedCorrectly(wordIndex: number): void
  /** Start, restart or finish: nothing carries over. */
  clear(): void
  /** Current consecutive mistakes on a word. For tests and debugging. */
  streakOf(wordIndex: number): number
}

/**
 * A mutable tracker rather than a reducer returning a fresh map, because it
 * runs on every keystroke and allocating a map per key press to hold at most
 * one entry would be waste on the one path that matters.
 */
export const createMistakeStreaks = (): MistakeStreaks => {
  const streaks = new Map<number, number>()

  return {
    keystroke: (wordIndex, kind, correct) => {
      // Moving to another word ends the streak on the one left behind. The map
      // holds at most one entry, so this loop is a single comparison.
      for (const other of streaks.keys()) {
        if (other !== wordIndex) streaks.delete(other)
      }

      if (kind !== 'character' || correct) return false

      const mistakes = (streaks.get(wordIndex) ?? 0) + 1
      streaks.set(wordIndex, mistakes)

      return mistakes % MISTAKES_PER_JUMP === 0
    },

    completedCorrectly: (wordIndex) => {
      streaks.delete(wordIndex)
    },

    clear: () => {
      streaks.clear()
    },

    streakOf: (wordIndex) => streaks.get(wordIndex) ?? 0,
  }
}

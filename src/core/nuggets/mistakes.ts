/**
 * Counting mistakes per word, so a word that keeps costing them becomes a
 * Golden Nugget on its own — outside Hover Mode as well as in it.
 *
 * ## The rule
 *
 * Five wrong keystrokes on the same word make it a nugget. Not five sightings,
 * not five attempts: five mistakes actually attributed to that word by the
 * engine's own account of where the cursor was.
 *
 * ## Why it is counted here and not stored
 *
 * Storage is never touched per keystroke. The tally lives in memory for the
 * life of a test; only the moment a word crosses the threshold is written, and
 * only once per word, however many more mistakes follow. A test in which
 * nothing crosses the line writes nothing at all.
 *
 * Pure, and no DOM: the caller says which word a mistake belongs to.
 */

/** Wrong keystrokes on one word that make it worth keeping. */
export const NUGGET_MISTAKE_THRESHOLD = 5

export interface MistakeTally {
  /**
   * One wrong keystroke on `word`. Returns the word when this is the mistake
   * that crosses the threshold — the moment worth recording — and null every
   * other time, including every mistake after it.
   */
  readonly note: (word: string) => string | null
  /** Mistakes counted on a word so far in this test. */
  readonly countOf: (word: string) => number
  /** Words that have crossed the threshold in this test. */
  readonly crossed: () => readonly string[]
  /** A new test: nothing carries over. */
  readonly reset: () => void
}

export const createMistakeTally = (threshold: number = NUGGET_MISTAKE_THRESHOLD): MistakeTally => {
  let mistakes = new Map<string, number>()
  let crossed = new Set<string>()

  return {
    note: (word) => {
      if (word === '') return null
      const count = (mistakes.get(word) ?? 0) + 1
      mistakes.set(word, count)
      if (count < threshold || crossed.has(word)) return null
      crossed.add(word)
      return word
    },

    countOf: (word) => mistakes.get(word) ?? 0,

    crossed: () => [...crossed],

    reset: () => {
      mistakes = new Map()
      crossed = new Set()
    },
  }
}

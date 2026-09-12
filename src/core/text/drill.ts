/**
 * Practice text built around one character transition.
 *
 * The first real intervention rather than another measurement: the cross-session
 * analysis says `in` is consistently slower than this typist's baseline, and
 * this turns that into something to type.
 *
 * ## Where the words come from
 *
 * The existing corpus, filtered to the words that actually contain the target.
 * Nothing is invented and no second corpus is introduced. For a 220-word list
 * that is more material than it sounds: `in` appears in 14 distinct words —
 * in, into, think, find, being, going, begin, bring and more — and the common
 * digraphs the analysis actually surfaces all have between 4 and 17.
 *
 * A sequence with no word at all behind it produces no drill. That is reported
 * rather than papered over with invented strings: `zq` is not a transition this
 * corpus can teach, and a page of nonsense would be worse than saying so.
 *
 * ## Why the drill is not all target words
 *
 * "in in in in in" trains a repetition that never occurs in real text. So does
 * a page made only of words containing `in` — the hands settle into one rhythm
 * and stop making the approach that the transition actually costs.
 *
 * The mix is roughly two target words to one ordinary one. The target is dense
 * enough that a short drill contains many times the exposure of ordinary
 * practice, while the words around it keep changing what the hands are doing on
 * either side. The goal is a transition that is faster in real typing, not a
 * sequence that is faster only in a drill.
 *
 * The same word never appears twice in a row, for the reason the ordinary
 * generator gives: it reads as a rendering fault and trains nothing.
 */

import type { SessionTarget } from '@core/types'

import type { RandomSource } from './generator.ts'
import type { TextProvider } from './types.ts'
import { COMMON_WORDS } from './word-list.ts'

/**
 * How many words a drill is.
 *
 * Fixed, and deliberately not configurable yet. Long enough to accumulate real
 * observations of the target — around 40 words of this mix yields roughly 40
 * occurrences, against the 5 a 60-word ordinary test gives — and short enough
 * that it is a thing you do rather than a thing you schedule.
 */
export const DRILL_WORD_COUNT = 40

/**
 * Share of the drill drawn from words containing the target.
 *
 * Two in three. An experimental parameter like every other number in this
 * corner of the codebase, not a figure derived from anything.
 */
export const TARGET_DENSITY = 2 / 3

export interface DrillPlan {
  /** The transition this drill was built for. */
  readonly sequence: string
  readonly text: string
  /** Distinct corpus words containing the sequence, in corpus order. */
  readonly carrierWords: readonly string[]
  /** Times the sequence occurs in `text`, counting overlaps the way typing does. */
  readonly targetOccurrences: number
  readonly wordCount: number
}

export interface DrillOptions {
  readonly sequence: string
  readonly wordCount?: number
  readonly words?: readonly string[]
  readonly random?: RandomSource
  readonly density?: number
}

/**
 * True when a sequence is something this version can build a drill from.
 *
 * Digraphs only for now, and no whitespace: a transition across a space is a
 * different phenomenon, already excluded from the analysis that produces these,
 * and a drill cannot make you practise a gap.
 */
export const isDrillableSequence = (sequence: string): boolean => {
  const characters = Array.from(sequence)
  return characters.length === 2 && characters.every((character) => !/\s/u.test(character))
}

/** Occurrences of `sequence` in `text`, overlapping. */
export const countOccurrences = (text: string, sequence: string): number => {
  if (sequence.length === 0) return 0

  let count = 0
  let from = text.indexOf(sequence)

  while (from !== -1) {
    count += 1
    // Advances by one rather than by the sequence length: in "aaa" the pair
    // "aa" is typed twice, and the second one is a real transition.
    from = text.indexOf(sequence, from + 1)
  }

  return count
}

/** The corpus words containing the target, in corpus order so it is stable. */
export const findCarrierWords = (
  sequence: string,
  words: readonly string[] = COMMON_WORDS,
): readonly string[] => words.filter((word) => word.includes(sequence))

/**
 * Builds a drill, or returns null when the corpus cannot support one.
 *
 * Null is a real answer, not a failure: it means no word in the material
 * available contains this transition, and the caller should decline to offer a
 * drill rather than show one made of invented syllables.
 */
export const createDrill = ({
  sequence,
  wordCount = DRILL_WORD_COUNT,
  words = COMMON_WORDS,
  random = Math.random,
  density = TARGET_DENSITY,
}: DrillOptions): DrillPlan | null => {
  if (!isDrillableSequence(sequence)) return null
  if (!Number.isInteger(wordCount) || wordCount <= 0) {
    throw new RangeError(`Drill word count must be a positive integer, got ${wordCount}`)
  }

  const carrierWords = findCarrierWords(sequence, words)
  if (carrierWords.length === 0) return null

  const fillerWords = words.filter((word) => !word.includes(sequence))

  const chosen: string[] = []

  /** Picks from a pool, never repeating the word just used. */
  const take = (pool: readonly string[]): string | null => {
    if (pool.length === 0) return null

    const previous = chosen[chosen.length - 1]
    const available =
      previous === undefined ? pool : pool.filter((word) => word !== previous)

    // A pool of exactly the word just used has nothing to offer; the caller
    // falls back to the other pool rather than repeating it.
    if (available.length === 0) return null

    const index = Math.min(available.length - 1, Math.floor(random() * available.length))
    return available[index] as string
  }

  for (let position = 0; position < wordCount; position += 1) {
    const wantsTarget = random() < density

    // The fallback is what makes a one-word carrier list work: the drill
    // alternates that word with ordinary ones instead of repeating it.
    const word =
      (wantsTarget ? take(carrierWords) : take(fillerWords)) ??
      (wantsTarget ? take(fillerWords) : take(carrierWords))

    // Only reachable when both pools are a single identical word, which cannot
    // happen for a real corpus but is worth not crashing on.
    if (word === null) break

    chosen.push(word)
  }

  const text = chosen.join(' ')

  return {
    sequence,
    text,
    carrierWords,
    targetOccurrences: countOccurrences(text, sequence),
    wordCount: chosen.length,
  }
}

/**
 * A drill as a `TextProvider`, so the typing screen loads it exactly the way it
 * loads ordinary practice text and knows nothing about drills.
 *
 * The plan is generated once, when the provider is constructed, for the reason
 * the provider interface documents: loading belongs at the composition root,
 * not in front of a keystroke. Restarting a drill therefore re-types the same
 * material, which is what makes a before-and-after comparison mean anything.
 */
export const DRILL_PROVIDER_ID = 'drill'

/** A drill provider, plus the plan behind it for a screen that wants to explain itself. */
export interface DrillProvider extends TextProvider {
  readonly plan: DrillPlan
}

export const createDrillProvider = (plan: DrillPlan): DrillProvider => {
  // Ignores the requested word count: a drill is the length it was generated
  // at, and the screen's 15/30/60 control has no meaning here.
  const target: SessionTarget = { text: plan.text, sourceId: DRILL_PROVIDER_ID }

  return {
    id: DRILL_PROVIDER_ID,
    label: `Drill: ${plan.sequence}`,
    plan,
    provide: () => target,
  }
}

/**
 * How the typist's rhythm actually came out: read from a finished Syllable
 * Trainer test's keystrokes, once, after the last character.
 *
 * The trainer teaches syllable, a breath, syllable. Whether that is happening is
 * a measurement, not an impression: compare the gap between two keys *inside* a
 * syllable with the gap between the last key of one syllable and the first of
 * the next. A typist still typing each word as one block has the same gap at
 * both; one who is chunking has a longer one at the breaks, and a shorter one
 * inside the chunks.
 *
 * Only clean transitions count, by the same rules the rest of telemetry uses
 * (see core/telemetry/sequences.ts): two character keystrokes, next to each other
 * in the log, on consecutive positions of the same word, both right. A mistake,
 * a correction or a space between them would time something else. The typical
 * gap is the median, so one hesitation does not decide the reading.
 *
 * It reports; it does not grade. There is no right size for a breath, and a
 * typist whose chunks have become automatic may show only a small one. The
 * words it chooses say what the numbers show and no more.
 */

import { computeWordRanges, toCharacters } from '@core/engine'
import type { Keystroke } from '@core/types'

import { layoutSyllables, type SyllableLayout } from './layout.ts'

export const READING_RULES = {
  /** Clean transitions needed of each kind before there is anything to read. */
  minimum: 6,
  /** A break this much longer than a key inside a syllable — and this share of it — reads as chunking. */
  chunked: { ms: 30, share: 0.25 },
  /** A break within this of a key inside a syllable reads as the word typed as one block. */
  unbroken: { ms: 10 },
} as const

export type RhythmVerdict =
  /** The breaks are clearly longer than the keys inside a syllable. */
  | 'chunked'
  /** Longer, but not by much yet. */
  | 'emerging'
  /** The same: the words are still single blocks. */
  | 'unbroken'
  /** Too few clean transitions to say. */
  | 'too-few'

export interface RhythmTiming {
  /** The typical gap, in milliseconds, or null with nothing to measure. */
  readonly medianMs: number | null
  /** How many clean transitions it was read from. */
  readonly count: number
}

export interface RhythmReading {
  /** Between two keys inside the same syllable. */
  readonly within: RhythmTiming
  /** From the last key of a syllable to the first of the next, in the same word. */
  readonly breaks: RhythmTiming
  /** `breaks - within`, or null when either is missing. */
  readonly differenceMs: number | null
  readonly verdict: RhythmVerdict
}

const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? (sorted[middle] as number) : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
}

const round = (value: number | null): number | null => (value === null ? null : Math.round(value))

export const readRhythm = (
  keystrokes: readonly Keystroke[],
  text: string,
  layout: SyllableLayout = layoutSyllables(text),
): RhythmReading => {
  const characters = toCharacters(text)
  const words = computeWordRanges(characters)
  // For each position: its word's index, and whether a syllable (other than the first) starts there.
  const wordAt = new Int32Array(characters.length).fill(-1)
  const breakAt = new Uint8Array(characters.length)
  for (const word of words) {
    for (let index = word.start; index < word.end; index += 1) wordAt[index] = word.index
    for (const offset of layout[word.index] ?? []) if (offset > 0) breakAt[word.start + offset] = 1
  }

  const within: number[] = []
  const breaks: number[] = []
  keystrokes.forEach((keystroke, position) => {
    const previous = keystrokes[position - 1]
    if (previous === undefined) return
    const clean =
      previous.kind === 'character' &&
      keystroke.kind === 'character' &&
      previous.correct &&
      keystroke.correct &&
      keystroke.index === previous.index + 1 &&
      (wordAt[keystroke.index] ?? -1) >= 0 &&
      wordAt[keystroke.index] === wordAt[previous.index]
    if (!clean) return
    const gap = keystroke.at - previous.at
    if (breakAt[keystroke.index] === 1) breaks.push(gap)
    else within.push(gap)
  })

  const withinMs = median(within)
  const breaksMs = median(breaks)
  const difference = withinMs === null || breaksMs === null ? null : breaksMs - withinMs

  const verdict: RhythmVerdict =
    difference === null || within.length < READING_RULES.minimum || breaks.length < READING_RULES.minimum
      ? 'too-few'
      : difference >= Math.max(READING_RULES.chunked.ms, (withinMs ?? 0) * READING_RULES.chunked.share)
        ? 'chunked'
        : difference <= READING_RULES.unbroken.ms
          ? 'unbroken'
          : 'emerging'

  return {
    within: { medianMs: round(withinMs), count: within.length },
    breaks: { medianMs: round(breaksMs), count: breaks.length },
    differenceMs: round(difference),
    verdict,
  }
}

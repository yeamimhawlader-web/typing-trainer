/**
 * The demonstration as a timeline: what is on screen at every moment of it.
 *
 * Built once from the words and the rhythm (rhythm.ts), and only played by the
 * screen, which moves from step to step and draws each. Every step says which
 * word is shown, how much of it is typed, which syllable is the one in hand and
 * what is happening to it — so the drawing never has to work anything out, and
 * the whole thing is tested without a clock.
 */

import type { SyllableWord } from './corpus.ts'
import { SYLLABLE_RHYTHM, type SyllableRhythm } from './rhythm.ts'

export type DemoPhase =
  /** The word, whole, as a reader sees it. */
  | 'whole'
  /** Coming apart into its syllables. */
  | 'chunk'
  /** A letter of the syllable in hand has just been typed. */
  | 'type'
  /** The syllable in hand is done: a breath before the next. */
  | 'breath'
  /** Every syllable typed: the word closes back up. */
  | 'resolve'
  /** Nothing moving, before the next word. */
  | 'rest'

export interface DemoStep {
  /** When the step begins, from the start of the demonstration. */
  readonly at: number
  readonly durationMs: number
  /** Which demonstration word. */
  readonly word: number
  readonly phase: DemoPhase
  /** The syllable in hand, or -1 where there is none. */
  readonly syllable: number
  /** How many of the word's letters are typed. */
  readonly typed: number
}

export interface DemoTimeline {
  readonly steps: readonly DemoStep[]
  readonly durationMs: number
}

/** The instruction a step is showing: chunk, type, pause, type the next. */
export type DemoCue = 'chunk' | 'type' | 'pause' | 'next'

export const cueOf = (step: DemoStep): DemoCue | null => {
  switch (step.phase) {
    case 'chunk':
      return 'chunk'
    case 'type':
      return step.syllable === 0 ? 'type' : 'next'
    case 'breath':
      return 'pause'
    default:
      return null
  }
}

export const buildDemoTimeline = (
  words: readonly SyllableWord[],
  rhythm: SyllableRhythm['demo'] = SYLLABLE_RHYTHM.demo,
): DemoTimeline => {
  const steps: DemoStep[] = []
  let at = 0
  const push = (word: number, phase: DemoPhase, syllable: number, typed: number, durationMs: number) => {
    steps.push({ at, durationMs, word, phase, syllable, typed })
    at += durationMs
  }

  words.forEach((entry, word) => {
    push(word, 'whole', -1, 0, rhythm.wholeMs)
    push(word, 'chunk', -1, 0, rhythm.chunkMs)
    let typed = 0
    entry.syllables.forEach((syllable, index) => {
      for (let letter = 0; letter < syllable.length; letter += 1) {
        typed += 1
        push(word, 'type', index, typed, rhythm.characterMs)
      }
      if (index < entry.syllables.length - 1) push(word, 'breath', index, typed, rhythm.breathMs)
    })
    push(word, 'resolve', -1, typed, rhythm.resolveMs)
    push(word, 'rest', -1, typed, word === words.length - 1 ? rhythm.loopRestMs : rhythm.restMs)
  })

  return { steps, durationMs: at }
}

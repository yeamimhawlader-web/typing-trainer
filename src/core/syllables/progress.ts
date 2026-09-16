/**
 * How far through its syllables a word is, read from the engine's snapshot.
 *
 * Nothing is kept: every answer is worked out from where the cursor is and the
 * state the engine already gave each character, so a backspace, a skipped word
 * or a mistake is reflected the moment the engine reflects it, and nothing here
 * can disagree with the score.
 *
 * ## Resolving is earned
 *
 * A word resolves when its last letter has been typed — the cursor has reached
 * its end — and it resolves *clean* only if every letter in it ended up right,
 * and nothing extra was typed where its space belongs. A word the typist left
 * with a space part-way through, or typed with a wrong letter standing, is
 * `missed`: it is over, but it is not shown as done. The trainer never accepts a
 * word as right because it was finished.
 *
 * Each of these is cheap enough to run for every word on every keystroke: the
 * cursor comparison answers almost all of them, and only a word the cursor has
 * passed looks at its own letters.
 */

import type { EngineSnapshot } from '@core/engine'

export type SyllableState =
  /** Not reached yet. */
  | 'pending'
  /** The chunk being typed now. */
  | 'active'
  /** Typed: the cursor is past it, whatever it holds. */
  | 'typed'

export const syllableState = (cursorIndex: number, start: number, end: number): SyllableState =>
  cursorIndex < start ? 'pending' : cursorIndex < end ? 'active' : 'typed'

export type WordResolution =
  /** A word still to come. */
  | 'ahead'
  /** The word being typed. */
  | 'current'
  /** Every letter typed, and every one right. */
  | 'resolved'
  /** Over, with a letter wrong, missing, or something extra after it. */
  | 'missed'

type Progress = Pick<EngineSnapshot, 'cursorIndex' | 'characterStates'>

export const wordResolution = (snapshot: Progress, start: number, end: number): WordResolution => {
  const { cursorIndex, characterStates } = snapshot
  if (cursorIndex < start) return 'ahead'
  if (cursorIndex < end) return 'current'
  for (let index = start; index < end; index += 1) {
    const state = characterStates[index]
    if (state !== 'correct' && state !== 'corrected') return 'missed'
  }
  // Extra letters where the space belongs are the engine's "incorrect" on the space.
  return characterStates[end] === 'incorrect' ? 'missed' : 'resolved'
}

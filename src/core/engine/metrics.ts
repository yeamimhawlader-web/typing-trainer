/**
 * Speed and accuracy, as pure functions.
 *
 * Kept out of the engine so the definitions can be read, argued about and
 * tested on their own. Every one of these is a convention rather than a law,
 * so each is stated explicitly here rather than being implied by the code that
 * happens to call it.
 *
 * The definitions used:
 *
 *   raw WPM  = every character typed / 5 / minutes
 *   net WPM  = characters currently correct / 5 / minutes
 *   accuracy = correct character keystrokes / all character keystrokes
 *
 * "5 characters = 1 word" is the standard convention and the reason WPM is
 * comparable across different texts at all.
 *
 * Two consequences worth being deliberate about:
 *
 * - A character typed wrongly, deleted, and retyped correctly counts toward
 *   net WPM (the text is right) but permanently against accuracy (the mistake
 *   happened). Speed and accuracy measure different things.
 * - Backspaces are not character keystrokes and appear in neither metric. They
 *   cost the typist time, which the elapsed clock already charges them for.
 */

import {
  accuracy as toAccuracy,
  CHARACTERS_PER_WORD,
  MILLISECONDS_PER_MINUTE,
  wpm as toWpm,
  type Accuracy,
  type Milliseconds,
  type Wpm,
} from '@core/types'

/**
 * Words per minute for a character count over a duration.
 *
 * Returns 0 for a zero or negative duration rather than Infinity. That case is
 * not hypothetical: the first keystroke of a session lands at elapsed 0, and
 * several keystrokes can share a millisecond at speed.
 */
export const calculateWpm = (characters: number, elapsedMs: Milliseconds): Wpm => {
  if (elapsedMs <= 0 || characters <= 0) return toWpm(0)

  const minutes = elapsedMs / MILLISECONDS_PER_MINUTE
  return toWpm(characters / CHARACTERS_PER_WORD / minutes)
}

/**
 * Proportion of character keystrokes that were correct.
 *
 * Before anything has been typed there is no evidence of a mistake, so this
 * reports 1 — which is also what a typist expects a fresh screen to show.
 */
export const calculateAccuracy = (
  correctKeystrokes: number,
  totalKeystrokes: number,
): Accuracy => {
  if (totalKeystrokes <= 0) return toAccuracy(1)

  const ratio = correctKeystrokes / totalKeystrokes
  return toAccuracy(Math.min(1, Math.max(0, ratio)))
}

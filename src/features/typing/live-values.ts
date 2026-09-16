/**
 * The live figures a typing screen shows, as selectors over the engine snapshot.
 *
 * Shared by both typing screens, so the classic screen and GG.Typing show the
 * same number at the same moment: nothing here computes a speed or an accuracy,
 * it only chooses how the engine's own figure is displayed. Each selector returns
 * the value as displayed rather than the raw number, so a component subscribed
 * to it re-renders only when what is on screen would change.
 */

import type { EngineSnapshot } from '@core/engine'

/**
 * Live speed is meaningless for the first moment of a test.
 *
 * The clock starts on the first keystroke, so after N characters only N-1
 * intervals have actually been measured — the first character is free. Early on
 * that inflates the figure badly: a typist holding a steady 130 WPM sees 229 on
 * their third keystroke, falling through 176 and 153 before it settles.
 *
 * Over a whole test the same bias is worth about 0.3%, so the engine's
 * definition stays as it is. This only withholds the number until there is
 * enough signal to be worth showing, which a dash says honestly and a
 * confidently wrong "229" does not.
 */
export const MIN_ELAPSED_FOR_WPM_MS = 1_000

/** Net WPM, rounded; null for the first second. Never capped. */
export const selectLiveWpm = (snapshot: EngineSnapshot): number | null =>
  snapshot.elapsedMs < MIN_ELAPSED_FOR_WPM_MS ? null : Math.round(snapshot.netWpm)

/** Accuracy as a whole percentage. */
export const selectAccuracyPercent = (snapshot: EngineSnapshot): number =>
  Math.round(snapshot.accuracy * 100)

/** Whole seconds elapsed, so a timer re-renders once a second rather than ten times. */
export const selectElapsedSeconds = (snapshot: EngineSnapshot): number =>
  Math.floor(snapshot.elapsedMs / 1000)

/**
 * How accuracy is doing, as three states rather than a number.
 *
 * The same accuracy the engine reports and the result records — nothing is
 * recomputed here — read as the ratio it is, never as a rounded percentage: at
 * 95.99% the figure on screen says 96, and the typist is nonetheless below the
 * line. The boundaries are inclusive from above, so exactly 96% is still
 * normal and exactly 94% is still caution.
 *
 * Returning a state rather than a number is what keeps the message still: a
 * component subscribed to this re-renders when the state changes and at no
 * other time, however often the figure moves underneath it.
 */
export type AccuracyState = 'normal' | 'caution' | 'critical'

export const ACCURACY_STATES = {
  /** At or above this, nothing is said. */
  caution: 0.96,
  /** Below this, the stronger of the two. */
  critical: 0.94,
} as const

export const selectAccuracyState = (snapshot: EngineSnapshot): AccuracyState => {
  // Nothing typed yet is not an accuracy problem.
  if (snapshot.typedCount === 0) return 'normal'
  if (snapshot.accuracy >= ACCURACY_STATES.caution) return 'normal'
  return snapshot.accuracy >= ACCURACY_STATES.critical ? 'caution' : 'critical'
}

/**
 * Plays the word jump on one element.
 *
 * The Web Animations API rather than a CSS class toggled on and off: a class
 * would have to be removed and re-added — with a forced reflow in between — to
 * replay, and a reflow on the typing path is precisely what this feature must
 * never cause. `element.animate` replays by being called again, touches no
 * layout, and hands a transform-only animation to the compositor.
 *
 * Reduced motion is checked at the moment of playing, not once at load, so
 * changing the system setting mid-session takes effect on the next jump. When
 * it is on, nothing plays. Nothing else is lost: the mistake itself is still
 * shown by the character's colour and bar, which never depended on motion.
 */

import { buildWordJumpKeyframes, WORD_JUMP_MOTION, wordJumpDurationMs, type WordJumpMotion } from './word-jump.motion.ts'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(REDUCED_MOTION_QUERY).matches

/**
 * Starts a jump on `element`, or does nothing when motion is unwanted or the
 * browser cannot animate. Returns the animation so a caller can cancel it.
 */
export const playWordJump = (
  element: HTMLElement,
  motion: WordJumpMotion = WORD_JUMP_MOTION,
): Animation | null => {
  if (typeof element.animate !== 'function') return null
  if (prefersReducedMotion()) return null

  return element.animate(buildWordJumpKeyframes(motion), {
    duration: wordJumpDurationMs(motion),
    // The per-keyframe curves carry all of the shape; an overall easing on top
    // would distort the phase timings.
    easing: 'linear',
    // Nothing held after the end: the word is left exactly as it was.
    fill: 'none',
  })
}

/**
 * Plays Hover Mode's motion on one focus's elements.
 *
 * The Web Animations API throughout, for the word jump's reasons: nothing is
 * toggled by class, nothing forces a reflow, and every animation is a transform
 * or an opacity the compositor can run on its own. No animation reads or writes
 * anything the typing engine owns.
 *
 * The one read is at release: the hover's current pose, taken from computed
 * style once so the descent can start exactly where the word is. It happens
 * once per focus, on the key that finished the last repetition, never on an
 * ordinary keystroke.
 *
 * Reduced motion is checked when each motion starts. When it is on, nothing
 * moves: the focused word, its nodes and its glow are drawn still by CSS, and
 * every call here returns at once.
 */

import {
  buildDriftLoop,
  buildEnterTo,
  buildFloatLoop,
  buildGlowLoop,
  buildLiftEnter,
  buildLiftRelease,
  buildNodeAppear,
  buildNodePop,
  buildPoolLoop,
  buildSettleToRest,
  buildSuccessSettle,
  buildTiltLoop,
  HOVER_FAILURE_JUMP,
  HOVER_MOTION,
  hoverEnterDurationMs,
  hoverReleaseDurationMs,
  successDurationMs,
} from './hover.motion.ts'
import { playWordJump, prefersReducedMotion } from './word-jump.ts'

export interface HoverElements {
  readonly lift: HTMLElement
  readonly accent: HTMLElement
  readonly float: HTMLElement
  readonly drift: HTMLElement
  readonly tilt: HTMLElement
  readonly glow: HTMLElement
  readonly pool: HTMLElement
}

export interface HoverMotion {
  /** The focus's nodes growing in under the word, when a mistake catches it. */
  appear(nodes: readonly HTMLElement[]): void
  /** Lift-off into the hover, which then loops until released. */
  enter(): void
  /** A repetition with a mistake: the jump, and the nodes added for it. */
  fail(added: readonly HTMLElement[]): void
  /** A clean repetition: the node it filled, and a small settle. */
  succeed(node: HTMLElement | null): void
  /** Back down to the line. Resolves when the word is at rest. */
  release(nodes: readonly HTMLElement[]): Promise<void>
  /** Everything cancelled at once: restart, a new test, unmounting. */
  stop(): void
}

const canAnimate = (element: HTMLElement): boolean =>
  typeof element.animate === 'function' && !prefersReducedMotion()

const REST_TRANSFORM: Keyframe = { transform: 'none' }

export const createHoverMotion = (elements: HoverElements): HoverMotion => {
  const { lift, accent, float, drift, tilt, glow, pool } = elements
  const running = new Set<Animation>()
  let accentAnimation: Animation | null = null
  let released = false

  const play = (element: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation => {
    const animation = element.animate(keyframes, options)
    running.add(animation)
    const forget = () => running.delete(animation)
    animation.addEventListener('cancel', forget)
    // Held animations stay in the set until the focus ends; the rest go.
    if (options.fill !== 'forwards' && options.iterations !== Infinity) animation.addEventListener('finish', forget)
    return animation
  }

  const stop = (): void => {
    for (const animation of [...running]) animation.cancel()
    running.clear()
    accentAnimation = null
  }

  const playAccent = (start: () => Animation | null): void => {
    accentAnimation?.cancel()
    accentAnimation = start()
    if (accentAnimation !== null) running.add(accentAnimation)
  }

  const growIn = (nodes: readonly HTMLElement[]): void => {
    nodes.forEach((node, index) => {
      play(node, buildNodeAppear(), {
        duration: HOVER_MOTION.node.appearMs,
        delay: index * HOVER_MOTION.node.appearStaggerMs,
        easing: 'linear',
        fill: 'backwards',
      })
    })
  }

  return {
    appear: (nodes) => {
      if (!canAnimate(lift)) return
      growIn(nodes)
    },

    enter: () => {
      if (!canAnimate(lift)) return

      const enterMs = hoverEnterDurationMs()
      const hold: KeyframeAnimationOptions = { duration: enterMs, easing: 'linear', fill: 'forwards' }
      const loop = (periodMs: number): KeyframeAnimationOptions => ({
        duration: periodMs,
        // Every loop begins as lift-off ends, from the same moment, so the
        // glow and the light under the word stay in step with the hover.
        delay: enterMs,
        iterations: Infinity,
        easing: 'linear',
        // No fill: until it begins, the lift-off holding the same layer shows.
        fill: 'none',
      })

      play(lift, buildLiftEnter(), hold)

      const drifting = buildDriftLoop()
      const tilting = buildTiltLoop()
      const glowing = buildGlowLoop()
      const pooling = buildPoolLoop()

      play(drift, buildEnterTo(drifting, { transform: 'translateX(0em)' }), hold)
      play(tilt, buildEnterTo(tilting, { transform: 'rotate(0deg)', transformOrigin: HOVER_MOTION.origin }), hold)
      play(glow, buildEnterTo(glowing, { opacity: 0, transform: 'scale(0.9)' }), hold)
      play(pool, buildEnterTo(pooling, { opacity: 0, transform: 'scaleX(0.7)' }), hold)

      play(float, buildFloatLoop(), loop(HOVER_MOTION.float.periodMs))
      play(drift, drifting, loop(HOVER_MOTION.drift.periodMs))
      play(tilt, tilting, loop(HOVER_MOTION.tilt.periodMs))
      play(glow, glowing, loop(HOVER_MOTION.float.periodMs))
      play(pool, pooling, loop(HOVER_MOTION.float.periodMs))
    },

    fail: (added) => {
      if (released || !canAnimate(accent)) return
      playAccent(() => playWordJump(accent, HOVER_FAILURE_JUMP))
      growIn(added)
    },

    succeed: (node) => {
      if (released || !canAnimate(accent)) return
      playAccent(() => accent.animate(buildSuccessSettle(), { duration: successDurationMs(), easing: 'linear' }))
      if (node !== null) play(node, buildNodePop(), { duration: HOVER_MOTION.node.popMs, easing: 'linear' })
    },

    release: (nodes) => {
      released = true
      if (!canAnimate(lift)) {
        stop()
        return Promise.resolve()
      }

      // Where every layer is right now, read once, before anything is cancelled.
      const pose = (element: HTMLElement): Keyframe => {
        const style = getComputedStyle(element)
        return { transform: style.transform === 'none' ? 'none' : style.transform, opacity: Number(style.opacity) }
      }
      const liftFrom = getComputedStyle(lift).transform
      const floatFrom = pose(float)
      const driftFrom = pose(drift)
      const tiltFrom = pose(tilt)
      const glowFrom = pose(glow)
      const poolFrom = pose(pool)

      stop()

      const { descentMs, fadeMs, nodeFadeMs, nodeStaggerMs } = HOVER_MOTION.release
      const hold = (duration: number): KeyframeAnimationOptions => ({ duration, easing: 'linear', fill: 'forwards' })

      const landing = play(lift, buildLiftRelease(liftFrom === 'none' ? 'translateY(0em)' : liftFrom), hold(hoverReleaseDurationMs()))
      play(float, buildSettleToRest({ transform: floatFrom.transform }, REST_TRANSFORM), hold(descentMs))
      play(drift, buildSettleToRest({ transform: driftFrom.transform }, REST_TRANSFORM), hold(descentMs))
      play(tilt, buildSettleToRest({ transform: tiltFrom.transform }, REST_TRANSFORM), hold(descentMs))
      play(glow, buildSettleToRest(glowFrom, { opacity: 0, transform: 'scale(0.9)' }), hold(fadeMs))
      play(pool, buildSettleToRest(poolFrom, { opacity: 0, transform: 'scaleX(0.7)' }), hold(fadeMs))
      nodes.forEach((node, index) => {
        play(node, buildSettleToRest({ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0)', opacity: 0 }), {
          ...hold(nodeFadeMs),
          delay: index * nodeStaggerMs,
        })
      })

      return landing.finished.then(
        () => undefined,
        // Cancelled by a restart part-way down: nothing left to wait for.
        () => undefined,
      )
    },

    stop,
  }
}

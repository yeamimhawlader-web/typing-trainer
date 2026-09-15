/**
 * Hover Mode's motion, checked as numbers.
 *
 * How it feels is judged in a browser. What can be held here is what the design
 * promises: loops without a seam, lift-off that hands over to the hover without
 * a jump in position or speed, no linear curves, sizes that keep the word
 * readable and unclipped, and nothing at all under reduced motion.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

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
  buildSuccessSettle,
  buildTiltLoop,
  HOVER_FAILURE_JUMP,
  HOVER_MOTION,
  hoverEnterDurationMs,
  hoverReleaseDurationMs,
  successDurationMs,
} from './hover.motion.ts'
import { createHoverMotion } from './hover.ts'
import { buildWordJumpKeyframes, WORD_JUMP_MOTION, wordJumpDurationMs } from './word-jump.motion.ts'

const SINE = 'cubic-bezier(0.37, 0, 0.63, 1)'

/** A keyframe's values, without its timing. */
const valuesOf = (frame: Keyframe | undefined): Keyframe => {
  const { offset: _offset, easing: _easing, ...values } = frame ?? {}
  return values
}

const translateYEm = (frame: Keyframe | undefined): number => {
  const match = /translateY\((-?[\d.]+)em\)/.exec(String(frame?.transform))
  if (match === null) throw new Error(`no translateY in ${String(frame?.transform)}`)
  return Number(match[1])
}

const easingOf = (frame: Keyframe): { y1: number; y2: number } => {
  const match = /^cubic-bezier\(([\d.-]+), ([\d.-]+), ([\d.-]+), ([\d.-]+)\)$/.exec(String(frame.easing))
  if (match === null) throw new Error(`not a cubic bézier: ${String(frame.easing)}`)
  return { y1: Number(match[2]), y2: Number(match[4]) }
}

const LOOPS = {
  float: buildFloatLoop(),
  drift: buildDriftLoop(),
  tilt: buildTiltLoop(),
  glow: buildGlowLoop(),
  pool: buildPoolLoop(),
}

describe('Hover Mode motion', () => {
  describe.each(Object.entries(LOOPS))('the %s loop', (_name, frames) => {
    it('ends exactly where it begins, so it wraps without a seam', () => {
      expect(frames[0]?.offset).toBe(0)
      expect(frames.at(-1)?.offset).toBe(1)
      expect(valuesOf(frames.at(-1))).toEqual(valuesOf(frames[0]))
    })

    it('has keyframes only at its extremes, joined by curves that stop at both ends', () => {
      // Zero speed at every keyframe, from both sides, is what makes every join
      // — the wrap included — smooth in speed as well as position.
      for (const frame of frames.slice(0, -1)) {
        expect(frame.easing).toBe(SINE)
        const { y1, y2 } = easingOf(frame)
        expect(y1).toBe(0)
        expect(y2).toBe(1)
      }
      expect(frames).toHaveLength(3)
    })
  })

  it('rises more slowly than it sinks, in step with its glow and its light', () => {
    expect(HOVER_MOTION.float.riseShare).toBeGreaterThan(0.5)
    expect(LOOPS.glow[1]?.offset).toBe(LOOPS.float[1]?.offset)
    expect(LOOPS.pool[1]?.offset).toBe(LOOPS.float[1]?.offset)
  })

  it('runs drift and tilt on periods of their own, so the whole does not visibly repeat', () => {
    const periods = [HOVER_MOTION.float.periodMs, HOVER_MOTION.drift.periodMs, HOVER_MOTION.tilt.periodMs]

    expect(new Set(periods).size).toBe(3)
    // Slow: every loop takes seconds, not a fraction of one.
    for (const period of periods) expect(period).toBeGreaterThanOrEqual(3_000)
  })

  it('lifts off into exactly the pose each loop starts from, arriving at rest', () => {
    const lift = buildLiftEnter()
    expect(translateYEm(lift[0])).toBe(0)
    expect(translateYEm(lift.at(-1))).toBe(-HOVER_MOTION.enter.liftEm)
    // The float starts at its own rest, stacked on the lift.
    expect(translateYEm(LOOPS.float[0])).toBe(0)

    for (const loop of [LOOPS.drift, LOOPS.tilt, LOOPS.glow, LOOPS.pool]) {
      const enter = buildEnterTo(loop, { transform: 'none' })
      expect(valuesOf(enter.at(-1))).toEqual(valuesOf(loop[0]))
    }

    // Both curves into the hover stop at their end.
    expect(easingOf(lift[1] as Keyframe).y2).toBe(1)
  })

  it('gathers before it lifts, sinking first', () => {
    const lift = buildLiftEnter()

    expect(translateYEm(lift[1])).toBeGreaterThan(0)
    expect(lift[1]?.offset).toBeCloseTo(HOVER_MOTION.enter.gatherMs / hoverEnterDurationMs(), 3)
  })

  it('uses no linear segments anywhere', () => {
    const tracks = [
      ...Object.values(LOOPS),
      buildLiftEnter(),
      buildSuccessSettle(),
      buildNodePop(),
      buildNodeAppear(),
      buildLiftRelease('translateY(-0.3em)'),
    ]
    for (const frames of tracks) {
      for (const frame of frames.slice(0, -1)) {
        expect(frame.easing).toMatch(/^cubic-bezier\(/)
      }
    }
  })

  it('keeps the word inside the room the stream leaves above its first line', () => {
    const hoverTop = HOVER_MOTION.enter.liftEm + HOVER_MOTION.float.travelEm
    const peak = hoverTop + HOVER_FAILURE_JUMP.heightEm

    // The stream reserves 0.5 em above the first line, and the letters' own
    // box already sits below the top of their line.
    expect(peak).toBeLessThanOrEqual(0.6)
    expect(HOVER_MOTION.enter.liftEm).toBeGreaterThan(HOVER_MOTION.float.travelEm * 2)
  })

  it('keeps the letters readable: a slight lean, a small scale', () => {
    expect(HOVER_MOTION.tilt.angleDeg).toBeLessThan(1)
    expect(Math.max(...HOVER_MOTION.glow.scale)).toBeLessThanOrEqual(1.05)
    expect(HOVER_MOTION.drift.distanceEm).toBeLessThanOrEqual(0.05)
  })

  it('reacts to a miss with the word jump itself, lower and quicker', () => {
    expect(buildWordJumpKeyframes(HOVER_FAILURE_JUMP)).toHaveLength(buildWordJumpKeyframes(WORD_JUMP_MOTION).length)
    expect(HOVER_FAILURE_JUMP.heightEm).toBeLessThan(WORD_JUMP_MOTION.heightEm)
    expect(wordJumpDurationMs(HOVER_FAILURE_JUMP)).toBeLessThan(wordJumpDurationMs(WORD_JUMP_MOTION))
    expect(wordJumpDurationMs(HOVER_FAILURE_JUMP)).toBeGreaterThanOrEqual(300)
  })

  it('keeps every event brief, and lands softly on release', () => {
    expect(hoverEnterDurationMs()).toBeLessThanOrEqual(800)
    expect(successDurationMs()).toBeLessThanOrEqual(500)
    expect(hoverReleaseDurationMs()).toBeLessThanOrEqual(900)

    const release = buildLiftRelease('translateY(-0.28em)')
    expect(translateYEm(release[1])).toBe(HOVER_MOTION.release.undershootEm)
    expect(translateYEm(release.at(-1))).toBe(0)
  })

  it('is deterministic', () => {
    expect(buildFloatLoop()).toEqual(buildFloatLoop())
    expect(buildLiftEnter()).toEqual(buildLiftEnter())
  })
})

describe('playing Hover Mode motion', () => {
  const originalMatchMedia = window.matchMedia
  const originalAnimate = HTMLElement.prototype.animate

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    HTMLElement.prototype.animate = originalAnimate
  })

  const reduceMotion = (reduce: boolean) => {
    window.matchMedia = ((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion: reduce'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia
  }

  const recordAnimations = () => {
    const played: { element: HTMLElement; options: KeyframeAnimationOptions }[] = []
    const cancelled: HTMLElement[] = []
    HTMLElement.prototype.animate = vi.fn(function animate(
      this: HTMLElement,
      _keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
      options?: number | KeyframeAnimationOptions,
    ) {
      played.push({ element: this, options: typeof options === 'object' ? options : {} })
      const target = played.at(-1)?.element as HTMLElement
      return {
        playState: 'running',
        finished: Promise.resolve(),
        cancel: () => cancelled.push(target),
        addEventListener: () => undefined,
      } as unknown as Animation
    }) as unknown as typeof HTMLElement.prototype.animate
    return { played, cancelled }
  }

  const elements = () => ({
    lift: document.createElement('span'),
    accent: document.createElement('span'),
    float: document.createElement('span'),
    drift: document.createElement('span'),
    tilt: document.createElement('span'),
    glow: document.createElement('span'),
    pool: document.createElement('span'),
  })

  it('plays nothing at all under reduced motion, and still resolves its release', async () => {
    reduceMotion(true)
    const { played } = recordAnimations()
    const motion = createHoverMotion(elements())
    const nodes = [document.createElement('span')]

    motion.appear(nodes)
    motion.enter()
    motion.fail(nodes)
    motion.succeed(nodes[0] ?? null)
    await motion.release(nodes)

    expect(played).toEqual([])
  })

  it('lifts every layer off and loops the hover on each of its own layers', () => {
    reduceMotion(false)
    const { played } = recordAnimations()
    const parts = elements()

    createHoverMotion(parts).enter()

    const looping = played.filter(({ options }) => options.iterations === Infinity).map(({ element }) => element)
    expect(looping).toEqual([parts.float, parts.drift, parts.tilt, parts.glow, parts.pool])
    // Every loop starts at the same moment, as lift-off ends.
    expect(new Set(played.filter(({ options }) => options.iterations === Infinity).map(({ options }) => options.delay))).toEqual(
      new Set([hoverEnterDurationMs()]),
    )
    // Nothing moves the accent layer until something happens.
    expect(played.some(({ element }) => element === parts.accent)).toBe(false)
  })

  it('plays a miss and a success on the accent layer, over the hover', () => {
    reduceMotion(false)
    const { played } = recordAnimations()
    const parts = elements()
    const motion = createHoverMotion(parts)
    motion.enter()
    const before = played.length

    motion.fail([])
    motion.succeed(null)

    expect(played.slice(before).map(({ element }) => element)).toEqual([parts.accent, parts.accent])
  })

  it('cancels everything when stopped', () => {
    reduceMotion(false)
    const { played, cancelled } = recordAnimations()
    const motion = createHoverMotion(elements())
    motion.enter()

    motion.stop()

    expect(cancelled).toHaveLength(played.length)
  })
})

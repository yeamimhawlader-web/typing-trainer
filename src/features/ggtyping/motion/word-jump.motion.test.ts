/**
 * The motion's shape, checked as numbers.
 *
 * How it looks is judged in a browser. What can be held here is the envelope
 * the design promised: the timing window, the size limits, transform-only
 * keyframes, curves that are not linear, and no randomness.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildWordJumpKeyframes,
  riseSegments,
  WORD_JUMP_MOTION,
  wordJumpDurationMs,
} from './word-jump.motion.ts'
import { playWordJump } from './word-jump.ts'

const keyframes = buildWordJumpKeyframes()

const parse = (frame: Keyframe) => {
  const value = String(frame.transform)
  const match =
    /^translateY\((-?[\d.]+)em\) scale\((-?[\d.]+), (-?[\d.]+)\) rotate\((-?[\d.]+)deg\)$/.exec(value)
  if (match === null) throw new Error(`unexpected transform: ${value}`)
  return {
    y: Number(match[1]),
    scaleX: Number(match[2]),
    scaleY: Number(match[3]),
    tilt: Number(match[4]),
  }
}

describe('word jump motion', () => {
  it('lasts within the 400–550 ms window', () => {
    const duration = wordJumpDurationMs()

    expect(duration).toBeGreaterThanOrEqual(400)
    expect(duration).toBeLessThanOrEqual(550)
  })

  it('runs through its phases in order, from rest back to rest', () => {
    const offsets = keyframes.map((frame) => frame.offset)

    expect(offsets[0]).toBe(0)
    expect(offsets.at(-1)).toBe(1)
    for (let index = 1; index < offsets.length; index += 1) {
      expect(offsets[index]).toBeGreaterThan(offsets[index - 1] as number)
    }

    expect(parse(keyframes[0] as Keyframe)).toEqual({ y: 0, scaleX: 1, scaleY: 1, tilt: 0 })
    expect(parse(keyframes.at(-1) as Keyframe)).toEqual({ y: 0, scaleX: 1, scaleY: 1, tilt: 0 })
  })

  it('stays within the size limits, so the word stays readable', () => {
    const frames = keyframes.map(parse)
    const peak = Math.min(...frames.map((frame) => frame.y))

    expect(-peak).toBe(WORD_JUMP_MOTION.heightEm)
    // 8–16 px at both sizes the typing text is set in: 20 px on a phone, 28 px
    // on a desktop.
    for (const fontSizePx of [20, 28]) {
      expect(-peak * fontSizePx).toBeGreaterThanOrEqual(8)
      expect(-peak * fontSizePx).toBeLessThanOrEqual(16)
    }

    for (const frame of frames) {
      expect(Math.abs(frame.tilt)).toBeLessThanOrEqual(2)
      expect(Math.abs(frame.scaleX - 1)).toBeLessThanOrEqual(0.05)
      expect(Math.abs(frame.scaleY - 1)).toBeLessThanOrEqual(0.05)
    }
  })

  it('animates only transform, never anything that affects layout', () => {
    const allowed = new Set(['offset', 'easing', 'transform', 'transformOrigin'])

    for (const frame of keyframes) {
      expect(Object.keys(frame).filter((key) => !allowed.has(key))).toEqual([])
    }
  })

  it('gives every segment its own curve, none of them linear', () => {
    const easings = keyframes.slice(0, -1).map((frame) => frame.easing)

    expect(easings.every((easing) => typeof easing === 'string' && easing.startsWith('cubic-bezier('))).toBe(true)
    expect(easings).not.toContain('linear')
    // Different curves for different phases: this is not one ease-in-out.
    expect(new Set(easings).size).toBeGreaterThan(3)
  })

  describe('the curve', () => {
    const bezierOf = (frame: Keyframe) => {
      const match = /^cubic-bezier\(([^,]+), ([^,]+), ([^,]+), ([^)]+)\)$/.exec(String(frame.easing))
      if (match === null) throw new Error(`not a bezier: ${String(frame.easing)}`)
      return match.slice(1).map(Number) as [number, number, number, number]
    }
    /** Speed in em/ms leaving and entering a segment, from its handles. */
    const speeds = (from: Keyframe, to: Keyframe) => {
      const [x1, y1, x2, y2] = bezierOf(from)
      const distance = Math.abs(parse(to).y - parse(from).y)
      const duration = ((to.offset as number) - (from.offset as number)) * wordJumpDurationMs()
      return {
        start: (y1 / x1) * (distance / duration),
        end: ((1 - y2) / (1 - x2)) * (distance / duration),
      }
    }

    const [, sunk, launched, peaked, landed] = keyframes as [Keyframe, Keyframe, Keyframe, Keyframe, Keyframe]

    it('carries its speed across the launch into the apex without a kink', () => {
      const launch = speeds(sunk, launched)
      const top = speeds(launched, peaked)

      expect(top.start).toBeCloseTo(launch.end, 3)
    })

    it('slows continuously to a stop at the apex, and falls from rest', () => {
      const launch = speeds(sunk, launched)
      const top = speeds(launched, peaked)
      const fall = speeds(peaked, landed)

      expect(launch.start).toBeGreaterThan(launch.end)
      expect(top.start).toBeGreaterThan(top.end)
      expect(top.end).toBe(0)
      expect(fall.start).toBe(0)
    })

    it('falls under stronger gravity than slows the rise', () => {
      const { anticipation, launch, apex, descent, heightEm } = WORD_JUMP_MOTION
      const riseMs = launch.durationMs + apex.durationMs
      const riseDeceleration = (2 * (heightEm + anticipation.sinkEm)) / riseMs ** 2
      const fallAcceleration = (2 * heightEm) / descent.durationMs ** 2

      expect(fallAcceleration / riseDeceleration).toBeGreaterThan(1.2)
    })
  })

  describe('riseSegments', () => {
    it('reaches the same height the continuous curve would at the split', () => {
      // Quadratic rise, split at 100 of 160 ms: 1 − (60/160)² of the way up.
      expect(riseSegments(100, 60, 2).reach).toBeCloseTo(1 - (60 / 160) ** 2, 10)
      expect(riseSegments(110, 80, 3).reach).toBeCloseTo(1 - (80 / 190) ** 3, 10)
    })

    it('always ends the apex on the plain ease-out of its power', () => {
      expect(riseSegments(100, 60, 2).apex).toEqual({ x1: 1 / 3, y1: 2 / 3, x2: 2 / 3, y2: 1 })
      expect(riseSegments(70, 40, 3).apex).toEqual({ x1: 1 / 3, y1: 1, x2: 2 / 3, y2: 1 })
    })
  })

  it('is the same every time', () => {
    expect(buildWordJumpKeyframes()).toEqual(buildWordJumpKeyframes())
  })
})

describe('playing it', () => {
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  const mediaReporting = (reduce: boolean) =>
    vi.fn((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia

  it('plays the keyframes for the full duration, holding nothing afterwards', () => {
    window.matchMedia = mediaReporting(false)
    const element = document.createElement('span')
    const animate = vi.fn(() => ({}) as Animation)
    element.animate = animate

    playWordJump(element)

    expect(animate).toHaveBeenCalledWith(keyframes, {
      duration: wordJumpDurationMs(),
      easing: 'linear',
      fill: 'none',
    })
  })

  it('does not move at all when the system asks for reduced motion', () => {
    window.matchMedia = mediaReporting(true)
    const element = document.createElement('span')
    const animate = vi.fn(() => ({}) as Animation)
    element.animate = animate

    expect(playWordJump(element)).toBeNull()
    expect(animate).not.toHaveBeenCalled()
  })

  it('does nothing where the browser cannot animate', () => {
    const element = document.createElement('span')
    Object.defineProperty(element, 'animate', { value: undefined })

    expect(playWordJump(element)).toBeNull()
  })
})

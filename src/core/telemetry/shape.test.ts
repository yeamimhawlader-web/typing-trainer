import { describe, expect, it } from 'vitest'

import { milliseconds, type Keystroke } from '@core/types'

import { deriveSessionTelemetry } from './derive.ts'
import { shapeOfTest, SHAPE_RULES } from './shape.ts'

/**
 * Keystrokes for `text`, the one at each index landing `atMs(index)` into the
 * session, with the indices in `wrong` mistyped. What the engine hands over
 * when a test ends, in miniature.
 */
const typed = (
  text: string,
  atMs: (index: number) => number,
  wrong: readonly number[] = [],
): Keystroke[] =>
  Array.from(text, (character, index) => ({
    kind: 'character' as const,
    key: wrong.includes(index) ? 'X' : character,
    expected: character,
    correct: !wrong.includes(index),
    at: milliseconds(atMs(index)),
    index,
  }))

const every = (gapMs: number) => (index: number) => (index + 1) * gapMs

const shapeOf = (text: string, atMs: (index: number) => number, wrong: readonly number[] = []) =>
  shapeOfTest(deriveSessionTelemetry(typed(text, atMs, wrong), text))

/** `count` five-letter words, so characters and words line up simply. */
const words = (count: number) => Array.from({ length: count }, () => 'alpha').join(' ')

describe('the shape of a test', () => {
  it('reads a second for every whole second typed, and no part-second at the end', () => {
    // 60 characters, one every 100ms: the first at 100ms, the last at 6s.
    const shape = shapeOf(words(10).slice(0, 60), every(100))

    expect(shape.points.map((point) => point.second)).toEqual([1, 2, 3, 4, 5])
  })

  it('says the speed of the moment, not the average so far', () => {
    // Ten characters a second for four seconds, then five a second.
    const text = words(20).slice(0, 80)
    const shape = shapeOf(text, (index) => (index < 40 ? (index + 1) * 100 : 4000 + (index - 39) * 200))
    const at = (second: number) => shape.points.find((point) => point.second === second)?.wpm ?? 0

    // Ten characters a second is 120 words a minute; five a second is 60.
    expect(at(4)).toBeGreaterThan(110)
    // By the last second the window holds only the slow half.
    expect(at(11)).toBeLessThan(70)
    expect(shape.peakWpm).toBeGreaterThanOrEqual(at(4))
  })

  it('measures the first seconds over the test so far, so they are not read as a slow start', () => {
    const shape = shapeOf(words(20).slice(0, 60), every(100))

    // Every second was typed at the same speed; the first is not a fifth of it.
    const speeds = shape.points.map((point) => point.wpm)
    expect(Math.min(...speeds)).toBeGreaterThan(Math.max(...speeds) * 0.9)
  })

  it('puts every mistake in the second it happened, corrected or not', () => {
    const shape = shapeOf(words(10).slice(0, 50), every(100), [12, 13, 44])

    expect(shape.errorSeconds).toEqual([1, 1, 4])
    expect(shape.points.find((point) => point.second === 2)?.errors).toBe(2)
    expect(shape.points.find((point) => point.second === 3)?.errors).toBe(0)
  })

  it('has no shape to draw for a test too short to have one', () => {
    expect(shapeOf('alpha bravo', every(100)).points).toEqual([])
    expect(shapeOfTest(deriveSessionTelemetry([], '')).peakWpm).toBe(0)
  })

  it('counts in the same characters-to-a-word as the rest of the application', () => {
    expect(SHAPE_RULES.charactersPerWord).toBe(5)
  })
})

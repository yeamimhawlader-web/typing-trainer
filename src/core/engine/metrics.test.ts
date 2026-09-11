import { describe, expect, it } from 'vitest'

import { milliseconds } from '@core/types'

import { calculateAccuracy, calculateWpm } from './metrics.ts'

describe('calculateWpm', () => {
  it('applies the five-characters-per-word convention', () => {
    // 100 characters = 20 words, in exactly one minute.
    expect(calculateWpm(100, milliseconds(60_000))).toBe(20)
  })

  it('scales with duration', () => {
    expect(calculateWpm(100, milliseconds(30_000))).toBe(40)
    expect(calculateWpm(100, milliseconds(120_000))).toBe(10)
  })

  it('returns zero for a zero duration rather than Infinity', () => {
    expect(calculateWpm(50, milliseconds(0))).toBe(0)
  })

  it('returns zero when nothing has been typed', () => {
    expect(calculateWpm(0, milliseconds(60_000))).toBe(0)
  })

  it('handles a realistic fast session', () => {
    // 650 characters in a minute is 130 WPM.
    expect(calculateWpm(650, milliseconds(60_000))).toBe(130)
  })

  it('does not round away sub-word progress', () => {
    expect(calculateWpm(3, milliseconds(60_000))).toBeCloseTo(0.6, 10)
  })
})

describe('calculateAccuracy', () => {
  it('reports a ratio of correct to total attempts', () => {
    expect(calculateAccuracy(8, 10)).toBe(0.8)
  })

  it('reports 1 for a flawless run', () => {
    expect(calculateAccuracy(10, 10)).toBe(1)
  })

  it('reports 0 when nothing was correct', () => {
    expect(calculateAccuracy(0, 10)).toBe(0)
  })

  it('reports 1 before any attempt has been made', () => {
    expect(calculateAccuracy(0, 0)).toBe(1)
  })

  it('clamps a nonsensical ratio into range', () => {
    expect(calculateAccuracy(15, 10)).toBe(1)
    expect(calculateAccuracy(-5, 10)).toBe(0)
  })
})

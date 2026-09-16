/**
 * The three states live accuracy is read as, and exactly where they change.
 *
 * The boundaries are the point of these: they are read from the ratio the
 * engine reports, not from the percentage on screen, so a typist at 95.99% is
 * in caution while the figure beside them still says 96.
 */

import { describe, expect, it } from 'vitest'

import type { EngineSnapshot } from '@core/engine'

import { ACCURACY_STATES, selectAccuracyState } from './live-values.ts'

/** A snapshot at an exact accuracy, with something typed. */
const at = (accuracy: number) => ({ accuracy, typedCount: 100 }) as EngineSnapshot

describe('the live accuracy state', () => {
  it('is normal at and above 96%', () => {
    expect(selectAccuracyState(at(1))).toBe('normal')
    expect(selectAccuracyState(at(0.97))).toBe('normal')
    expect(selectAccuracyState(at(0.96))).toBe('normal')
    // The ratio exactly as it is computed, not as it is printed.
    expect(selectAccuracyState(at(96 / 100))).toBe('normal')
    expect(selectAccuracyState(at(24 / 25))).toBe('normal')
  })

  it('is caution below 96% and down to 94%', () => {
    expect(selectAccuracyState(at(0.9599))).toBe('caution')
    // 95.99%: the figure on screen reads 96, and this does not.
    expect(selectAccuracyState(at(0.9599999))).toBe('caution')
    expect(selectAccuracyState(at(0.95))).toBe('caution')
    expect(selectAccuracyState(at(0.94))).toBe('caution')
    expect(selectAccuracyState(at(47 / 50))).toBe('caution')
  })

  it('is critical below 94%', () => {
    expect(selectAccuracyState(at(0.9399))).toBe('critical')
    expect(selectAccuracyState(at(0.9))).toBe('critical')
    expect(selectAccuracyState(at(0))).toBe('critical')
  })

  it('says nothing about a test nobody has typed into yet', () => {
    expect(selectAccuracyState({ accuracy: 0, typedCount: 0 } as EngineSnapshot)).toBe('normal')
  })

  it('changes state once, where the state changes, and not with every figure', () => {
    // The walk in the brief: 100 → 95.8 → 94.1 → 93.9 → 94.2.
    const walk = [1, 0.958, 0.941, 0.939, 0.942].map((accuracy) => selectAccuracyState(at(accuracy)))

    expect(walk).toEqual(['normal', 'caution', 'caution', 'critical', 'caution'])
    // Four figures inside caution, one state: a subscriber sees one change.
    const inside = [0.9599, 0.955, 0.949, 0.9401].map((accuracy) => selectAccuracyState(at(accuracy)))
    expect(new Set(inside).size).toBe(1)
  })

  it('keeps its boundaries where the brief puts them', () => {
    expect(ACCURACY_STATES.caution).toBe(0.96)
    expect(ACCURACY_STATES.critical).toBe(0.94)
  })
})

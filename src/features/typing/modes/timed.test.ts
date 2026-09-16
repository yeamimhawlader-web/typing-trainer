/**
 * The timed mode: when a test on the clock is over, and what it is saved as.
 *
 * The rule itself is arithmetic on the engine's own snapshot, so it is checked
 * here directly; that the engine then ends the session on it — and refuses the
 * key that arrives late — is checked against the real engine in
 * `core/engine/engine.test.ts`, and on the screen in the GG.Typing integration.
 */

import { describe, expect, it } from 'vitest'

import type { EngineSnapshot } from '@core/engine'
import { DEFAULT_SESSION_CONTEXT } from '@core/sessions'

import { clampTime, createTimedMode, CUSTOM_TIME, isValidTime, TIME_OPTIONS, wordsForTime } from './timed.ts'

const after = (elapsedMs: number) => ({ elapsedMs }) as EngineSnapshot

describe('a timed test', () => {
  it('is over the moment its time is up, and not a moment before', () => {
    const { isComplete } = createTimedMode(30)

    expect(isComplete(after(29_999))).toBe(false)
    expect(isComplete(after(30_000))).toBe(true)
    expect(isComplete(after(45_000))).toBe(true)
  })

  it('runs the clock whether or not anyone is typing: thirty seconds means thirty seconds', () => {
    expect(createTimedMode(30).maxGapMs).toBeNull()
  })

  it('is saved as a timed test, with the time it was set to run for', () => {
    const context = createTimedMode(15).finalContext(DEFAULT_SESSION_CONTEXT)

    expect(context.mode).toBe('time')
    expect(context.durationSeconds).toBe(15)
    // Nothing else about the session is the mode's business.
    expect(context.language).toBe(DEFAULT_SESSION_CONTEXT.language)
    expect(context.difficulty).toBe(DEFAULT_SESSION_CONTEXT.difficulty)
  })

  it('lays out more words than any typist could reach in the time', () => {
    for (const seconds of [...TIME_OPTIONS, CUSTOM_TIME.min, 45]) {
      // 360 words a minute is past every record; the material outlasts it.
      expect(wordsForTime(seconds), `${seconds}s`).toBeGreaterThanOrEqual((seconds / 60) * 360)
    }
    // And a long custom test does not render a page nobody reaches.
    expect(wordsForTime(CUSTOM_TIME.max)).toBeLessThanOrEqual(800)
  })

  it('takes any whole number of seconds in range, and refuses the rest', () => {
    expect(isValidTime(CUSTOM_TIME.min)).toBe(true)
    expect(isValidTime(CUSTOM_TIME.max)).toBe(true)
    expect(isValidTime(47)).toBe(true)
    expect(isValidTime(CUSTOM_TIME.min - 1)).toBe(false)
    expect(isValidTime(CUSTOM_TIME.max + 1)).toBe(false)
    expect(isValidTime(30.5)).toBe(false)
    expect(isValidTime('30')).toBe(false)
    expect(isValidTime(Number.NaN)).toBe(false)
  })

  it('brings a time from outside this build into range rather than refusing to run', () => {
    expect(clampTime(0)).toBe(CUSTOM_TIME.min)
    expect(clampTime(10_000)).toBe(CUSTOM_TIME.max)
    expect(clampTime(30.4)).toBe(30)
    expect(createTimedMode(10_000).isComplete(after(CUSTOM_TIME.max * 1000))).toBe(true)
  })

  it('is a different shape of test for every time, and says so', () => {
    expect(createTimedMode(15).key).toBe('time:15')
    expect(createTimedMode(60).key).toBe('time:60')
    expect(createTimedMode(15).key).not.toBe(createTimedMode(30).key)
  })
})

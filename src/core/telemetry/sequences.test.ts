/**
 * Slow-sequence tests.
 *
 * Fixtures are driven through the real engine with explicit timestamps, so
 * every expected median below can be worked out by hand from the intervals in
 * the comment beside it.
 */

import { describe, expect, it } from 'vitest'

import { createTypingEngine } from '@core/engine'
import { timestamp, type SessionTarget } from '@core/types'

import { deriveSessionTelemetry } from './derive.ts'
import { analyseSlowSequences, MINIMUM_OBSERVATIONS } from './sequences.ts'
import type { SessionTelemetry } from './types.ts'

const target = (text: string): SessionTarget => ({ text, sourceId: 'test' })

/**
 * Types a script at explicit per-keystroke intervals.
 *
 * `script` pairs each key with the gap before it, so the timing of every
 * transition in a test is stated rather than inferred.
 */
const type = (
  text: string,
  script: ReadonlyArray<readonly [key: string, gapMs: number]>,
): SessionTelemetry => {
  const engine = createTypingEngine()
  engine.start(target(text), timestamp(0))

  let at = 0
  for (const [key, gap] of script) {
    at += gap
    engine.input(key, timestamp(at))
  }

  return deriveSessionTelemetry(engine.getSnapshot().keystrokes, text)
}

/** Types `text` correctly with one gap repeated, then per-key overrides. */
const evenly = (
  text: string,
  gapMs: number,
  overrides: Readonly<Record<number, number>> = {},
): SessionTelemetry =>
  type(
    text,
    Array.from(text).map((key, index) => [key, overrides[index] ?? gapMs] as const),
  )

describe('analyseSlowSequences', () => {
  it('reports nothing for a session with no keystrokes', () => {
    const report = analyseSlowSequences(deriveSessionTelemetry([], 'hello world'))

    expect(report.ranked).toEqual([])
    expect(report.overallMedianMs).toBeNull()
    expect(report.sampleSize).toBe(0)
    expect(report.distinctSequences).toBe(0)
  })

  it('measures a repeated digraph and takes its median', () => {
    // 'ab' five times, gaps into the second letter: 100, 200, 300, 400, 500.
    // Median of those five is 300.
    const text = 'ab ab ab ab ab'
    const gaps: Record<number, number> = { 1: 100, 4: 200, 7: 300, 10: 400, 13: 500 }
    const report = analyseSlowSequences(evenly(text, 90, gaps), {
      minimumObservations: 5,
    })

    const ab = report.ranked.find((entry) => entry.sequence === 'ab')
    expect(ab).toMatchObject({ sequence: 'ab', observations: 5, medianMs: 300 })
  })

  it('takes the mean of the middle two when observations are even', () => {
    // 'ab' four times at 100, 200, 300, 400 -> (200 + 300) / 2 = 250.
    const text = 'ab ab ab ab'
    const gaps: Record<number, number> = { 1: 100, 4: 200, 7: 300, 10: 400 }
    const report = analyseSlowSequences(evenly(text, 90, gaps), {
      minimumObservations: 4,
    })

    expect(report.ranked.find((e) => e.sequence === 'ab')?.medianMs).toBe(250)
  })

  it('will not rank a sequence seen too few times', () => {
    // 'zq' appears twice and is very slow; 'ab' appears five times and is not.
    const text = 'zq ab ab ab ab ab'
    const gaps: Record<number, number> = { 1: 900 }
    const report = analyseSlowSequences(evenly(text, 100, gaps), {
      minimumObservations: 5,
    })

    expect(report.ranked.map((entry) => entry.sequence)).not.toContain('zq')
    expect(report.ranked.map((entry) => entry.sequence)).toContain('ab')
    // It was still seen, and the count says so.
    expect(report.distinctSequences).toBeGreaterThan(report.ranked.length)
  })

  it('ranks several sequences slowest first', () => {
    // 'ab' at 300 each, 'cd' at 500 each, 'ef' at 100 each.
    const text = 'ab cd ef ab cd ef ab cd ef ab cd ef ab cd ef'
    const script: Array<readonly [string, number]> = []
    Array.from(text).forEach((key, index) => {
      const position = index % 9
      if (position === 1) script.push([key, 300])
      else if (position === 4) script.push([key, 500])
      else if (position === 7) script.push([key, 100])
      else script.push([key, 120])
    })

    const report = analyseSlowSequences(type(text, script), { minimumObservations: 5 })

    expect(report.ranked.map((entry) => entry.sequence)).toEqual(['cd', 'ab', 'ef'])
    expect(report.ranked.map((entry) => entry.medianMs)).toEqual([500, 300, 100])
  })

  it('compares each sequence against the session median', () => {
    const text = 'ab cd ab cd ab cd ab cd ab cd'
    const script: Array<readonly [string, number]> = []
    Array.from(text).forEach((key, index) => {
      const position = index % 6
      if (position === 1) script.push([key, 100])
      else if (position === 4) script.push([key, 300])
      else script.push([key, 100])
    })

    const report = analyseSlowSequences(type(text, script), { minimumObservations: 5 })

    // Ten clean transitions: five at 100 and five at 300, so the median is 200.
    expect(report.overallMedianMs).toBe(200)
    expect(report.ranked.find((e) => e.sequence === 'cd')?.deltaMs).toBe(100)
    expect(report.ranked.find((e) => e.sequence === 'ab')?.deltaMs).toBe(-100)
  })

  it('ranks identical timings deterministically', () => {
    // Every sequence at the same speed: order must still be stable and total.
    const text = 'ab cd ef ab cd ef ab cd ef ab cd ef ab cd ef'
    const report = analyseSlowSequences(evenly(text, 120), { minimumObservations: 5 })
    const again = analyseSlowSequences(evenly(text, 120), { minimumObservations: 5 })

    expect(report.ranked.map((e) => e.medianMs)).toEqual([120, 120, 120])
    // Equal medians and equal counts fall back to alphabetical.
    expect(report.ranked.map((e) => e.sequence)).toEqual(['ab', 'cd', 'ef'])
    expect(again.ranked).toEqual(report.ranked)
  })

  it('handles very fast typing without collapsing', () => {
    const text = 'ab ab ab ab ab'
    const report = analyseSlowSequences(evenly(text, 1), { minimumObservations: 5 })

    expect(report.ranked[0]).toMatchObject({ sequence: 'ab', medianMs: 1 })
    expect(report.overallMedianMs).toBe(1)
  })

  it('handles simultaneous keystrokes as zero rather than as missing', () => {
    const text = 'ab ab ab ab ab'
    const report = analyseSlowSequences(evenly(text, 0), { minimumObservations: 5 })

    expect(report.ranked[0]?.medianMs).toBe(0)
    expect(report.sampleSize).toBeGreaterThan(0)
  })
})

describe('what is excluded, and why', () => {
  it('ignores a transition across a space', () => {
    // The gap into 'c' is enormous, but it follows a space.
    const text = 'ab cd ab cd ab cd ab cd ab cd'
    const script: Array<readonly [string, number]> = []
    Array.from(text).forEach((key, index) => {
      script.push([key, index % 6 === 3 ? 2_000 : 100])
    })

    const report = analyseSlowSequences(type(text, script), { minimumObservations: 5 })

    // Word-start hesitation is a different phenomenon; it lives on the word.
    expect(report.ranked.map((e) => e.sequence)).not.toContain(' c')
    expect(report.ranked.every((entry) => !entry.sequence.includes(' '))).toBe(true)
  })

  it('ignores a pair containing a mistyped character', () => {
    // 'b' is typed as 'x' every time, so 'ab' never happens cleanly.
    const text = 'ab ab ab ab ab'
    const script = Array.from(text).map(
      (key, index) => [index % 3 === 1 ? 'x' : key, 100] as const,
    )

    const report = analyseSlowSequences(type(text, script), { minimumObservations: 1 })

    expect(report.ranked.map((e) => e.sequence)).not.toContain('ab')
    expect(report.ranked.map((e) => e.sequence)).not.toContain('ax')
  })

  it('ignores a retyped character after a correction', () => {
    // a, then wrong x, backspace, then the real b. The interval into 'b'
    // contains the whole correction, and 'ab' must not be credited with it.
    const report = analyseSlowSequences(
      type('abc', [
        ['a', 100],
        ['x', 100],
        ['Backspace', 400],
        ['b', 400],
        ['c', 100],
      ]),
      { minimumObservations: 1 },
    )

    expect(report.ranked.map((e) => e.sequence)).not.toContain('ab')
    // The clean pair after the correction is still measured.
    expect(report.ranked.map((e) => e.sequence)).toContain('bc')
  })

  it('does not let a backspace inflate a neighbouring interval', () => {
    const withCorrection = analyseSlowSequences(
      type('abcd', [
        ['a', 100],
        ['b', 100],
        ['x', 100],
        ['Backspace', 900],
        ['c', 900],
        ['d', 100],
      ]),
      { minimumObservations: 1 },
    )

    // 'ab' measured cleanly before any of it; 'cd' cleanly after.
    expect(withCorrection.ranked.find((e) => e.sequence === 'ab')?.medianMs).toBe(100)
    expect(withCorrection.ranked.find((e) => e.sequence === 'cd')?.medianMs).toBe(100)
    // Nothing carries the 1,800ms the correction took.
    expect(withCorrection.ranked.every((entry) => entry.medianMs <= 100)).toBe(true)
  })

  it('measures the same interval whichever named latency is used', () => {
    // The two definitions agree exactly on a clean pair, which is why either
    // could be used here — and why using the wrong one elsewhere would not show
    // up until a correction happened.
    const telemetry = evenly('abcd', 150)
    const clean = telemetry.keystrokes.filter(
      (keystroke, index) => index > 0 && keystroke.correct,
    )

    for (const keystroke of clean) {
      expect(keystroke.sincePreviousCharacterMs).toBe(keystroke.interKeystrokeMs)
    }
  })
})

describe('thresholds and reporting', () => {
  it('applies the documented default threshold', () => {
    const text = 'ab ab ab ab'
    const report = analyseSlowSequences(evenly(text, 100))

    expect(report.minimumObservations).toBe(MINIMUM_OBSERVATIONS)
    // Four observations against a default of five.
    expect(report.ranked).toEqual([])
    expect(report.distinctSequences).toBe(1)
  })

  it('reports how much it had to work with', () => {
    const report = analyseSlowSequences(evenly('ab ab ab ab ab', 100), {
      minimumObservations: 5,
    })

    expect(report.sampleSize).toBe(5)
    expect(report.distinctSequences).toBe(1)
    expect(report.overallMedianMs).toBe(100)
  })

  it('finds nothing rankable in a short test', () => {
    // The insufficient-data case a 15-word test will often be in.
    const report = analyseSlowSequences(evenly('the quick brown fox', 100))

    expect(report.ranked).toEqual([])
    expect(report.sampleSize).toBeGreaterThan(0)
  })

  it('leaves the telemetry it reads untouched', () => {
    const telemetry = evenly('ab ab ab ab ab', 100)
    const before = JSON.stringify(telemetry)

    analyseSlowSequences(telemetry)

    expect(JSON.stringify(telemetry)).toBe(before)
  })
})

describe('only genuinely slower sequences are reported', () => {
  it('drops a sequence that is faster than the session median', () => {
    // 'ab' at 50ms, 'cd' at 150ms. The median transition is 100ms, so 'ab' is
    // fast — it must not be listed however few rivals clear the threshold.
    const text = 'ab cd ab cd ab cd ab cd ab cd'
    const script: Array<readonly [string, number]> = []
    Array.from(text).forEach((key, index) => {
      const position = index % 6
      if (position === 1) script.push([key, 50])
      else if (position === 4) script.push([key, 150])
      else script.push([key, 100])
    })

    const report = analyseSlowSequences(type(text, script), { minimumObservations: 5 })

    expect(report.slowerThanTypical.map((entry) => entry.sequence)).toEqual(['cd'])
    expect(report.slowerThanTypical.every((entry) => entry.deltaMs > 0)).toBe(true)
  })

  it('reports nothing when the only qualifying sequence is a fast one', () => {
    // Observed in a real run: a single sequence cleared the threshold at 71ms
    // against an 85ms median, and was presented as "slowest observed".
    // Topping a list of one is not evidence of being slow.
    const text = 'ab zz zz zz ab ab ab ab'
    const script: Array<readonly [string, number]> = []
    Array.from(text).forEach((key) => {
      // 'ab' is consistently quick; the noisy 'zz' pairs are slow but rare.
      script.push([key, key === 'b' ? 40 : 200])
    })

    const report = analyseSlowSequences(type(text, script), { minimumObservations: 5 })

    expect(report.slowerThanTypical).toEqual([])
    // The data was still collected; it simply says nothing worth showing.
    expect(report.sampleSize).toBeGreaterThan(0)
  })

  it('still ranks every sequence that is slower than typical', () => {
    const text = 'ab cd ab cd ab cd ab cd ab cd'
    const script: Array<readonly [string, number]> = []
    Array.from(text).forEach((key, index) => {
      const position = index % 6
      if (position === 1) script.push([key, 120])
      else if (position === 4) script.push([key, 200])
      else script.push([key, 100])
    })

    const report = analyseSlowSequences(type(text, script), { minimumObservations: 5 })

    // Median of ten transitions (five at 120, five at 200) is 160, so only
    // 'cd' clears it.
    expect(report.overallMedianMs).toBe(160)
    expect(report.slowerThanTypical.map((e) => e.sequence)).toEqual(['cd'])
  })
})

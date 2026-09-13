/**
 * The evidence tiers against simulated typists.
 *
 * The unit tests pin the arithmetic with hand-checkable fixtures, where every
 * transition of a kind takes exactly the same time. Real typing is nothing like
 * that, and the failure these tiers exist to prevent — ordinary jitter turning
 * into a list of "findings" as history grows — only appears with realistic
 * noise. So this runs the audit's typist model through the real engine and
 * telemetry derivation, seeded so every run sees identical histories:
 *
 * - transitions around 86 ms with log-normal jitter (σ 0.3);
 * - a 150–400 ms pause on 3% of keystrokes;
 * - 60-word tests of the ordinary practice text;
 * - optionally, a fixed slowdown planted on `in`.
 *
 * Seeded results, twenty histories each, at the time of writing:
 *
 * | Case                   | Fake strong | Fake any | Planted strong | Planted any |
 * | ---------------------- | ----------- | -------- | -------------- | ----------- |
 * | No slowdown, 10 tests  | 1           | 5        | —              | —           |
 * | No slowdown, 20 tests  | 0           | 4        | —              | —           |
 * | No slowdown, 30 tests  | 0           | 7        | —              | —           |
 * | +40 ms, 6 tests        | 0           | 1        | 0              | 16          |
 * | +40 ms, 15 tests       | 0           | 2        | 20             | 20          |
 * | +15 ms, 20 tests       | 0           | 4        | 3              | 14          |
 *
 * Without the multiple-comparison adjustment the fake-any column reads 18, 19
 * and 19, and three of these tests fail. The bounds leave some room around the
 * seeded figures so an unrelated change to the word list does not break them
 * by luck. The effect-size floors are pinned by the unit tests, not here.
 */

import { describe, expect, it } from 'vitest'

import { createTypingEngine } from '@core/engine'
import { createCommonWordsProvider } from '@core/text'
import { timestamp } from '@core/types'

import { deriveSessionTelemetry } from './derive.ts'
import { analysePersistentSequences, type SessionTelemetryEntry } from './persistent.ts'

/** mulberry32: small, fast and well mixed, which is all a fixture needs. */
const seeded = (seed: number) => {
  let state = seed | 0
  return (): number => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

const PLANTED = 'in'

/** One simulated history of `sessions` tests, with `penaltyMs` added to `in`. */
const history = (seed: number, sessions: number, penaltyMs: number): SessionTelemetryEntry[] => {
  const textRandom = seeded(seed * 7 + 11)
  const timeRandom = seeded(seed * 13 + 97)
  const gaussian = (): number => {
    let u = 0
    while (u === 0) u = timeRandom()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * timeRandom())
  }
  const provider = createCommonWordsProvider({ random: textRandom })

  return Array.from({ length: sessions }, (_, index) => {
    const { text } = provider.provide({ wordCount: 60 })
    const engine = createTypingEngine()
    engine.start({ text, sourceId: 'simulation' }, timestamp(0))

    const characters = Array.from(text)
    let at = 0
    characters.forEach((key, position) => {
      if (position > 0) {
        const pair = `${characters[position - 1] as string}${key}`
        at += 86 * Math.exp(0.3 * gaussian())
        if (pair === PLANTED) at += penaltyMs
        if (timeRandom() < 0.03) at += 150 + timeRandom() * 250
      }
      engine.input(key, timestamp(at))
    })

    return {
      sessionId: `sim-${seed}-${index}`,
      telemetry: deriveSessionTelemetry(engine.getSnapshot().keystrokes, text),
    }
  })
}

const TRIALS = 20

interface Tally {
  /** Histories in which some sequence other than the planted one was reported. */
  readonly withFakeStrong: number
  readonly withFakeAny: number
  /** Histories in which the planted sequence reached each tier. */
  readonly plantedStrong: number
  readonly plantedAny: number
}

const tally = (sessions: number, penaltyMs: number): Tally => {
  let withFakeStrong = 0
  let withFakeAny = 0
  let plantedStrong = 0
  let plantedAny = 0

  for (let trial = 0; trial < TRIALS; trial += 1) {
    const { candidates } = analysePersistentSequences(history(trial * 1000 + sessions, sessions, penaltyMs))
    const fakes = candidates.filter((candidate) => candidate.sequence !== PLANTED)
    const planted = candidates.find((candidate) => candidate.sequence === PLANTED)

    if (fakes.some((candidate) => candidate.tier === 'strong')) withFakeStrong += 1
    if (fakes.length > 0) withFakeAny += 1
    if (planted?.tier === 'strong') plantedStrong += 1
    if (planted !== undefined) plantedAny += 1
  }

  return { withFakeStrong, withFakeAny, plantedStrong, plantedAny }
}

describe('evidence tiers on simulated typists', () => {
  it('almost never calls ordinary jitter strong evidence, however long the history', () => {
    // Before the tiers, every one of these histories reported something.
    for (const sessions of [10, 20, 30]) {
      expect(tally(sessions, 0).withFakeStrong, `${sessions} sessions`).toBeLessThanOrEqual(2)
    }
  })

  it('keeps possible findings from jitter to at most half of histories', () => {
    // Before the tiers it was every history from ten sessions on.
    for (const sessions of [10, 20, 30]) {
      expect(tally(sessions, 0).withFakeAny, `${sessions} sessions`).toBeLessThanOrEqual(10)
    }
  })

  it('finds a large persistent slowdown as strong evidence once history is long enough', () => {
    expect(tally(15, 40).plantedStrong).toBeGreaterThanOrEqual(18)
  })

  it('shows the same slowdown as possible before there is enough history to be sure', () => {
    const early = tally(6, 40)

    expect(early.plantedStrong).toBe(0)
    expect(early.plantedAny).toBeGreaterThanOrEqual(12)
  })

  it('mostly keeps a small slowdown out of the strong tier', () => {
    // +15 ms on an 86 ms typist is below the fifth that strong requires, so it
    // should reach strong only when noise inflates its estimate.
    const small = tally(20, 15)

    expect(small.plantedStrong).toBeLessThanOrEqual(6)
    expect(small.plantedAny).toBeGreaterThanOrEqual(10)
  })
})

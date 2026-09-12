/**
 * The idle cap: time spent away from the keyboard is not charged to speed.
 *
 * Before it, eight seconds away mid-test saved a 130 WPM test as 80 WPM. The
 * rule under test: any single gap between inputs counts as at most
 * `maxGapMs`; anything longer is treated as paused.
 *
 * Every figure below is on an explicit clock, so each expected duration is a
 * sum that can be checked by hand.
 */

import { describe, expect, it } from 'vitest'

import { timestamp, type SessionTarget } from '@core/types'

import { createTypingEngine } from './engine.ts'
import { IDLE_GAP_CAP_MS } from './types.ts'

const target = (text: string): SessionTarget => ({ text, sourceId: 'test' })

/** A session with a 3 s cap, typing one key per call at an explicit time. */
const capped = (text: string, maxGapMs = 3_000) => {
  const engine = createTypingEngine({ maxGapMs })
  engine.start(target(text), timestamp(0))
  const key = (character: string, at: number) => engine.input(character, timestamp(at))
  const tick = (at: number) => engine.tick(timestamp(at))
  return { engine, key, tick, snapshot: () => engine.getSnapshot() }
}

describe('idle cap', () => {
  it('uses three seconds for ordinary practice', () => {
    expect(IDLE_GAP_CAP_MS).toBe(3_000)
  })

  describe('normal typing pauses', () => {
    it('counts ordinary gaps in full', () => {
      const s = capped('abcd')
      s.key('a', 0)
      s.key('b', 120)
      s.key('c', 2_120) // a two-second hesitation — real typing time
      s.key('d', 2_240)

      expect(s.snapshot().elapsedMs).toBe(2_240)
    })

    it('counts a gap of exactly the cap in full', () => {
      const s = capped('abc')
      s.key('a', 0)
      s.key('b', 3_000)
      s.key('c', 3_100)

      expect(s.snapshot().elapsedMs).toBe(3_100)
    })
  })

  describe('a several-second interruption', () => {
    it('counts only the cap, however long the typist was away', () => {
      const s = capped('abc')
      s.key('a', 0)
      s.key('b', 100)
      s.key('c', 60_100) // a minute away

      // 100 ms of typing, then the gap counted as 3 000 ms.
      expect(s.snapshot().elapsedMs).toBe(3_100)
    })

    it('stops the live clock when the cap runs out', () => {
      const s = capped('abc')
      s.key('a', 0)
      s.key('b', 500)

      s.tick(2_000)
      expect(s.snapshot().elapsedMs).toBe(2_000)

      s.tick(10_000)
      // Frozen at the last input plus the cap: 500 + 3 000.
      expect(s.snapshot().elapsedMs).toBe(3_500)
      expect(s.snapshot().idle).toBe(true)
    })

    it('does not report idle during ordinary gaps', () => {
      const s = capped('abc')
      s.key('a', 0)
      s.tick(2_900)

      expect(s.snapshot().idle).toBe(false)
    })
  })

  describe('returning after an interruption', () => {
    it('resumes counting from the next keystroke', () => {
      const s = capped('abcd')
      s.key('a', 0)
      s.key('b', 100)
      s.tick(20_000)
      s.key('c', 20_000) // back
      s.key('d', 20_150)

      // 100 + 3 000 capped + 150.
      expect(s.snapshot().elapsedMs).toBe(3_250)
      expect(s.snapshot().idle).toBe(false)
    })

    it('charges the gap correctly even if no tick ran while away', () => {
      // A background tab can hold timers back for a minute. The rule is applied
      // from timestamps when the key arrives, so it cannot depend on a tick.
      const s = capped('abc')
      s.key('a', 0)
      s.key('b', 45_000)
      s.key('c', 45_100)

      expect(s.snapshot().elapsedMs).toBe(3_100)
    })

    it('records the telemetry time of the returning key on the capped clock', () => {
      const s = capped('abc')
      s.key('a', 0)
      s.key('b', 30_000)

      const [first, second] = s.snapshot().keystrokes
      expect(second!.at - first!.at).toBe(3_000)
    })
  })

  describe('completing after an interruption', () => {
    it('saves a result whose duration excludes the time away', () => {
      const s = capped('ab cd')
      s.key('a', 0)
      s.key('b', 100)
      s.key(' ', 200)
      s.key('c', 8_200) // eight seconds away, as in the audit
      s.key('d', 8_300)

      const result = s.engine.toResult()
      expect(result?.status).toBe('completed')
      // 200 + 3 000 + 100.
      expect(result?.durationMs).toBe(3_300)
    })

    it('keeps speed honest compared with the uncapped clock', () => {
      const text = 'abcde abcde'
      const chars = Array.from(text)

      const withCap = capped(text)
      const withoutCap = createTypingEngine()
      withoutCap.start(target(text), timestamp(0))

      chars.forEach((c, i) => {
        // 100 ms per key, plus an eight-second break in the middle.
        const at = i * 100 + (i >= 6 ? 8_000 : 0)
        withCap.key(c, at)
        withoutCap.input(c, timestamp(at))
      })

      const capWpm = withCap.snapshot().netWpm
      const rawWpm = withoutCap.getSnapshot().netWpm
      expect(capWpm).toBeGreaterThan(rawWpm * 2)
    })
  })

  describe('an abandoned test', () => {
    it('stays unfinished and records nothing while no one types', () => {
      const s = capped('abc')
      s.key('a', 0)
      s.tick(600_000)

      expect(s.snapshot().status).toBe('running')
      expect(s.engine.toResult()).toBeNull()
    })

    it('caps the duration of a test given up on after walking away', () => {
      const s = capped('abc')
      s.key('a', 0)
      s.key('b', 100)
      s.engine.finish(timestamp(900_000), 'abandoned')

      expect(s.engine.toResult()?.durationMs).toBe(3_100)
    })
  })

  describe('without a cap', () => {
    it('charges every gap in full, as a timed mode needs', () => {
      const engine = createTypingEngine()
      engine.start(target('abc'), timestamp(0))
      engine.input('a', timestamp(0))
      engine.input('b', timestamp(60_000))

      expect(engine.getSnapshot().elapsedMs).toBe(60_000)
      expect(engine.getSnapshot().idle).toBe(false)
    })
  })

  describe('explicit pause and resume', () => {
    it('starts a fresh idle window on resume', () => {
      const s = capped('abc')
      s.key('a', 0)
      s.engine.pause(timestamp(1_000))
      s.engine.resume(timestamp(50_000))
      s.key('b', 51_000)

      // 1 000 before the pause; after resuming, a one-second gap counted in full.
      expect(s.snapshot().elapsedMs).toBe(2_000)
    })
  })
})

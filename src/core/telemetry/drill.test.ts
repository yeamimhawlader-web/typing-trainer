/**
 * Drill measurement tests.
 *
 * Fixtures go through the real engine at explicit intervals, so the cleanliness
 * rules apply for real and every expected median can be worked out by hand from
 * the gaps in the fixture.
 */

import { describe, expect, it } from 'vitest'

import { createTypingEngine } from '@core/engine'
import { createMemoryAdapter } from '@core/persistence'
import {
  createTypingSession,
  createSessionServiceOver,
  DEFAULT_SESSION_CONTEXT,
} from '@core/sessions'
import { timestamp, type SessionTarget } from '@core/types'

import { deriveSessionTelemetry } from './derive.ts'
import { compareToBaseline, measureDrill } from './drill.ts'
import { findSequenceBaseline, type SessionTelemetryEntry } from './persistent.ts'
import { createTelemetryServiceOver } from './service.ts'
import type { SessionTelemetry } from './types.ts'

const target = (text: string): SessionTarget => ({ text, sourceId: 'drill' })

/** Types `text` correctly, at `gapMs` between keys except where overridden. */
const run = (
  text: string,
  gapMs: number,
  slow: Readonly<Record<string, number>> = {},
): SessionTelemetry => {
  const engine = createTypingEngine()
  engine.start(target(text), timestamp(0))

  const characters = Array.from(text)
  let at = 0

  characters.forEach((key, index) => {
    const pair = index === 0 ? '' : `${characters[index - 1] as string}${key}`
    at += index === 0 ? 0 : (slow[pair] ?? gapMs)
    engine.input(key, timestamp(at))
  })

  return deriveSessionTelemetry(engine.getSnapshot().keystrokes, text)
}

describe('measureDrill', () => {
  it('counts the chances the drill gave and the ones actually typed cleanly', () => {
    // "in" appears three times in the text and every character is typed right.
    const text = 'in find into'
    const outcome = measureDrill(run(text, 80), text, 'in')

    expect(outcome.targetOccurrences).toBe(3)
    expect(outcome.correctTransitions).toBe(3)
  })

  it('reports the median of the target timings', () => {
    // The three "in" transitions are 120, 140 and 100; the rest are 80.
    const text = 'in find into'
    const telemetry = run(text, 80, { in: 120 })
    const outcome = measureDrill(telemetry, text, 'in')

    expect(outcome.medianMs).toBe(120)
    // And the drill's own overall transition median, for context.
    expect(outcome.sessionMedianMs).toBe(80)
  })

  it('separates opportunities from measured transitions', () => {
    const text = 'in find into'
    const engine = createTypingEngine()
    engine.start(target(text), timestamp(0))

    // Mistype the "n" of the first "in", leaving it wrong.
    const characters = Array.from(text)
    characters.forEach((key, index) => {
      engine.input(index === 1 ? 'x' : key, timestamp((index + 1) * 80))
    })

    const outcome = measureDrill(
      deriveSessionTelemetry(engine.getSnapshot().keystrokes, text),
      text,
      'in',
    )

    // Three chances, one fumbled: the gap between these two numbers is the
    // thing a single median would hide.
    expect(outcome.targetOccurrences).toBe(3)
    expect(outcome.correctTransitions).toBe(2)
  })

  it('reports no timing when the target was never typed cleanly', () => {
    const text = 'cat dog'
    const outcome = measureDrill(run(text, 80), text, 'in')

    expect(outcome.targetOccurrences).toBe(0)
    expect(outcome.correctTransitions).toBe(0)
    expect(outcome.medianMs).toBeNull()
  })

  it('counts overlapping occurrences, because both are really typed', () => {
    const text = 'aaa'
    const outcome = measureDrill(run(text, 80), text, 'aa')

    expect(outcome.targetOccurrences).toBe(2)
    expect(outcome.correctTransitions).toBe(2)
  })

  it('measures nothing from an empty session', () => {
    const outcome = measureDrill(deriveSessionTelemetry([], 'in find'), 'in find', 'in')

    expect(outcome.correctTransitions).toBe(0)
    expect(outcome.medianMs).toBeNull()
    expect(outcome.sessionMedianMs).toBeNull()
    // The text still offered two chances, whether or not they were taken.
    expect(outcome.targetOccurrences).toBe(2)
  })
})

describe('compareToBaseline', () => {
  const outcomeAt = (medianMs: number | null) => ({
    sequence: 'in',
    targetOccurrences: 10,
    correctTransitions: 8,
    medianMs,
    sessionMedianMs: 90,
  })

  it('states the difference as a subtraction, faster being negative', () => {
    const comparison = compareToBaseline(outcomeAt(121), 133)

    expect(comparison.baselineMs).toBe(133)
    expect(comparison.drillMs).toBe(121)
    expect(comparison.differenceMs).toBe(-12)
  })

  it('is positive when the drill was slower', () => {
    expect(compareToBaseline(outcomeAt(150), 133).differenceMs).toBe(17)
  })

  it('has no difference to state without a baseline', () => {
    const comparison = compareToBaseline(outcomeAt(121), null)

    expect(comparison.baselineMs).toBeNull()
    expect(comparison.differenceMs).toBeNull()
  })

  describe('against the typical range', () => {
    const range = { lowMs: 110, highMs: 140 }

    it('calls a drill inside the range within ordinary variation, edges included', () => {
      expect(compareToBaseline(outcomeAt(121), 133, range).placement).toBe('within')
      expect(compareToBaseline(outcomeAt(110), 133, range).placement).toBe('within')
      expect(compareToBaseline(outcomeAt(140), 133, range).placement).toBe('within')
    })

    it('says which side of the range a drill fell outside it', () => {
      expect(compareToBaseline(outcomeAt(109), 133, range).placement).toBe('faster')
      expect(compareToBaseline(outcomeAt(141), 133, range).placement).toBe('slower')
    })

    it('places nothing without a range or without a drill timing', () => {
      expect(compareToBaseline(outcomeAt(121), 133).placement).toBeNull()
      expect(compareToBaseline(outcomeAt(121), 133, null).typicalRangeMs).toBeNull()
      expect(compareToBaseline(outcomeAt(null), 133, range).placement).toBeNull()
    })
  })

  it('has no difference to state when the drill measured nothing', () => {
    expect(compareToBaseline(outcomeAt(null), 133).differenceMs).toBeNull()
  })
})

describe('findSequenceBaseline', () => {
  const entriesOf = (...sessions: readonly SessionTelemetry[]): SessionTelemetryEntry[] =>
    sessions.map((telemetry, index) => ({ sessionId: `s${index}`, telemetry }))

  it('reports a sequence the ranking would never have shown', () => {
    // Two sessions is below the evidence threshold for ranking, but the typist
    // still has a real history for this transition and it is what a drill
    // should be compared against.
    const text = 'in find into stop'
    const baseline = findSequenceBaseline(
      entriesOf(run(text, 80, { in: 120 }), run(text, 80, { in: 120 })),
      'in',
    )

    expect(baseline?.medianMs).toBe(120)
    expect(baseline?.sessions).toBe(2)
    expect(baseline?.observations).toBe(6)
    expect(baseline?.overallMedianMs).toBe(80)
  })

  it('weights sessions equally, exactly as the ranking does', () => {
    // A long session at 200 ms and two short ones at 100 ms. Pooling would say
    // 200; one vote per session says 100.
    const long = run('in in in in in in in in', 80, { in: 200 })
    const short = run('in find', 80, { in: 100 })

    const baseline = findSequenceBaseline(entriesOf(long, short, short), 'in')

    expect(baseline?.medianMs).toBe(100)
  })

  it('gives no typical range from too few sessions to describe one', () => {
    const text = 'in find into stop'
    const baseline = findSequenceBaseline(
      entriesOf(run(text, 80, { in: 120 }), run(text, 80, { in: 120 })),
      'in',
    )

    expect(baseline?.typicalRangeMs).toBeNull()
  })

  it('gives the 10th to 90th percentile of the per-session medians as the typical range', () => {
    // Per-session medians 100, 110, 120, 130. The 10th percentile sits 0.3 of
    // the way from 100 to 110; the 90th, 0.7 of the way from 120 to 130.
    const text = 'in find into stop'
    const baseline = findSequenceBaseline(
      entriesOf(
        run(text, 80, { in: 130 }),
        run(text, 80, { in: 100 }),
        run(text, 80, { in: 120 }),
        run(text, 80, { in: 110 }),
      ),
      'in',
    )

    expect(baseline?.typicalRangeMs?.lowMs).toBeCloseTo(103, 10)
    expect(baseline?.typicalRangeMs?.highMs).toBeCloseTo(127, 10)
  })

  it('returns nothing for a sequence never typed', () => {
    expect(findSequenceBaseline(entriesOf(run('cat dog', 80)), 'in')).toBeNull()
  })

  it('returns nothing when there is no telemetry at all', () => {
    expect(findSequenceBaseline([{ sessionId: 'a', telemetry: null }], 'in')).toBeNull()
  })
})

describe('a drill session, stored and read back', () => {
  it('records which sequence it targeted, and joins to its telemetry', async () => {
    const storage = createMemoryAdapter()
    const sessions = createSessionServiceOver(storage)
    const telemetry = createTelemetryServiceOver(storage)

    const text = 'in find into'
    const engine = createTypingEngine()
    engine.start(target(text), timestamp(0))
    Array.from(text).forEach((key, index) => {
      engine.input(key, timestamp((index + 1) * 90))
    })

    const result = engine.toResult()
    const session = createTypingSession({
      result: result!,
      context: { ...DEFAULT_SESSION_CONTEXT, mode: 'drill', targetSequence: 'in' },
      completedAt: timestamp(1_700_000_000_000),
    })

    await sessions.save(session)
    await telemetry.save(session.id, telemetry.capture(result!))

    const [stored] = await sessions.getAll()

    // The target lives on the session rather than inside the keystroke blob, so
    // there is one copy of it and no second format to keep in step. Telemetry
    // is joined to it by id, which is what makes the drill identifiable.
    expect(stored?.context.mode).toBe('drill')
    expect(stored?.context.targetSequence).toBe('in')

    const captured = await telemetry.getBySessionId(stored!.id, stored!.text)
    const outcome = measureDrill(captured!, stored!.text, stored!.context.targetSequence!)

    expect(outcome.sequence).toBe('in')
    expect(outcome.correctTransitions).toBe(3)
    expect(outcome.medianMs).toBe(90)
  })

  it('leaves an ordinary practice session with no target', async () => {
    const storage = createMemoryAdapter()
    const sessions = createSessionServiceOver(storage)

    const text = 'in find'
    const engine = createTypingEngine()
    engine.start(target(text), timestamp(0))
    Array.from(text).forEach((key, index) => {
      engine.input(key, timestamp((index + 1) * 90))
    })

    await sessions.save(
      createTypingSession({
        result: engine.toResult()!,
        context: DEFAULT_SESSION_CONTEXT,
        completedAt: timestamp(1_700_000_000_000),
      }),
    )

    const [stored] = await sessions.getAll()

    expect(stored?.context.mode).toBe('words')
    expect(stored?.context.targetSequence).toBeUndefined()
  })
})

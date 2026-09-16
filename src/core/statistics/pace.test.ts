/**
 * The pace caret's speeds, read from history, and where a pace has got to.
 *
 * Fixtures are small enough to work out by hand; the answer is in the comment.
 */

import { describe, expect, it } from 'vitest'

import { DEFAULT_SESSION_CONTEXT, type SessionMode, type TypingSession } from '@core/sessions'
import { accuracy, milliseconds, sessionId, timestamp, wpm } from '@core/types'

import { PACE_RULES, paceFor, paceIndexAt, paceTargets } from './pace.ts'

let counter = 0

const test = (netWpm: number, { at = counter, mode = 'words' as SessionMode, status = 'completed' as const } = {}): TypingSession => {
  counter += 1
  return {
    id: sessionId(`session-${counter}`),
    startedAt: timestamp(1_700_000_000_000 + at * 60_000 - 20_000),
    completedAt: timestamp(1_700_000_000_000 + at * 60_000),
    durationMs: milliseconds(20_000),
    text: 'the quick brown fox',
    textSourceId: 'common-words',
    context: { ...DEFAULT_SESSION_CONTEXT, mode },
    metrics: {
      netWpm: wpm(netWpm),
      rawWpm: wpm(netWpm + 5),
      accuracy: accuracy(0.97),
      totalCharacters: 19,
      typedCharacters: 100,
      correctCharacters: 97,
      incorrectCharacters: 3,
      correctedCharacters: 1,
      errorCount: 3,
    },
    status,
  }
}

describe('pace targets', () => {
  it('offers nothing until there are a few ordinary tests to read', () => {
    expect(paceTargets([])).toEqual({ average: null, best: null, push: null, from: 0 })
    expect(paceTargets([test(90), test(95)])).toEqual({ average: null, best: null, push: null, from: 2 })
  })

  it("is the typist's median, their fastest, and a push a little past the median", () => {
    // Median of 80, 90, 100, 130 is 95; the fastest 130; 95 × 1.05 = 99.75, so 100.
    const targets = paceTargets([test(80), test(130), test(90), test(100)])

    expect(targets).toEqual({ average: 95, best: 130, push: 100, from: 4 })
  })

  it('is not dragged by one great or awful test, because it is a median', () => {
    expect(paceTargets([test(90), test(92), test(94), test(300)]).average).toBe(93)
    expect(paceTargets([test(90), test(92), test(94), test(3)]).average).toBe(91)
  })

  it('always pushes by at least one word per minute', () => {
    // 10 × 1.05 rounds to 11 anyway; 12 × 1.05 = 12.6 rounds to 13; 1 × 1.05 would round to 1.
    expect(paceTargets([test(1), test(1), test(1)]).push).toBe(2)
  })

  it('reads only ordinary, completed tests: training modes shape their text, abandoned tests did not finish', () => {
    const targets = paceTargets([
      test(90),
      test(92),
      test(94),
      test(200, { mode: 'drill' }),
      test(200, { mode: 'hover' }),
      test(200, { mode: 'syllable' }),
      test(200, { status: 'abandoned' as never }),
    ])

    expect(targets).toEqual({ average: 92, best: 94, push: 97, from: 3 })
  })

  it('counts timed tests as ordinary typing', () => {
    expect(paceTargets([test(90, { mode: 'time' }), test(92), test(94)]).from).toBe(3)
  })

  it(`reads only the ${PACE_RULES.recent} most recent, so the pace follows the typist as they improve`, () => {
    const old = Array.from({ length: 30 }, (_, index) => test(60, { at: index }))
    const recent = Array.from({ length: PACE_RULES.recent }, (_, index) => test(110, { at: 100 + index }))

    expect(paceTargets([...recent, ...old])).toMatchObject({ average: 110, best: 110, from: PACE_RULES.recent })
  })

  it('never reorders the history it was given', () => {
    const history = [test(80, { at: 5 }), test(90, { at: 1 }), test(100, { at: 3 })]
    const before = history.map((session) => session.id)

    paceTargets(history)

    expect(history.map((session) => session.id)).toEqual(before)
  })
})

describe('the pace a choice stands for', () => {
  const targets = { average: 95, best: 130, push: 100, from: 4 }

  it('is the matching speed, or none when the caret is off or there is no history', () => {
    expect(paceFor('off', targets)).toBeNull()
    expect(paceFor('average', targets)).toBe(95)
    expect(paceFor('best', targets)).toBe(130)
    expect(paceFor('push', targets)).toBe(100)
    expect(paceFor('best', null)).toBeNull()
    expect(paceFor('best', { average: null, best: null, push: null, from: 1 })).toBeNull()
  })
})

describe('where a pace has got to', () => {
  it('moves five characters a word: 60 WPM is 5 characters a second', () => {
    expect(paceIndexAt(1000, 60, 500)).toBe(5)
    expect(paceIndexAt(999, 60, 500)).toBe(4)
    expect(paceIndexAt(12_000, 120, 500)).toBe(120)
  })

  it('starts at the beginning and never runs past the end', () => {
    expect(paceIndexAt(0, 100, 50)).toBe(0)
    expect(paceIndexAt(-40, 100, 50)).toBe(0)
    expect(paceIndexAt(600_000, 100, 50)).toBe(50)
  })

  it('stays put without a pace', () => {
    expect(paceIndexAt(5000, 0, 50)).toBe(0)
    expect(paceIndexAt(5000, Number.NaN, 50)).toBe(0)
  })
})

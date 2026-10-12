import { describe, expect, it } from 'vitest'

import { accuracy, milliseconds, sessionId, timestamp, wpm } from '@core/types'

import { DEFAULT_SESSION_CONTEXT } from './defaults.ts'
import { personalBestOf } from './personal-best.ts'
import type { SessionContext, TypingSession } from './types.ts'

let next = 0
const test = (speed: number, context: Partial<SessionContext> = {}, text = 'one two three'): TypingSession => ({
  id: sessionId(`session-${(next += 1)}`),
  startedAt: timestamp(1_000),
  completedAt: timestamp(2_000),
  durationMs: milliseconds(1_000),
  text,
  textSourceId: 'test',
  context: { ...DEFAULT_SESSION_CONTEXT, mode: 'words', ...context },
  metrics: {
    netWpm: wpm(speed),
    rawWpm: wpm(speed),
    accuracy: accuracy(1),
    totalCharacters: text.length,
    typedCharacters: text.length,
    correctCharacters: text.length,
    incorrectCharacters: 0,
    correctedCharacters: 0,
    errorCount: 0,
  },
  status: 'completed',
})

describe('personal best', () => {
  it('is a test faster than every earlier test of its kind, with the speed it beat', () => {
    expect(personalBestOf(test(80), [test(60), test(72)])).toEqual({ previousWpm: 72 })
  })

  it('is not a test that only matches or trails the best', () => {
    expect(personalBestOf(test(72), [test(60), test(72)])).toBeNull()
    expect(personalBestOf(test(50), [test(60)])).toBeNull()
  })

  it('is not the first test of its kind: there was nothing to beat', () => {
    expect(personalBestOf(test(80), [])).toBeNull()
  })

  it('leaves the test itself out of the history, saved or not', () => {
    const finished = test(80)
    expect(personalBestOf(finished, [finished, test(70)])).toEqual({ previousWpm: 70 })
    expect(personalBestOf(finished, [finished])).toBeNull()
  })

  it('compares only tests of the same length, difficulty, language and mode', () => {
    const fast = 200
    expect(personalBestOf(test(80), [test(fast, {}, 'one two three four')])).toBeNull()
    expect(personalBestOf(test(80), [test(70), test(fast, { difficulty: 'punctuation' })])).toEqual({ previousWpm: 70 })
    expect(personalBestOf(test(80), [test(70), test(fast, { language: 'de' })])).toEqual({ previousWpm: 70 })
    expect(personalBestOf(test(80, { mode: 'time', durationSeconds: 30 }), [test(70, { mode: 'time', durationSeconds: 30 }), test(fast, { mode: 'time', durationSeconds: 15 })]))
      .toEqual({ previousWpm: 70 })
  })

  it('never counts the training modes, or a test that was abandoned', () => {
    expect(personalBestOf(test(80, { mode: 'drill' }), [test(60, { mode: 'drill' })])).toBeNull()
    expect(personalBestOf(test(80, { mode: 'hover' }), [test(60, { mode: 'hover' })])).toBeNull()
    expect(personalBestOf({ ...test(80), status: 'abandoned' }, [test(60)])).toBeNull()
  })
})

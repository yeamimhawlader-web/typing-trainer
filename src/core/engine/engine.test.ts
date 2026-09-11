/**
 * Engine tests.
 *
 * Every test drives the engine with explicit timestamps, so nothing here
 * depends on how fast the machine running it happens to be. There is no fake
 * timer, no `await`, and no rendered component — which is the entire argument
 * for keeping the engine out of the UI.
 */

import { describe, expect, it, vi } from 'vitest'

import {
  sessionId as toSessionId,
  timestamp,
  type CharacterState,
  type Keystroke,
  type SessionTarget,
} from '@core/types'

import { createTypingEngine } from './engine.ts'
import { BACKSPACE, type EngineEvent, type TypingEngineOptions } from './types.ts'

const target = (text: string): SessionTarget => ({ text, sourceId: 'test' })

/**
 * Drives an engine on a simple clock: `start` at 0, then one keystroke every
 * `stepMs`. Returns the engine plus the current time so a test can keep going.
 */
const createHarness = (text: string, options?: TypingEngineOptions) => {
  const engine = createTypingEngine(options)
  let now = 0

  const start = () => {
    now = 0
    engine.start(target(text), timestamp(0))
  }

  const press = (key: string, stepMs = 100) => {
    now += stepMs
    engine.input(key, timestamp(now))
  }

  const typeText = (input: string, stepMs = 100) => {
    for (const character of Array.from(input)) press(character, stepMs)
  }

  return {
    engine,
    start,
    press,
    typeText,
    advanceTo: (ms: number) => {
      now = ms
      engine.tick(timestamp(ms))
    },
  }
}

describe('independence from storage', () => {
  /**
   * These tests run in the `domain` project, which has no DOM. If the engine
   * ever reached for browser storage — directly, or by importing something that
   * does — this file would stop loading. The assertions below state that
   * explicitly rather than leaving it as a property of the test setup.
   */
  it('runs with no browser storage available at all', () => {
    const globals = globalThis as {
      localStorage?: unknown
      indexedDB?: unknown
      window?: unknown
    }

    expect(globals.localStorage).toBeUndefined()
    expect(globals.indexedDB).toBeUndefined()
    expect(globals.window).toBeUndefined()

    const { engine, start, typeText } = createHarness('hello world')
    start()
    typeText('hello world')

    expect(engine.getSnapshot().status).toBe('completed')
    expect(engine.toResult()?.metrics.netWpm).toBeCloseTo(120, 10)
  })

  it('hands out a result without persisting anything itself', () => {
    const { engine, start, typeText } = createHarness('hi')
    start()
    typeText('hi')

    // The engine's entire output is this value. Storing it is somebody else's
    // job, which is what lets the same engine back a different store later.
    expect(engine.toResult()).toMatchObject({ status: 'completed' })
  })
})

describe('session lifecycle', () => {
  it('starts idle with nothing typed', () => {
    const engine = createTypingEngine()
    const snapshot = engine.getSnapshot()

    expect(snapshot.status).toBe('idle')
    expect(snapshot.cursorIndex).toBe(0)
    expect(snapshot.keystrokes).toEqual([])
    expect(engine.toResult()).toBeNull()
  })

  it('moves to running on start', () => {
    const { engine, start } = createHarness('hello')
    start()

    const snapshot = engine.getSnapshot()
    expect(snapshot.status).toBe('running')
    expect(snapshot.target.text).toBe('hello')
    expect(snapshot.characterStates).toEqual([
      'pending',
      'pending',
      'pending',
      'pending',
      'pending',
    ])
  })

  it('refuses an empty target', () => {
    const engine = createTypingEngine()

    expect(() => engine.start(target(''), timestamp(0))).toThrow(RangeError)
  })

  it('ignores input before a session starts', () => {
    const engine = createTypingEngine()

    engine.input('a', timestamp(100))

    expect(engine.getSnapshot().cursorIndex).toBe(0)
    expect(engine.getSnapshot().keystrokes).toEqual([])
  })

  it('ignores input after a session finishes', () => {
    const { engine, start, typeText, press } = createHarness('ab')
    start()
    typeText('ab')
    expect(engine.getSnapshot().status).toBe('completed')

    press('c')

    expect(engine.getSnapshot().typedCount).toBe(2)
  })

  it('transitions running -> paused -> running -> abandoned', () => {
    const { engine, start } = createHarness('hello world')
    start()

    engine.pause(timestamp(100))
    expect(engine.getSnapshot().status).toBe('paused')

    engine.resume(timestamp(200))
    expect(engine.getSnapshot().status).toBe('running')

    engine.finish(timestamp(300), 'abandoned')
    expect(engine.getSnapshot().status).toBe('abandoned')
    expect(engine.toResult()?.status).toBe('abandoned')
  })

  it('ignores pause when not running and resume when not paused', () => {
    const { engine, start } = createHarness('hello')

    engine.pause(timestamp(10))
    expect(engine.getSnapshot().status).toBe('idle')

    start()
    engine.resume(timestamp(20))
    expect(engine.getSnapshot().status).toBe('running')
  })

  it('ignores finish on a session that never started', () => {
    const engine = createTypingEngine()

    engine.finish(timestamp(100), 'abandoned')

    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.toResult()).toBeNull()
  })
})

describe('correct typing', () => {
  it('marks each matching character correct and advances the cursor', () => {
    const { engine, start, typeText } = createHarness('hello world')
    start()
    typeText('hel')

    const snapshot = engine.getSnapshot()
    expect(snapshot.cursorIndex).toBe(3)
    expect(snapshot.characterStates.slice(0, 3)).toEqual([
      'correct',
      'correct',
      'correct',
    ])
    expect(snapshot.characterStates[3]).toBe('pending')
    expect(snapshot.correctCount).toBe(3)
    expect(snapshot.incorrectCount).toBe(0)
    expect(snapshot.errorCount).toBe(0)
  })

  it('records a keystroke per character with the expected character attached', () => {
    const { engine, start, typeText } = createHarness('ab')
    start()
    typeText('ab')

    expect(engine.getSnapshot().keystrokes).toEqual([
      { kind: 'character', key: 'a', expected: 'a', index: 0, correct: true, at: 100 },
      { kind: 'character', key: 'b', expected: 'b', index: 1, correct: true, at: 200 },
    ])
  })

  it('handles repeated characters without confusing positions', () => {
    const { engine, start, typeText } = createHarness('aaabbb')
    start()
    typeText('aaabbb')

    const snapshot = engine.getSnapshot()
    expect(snapshot.correctCount).toBe(6)
    expect(snapshot.characterStates).toEqual(Array(6).fill('correct'))
  })

  it('types spaces like any other character', () => {
    const { engine, start, typeText } = createHarness('a b')
    start()
    typeText('a b')

    expect(engine.getSnapshot().correctCount).toBe(3)
    expect(engine.getSnapshot().status).toBe('completed')
  })
})

describe('incorrect typing', () => {
  it('marks a wrong character incorrect and still advances', () => {
    const { engine, start, typeText } = createHarness('hello')
    start()
    typeText('hxl')

    const snapshot = engine.getSnapshot()
    expect(snapshot.cursorIndex).toBe(3)
    expect(snapshot.characterStates.slice(0, 3)).toEqual([
      'correct',
      'incorrect',
      'correct',
    ])
    expect(snapshot.errorCount).toBe(1)
    expect(snapshot.incorrectCount).toBe(1)
    expect(snapshot.correctCount).toBe(2)
  })

  it('records what was typed alongside what was expected', () => {
    const { engine, start, typeText } = createHarness('hello')
    start()
    typeText('x')

    expect(engine.getSnapshot().keystrokes[0]).toEqual({
      kind: 'character',
      key: 'x',
      expected: 'h',
      index: 0,
      correct: false,
      at: 100,
    })
  })

  it('handles a run of consecutive errors', () => {
    const { engine, start, typeText } = createHarness('hello')
    start()
    typeText('xxxxx')

    const snapshot = engine.getSnapshot()
    expect(snapshot.characterStates).toEqual(Array(5).fill('incorrect'))
    expect(snapshot.errorCount).toBe(5)
    expect(snapshot.correctCount).toBe(0)
    expect(snapshot.accuracy).toBe(0)
    expect(snapshot.status).toBe('completed')
  })

  it('counts every error, including repeats at the same position', () => {
    const { engine, start, press } = createHarness('hello')
    start()

    press('x')
    press(BACKSPACE)
    press('y')
    press(BACKSPACE)
    press('z')

    const snapshot = engine.getSnapshot()
    expect(snapshot.errorCount).toBe(3)
    expect(snapshot.typedCount).toBe(3)
    expect(snapshot.cursorIndex).toBe(1)
  })
})

describe('backspace', () => {
  it('steps the cursor back and clears that character', () => {
    const { engine, start, typeText, press } = createHarness('hello')
    start()
    typeText('he')
    press(BACKSPACE)

    const snapshot = engine.getSnapshot()
    expect(snapshot.cursorIndex).toBe(1)
    expect(snapshot.characterStates[1]).toBe('pending')
    expect(snapshot.characterStates[0]).toBe('correct')
  })

  it('does nothing at the beginning of the text', () => {
    const { engine, start, press } = createHarness('hello')
    start()

    press(BACKSPACE)
    press(BACKSPACE)

    const snapshot = engine.getSnapshot()
    expect(snapshot.cursorIndex).toBe(0)
    expect(snapshot.keystrokes).toEqual([])
    expect(snapshot.typedCount).toBe(0)
    expect(snapshot.errorCount).toBe(0)
  })

  it('marks a fixed character corrected rather than correct', () => {
    const { engine, start, press } = createHarness('hello')
    start()

    press('x')
    press(BACKSPACE)
    press('h')

    const snapshot = engine.getSnapshot()
    expect(snapshot.characterStates[0]).toBe('corrected')
    expect(snapshot.correctCount).toBe(1)
    expect(snapshot.incorrectCount).toBe(0)
  })

  it('keeps a corrected character counted against accuracy', () => {
    const { engine, start, press } = createHarness('hello')
    start()

    press('x')
    press(BACKSPACE)
    press('h')

    // Two character attempts, one of which was wrong. Deleting it does not
    // unmake the mistake.
    expect(engine.getSnapshot().accuracy).toBeCloseTo(0.5, 10)
    expect(engine.getSnapshot().errorCount).toBe(1)
  })

  it('leaves a character correct when it was never wrong', () => {
    const { engine, start, press } = createHarness('hello')
    start()

    press('h')
    press(BACKSPACE)
    press('h')

    expect(engine.getSnapshot().characterStates[0]).toBe('correct')
  })

  it('records backspaces as their own kind of keystroke', () => {
    const { engine, start, press } = createHarness('hello')
    start()

    press('h')
    press(BACKSPACE)

    const keystrokes = engine.getSnapshot().keystrokes
    expect(keystrokes).toHaveLength(2)
    expect(keystrokes[1]).toEqual({
      kind: 'backspace',
      key: BACKSPACE,
      expected: null,
      index: 0,
      correct: false,
      at: 200,
    })
  })

  it('does not let backspaces inflate the typed count', () => {
    const { engine, start, press } = createHarness('hello')
    start()

    press('h')
    press(BACKSPACE)
    press('h')

    expect(engine.getSnapshot().typedCount).toBe(2)
  })

  it('can walk all the way back to the start', () => {
    const { engine, start, typeText, press } = createHarness('hello')
    start()
    typeText('hell')

    for (let index = 0; index < 4; index += 1) press(BACKSPACE)

    const snapshot = engine.getSnapshot()
    expect(snapshot.cursorIndex).toBe(0)
    expect(snapshot.characterStates).toEqual(Array(5).fill('pending'))
    expect(snapshot.correctCount).toBe(0)
  })
})

describe('input filtering', () => {
  it('ignores modifier and navigation key names', () => {
    const { engine, start, press } = createHarness('hello')
    start()

    for (const key of ['Shift', 'Control', 'Alt', 'ArrowLeft', 'Enter', 'Tab', '']) {
      press(key)
    }

    const snapshot = engine.getSnapshot()
    expect(snapshot.cursorIndex).toBe(0)
    expect(snapshot.keystrokes).toEqual([])
  })

  it('leaves the clock untouched for ignored keys', () => {
    const { engine, start, press } = createHarness('hello')
    start()

    press('Shift', 5_000)

    expect(engine.getSnapshot().elapsedMs).toBe(0)
  })
})

describe('unusual characters', () => {
  it('treats an accented letter as one character', () => {
    const { engine, start, typeText } = createHarness('café')
    start()

    expect(engine.getSnapshot().characters).toEqual(['c', 'a', 'f', 'é'])

    typeText('café')

    expect(engine.getSnapshot().correctCount).toBe(4)
    expect(engine.getSnapshot().status).toBe('completed')
  })

  it('treats an emoji as one character rather than two halves', () => {
    const { engine, start } = createHarness('a👍b')
    start()

    expect(engine.getSnapshot().characters).toEqual(['a', '👍', 'b'])
    expect(engine.getSnapshot().characters).toHaveLength(3)
  })

  it('accepts an emoji as input', () => {
    const { engine, start, press } = createHarness('a👍b')
    start()

    press('a')
    press('👍')
    press('b')

    expect(engine.getSnapshot().correctCount).toBe(3)
    expect(engine.getSnapshot().status).toBe('completed')
  })

  it('handles punctuation and symbols', () => {
    const { engine, start, typeText } = createHarness('a—b; "c" (d) #1 50%')
    start()
    typeText('a—b; "c" (d) #1 50%')

    expect(engine.getSnapshot().accuracy).toBe(1)
    expect(engine.getSnapshot().status).toBe('completed')
  })

  it('distinguishes visually similar characters', () => {
    const { engine, start, press } = createHarness('—')
    start()

    // An en dash typed where an em dash was expected.
    press('–')

    expect(engine.getSnapshot().errorCount).toBe(1)
  })
})

describe('word boundaries', () => {
  it('exposes word ranges for the target', () => {
    const { engine, start } = createHarness('the quick brown')
    start()

    expect(engine.getSnapshot().words).toEqual([
      { index: 0, start: 0, end: 3, text: 'the' },
      { index: 1, start: 4, end: 9, text: 'quick' },
      { index: 2, start: 10, end: 15, text: 'brown' },
    ])
  })

  it('tracks which word the cursor is in', () => {
    const { engine, start, typeText } = createHarness('the quick brown')
    start()
    expect(engine.getSnapshot().currentWordIndex).toBe(0)

    typeText('the')
    expect(engine.getSnapshot().currentWordIndex).toBe(1)

    typeText(' qui')
    expect(engine.getSnapshot().currentWordIndex).toBe(1)

    typeText('ck ')
    expect(engine.getSnapshot().currentWordIndex).toBe(2)
  })

  it('emits an event when a word boundary is crossed', () => {
    const { engine, start, typeText } = createHarness('the quick')
    const events: EngineEvent[] = []
    engine.on((event) => events.push(event))

    start()
    typeText('the')

    const wordEvents = events.filter((event) => event.type === 'word-completed')
    expect(wordEvents).toHaveLength(1)
    expect(wordEvents[0]).toMatchObject({ word: { index: 0, text: 'the' } })
  })

  it('reports word completion even when the word was typed wrongly', () => {
    const { engine, start, typeText } = createHarness('the quick')
    const events: EngineEvent[] = []
    engine.on((event) => events.push(event))

    start()
    typeText('thx')

    expect(events.filter((event) => event.type === 'word-completed')).toHaveLength(1)
  })

  it('handles a single-word target', () => {
    const { engine, start } = createHarness('hello')
    start()

    expect(engine.getSnapshot().words).toHaveLength(1)
    expect(engine.getSnapshot().currentWordIndex).toBe(0)
  })
})

describe('timing', () => {
  it('measures elapsed time from the start of the session', () => {
    const { engine, start, typeText } = createHarness('hello')
    start()
    typeText('hel', 250)

    expect(engine.getSnapshot().elapsedMs).toBe(750)
  })

  it('advances time on tick without any input', () => {
    const { engine, start, advanceTo } = createHarness('hello')
    start()

    advanceTo(4_000)

    expect(engine.getSnapshot().elapsedMs).toBe(4_000)
    expect(engine.getSnapshot().typedCount).toBe(0)
  })

  it('excludes paused time', () => {
    const { engine, start } = createHarness('hello world')
    start()

    engine.input('h', timestamp(200))
    engine.pause(timestamp(300))
    engine.resume(timestamp(10_300))
    engine.input('e', timestamp(10_400))

    // 300ms before the pause, 100ms after resuming.
    expect(engine.getSnapshot().elapsedMs).toBe(400)
  })

  it('does not advance while paused', () => {
    const { engine, start } = createHarness('hello')
    start()

    engine.pause(timestamp(500))
    engine.tick(timestamp(9_000))

    expect(engine.getSnapshot().elapsedMs).toBe(500)
  })

  it('refuses to run the clock backwards on an out-of-order timestamp', () => {
    const { engine, start } = createHarness('hello')
    start()

    engine.input('h', timestamp(1_000))
    engine.input('e', timestamp(400))

    expect(engine.getSnapshot().elapsedMs).toBe(1_000)
  })

  it('stamps keystrokes with an offset from the session start', () => {
    const { engine, start } = createHarness('hello')
    start()

    engine.input('h', timestamp(340))

    expect(engine.getSnapshot().keystrokes[0]?.at).toBe(340)
  })

  it('freezes elapsed time once the session ends', () => {
    const { engine, start, typeText } = createHarness('ab')
    start()
    typeText('ab', 500)
    const atCompletion = engine.getSnapshot().elapsedMs

    engine.tick(timestamp(50_000))

    expect(engine.getSnapshot().elapsedMs).toBe(atCompletion)
  })
})

describe('speed and accuracy', () => {
  it('computes net WPM from characters typed correctly', () => {
    // 11 characters in 1.1s => (11 / 5) / (1.1 / 60) = 120 WPM exactly.
    const { engine, start, typeText } = createHarness('hello world')
    start()
    typeText('hello world')

    expect(engine.getSnapshot().netWpm).toBeCloseTo(120, 10)
  })

  it('computes raw WPM from every character typed, right or wrong', () => {
    const { engine, start, typeText } = createHarness('hello world')
    start()
    typeText('hellX worlX')

    const snapshot = engine.getSnapshot()
    expect(snapshot.rawWpm).toBeCloseTo(120, 10)
    // 9 of 11 correct => (9 / 5) / (1.1 / 60)
    expect(snapshot.netWpm).toBeCloseTo(98.1818, 3)
    expect(snapshot.netWpm).toBeLessThan(snapshot.rawWpm)
  })

  it('matches raw and net WPM on a flawless session', () => {
    const { engine, start, typeText } = createHarness('hello world')
    start()
    typeText('hello world')

    const snapshot = engine.getSnapshot()
    expect(snapshot.netWpm).toBeCloseTo(snapshot.rawWpm, 10)
  })

  it('counts corrected characters toward speed but not accuracy', () => {
    const { engine, start, press } = createHarness('ab')
    start()

    press('x')
    press(BACKSPACE)
    press('a')
    press('b')

    const snapshot = engine.getSnapshot()
    // Both characters are right, so both count toward speed.
    expect(snapshot.correctCount).toBe(2)
    // Three character attempts, two of them correct. The backspace is not an
    // attempt at a character and does not appear in the denominator.
    expect(snapshot.typedCount).toBe(3)
    expect(snapshot.accuracy).toBeCloseTo(2 / 3, 10)
  })

  it('reports accuracy as correct attempts over all attempts', () => {
    const { engine, start, typeText } = createHarness('hello')
    start()
    typeText('hexlo')

    expect(engine.getSnapshot().accuracy).toBeCloseTo(0.8, 10)
  })

  it('reports full accuracy before anything is typed', () => {
    const { engine, start } = createHarness('hello')
    start()

    expect(engine.getSnapshot().accuracy).toBe(1)
  })

  it('reports zero speed before anything is typed', () => {
    const { engine, start } = createHarness('hello')
    start()

    expect(engine.getSnapshot().netWpm).toBe(0)
    expect(engine.getSnapshot().rawWpm).toBe(0)
  })
})

describe('very rapid input', () => {
  it('does not divide by zero when keystrokes share a timestamp', () => {
    const engine = createTypingEngine()
    engine.start(target('hello world'), timestamp(0))

    for (const character of Array.from('hello world')) {
      engine.input(character, timestamp(0))
    }

    const snapshot = engine.getSnapshot()
    expect(snapshot.elapsedMs).toBe(0)
    expect(snapshot.netWpm).toBe(0)
    expect(snapshot.rawWpm).toBe(0)
    expect(Number.isFinite(snapshot.netWpm)).toBe(true)
    expect(snapshot.correctCount).toBe(11)
    expect(snapshot.accuracy).toBe(1)
  })

  it('keeps every keystroke in order at sub-millisecond speed', () => {
    const text = 'a'.repeat(500)
    const engine = createTypingEngine()
    engine.start(target(text), timestamp(0))

    for (let index = 0; index < 500; index += 1) {
      engine.input('a', timestamp(Math.floor(index / 10)))
    }

    const snapshot = engine.getSnapshot()
    expect(snapshot.keystrokes).toHaveLength(500)
    expect(snapshot.cursorIndex).toBe(500)
    expect(snapshot.correctCount).toBe(500)
    expect(snapshot.status).toBe('completed')
  })

  it('produces a sane speed at a realistic 130 WPM', () => {
    // 130 WPM = 650 characters per minute ≈ one character every 92.3ms.
    const text = 'a'.repeat(65)
    const engine = createTypingEngine()
    engine.start(target(text), timestamp(0))

    for (let index = 1; index <= 65; index += 1) {
      engine.input('a', timestamp(Math.round(index * (60_000 / 650))))
    }

    expect(engine.getSnapshot().netWpm).toBeCloseTo(130, 0)
  })
})

describe('completion', () => {
  it('completes when the last character is typed', () => {
    const { engine, start, typeText } = createHarness('hi')
    start()
    typeText('hi')

    expect(engine.getSnapshot().status).toBe('completed')
    expect(engine.getSnapshot().cursorIndex).toBe(2)
  })

  it('completes even when every character was wrong', () => {
    const { engine, start, typeText } = createHarness('hi')
    start()
    typeText('xx')

    expect(engine.getSnapshot().status).toBe('completed')
  })

  it('produces a result on completion', () => {
    const { engine, start, typeText } = createHarness('hello world')
    start()
    typeText('hello world')

    const result = engine.toResult()
    expect(result).not.toBeNull()
    expect(result?.status).toBe('completed')
    expect(result?.durationMs).toBe(1_100)
    expect(result?.target.text).toBe('hello world')
    expect(result?.keystrokes).toHaveLength(11)
    expect(result?.metrics.accuracy).toBe(1)
    expect(result?.metrics.netWpm).toBeCloseTo(120, 10)
  })

  it('carries the full metric set onto the result', () => {
    const { engine, start, press } = createHarness('ab cd')
    start()

    press('a')
    press('X') // wrong, then fixed
    press(BACKSPACE)
    press('b')
    press(' ')
    press('c')
    press('Z') // wrong, left standing

    const metrics = engine.toResult()?.metrics

    expect(metrics).toEqual({
      netWpm: expect.any(Number),
      rawWpm: expect.any(Number),
      accuracy: expect.closeTo(4 / 6, 10),
      totalCharacters: 5,
      typedCharacters: 6,
      correctCharacters: 4,
      incorrectCharacters: 1,
      correctedCharacters: 1,
      errorCount: 2,
    })
  })

  it('uses the injected session id', () => {
    const { engine, start, typeText } = createHarness('hi', {
      createSessionId: () => toSessionId('fixed-id'),
    })
    start()
    typeText('hi')

    expect(engine.toResult()?.id).toBe('fixed-id')
  })

  it('has no result until the session ends', () => {
    const { engine, start, typeText } = createHarness('hello')
    start()
    typeText('hel')

    expect(engine.toResult()).toBeNull()
  })

  it('records the start time on the result', () => {
    const engine = createTypingEngine()
    engine.start(target('hi'), timestamp(1_700_000_000_000))
    engine.input('h', timestamp(1_700_000_000_100))
    engine.input('i', timestamp(1_700_000_000_200))

    expect(engine.toResult()?.startedAt).toBe(1_700_000_000_000)
  })
})

describe('reset and restart', () => {
  it('returns to idle on reset, keeping the target', () => {
    const { engine, start, typeText } = createHarness('hello')
    start()
    typeText('hel')

    engine.reset()

    const snapshot = engine.getSnapshot()
    expect(snapshot.status).toBe('idle')
    expect(snapshot.cursorIndex).toBe(0)
    expect(snapshot.keystrokes).toEqual([])
    expect(snapshot.characterStates).toEqual(Array(5).fill('pending'))
    expect(snapshot.typedCount).toBe(0)
    expect(snapshot.errorCount).toBe(0)
    expect(snapshot.elapsedMs).toBe(0)
    expect(snapshot.target.text).toBe('hello')
  })

  it('clears the previous result on reset', () => {
    const { engine, start, typeText } = createHarness('hi')
    start()
    typeText('hi')
    expect(engine.toResult()).not.toBeNull()

    engine.reset()

    expect(engine.toResult()).toBeNull()
  })

  it('restarts cleanly after a completed session', () => {
    const { engine, start, typeText } = createHarness('hi')
    start()
    typeText('xx')
    expect(engine.getSnapshot().errorCount).toBe(2)

    start()

    const snapshot = engine.getSnapshot()
    expect(snapshot.status).toBe('running')
    expect(snapshot.errorCount).toBe(0)
    expect(snapshot.accuracy).toBe(1)
    expect(snapshot.characterStates).toEqual(['pending', 'pending'])
  })

  it('discards an unfinished session when started again', () => {
    const { engine, start, typeText } = createHarness('hello')
    start()
    typeText('hel')

    start()

    expect(engine.getSnapshot().cursorIndex).toBe(0)
    expect(engine.getSnapshot().keystrokes).toEqual([])
  })

  it('can load a different target', () => {
    const { engine, start } = createHarness('hello')
    start()

    engine.start(target('different'), timestamp(0))

    expect(engine.getSnapshot().target.text).toBe('different')
    expect(engine.getSnapshot().characterStates).toHaveLength(9)
  })
})

describe('training modes', () => {
  it('supports a time-limited mode without changing the engine', () => {
    const { engine, start, typeText, advanceTo } = createHarness('a'.repeat(200), {
      isComplete: (snapshot) => snapshot.elapsedMs >= 1_000,
    })
    start()
    typeText('aaa')
    expect(engine.getSnapshot().status).toBe('running')

    advanceTo(1_000)

    expect(engine.getSnapshot().status).toBe('completed')
    expect(engine.getSnapshot().cursorIndex).toBe(3)
  })

  it('supports a word-count mode without changing the engine', () => {
    const { engine, start, typeText } = createHarness('one two three four', {
      isComplete: (snapshot) => snapshot.currentWordIndex >= 2,
    })
    start()

    typeText('one two ')

    expect(engine.getSnapshot().status).toBe('completed')
  })

  it('lets a mode end a session on the first error', () => {
    const { engine, start, typeText } = createHarness('hello world', {
      isComplete: (snapshot) => snapshot.errorCount > 0,
    })
    start()

    typeText('hex')

    expect(engine.getSnapshot().status).toBe('completed')
    expect(engine.getSnapshot().cursorIndex).toBe(3)
  })

  it('does not run past the end of the text under a custom policy', () => {
    const { engine, start, typeText, press } = createHarness('ab', {
      isComplete: () => false,
    })
    start()
    typeText('ab')

    press('c')

    const snapshot = engine.getSnapshot()
    expect(snapshot.status).toBe('running')
    expect(snapshot.cursorIndex).toBe(2)
    expect(snapshot.typedCount).toBe(2)
  })
})

describe('subscriptions', () => {
  it('notifies subscribers when state changes', () => {
    const { engine, start, typeText } = createHarness('hello')
    const listener = vi.fn()
    engine.subscribe(listener)

    start()
    typeText('h')

    expect(listener).toHaveBeenCalled()
  })

  it('stops notifying after unsubscribe', () => {
    const { engine, start, typeText } = createHarness('hello')
    const listener = vi.fn()
    const unsubscribe = engine.subscribe(listener)

    start()
    unsubscribe()
    listener.mockClear()
    typeText('h')

    expect(listener).not.toHaveBeenCalled()
  })

  it('returns a new snapshot object after a change', () => {
    const { engine, start, typeText } = createHarness('hello')
    start()
    const before = engine.getSnapshot()

    typeText('h')

    expect(engine.getSnapshot()).not.toBe(before)
  })

  it('returns the same snapshot object when nothing has changed', () => {
    const { engine, start } = createHarness('hello')
    start()

    expect(engine.getSnapshot()).toBe(engine.getSnapshot())
  })

  it('emits lifecycle events in order', () => {
    const { engine, start, typeText } = createHarness('hi')
    const types: string[] = []
    engine.on((event) => types.push(event.type))

    start()
    typeText('hi')

    expect(types).toEqual([
      'started',
      'keystroke',
      'keystroke',
      'word-completed',
      'finished',
    ])
  })

  it('emits pause and resume events', () => {
    const { engine, start } = createHarness('hello')
    const types: string[] = []
    engine.on((event) => types.push(event.type))

    start()
    engine.pause(timestamp(100))
    engine.resume(timestamp(200))

    expect(types).toEqual(['started', 'paused', 'resumed'])
  })

  it('emits a reset event', () => {
    const { engine, start } = createHarness('hello')
    const types: string[] = []
    engine.on((event) => types.push(event.type))

    start()
    engine.reset()

    expect(types).toEqual(['started', 'reset'])
  })

  it('includes the finished result on the event', () => {
    const { engine, start, typeText } = createHarness('hi')
    const events: EngineEvent[] = []
    engine.on((event) => events.push(event))

    start()
    typeText('hi')

    const finished = events.find((event) => event.type === 'finished')
    expect(finished).toMatchObject({ status: 'completed' })
  })

  it('stops emitting events after unsubscribe', () => {
    const { engine, start, typeText } = createHarness('hello')
    const listener = vi.fn()
    const unsubscribe = engine.on(listener)

    start()
    unsubscribe()
    listener.mockClear()
    typeText('h')

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('snapshot isolation', () => {
  /**
   * Snapshots are copies, not views. They are not frozen at runtime: the
   * `readonly` types already state the contract for every caller the compiler
   * can see, and freezing two arrays on every keystroke to defend against code
   * that deliberately casts those types away is not a trade worth making. What
   * must hold — and is tested here — is that no caller can corrupt the engine.
   */
  it('cannot be corrupted by a caller mutating a snapshot array', () => {
    const { engine, start, typeText } = createHarness('hello')
    start()
    typeText('h')

    const states = engine.getSnapshot().characterStates as CharacterState[]
    states[0] = 'pending'

    typeText('e')

    expect(engine.getSnapshot().characterStates[0]).toBe('correct')
  })

  it('hands out a keystroke list the caller cannot append to', () => {
    const { engine, start, typeText } = createHarness('hello')
    start()
    typeText('h')

    const keystrokes = engine.getSnapshot().keystrokes as Keystroke[]
    keystrokes.push(keystrokes[0] as Keystroke)

    typeText('e')

    expect(engine.getSnapshot().keystrokes).toHaveLength(2)
  })
})

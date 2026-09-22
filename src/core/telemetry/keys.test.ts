import { describe, expect, it } from 'vitest'

import { milliseconds, type Keystroke } from '@core/types'

import { deriveSessionTelemetry } from './derive.ts'
import { keyCosts, KEY_RULES } from './keys.ts'

/** A session in which `text` was typed, with the indices in `wrong` mistyped. */
const session = (text: string, wrong: readonly number[] = [], gapMs = 150) => {
  const keystrokes: Keystroke[] = Array.from(text, (character, index) => ({
    kind: 'character' as const,
    key: wrong.includes(index) ? 'X' : character,
    expected: character,
    correct: !wrong.includes(index),
    at: milliseconds((index + 1) * gapMs),
    index,
  }))
  return deriveSessionTelemetry(keystrokes, text)
}

/** `count` copies of a key, as its own little session. */
const repeat = (key: string, count: number, wrong: readonly number[] = []) =>
  session(key.repeat(count), wrong)

describe('the keys that cost you', () => {
  it('counts a key by what was aimed at, not by what came out', () => {
    const report = keyCosts([repeat('e', 20, [0, 1, 2])], { minimumAttempts: 5 })
    const e = report.keys.find((key) => key.key === 'e')

    expect(e).toEqual({ key: 'e', attempts: 20, misses: 3, accuracy: 0.85, medianMs: 150 })
    // The wrong key that came out is nobody's key.
    expect(report.keys.some((key) => key.key === 'x')).toBe(false)
  })

  it('treats a capital as the same key as its lower case', () => {
    const report = keyCosts([session('aaaaaAAAAA', [5])], { minimumAttempts: 5 })

    expect(report.keys).toHaveLength(1)
    expect(report.keys[0]).toMatchObject({ key: 'a', attempts: 10, misses: 1 })
  })

  it('puts the worst first, and says which few to look at', () => {
    const report = keyCosts(
      [repeat('e', 20, [0]), repeat('q', 20, [0, 1, 2, 3, 4]), repeat('z', 20, [0, 1])],
      { minimumAttempts: 5 },
    )

    expect(report.keys.map((key) => key.key)).toEqual(['q', 'z', 'e'])
    expect(report.worst.map((key) => key.key)).toEqual(['q', 'z', 'e'])
    expect(report.keys[0]?.accuracy).toBeCloseTo(0.75, 5)
  })

  it('says nothing about a key too rarely typed to judge', () => {
    const report = keyCosts([session('alphabet soup', [0])], { minimumAttempts: 12 })

    expect(report.keys).toEqual([])
    // It was still seen, which is why the section can say "keep typing".
    expect(report.keysSeen).toBeGreaterThan(0)
    expect(report.attempts).toBe('alphabet soup'.length)
  })

  it('leaves a key nobody misses out of the worst list, however often it is typed', () => {
    const report = keyCosts([repeat('a', 40), repeat('b', 40, [0])], { minimumAttempts: 5 })

    expect(report.worst.map((key) => key.key)).toEqual(['b'])
  })

  it('times a key from clean hits only, so a fumble does not become its speed', () => {
    const slowMiss: Keystroke[] = [
      { kind: 'character', key: 'a', expected: 'a', correct: true, at: milliseconds(100), index: 0 },
      { kind: 'character', key: 'a', expected: 'a', correct: true, at: milliseconds(200), index: 1 },
      // A mistake three seconds later: hesitation, not this key's speed.
      { kind: 'character', key: 'X', expected: 'a', correct: false, at: milliseconds(3200), index: 2 },
      { kind: 'character', key: 'a', expected: 'a', correct: true, at: milliseconds(3300), index: 3 },
    ]

    const report = keyCosts([deriveSessionTelemetry(slowMiss, 'aaaa')], { minimumAttempts: 1 })

    expect(report.keys[0]?.medianMs).toBe(100)
  })

  it('adds up across every session it is given, and ignores the ones with no detail kept', () => {
    const report = keyCosts([repeat('e', 10, [0]), null, repeat('e', 10, [0])], { minimumAttempts: 5 })

    expect(report.keys[0]).toMatchObject({ key: 'e', attempts: 20, misses: 2 })
  })

  it('has nothing to say before anything has been typed', () => {
    expect(keyCosts([])).toEqual({ keys: [], worst: [], keysSeen: 0, attempts: 0 })
    expect(KEY_RULES.minimumAttempts).toBeGreaterThan(1)
  })
})

/**
 * The streak rules, on their own.
 *
 * No engine and no DOM: word indices and verdicts go in, "jump or not" comes
 * out. The controller tests drive the same rules through a real engine.
 */

import { describe, expect, it } from 'vitest'

import { computeWordRanges, toCharacters } from '@core/engine'

import { createMistakeStreaks, MISTAKES_PER_JUMP, wordOwning } from './mistake-streak.ts'

const mistake = (streaks: ReturnType<typeof createMistakeStreaks>, word: number): boolean =>
  streaks.keystroke(word, 'character', false)

const correct = (streaks: ReturnType<typeof createMistakeStreaks>, word: number): boolean =>
  streaks.keystroke(word, 'character', true)

const backspace = (streaks: ReturnType<typeof createMistakeStreaks>, word: number): boolean =>
  streaks.keystroke(word, 'backspace', false)

describe('consecutive mistakes on a word', () => {
  it('does nothing on the first mistake', () => {
    const streaks = createMistakeStreaks()

    expect(mistake(streaks, 0)).toBe(false)
    expect(streaks.streakOf(0)).toBe(1)
  })

  it('does nothing on the second consecutive mistake', () => {
    const streaks = createMistakeStreaks()
    mistake(streaks, 0)

    expect(mistake(streaks, 0)).toBe(false)
    expect(streaks.streakOf(0)).toBe(2)
  })

  it('jumps on the third consecutive mistake', () => {
    const streaks = createMistakeStreaks()
    mistake(streaks, 0)
    mistake(streaks, 0)

    expect(MISTAKES_PER_JUMP).toBe(3)
    expect(mistake(streaks, 0)).toBe(true)
  })

  it('keeps counting through backspaces and correct letters inside the word', () => {
    // x, delete, x, delete, correct letter, x — still the same struggle.
    const streaks = createMistakeStreaks()

    mistake(streaks, 2)
    backspace(streaks, 2)
    mistake(streaks, 2)
    backspace(streaks, 2)
    correct(streaks, 2)

    expect(mistake(streaks, 2)).toBe(true)
  })

  it('never counts a backspace or a correct keystroke as a mistake', () => {
    const streaks = createMistakeStreaks()

    for (let press = 0; press < 10; press += 1) {
      expect(backspace(streaks, 0)).toBe(false)
      expect(correct(streaks, 0)).toBe(false)
    }
    expect(streaks.streakOf(0)).toBe(0)
  })
})

describe('when a streak ends', () => {
  it('resets on a correct completion of the word', () => {
    const streaks = createMistakeStreaks()
    mistake(streaks, 0)
    mistake(streaks, 0)

    streaks.completedCorrectly(0)

    expect(streaks.streakOf(0)).toBe(0)
    // Two more would have made four; after the reset they make two.
    expect(mistake(streaks, 0)).toBe(false)
    expect(mistake(streaks, 0)).toBe(false)
  })

  it('resets the previous word when a keystroke lands on another word', () => {
    const streaks = createMistakeStreaks()
    mistake(streaks, 4)
    mistake(streaks, 4)

    correct(streaks, 5)

    expect(streaks.streakOf(4)).toBe(0)
  })

  it('does not resume an old streak when the typist comes back to a word', () => {
    const streaks = createMistakeStreaks()
    mistake(streaks, 1)
    mistake(streaks, 1)
    backspace(streaks, 0) // back into the previous word

    expect(mistake(streaks, 1)).toBe(false)
    expect(streaks.streakOf(1)).toBe(1)
  })

  it('clears every streak on start, restart or completion', () => {
    const streaks = createMistakeStreaks()
    mistake(streaks, 3)
    mistake(streaks, 3)

    streaks.clear()

    expect(streaks.streakOf(3)).toBe(0)
    expect(mistake(streaks, 3)).toBe(false)
  })
})

describe('words are tracked independently', () => {
  it('follows the example: 4 jumps, 5 resets, 6 does not jump', () => {
    const streaks = createMistakeStreaks()
    const jumps: number[] = []
    const record = (word: number, jumped: boolean): void => {
      if (jumped) jumps.push(word)
    }

    // word 4: mistake → mistake → mistake → jump
    record(4, mistake(streaks, 4))
    record(4, mistake(streaks, 4))
    record(4, mistake(streaks, 4))

    // word 5: mistake → correct → reset
    record(5, mistake(streaks, 5))
    streaks.completedCorrectly(5)

    // word 6: mistake → mistake
    record(6, mistake(streaks, 6))
    record(6, mistake(streaks, 6))

    expect(jumps).toEqual([4])
    expect(streaks.streakOf(5)).toBe(0)
    expect(streaks.streakOf(6)).toBe(2)
  })

  it('does not let one word’s mistakes add up with another’s', () => {
    // Alternating words, two mistakes each time: never three on one word.
    const streaks = createMistakeStreaks()
    const jumped = [0, 0, 1, 1, 0, 0, 1, 1].map((word) => mistake(streaks, word))

    expect(jumped.every((value) => !value)).toBe(true)
  })
})

describe('repeated triggering', () => {
  it('jumps again on every third consecutive mistake, not on each one after', () => {
    const streaks = createMistakeStreaks()
    const jumped = Array.from({ length: 9 }, () => mistake(streaks, 0))

    expect(jumped).toEqual([false, false, true, false, false, true, false, false, true])
  })

  it('starts over after a reset, needing three more', () => {
    const streaks = createMistakeStreaks()
    mistake(streaks, 0)
    mistake(streaks, 0)
    mistake(streaks, 0)
    streaks.clear()

    expect([mistake(streaks, 0), mistake(streaks, 0), mistake(streaks, 0)]).toEqual([
      false,
      false,
      true,
    ])
  })
})

describe('wordOwning', () => {
  const words = computeWordRanges(toCharacters('ab cde f'))

  it('gives each letter its own word', () => {
    expect([0, 1, 3, 4, 5, 7].map((position) => wordOwning(words, position))).toEqual([
      0, 0, 1, 1, 1, 2,
    ])
  })

  it('gives the space after a word to that word, where an extra letter lands', () => {
    expect(wordOwning(words, 2)).toBe(0)
    expect(wordOwning(words, 6)).toBe(1)
  })

  it('has no word to give when the text has none', () => {
    expect(wordOwning([], 0)).toBe(-1)
  })
})

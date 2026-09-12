/**
 * Error recovery: a normal mistake must not poison the rest of the test.
 *
 * Before the word-synchronised rules, one extra letter left 52 of the next 60
 * characters wrong and one unnoticed dropped letter turned a 130 WPM test into
 * 9 WPM at 7% accuracy. These tests pin down the behaviour that replaced that.
 *
 * States are written one letter per character so every expectation can be
 * checked by eye against the target text above it:
 *
 *   c = correct   x = incorrect   r = corrected   . = pending
 */

import { describe, expect, it } from 'vitest'

import { timestamp, type SessionTarget } from '@core/types'

import { createTypingEngine } from './engine.ts'
import { BACKSPACE } from './types.ts'

const target = (text: string): SessionTarget => ({ text, sourceId: 'test' })

const LETTER = { pending: '.', correct: 'c', incorrect: 'x', corrected: 'r' } as const

/** Starts a session and returns helpers on a 100 ms clock. */
const session = (text: string) => {
  const engine = createTypingEngine()
  engine.start(target(text), timestamp(0))
  let now = 0

  const type = (keys: string) => {
    for (const key of Array.from(keys)) {
      now += 100
      engine.input(key, timestamp(now))
    }
  }
  const backspace = (times = 1) => {
    for (let i = 0; i < times; i += 1) {
      now += 100
      engine.input(BACKSPACE, timestamp(now))
    }
  }
  const deleteWord = () => {
    now += 100
    engine.deleteWord(timestamp(now))
  }
  const states = () =>
    engine
      .getSnapshot()
      .characterStates.map((state) => LETTER[state])
      .join('')
  const snapshot = () => engine.getSnapshot()

  return { engine, type, backspace, deleteWord, states, snapshot }
}

describe('error recovery', () => {
  describe('one extra character', () => {
    it('keeps an extra letter at the end of a word inside that word', () => {
      // Target: "the cat dog"; typed "thee cat dog".
      const s = session('the cat dog')
      s.type('thee cat dog')

      // "the" is right, the space shows the extra, and both following words are
      // untouched by it.
      expect(s.states()).toBe('cccxccccccc')
      expect(s.snapshot().status).toBe('completed')
    })

    it('contains an extra letter in the middle of a word to that word', () => {
      // Target: "quick fox"; typed "quiick fox". The doubled i shifts the rest
      // of "quick" by one, which lands the final k on the space as an extra.
      const s = session('quick fox')
      s.type('quiick fox')

      expect(s.states()).toBe('cccxxxccc')
      expect(s.snapshot().status).toBe('completed')
    })

    it('holds the cursor on the boundary while extras are typed', () => {
      const s = session('the cat')
      s.type('theee')

      // Two extras, cursor still on the space.
      expect(s.snapshot().cursorIndex).toBe(3)
      expect(s.states()).toBe('cccx...')
    })
  })

  describe('one dropped character', () => {
    it('contains a dropped letter to its own word', () => {
      // Target: "quick fox"; typed "qick fox". Inside the word the comparison
      // shifts, and the space re-synchronises: "fox" is compared with "fox".
      const s = session('quick fox')
      s.type('qick fox')

      expect(s.states()).toBe('cxxxxcccc')
      expect(s.snapshot().status).toBe('completed')
    })

    it('marks the unreached letter as missed rather than pending', () => {
      const s = session('quick fox')
      s.type('quic ')

      // The k was never typed and never will be at this point: it is wrong, and
      // the cursor is already at the start of "fox".
      expect(s.states()).toBe('ccccxc...')
      expect(s.snapshot().cursorIndex).toBe(6)
    })
  })

  describe('one early space', () => {
    it('ends the word and moves to the next one', () => {
      // Target: "quick brown fox"; typed "qui brown fox".
      const s = session('quick brown fox')
      s.type('qui brown fox')

      expect(s.states()).toBe('cccxxcccccccccc')
      expect(s.snapshot().status).toBe('completed')
    })

    it('ignores a space before any letter of the word', () => {
      // A double space must not skip a whole word the typist has not touched.
      const s = session('the cat')
      s.type('the  cat')

      expect(s.states()).toBe('ccccccc')
      expect(s.snapshot().status).toBe('completed')
    })

    it('ignores a space at the very start of the test', () => {
      const s = session('the cat')
      s.type(' the cat')

      expect(s.states()).toBe('ccccccc')
      expect(s.snapshot().typedCount).toBe(7)
    })

    it('finishes the test when the space comes in the last word', () => {
      // No next word to move to: the unreached letters are missed and the test
      // is over, exactly as pressing space on the last word ends it elsewhere.
      const s = session('the cat')
      s.type('the ca ')

      expect(s.states()).toBe('ccccccx')
      expect(s.snapshot().status).toBe('completed')
    })
  })

  describe('one transposition', () => {
    it('costs the two swapped letters and nothing else', () => {
      const s = session('quick fox')
      s.type('qiuck fox')

      expect(s.states()).toBe('cxxcccccc')
    })
  })

  describe('multiple mistakes', () => {
    it('contains each mistake to the word it happened in', () => {
      // Target: "one two six ten"; typed with an extra, a drop and a swap.
      const s = session('one two six ten')
      s.type('onee tw sxi ten')

      expect(s.states()).toBe('cccxccxccxxcccc')
      expect(s.snapshot().status).toBe('completed')
    })

    it('never marks a later correct word wrong because of an earlier slip', () => {
      const words = ['alpha', 'bravo', 'delta', 'echo', 'hotel', 'kilo', 'lima']
      const s = session(words.join(' '))

      // An extra letter in the first word, then everything else typed perfectly.
      s.type(`alphaa ${words.slice(1).join(' ')}`)

      const states = s.snapshot().characterStates
      const firstWordEnd = words[0]!.length
      const wrongAfterFirstWord = states
        .slice(firstWordEnd + 1)
        .filter((state) => state === 'incorrect').length

      expect(wrongAfterFirstWord).toBe(0)
    })
  })

  describe('backspacing after a mistake', () => {
    it('removes an extra first, leaving the cursor on the boundary', () => {
      const s = session('the cat')
      s.type('theee')
      s.backspace()

      expect(s.snapshot().cursorIndex).toBe(3)
      // One extra left, so the boundary still shows it.
      expect(s.states()).toBe('cccx...')

      s.backspace()
      expect(s.states()).toBe('ccc....')
      expect(s.snapshot().cursorIndex).toBe(3)
    })

    it('steps back into the missed letters after an early space', () => {
      const s = session('quick fox')
      s.type('qui ')
      s.backspace()

      // Back onto the space, then onto the last missed letter.
      expect(s.snapshot().cursorIndex).toBe(5)
      s.backspace()
      expect(s.snapshot().cursorIndex).toBe(4)
      expect(s.states()).toBe('cccx.....')
    })

    it('keeps extras when only the space in front of them is deleted', () => {
      // "thee " — the extra was committed by the space. Deleting the space puts
      // the cursor back on the boundary, where the extra still stands.
      const s = session('the cat')
      s.type('thee ')
      expect(s.snapshot().cursorIndex).toBe(4)

      s.backspace()
      expect(s.snapshot().cursorIndex).toBe(3)
      expect(s.states()).toBe('cccx...')

      s.backspace()
      expect(s.states()).toBe('ccc....')
    })

    it('clears a word and its extras with one Ctrl+Backspace', () => {
      const s = session('the cat')
      s.type('theeee')
      s.deleteWord()

      expect(s.snapshot().cursorIndex).toBe(0)
      expect(s.states()).toBe('.......')
    })
  })

  describe('correcting a mistake', () => {
    it('shows a removed extra and a correct space as fully correct', () => {
      const s = session('the cat')
      s.type('thee')
      s.backspace()
      s.type(' cat')

      // The space was wrong once and then right: corrected, not correct.
      expect(s.states()).toBe('cccrccc')
    })

    it('marks retyped missed letters as corrected', () => {
      const s = session('quick fox')
      s.type('qui ')
      s.backspace(3)
      s.type('ck fox')

      expect(s.states()).toBe('cccrrcccc')
      expect(s.snapshot().status).toBe('completed')
    })

    it('leaves an uncorrected extra showing after the word is spaced', () => {
      // The typist moved on without deleting the extra: the boundary stays
      // wrong, so the error is not silently forgiven.
      const s = session('the cat')
      s.type('thee cat')

      expect(s.states()).toBe('cccxccc')
      expect(s.snapshot().incorrectCount).toBe(1)
    })
  })

  describe('continuing normally after an error', () => {
    it('types every following word correctly', () => {
      const s = session('red green blue pink')
      s.type('redd green blue pink')

      expect(s.states()).toBe('cccxccccccccccccccc')
    })
  })

  describe('what a mistake costs in the metrics', () => {
    it('counts an extra letter as one wrong keystroke', () => {
      const s = session('the cat')
      s.type('thee cat')
      const snapshot = s.snapshot()

      // 8 keys, 7 right; the extra is the only error.
      expect(snapshot.typedCount).toBe(8)
      expect(snapshot.errorCount).toBe(1)
      expect(snapshot.accuracy).toBeCloseTo(7 / 8)
    })

    it('counts an early space as one wrong keystroke, and the missed letters as wrong characters', () => {
      const s = session('quick fox')
      s.type('qui fox')
      const snapshot = s.snapshot()

      // Keystrokes: q u i ␣ f o x = 7, of which the space was wrong.
      expect(snapshot.typedCount).toBe(7)
      expect(snapshot.errorCount).toBe(1)
      expect(snapshot.accuracy).toBeCloseTo(6 / 7)
      // Characters: c and k missed, the space arrived where k was expected.
      expect(snapshot.incorrectCount).toBe(2)
      expect(snapshot.correctCount).toBe(7)
    })

    it('leaves raw and net speed on their existing definitions', () => {
      const s = session('the cat')
      s.type('thee cat')
      const snapshot = s.snapshot()

      // Raw counts every character keystroke; net counts characters now right.
      expect(snapshot.rawWpm).toBeCloseTo(8 / 5 / (snapshot.elapsedMs / 60_000))
      expect(snapshot.netWpm).toBeCloseTo(6 / 5 / (snapshot.elapsedMs / 60_000))
    })

    it('records each keystroke once, at the position it happened', () => {
      const s = session('quick fox')
      s.type('qui ')
      const spaceKey = s.snapshot().keystrokes[3]

      // The early space acted on the position of "c", which it got wrong.
      expect(spaceKey).toMatchObject({ key: ' ', index: 3, expected: 'c', correct: false })
      expect(s.snapshot().keystrokes).toHaveLength(4)
    })
  })

  describe('the errors this deliberately does not guess at', () => {
    it('shifts by one word when a space is missed entirely', () => {
      // "the cat dog" typed as "thecat dog": the space between the and cat was
      // never pressed. Like word-based typing sites, the merged word lands on
      // "the" as extras and the typing is one word behind until corrected.
      const s = session('the cat dog')
      s.type('thecat dog')

      // t h e right; c a t held as extras on the space; the space moves on to
      // "cat", where d o g are compared with c a t. One word behind.
      expect(s.snapshot().cursorIndex).toBe(7)
      expect(s.states()).toBe('cccxxxx....')
    })

    it('recovers from a missed space with one Ctrl+Backspace', () => {
      const s = session('the cat dog')
      s.type('thecat')
      s.deleteWord()
      s.type('the cat dog')

      expect(s.states()).toBe('cccrccccccc')
      expect(s.snapshot().status).toBe('completed')
    })
  })

  describe('keys that are not text', () => {
    it('ignores control and invisible characters', () => {
      const s = session('the cat')
      for (const key of ['\r', '\n', '\t', ' ', '', '', '​', '́']) {
        s.type(key)
      }

      expect(s.snapshot().keystrokes).toHaveLength(0)
      expect(s.snapshot().cursorIndex).toBe(0)
    })
  })
})

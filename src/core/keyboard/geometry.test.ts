/**
 * The keyboard's geometry, checked against distances worked out by hand.
 *
 * Every expected figure below comes from the layout as a person would measure
 * it — count the keys across, count the rows down, Pythagoras — and not from
 * running the code under test.
 */

import { describe, expect, it } from 'vitest'

import { SYLLABLE_CORPUS } from '@core/syllables'

import { chunkTravel, KEYBOARD_ROWS, keyPosition, keyTravel, wordGeometry } from './geometry.ts'

describe('where the keys are', () => {
  it('places every key of the four rows, ten to a row', () => {
    expect(KEYBOARD_ROWS.map((row) => row.keys.length)).toEqual([10, 10, 10, 10])
    for (const row of KEYBOARD_ROWS) for (const key of row.keys) expect(keyPosition(key)).not.toBeNull()
  })

  it('staggers the rows as a real keyboard does, rather than laying them out as a grid', () => {
    expect(keyPosition('1')).toMatchObject({ x: 0, y: 0 })
    expect(keyPosition('q')).toMatchObject({ x: 0.5, y: 1 })
    expect(keyPosition('a')).toMatchObject({ x: 0.75, y: 2 })
    expect(keyPosition('z')).toMatchObject({ x: 1.25, y: 3 })
    // Ten keys along the home row: J is six to the right of A.
    expect(keyPosition('j')).toMatchObject({ x: 6.75, y: 2 })
  })

  it('finds a key whichever case it is typed in, and has no place for what is not a key', () => {
    expect(keyPosition('T')).toEqual(keyPosition('t'))
    expect(keyPosition(' ')).toBeNull()
    expect(keyPosition('é')).toBeNull()
  })

  it('gives each key the finger a typing course teaches for it', () => {
    const fingersOf = (keys: string) => new Set([...keys].map((key) => keyPosition(key)?.finger))

    expect(fingersOf('qaz')).toEqual(new Set(['leftPinky']))
    expect(fingersOf('wsx')).toEqual(new Set(['leftRing']))
    expect(fingersOf('edc')).toEqual(new Set(['leftMiddle']))
    expect(fingersOf('rfvtgb')).toEqual(new Set(['leftIndex']))
    expect(fingersOf('yhnujm')).toEqual(new Set(['rightIndex']))
    expect(fingersOf('ik')).toEqual(new Set(['rightMiddle']))
    expect(fingersOf('ol')).toEqual(new Set(['rightRing']))
    expect(fingersOf('p')).toEqual(new Set(['rightPinky']))
  })

  it('splits the hands between T and Y, G and H, B and N', () => {
    for (const key of 'qwertasdfgzxcvb') expect(keyPosition(key)?.hand).toBe('left')
    for (const key of 'yuiophjklnm') expect(keyPosition(key)?.hand).toBe('right')
  })
})

describe('the distance along a word', () => {
  it('is one key width between neighbours on a row', () => {
    expect(keyTravel('as')).toBe(1)
    expect(keyTravel('fj')).toBe(3)
  })

  it('follows the stagger between rows: Q to A is a quarter across and one down', () => {
    expect(keyTravel('qa')).toBeCloseTo(Math.sqrt(0.25 ** 2 + 1 ** 2), 10)
    // A to Z: half a key across and one down.
    expect(keyTravel('az')).toBeCloseTo(Math.sqrt(0.5 ** 2 + 1 ** 2), 10)
    // T (4.5, 1) to H (5.75, 2): one and a quarter across, one down.
    expect(keyTravel('th')).toBeCloseTo(Math.sqrt(1.25 ** 2 + 1 ** 2), 10)
  })

  it('is the same in either direction, and the sum of its steps', () => {
    expect(keyTravel('ht')).toBeCloseTo(keyTravel('th'), 10)
    expect(keyTravel('the')).toBeCloseTo(keyTravel('th') + keyTravel('he'), 10)
  })

  it('is nothing for one key, for no keys, and for a key pressed twice', () => {
    expect(keyTravel('a')).toBe(0)
    expect(keyTravel('')).toBe(0)
    expect(keyTravel('ll')).toBe(0)
  })

  it('carries on past a character that is not a key', () => {
    expect(keyTravel('a s')).toBe(1)
  })
})

describe('what the layout says about a word', () => {
  it('divides the travel by the transitions, so a long word is not marked down for its length', () => {
    const geometry = wordGeometry('asdf')

    expect(geometry.keys).toBe(4)
    expect(geometry.totalTravel).toBe(3)
    expect(geometry.averageTravel).toBe(1)
    expect(wordGeometry('a').averageTravel).toBe(0)
  })

  it('counts a transition between two keys of one finger, and not a key pressed twice', () => {
    // E then D: both the left middle finger.
    expect(wordGeometry('ed')).toMatchObject({ sameFingerTransitions: 1, repeatedCharacters: 0 })
    // L twice: the same key, which is a repeat and not a reach.
    expect(wordGeometry('ll')).toMatchObject({ sameFingerTransitions: 0, repeatedCharacters: 1 })
    // "letter": tt is the repeat; t to e and e to r are neighbours on different fingers.
    expect(wordGeometry('letter')).toMatchObject({ sameFingerTransitions: 0, repeatedCharacters: 1 })
  })

  it('counts each change of hand and each change of row', () => {
    // t (left, top) h (right, home) e (left, top): two changes of hand, two of row.
    expect(wordGeometry('the')).toMatchObject({ handAlternations: 2, rowTransitions: 2 })
    // All on the left hand's home row.
    expect(wordGeometry('sad')).toMatchObject({ handAlternations: 0, rowTransitions: 0 })
  })

  it('names the finger for each key, in order', () => {
    expect(wordGeometry('the').fingers).toEqual(['leftIndex', 'rightIndex', 'leftMiddle'])
  })
})

describe('a word, a chunk at a time', () => {
  it('measures each chunk on its own, and the step between chunks apart from both', () => {
    const { runs, bridges } = chunkTravel(['as', 'df'])

    expect(runs).toEqual([1, 1])
    // S to D, crossed during the breath.
    expect(bridges).toEqual([1])
  })

  it('covers exactly the distance of the whole word: chunking moves no key', () => {
    for (const entry of SYLLABLE_CORPUS) {
      expect(chunkTravel(entry.syllables).totalTravel).toBeCloseTo(keyTravel(entry.word), 10)
    }
  })

  it('never has a run longer than the whole word, and a shorter one for a word of two real chunks', () => {
    for (const entry of SYLLABLE_CORPUS) {
      expect(chunkTravel(entry.syllables).longestRun).toBeLessThanOrEqual(keyTravel(entry.word) + 1e-9)
    }
    const mountain = chunkTravel(['moun', 'tain'])
    expect(mountain.longestRun).toBeLessThan(keyTravel('mountain'))
    expect(mountain.longestRun).toBeCloseTo(Math.max(keyTravel('moun'), keyTravel('tain')), 10)
  })

  it('is nothing for no chunks', () => {
    expect(chunkTravel([])).toEqual({ runs: [], bridges: [], longestRun: 0, totalTravel: 0 })
  })
})

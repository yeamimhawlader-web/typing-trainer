/**
 * Reading a Syllable Trainer test's rhythm from its keystrokes, typed through a
 * real engine at chosen gaps so every expected number can be worked out by hand.
 */

import { describe, expect, it } from 'vitest'

import { createTypingEngine } from '@core/engine'
import { timestamp } from '@core/types'

import { READING_RULES, readRhythm } from './reading.ts'

const TEXT = 'mountain because different important mountain because'

/**
 * Types `text` exactly, waiting `withinMs` between keys of one syllable,
 * `breakMs` at a syllable break and `spaceMs` around a space. Letters in
 * `mistakes` (by position) are typed wrong.
 */
const type = ({
  text = TEXT,
  withinMs,
  breakMs,
  spaceMs = 150,
  mistakes = new Set<number>(),
}: {
  text?: string
  withinMs: number
  breakMs: number
  spaceMs?: number
  mistakes?: ReadonlySet<number>
}) => {
  // Where syllables start in these words, by hand.
  const starts: Record<string, number[]> = {
    mountain: [4],
    because: [2],
    different: [3, 6],
    important: [2, 5],
  }
  const breaks = new Set<number>()
  let offset = 0
  for (const word of text.split(' ')) {
    for (const start of starts[word] ?? []) breaks.add(offset + start)
    offset += word.length + 1
  }

  const engine = createTypingEngine()
  let at = 1000
  engine.start({ text, sourceId: 'test' }, timestamp(at))
  Array.from(text).forEach((character, index) => {
    if (index > 0) {
      const around = character === ' ' || text[index - 1] === ' '
      at += around ? spaceMs : breaks.has(index) ? breakMs : withinMs
    }
    engine.input(mistakes.has(index) ? 'q' : character, timestamp(at))
  })
  return engine.getSnapshot().keystrokes
}

describe('the rhythm of a Syllable Trainer test', () => {
  it('times the keys inside syllables and the breaks between them apart', () => {
    const reading = readRhythm(type({ withinMs: 80, breakMs: 190 }), TEXT)

    expect(reading.within.medianMs).toBe(80)
    expect(reading.breaks.medianMs).toBe(190)
    expect(reading.differenceMs).toBe(110)
    // mountain 1, because 1, different 2, important 2, mountain 1, because 1.
    expect(reading.breaks.count).toBe(8)
  })

  it('reads a clearly longer break as chunking', () => {
    expect(readRhythm(type({ withinMs: 80, breakMs: 190 }), TEXT).verdict).toBe('chunked')
  })

  it('reads breaks no longer than the keys as words still typed in one block', () => {
    expect(readRhythm(type({ withinMs: 90, breakMs: 95 }), TEXT).verdict).toBe('unbroken')
  })

  it('reads a break that is only a little longer as chunking starting to show', () => {
    // 20 ms longer: past the unbroken line, short of the chunked one.
    expect(readRhythm(type({ withinMs: 90, breakMs: 110 }), TEXT).verdict).toBe('emerging')
  })

  it('asks more of a slower typist: the break must be a share of their own key gap, not a fixed few milliseconds', () => {
    // 40 ms longer is chunking at 80 ms a key, but not at 240.
    expect(readRhythm(type({ withinMs: 80, breakMs: 120 }), TEXT).verdict).toBe('chunked')
    expect(readRhythm(type({ withinMs: 240, breakMs: 280 }), TEXT).verdict).toBe('emerging')
  })

  it('ignores the gaps around a space: the pause between words is not a syllable break', () => {
    const reading = readRhythm(type({ withinMs: 80, breakMs: 190, spaceMs: 900 }), TEXT)

    expect(reading.within.medianMs).toBe(80)
    expect(reading.breaks.medianMs).toBe(190)
  })

  it('leaves out a transition touched by a mistake, which times the mistake rather than the rhythm', () => {
    const clean = readRhythm(type({ withinMs: 80, breakMs: 190 }), TEXT)
    // The "t" that starts "tain": the break into it, and the key after it, go.
    const withMistake = readRhythm(type({ withinMs: 80, breakMs: 190, mistakes: new Set([4]) }), TEXT)

    expect(withMistake.breaks.count).toBe(clean.breaks.count - 1)
    expect(withMistake.within.count).toBe(clean.within.count - 1)
  })

  it(`says nothing until there are ${READING_RULES.minimum} clean breaks to read`, () => {
    const short = 'mountain because'
    const reading = readRhythm(type({ text: short, withinMs: 80, breakMs: 190 }), short)

    expect(reading.breaks.count).toBe(2)
    expect(reading.verdict).toBe('too-few')
  })

  it('reads nothing from nothing', () => {
    expect(readRhythm([], TEXT)).toEqual({
      within: { medianMs: null, count: 0 },
      breaks: { medianMs: null, count: 0 },
      differenceMs: null,
      verdict: 'too-few',
    })
  })
})

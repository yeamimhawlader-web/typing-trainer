/**
 * The Syllable Trainer's domain: its corpus, where syllables are in a text, how
 * far a word has got through them — read from a real engine — and the rhythm
 * its demonstration plays.
 */

import { describe, expect, it } from 'vitest'

import { computeWordRanges, createTypingEngine, toCharacters } from '@core/engine'
import { createSyllableWordsProvider, SYLLABLE_WORDS_PROVIDER_ID } from '@core/text'
import { timestamp } from '@core/types'

import {
  buildDemoTimeline,
  createSyllableLookup,
  cueOf,
  guidanceStrength,
  layoutSyllables,
  SYLLABLE_CORPUS,
  SYLLABLE_RHYTHM,
  syllableRanges,
  syllableStarts,
  syllableState,
  wordResolution,
  type SyllableWord,
} from './index.ts'

describe('the syllable corpus', () => {
  it('holds two hundred words', () => {
    expect(SYLLABLE_CORPUS).toHaveLength(200)
  })

  it('splits every word into syllables that join back into exactly that word', () => {
    const wrong = SYLLABLE_CORPUS.filter((entry) => entry.syllables.join('') !== entry.word)

    expect(wrong).toEqual([])
  })

  it('has no empty syllable anywhere', () => {
    const empty = SYLLABLE_CORPUS.filter((entry) => entry.syllables.some((syllable) => syllable.length === 0))

    expect(empty).toEqual([])
  })

  it('states each count as exactly the number of syllables', () => {
    const miscounted = SYLLABLE_CORPUS.filter((entry) => entry.count !== entry.syllables.length)

    expect(miscounted).toEqual([])
  })

  it('has no word twice', () => {
    const words = SYLLABLE_CORPUS.map((entry) => entry.word)

    expect(new Set(words).size).toBe(words.length)
  })

  it('is lowercase letters only, so every word is typed as it is shown', () => {
    const offenders = SYLLABLE_CORPUS.filter((entry) => !/^[a-z]+$/.test(entry.word))

    expect(offenders).toEqual([])
  })

  it('is words worth chunking: every one of two syllables or more, most of them two or three', () => {
    const counts = SYLLABLE_CORPUS.map((entry) => entry.count)
    const twoOrThree = counts.filter((count) => count === 2 || count === 3).length

    expect(Math.min(...counts)).toBeGreaterThanOrEqual(2)
    expect(twoOrThree / counts.length).toBeGreaterThan(0.75)
    // And enough long ones that the rhythm is trained where it pays most.
    expect(counts.filter((count) => count >= 4).length).toBeGreaterThanOrEqual(20)
  })

  it('splits where a dictionary does, not at a fixed length', () => {
    const byWord = new Map(SYLLABLE_CORPUS.map((entry) => [entry.word, entry.syllables]))

    expect(byWord.get('mountain')).toEqual(['moun', 'tain'])
    expect(byWord.get('different')).toEqual(['dif', 'fer', 'ent'])
    expect(byWord.get('information')).toEqual(['in', 'for', 'ma', 'tion'])
    expect(byWord.get('because')).toEqual(['be', 'cause'])
    expect(byWord.get('about')).toEqual(['a', 'bout'])
  })

  it('is fixed: frozen, the same words in the same order every time it is read', () => {
    expect(Object.isFrozen(SYLLABLE_CORPUS)).toBe(true)
    expect(SYLLABLE_CORPUS.every((entry) => Object.isFrozen(entry) && Object.isFrozen(entry.syllables))).toBe(true)
    expect(() => (SYLLABLE_CORPUS as SyllableWord[]).push({ word: 'x', syllables: ['x'], count: 1 })).toThrow()
    expect(createSyllableLookup(SYLLABLE_CORPUS)).toEqual(createSyllableLookup(SYLLABLE_CORPUS))
    expect(SYLLABLE_CORPUS[0]?.word).toBe('about')
  })
})

describe('the syllable layout of a text', () => {
  it('says where each syllable starts within its word', () => {
    expect(syllableStarts(['moun', 'tain'])).toEqual([0, 4])
    expect(syllableStarts(['in', 'for', 'ma', 'tion'])).toEqual([0, 2, 5, 7])
  })

  it('lays out every word of a text, and a word it does not know as one syllable', () => {
    expect(layoutSyllables('mountain zzz because')).toEqual([[0, 4], [0], [0, 2]])
  })

  it('is the same for the same text, every time', () => {
    const text = 'important information because different'

    expect(layoutSyllables(text)).toEqual(layoutSyllables(text))
  })

  it('turns a word and its starts into ranges of the text, the last running to the end of the word', () => {
    const [, word] = computeWordRanges(toCharacters('a mountain'))

    expect(syllableRanges(word!.start, word!.end, [0, 4])).toEqual([
      { start: 2, end: 6 },
      { start: 6, end: 10 },
    ])
  })
})

describe('a word through its syllables, as the engine sees it', () => {
  const TEXT = 'mountain because'
  const [MOUNTAIN, BECAUSE] = computeWordRanges(toCharacters(TEXT))
  const moun = { start: 0, end: 4 }
  const tain = { start: 4, end: 8 }

  const typing = () => {
    const engine = createTypingEngine()
    let at = 1000
    engine.start({ text: TEXT, sourceId: 'test' }, timestamp(at))
    const type = (keys: string) => {
      for (const key of keys) engine.input(key, timestamp((at += 80)))
    }
    const syllableOf = (range: { start: number; end: number }) =>
      syllableState(engine.getSnapshot().cursorIndex, range.start, range.end)
    const word = (range = MOUNTAIN!) => wordResolution(engine.getSnapshot(), range.start, range.end)
    return { engine, type, syllableOf, word }
  }

  it('begins with the first syllable in hand and the rest of the word to come', () => {
    const { syllableOf, word } = typing()

    expect(syllableOf(moun)).toBe('active')
    expect(syllableOf(tain)).toBe('pending')
    expect(word()).toBe('current')
    expect(word(BECAUSE)).toBe('ahead')
  })

  it('moves to the next syllable when the first is typed correctly', () => {
    const { type, syllableOf, word } = typing()

    type('moun')

    expect(syllableOf(moun)).toBe('typed')
    expect(syllableOf(tain)).toBe('active')
    expect(word()).toBe('current')
  })

  it('moves on from a syllable typed wrongly too — errors do not block — and keeps the mistake on the word', () => {
    const { engine, type, syllableOf, word } = typing()

    type('mxun')

    expect(syllableOf(moun)).toBe('typed')
    expect(syllableOf(tain)).toBe('active')
    expect(engine.getSnapshot().characterStates[1]).toBe('incorrect')

    type('tain')
    expect(word()).toBe('missed')
  })

  it('resolves the word clean when its last letter is typed and every letter is right', () => {
    const { type, word } = typing()

    type('mountain')

    expect(word()).toBe('resolved')
    expect(word(BECAUSE)).toBe('ahead')
  })

  it('goes on to the next word, its first syllable in hand', () => {
    const { type, word } = typing()

    type('mountain be')

    expect(word()).toBe('resolved')
    expect(word(BECAUSE)).toBe('current')
    expect(syllableState(11, BECAUSE!.start, BECAUSE!.start + 2)).toBe('typed')
  })

  it('never resolves a word that was not finished: a space part-way through leaves it missed', () => {
    const { type, word, syllableOf } = typing()

    type('moun ')

    expect(syllableOf(tain)).toBe('typed')
    expect(word()).toBe('missed')
    expect(word(BECAUSE)).toBe('current')
  })

  it('does not count a word as resolved with something extra typed where its space belongs', () => {
    const { type, word } = typing()

    type('mountainx')

    expect(word()).toBe('missed')
  })

  it('resolves a word whose mistake was fixed, because the text is right', () => {
    const { engine, type, word } = typing()

    type('mox')
    engine.input('Backspace', timestamp(5000))
    type('untain')

    expect(word()).toBe('resolved')
  })

  it('takes a word back to being typed when the typist backspaces into it', () => {
    const { engine, type, word, syllableOf } = typing()

    type('mountain')
    engine.input('Backspace', timestamp(9000))

    expect(word()).toBe('current')
    expect(syllableOf(tain)).toBe('active')
  })
})

describe('the rhythm', () => {
  it('breathes between syllables for a short, human pause', () => {
    expect(SYLLABLE_RHYTHM.demo.breathMs).toBeGreaterThanOrEqual(100)
    expect(SYLLABLE_RHYTHM.demo.breathMs).toBeLessThanOrEqual(300)
    expect(SYLLABLE_RHYTHM.guidance.breathMs).toBeGreaterThanOrEqual(100)
    expect(SYLLABLE_RHYTHM.guidance.breathMs).toBeLessThanOrEqual(300)
  })

  it('guides fully at first, fades after, and never goes away altogether', () => {
    const { fullForWords, fadeOverWords, faintest } = SYLLABLE_RHYTHM.guidance

    expect(guidanceStrength(0)).toBe(1)
    expect(guidanceStrength(fullForWords)).toBe(1)
    expect(guidanceStrength(fullForWords + Math.round(fadeOverWords / 2))).toBeLessThan(1)
    expect(guidanceStrength(fullForWords + fadeOverWords)).toBe(faintest)
    expect(guidanceStrength(500)).toBe(faintest)
    for (let word = 1; word < 40; word += 1) expect(guidanceStrength(word)).toBeLessThanOrEqual(guidanceStrength(word - 1))
  })
})

describe('the demonstration', () => {
  const mountain = SYLLABLE_CORPUS.find((entry) => entry.word === 'mountain')!
  const important = SYLLABLE_CORPUS.find((entry) => entry.word === 'important')!
  const { demo } = SYLLABLE_RHYTHM

  it('shows the word whole, pulls it apart, types a syllable, breathes, types the next, and closes it up', () => {
    const { steps } = buildDemoTimeline([mountain])
    const phases = steps.map((step) => (step.phase === 'type' ? `type${step.syllable}` : step.phase))

    expect(phases).toEqual([
      'whole', 'chunk',
      'type0', 'type0', 'type0', 'type0',
      'breath',
      'type1', 'type1', 'type1', 'type1',
      'resolve', 'rest',
    ])
  })

  it('types one letter at a time, never more than the word has', () => {
    const { steps } = buildDemoTimeline([important])
    const typed = steps.filter((step) => step.phase === 'type').map((step) => step.typed)

    expect(typed).toEqual(Array.from({ length: 'important'.length }, (_, index) => index + 1))
  })

  it('breathes after every syllable but the last', () => {
    const { steps } = buildDemoTimeline([important])

    expect(steps.filter((step) => step.phase === 'breath').map((step) => step.syllable)).toEqual([0, 1])
  })

  it('makes the technique plain in about two seconds of a word', () => {
    const { steps } = buildDemoTimeline([mountain])
    // Whole, apart, moun, breath, tain: everything up to the word being resolved.
    const shown = steps.find((step) => step.phase === 'resolve')!.at

    expect(shown).toBeGreaterThan(1500)
    expect(shown).toBeLessThan(2500)
  })

  it('runs on its own clock: each step starts where the one before ended', () => {
    const timeline = buildDemoTimeline([mountain, important])

    timeline.steps.forEach((step, index) => {
      const next = timeline.steps[index + 1]
      if (next !== undefined) expect(next.at).toBe(step.at + step.durationMs)
    })
    expect(timeline.durationMs).toBe(timeline.steps.at(-1)!.at + timeline.steps.at(-1)!.durationMs)
    expect(timeline.steps.at(-1)!.durationMs).toBe(demo.loopRestMs)
  })

  it('lights each instruction as it happens: chunk, type one, pause, type the next', () => {
    const { steps } = buildDemoTimeline([mountain])
    const cues = steps.map(cueOf).filter((cue, index, all) => cue !== null && cue !== all[index - 1])

    expect(cues).toEqual(['chunk', 'type', 'pause', 'next'])
  })
})

describe("the trainer's text", () => {
  const sequence = (values: number[]) => {
    let index = 0
    return () => values[index++ % values.length] as number
  }

  it('is words the corpus knows the syllables of, so every one can be shown in chunks', () => {
    const provider = createSyllableWordsProvider()
    const known = new Set(SYLLABLE_CORPUS.map((entry) => entry.word))
    const target = provider.provide({ wordCount: 60 })

    expect(target.sourceId).toBe(SYLLABLE_WORDS_PROVIDER_ID)
    expect(target.text.split(' ')).toHaveLength(60)
    expect(target.text.split(' ').every((word) => known.has(word))).toBe(true)
    expect(layoutSyllables(target.text).every((starts) => starts.length >= 2)).toBe(true)
  })

  it('is the same text for the same draws', () => {
    const draws = [0.1, 0.72, 0.33, 0.9, 0.05, 0.5]
    const first = createSyllableWordsProvider({ random: sequence(draws) }).provide({ wordCount: 20 })
    const second = createSyllableWordsProvider({ random: sequence(draws) }).provide({ wordCount: 20 })

    expect(first).toEqual(second)
  })
})

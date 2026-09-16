/**
 * Golden Nuggets: when a word goes in, how records are merged, and that they
 * survive a reload.
 */

import { describe, expect, it } from 'vitest'

import { createMemoryAdapter, STORAGE_KEYS } from '@core/persistence'

import { createMistakeTally } from './mistakes.ts'
import { applyFocusOutcome, nuggetIdOf, testsOf } from './merge.ts'
import { createGoldenNuggetService } from './service.ts'
import type { GoldenNugget, HoverFocusOutcome } from './types.ts'

const outcome = (overrides: Partial<HoverFocusOutcome> = {}): HoverFocusOutcome => ({
  word: 'because',
  language: 'en',
  difficulty: 'standard',
  cleared: false,
  mistakes: 2,
  at: 1_000,
  testId: 'test-1',
  ...overrides,
})

describe('Golden Nugget rules', () => {
  it('adds a word released without clearing', () => {
    const { nuggets, changed } = applyFocusOutcome([], outcome())

    expect(nuggets).toEqual([changed])
    expect(changed).toEqual({
      id: 'en:because',
      word: 'because',
      language: 'en',
      timesUnresolved: 1,
      hoverSessions: 1,
      tests: 1,
      mistakes: 2,
      firstSeenAt: 1_000,
      lastSeenAt: 1_000,
      lastDifficulty: 'standard',
      lastOutcome: 'unresolved',
      lastTestId: 'test-1',
    })
  })

  it('does not add a word that cleared', () => {
    expect(applyFocusOutcome([], outcome({ cleared: true }))).toEqual({ nuggets: [], changed: null })
  })

  it('keeps one record per word, whose counts rise', () => {
    let nuggets = applyFocusOutcome([], outcome()).nuggets
    nuggets = applyFocusOutcome(nuggets, outcome({ testId: 'test-2', at: 2_000, mistakes: 3, difficulty: 'all-in' })).nuggets
    nuggets = applyFocusOutcome(nuggets, outcome({ testId: 'test-3', at: 3_000, mistakes: 1, difficulty: 'tired' })).nuggets

    expect(nuggets).toHaveLength(1)
    expect(nuggets[0]).toMatchObject({
      timesUnresolved: 3,
      hoverSessions: 3,
      mistakes: 6,
      firstSeenAt: 1_000,
      lastSeenAt: 3_000,
      lastDifficulty: 'tired',
    })
  })

  it('counts a test once, however many times the word was focused in it', () => {
    let nuggets = applyFocusOutcome([], outcome()).nuggets
    nuggets = applyFocusOutcome(nuggets, outcome({ at: 1_500 })).nuggets

    expect(nuggets[0]).toMatchObject({ timesUnresolved: 2, hoverSessions: 1, mistakes: 4 })
  })

  it('updates an existing nugget when the word clears, without counting it as unresolved', () => {
    const nuggets = applyFocusOutcome([], outcome()).nuggets

    const { changed } = applyFocusOutcome(nuggets, outcome({ cleared: true, testId: 'test-2', at: 5_000, mistakes: 1 }))

    expect(changed).toMatchObject({ timesUnresolved: 1, hoverSessions: 2, mistakes: 3, lastOutcome: 'cleared', lastSeenAt: 5_000 })
  })

  it('treats different words as separate records, and the same word in any case as one', () => {
    let nuggets = applyFocusOutcome([], outcome({ word: 'because' })).nuggets
    nuggets = applyFocusOutcome(nuggets, outcome({ word: 'their' })).nuggets
    nuggets = applyFocusOutcome(nuggets, outcome({ word: 'Because', testId: 'test-2' })).nuggets

    expect(nuggets.map((nugget) => [nugget.word, nugget.timesUnresolved])).toEqual([
      ['because', 2],
      ['their', 1],
    ])
  })

  it('keeps a word apart in another language', () => {
    expect(nuggetIdOf('die', 'en')).not.toBe(nuggetIdOf('die', 'de'))

    let nuggets = applyFocusOutcome([], outcome({ word: 'die', language: 'en' })).nuggets
    nuggets = applyFocusOutcome(nuggets, outcome({ word: 'die', language: 'de' })).nuggets

    expect(nuggets).toHaveLength(2)
  })
})

describe('Golden Nugget storage', () => {
  it('survives a reload: a new service reads back what the last one wrote', async () => {
    const storage = createMemoryAdapter()
    await createGoldenNuggetService(storage).recordFocus(outcome())

    const reloaded = createGoldenNuggetService(storage)

    await expect(reloaded.getAll()).resolves.toEqual([expect.objectContaining({ id: 'en:because', timesUnresolved: 1 })])
  })

  it('lists the most recently seen first', async () => {
    const service = createGoldenNuggetService(createMemoryAdapter())
    await service.recordFocus(outcome({ word: 'older', at: 1_000 }))
    await service.recordFocus(outcome({ word: 'newer', at: 2_000 }))

    expect((await service.getAll()).map((nugget) => nugget.word)).toEqual(['newer', 'older'])
  })

  it('loses no update when focuses end at the same moment', async () => {
    const service = createGoldenNuggetService(createMemoryAdapter())

    await Promise.all([
      service.recordFocus(outcome({ testId: 'a' })),
      service.recordFocus(outcome({ testId: 'b' })),
      service.recordFocus(outcome({ word: 'their', testId: 'c' })),
    ])

    const all = await service.getAll()
    expect(all.find((nugget) => nugget.word === 'because')).toMatchObject({ timesUnresolved: 2, hoverSessions: 2 })
    expect(all).toHaveLength(2)
  })

  it('writes nothing for an outcome that changes nothing', async () => {
    const storage = createMemoryAdapter()

    await expect(createGoldenNuggetService(storage).recordFocus(outcome({ cleared: true }))).resolves.toBeNull()

    await expect(storage.read(STORAGE_KEYS.goldenNuggets)).resolves.toBeNull()
  })

  it('drops malformed records from storage and keeps the rest', async () => {
    const storage = createMemoryAdapter()
    const good = applyFocusOutcome([], outcome()).nuggets[0]
    await storage.write(STORAGE_KEYS.goldenNuggets, [good, { id: 'en:x', word: 'x' }, 'nonsense', { ...good, lastDifficulty: 'extreme' }])

    await expect(createGoldenNuggetService(storage).getAll()).resolves.toEqual([good])
  })

  it('reads a store that is not a list as empty', async () => {
    const storage = createMemoryAdapter()
    await storage.write(STORAGE_KEYS.goldenNuggets, { because: 1 })

    await expect(createGoldenNuggetService(storage).getAll()).resolves.toEqual([])
  })
})

describe('a word that keeps costing mistakes', () => {
  const trouble = (fields: Partial<HoverFocusOutcome> = {}): HoverFocusOutcome => ({
    reason: 'mistakes',
    word: 'because',
    language: 'en',
    cleared: false,
    mistakes: 5,
    at: 2_000,
    testId: 'test-9',
    ...fields,
  })

  it('becomes a nugget with no Hover Mode history behind it', () => {
    const { changed } = applyFocusOutcome([], trouble())

    expect(changed).toEqual({
      id: 'en:because',
      word: 'because',
      language: 'en',
      // It was never focused, so nothing about focuses is claimed.
      timesUnresolved: 0,
      hoverSessions: 0,
      tests: 1,
      mistakes: 5,
      firstSeenAt: 2_000,
      lastSeenAt: 2_000,
      lastDifficulty: null,
      lastOutcome: 'unresolved',
      lastTestId: 'test-9',
    })
  })

  it('adds to the record a word already has, without claiming a focus', () => {
    const { nuggets } = applyFocusOutcome([], outcome({ mistakes: 3 }))

    const { changed } = applyFocusOutcome(nuggets, trouble())

    expect(changed).toMatchObject({
      timesUnresolved: 1,
      hoverSessions: 1,
      tests: 2,
      mistakes: 8,
      // The last focus is still the last thing that happened to it in Hover Mode.
      lastDifficulty: 'standard',
      lastOutcome: 'unresolved',
      lastSeenAt: 2_000,
    })
  })

  it('counts one test once, however many words cross in it', () => {
    const first = applyFocusOutcome([], trouble({ testId: 'test-9' })).nuggets
    const again = applyFocusOutcome(first, trouble({ testId: 'test-9', at: 2_500 })).nuggets

    expect(again[0]).toMatchObject({ tests: 1, mistakes: 10, lastSeenAt: 2_500 })
  })

  it('reads a record written before ordinary tests could keep a word', () => {
    const old = { ...(applyFocusOutcome([], outcome()).changed as GoldenNugget) }
    delete (old as { tests?: number }).tests

    expect(testsOf(old)).toBe(old.hoverSessions)
  })
})

describe('counting mistakes towards a nugget', () => {
  it('keeps a word on the fifth mistake, and only then', () => {
    const tally = createMistakeTally()

    expect([1, 2, 3, 4].map(() => tally.note('because'))).toEqual([null, null, null, null])
    expect(tally.note('because')).toBe('because')
    // Every mistake after it is still counted, and says nothing more.
    expect(tally.note('because')).toBeNull()
    expect(tally.countOf('because')).toBe(6)
  })

  it('counts each word on its own', () => {
    const tally = createMistakeTally()

    for (const word of ['because', 'through', 'because']) tally.note(word)

    expect(tally.countOf('because')).toBe(2)
    expect(tally.countOf('through')).toBe(1)
    expect(tally.crossed()).toEqual([])
  })

  it('starts again with a new test', () => {
    const tally = createMistakeTally()
    for (let i = 0; i < 4; i += 1) tally.note('because')

    tally.reset()

    expect(tally.countOf('because')).toBe(0)
    expect(tally.note('because')).toBeNull()
  })

  it('takes a threshold of its own, for anything that wants one', () => {
    const tally = createMistakeTally(2)

    expect(tally.note('because')).toBeNull()
    expect(tally.note('because')).toBe('because')
  })

  it('says nothing about a mistake that belongs to no word', () => {
    expect(createMistakeTally(1).note('')).toBeNull()
  })
})

/**
 * Golden Nuggets: when a word goes in, how records are merged, and that they
 * survive a reload.
 */

import { describe, expect, it } from 'vitest'

import { createMemoryAdapter, STORAGE_KEYS } from '@core/persistence'

import { applyFocusOutcome, nuggetIdOf } from './merge.ts'
import { createGoldenNuggetService } from './service.ts'
import type { HoverFocusOutcome } from './types.ts'

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

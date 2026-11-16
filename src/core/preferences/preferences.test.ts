/**
 * The preferences record: the blob, the moment it was chosen, and which of the
 * two ways it was written.
 *
 * Small, but it carries the one distinction the whole of settings syncing
 * rests on — a choice made here is silent, a record from the account is
 * announced — so it is worth saying out loud what each does.
 */

import { describe, expect, it } from 'vitest'

import { createMemoryAdapter, STORAGE_KEYS } from '@core/persistence'

import { createPreferencesRecord } from './index.ts'

const record = () => createPreferencesRecord(createMemoryAdapter())

describe('reading the preferences record', () => {
  it('answers nothing, and no time, for a browser that has never saved one', async () => {
    expect(await record().read()).toEqual({ data: null, updatedAt: 0 })
  })

  it('gives back exactly what was written, untouched', async () => {
    const kept = record()
    // Not inspected field by field anywhere here: what a valid theme is
    // belongs to the settings, which check whatever they are given.
    await kept.write({ theme: 'flow-mint', soundSamples: { start: 'a' } }, 5_000)

    expect(await kept.read()).toEqual({
      data: { theme: 'flow-mint', soundSamples: { start: 'a' } },
      updatedAt: 5_000,
    })
  })

  it('reads a record written before the time was kept as never having been chosen', async () => {
    // Every typist who used this before settings followed them about has one
    // of these: the preferences, and no time beside them.
    const adapter = createMemoryAdapter()
    await adapter.write(STORAGE_KEYS.preferences, { theme: 'flow-mint' })

    expect(await createPreferencesRecord(adapter).read()).toEqual({
      data: { theme: 'flow-mint' },
      updatedAt: 0,
    })
  })

  it('ignores a time that is not one', async () => {
    const adapter = createMemoryAdapter()
    await adapter.write(STORAGE_KEYS.preferences, { theme: 'flow-mint' })
    for (const nonsense of [{ at: 'yesterday' }, { at: -1 }, { at: Number.NaN }, 'not an object', null]) {
      // oxlint-disable-next-line no-await-in-loop
      await adapter.write(STORAGE_KEYS.preferencesSaved, nonsense)
      // oxlint-disable-next-line no-await-in-loop
      expect([nonsense, (await createPreferencesRecord(adapter).read()).updatedAt]).toEqual([nonsense, 0])
    }
  })

  it('keeps the preferences and their time apart, so an old record still reads', async () => {
    const adapter = createMemoryAdapter()
    await createPreferencesRecord(adapter).write({ theme: 'flow-mint' }, 5_000)

    // The preferences stay a bare object under their own key, exactly as they
    // were before the time existed. Wrapping them would have read as empty on
    // the next load and reset everyone's settings.
    expect(await adapter.read(STORAGE_KEYS.preferences)).toEqual({ theme: 'flow-mint' })
    expect(await adapter.read(STORAGE_KEYS.preferencesSaved)).toEqual({ at: 5_000 })
  })
})

describe('telling a choice made here from one that arrived', () => {
  it('says nothing about a choice made on this browser', async () => {
    const kept = record()
    const heard: unknown[] = []
    kept.subscribe((stored) => heard.push(stored))

    await kept.write({ theme: 'flow-mint' }, 5_000)

    // The typist made this choice and watched it happen; telling the settings
    // about it again only risks their undoing it.
    expect(heard).toEqual([])
  })

  it('announces one that arrived from the account', async () => {
    const kept = record()
    const heard: unknown[] = []
    kept.subscribe((stored) => heard.push(stored))

    await kept.arrive({ theme: 'paper' }, 9_000)

    expect(heard).toEqual([{ data: { theme: 'paper' }, updatedAt: 9_000 }])
    expect(await kept.read()).toEqual({ data: { theme: 'paper' }, updatedAt: 9_000 })
  })

  it('announces it whatever its age, the decision having been made elsewhere', async () => {
    const kept = record()
    await kept.write({ theme: 'flow-mint' }, 9_000)
    const heard: unknown[] = []
    kept.subscribe((stored) => heard.push(stored))

    // Older, and still applied: a second person signing in on a shared browser
    // must be given their own settings even though the first person's are
    // newer. Whether it should have been sent is the syncing's business.
    await kept.arrive({ theme: 'paper' }, 1_000)

    expect(heard).toHaveLength(1)
    expect((await kept.read()).data).toEqual({ theme: 'paper' })
  })

  it('stops telling a listener that has gone away', async () => {
    const kept = record()
    const heard: unknown[] = []
    const stop = kept.subscribe((stored) => heard.push(stored))

    stop()
    await kept.arrive({ theme: 'paper' }, 9_000)

    expect(heard).toEqual([])
  })
})

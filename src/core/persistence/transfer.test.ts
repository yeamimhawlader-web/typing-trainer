/**
 * Packing a browser's worth of practice into a file, and putting it back.
 */

import { describe, expect, it } from 'vitest'

import { createMemoryAdapter } from './adapters/memory.adapter.ts'
import { withNamespace } from './namespace.ts'
import { packStored, readTransferFile, restoreStored, TRANSFER_FORMAT, TransferError } from './transfer.ts'
import type { StorageAdapter } from './types.ts'

const VERSION = 1

const storageWith = async (entries: Readonly<Record<string, unknown>>): Promise<StorageAdapter> => {
  const storage = withNamespace(createMemoryAdapter(), { namespace: 'typing-trainer', schemaVersion: VERSION })
  // Sequential on purpose: these stand in for a browser filling up over time.
  // oxlint-disable-next-line no-await-in-loop
  for (const [key, value] of Object.entries(entries)) await storage.write(key, value)
  return storage
}

describe('packing a typist’s data', () => {
  it('takes every key the application owns, whatever they are', async () => {
    const storage = await storageWith({
      preferences: { caret: 'bar' },
      'golden-nuggets': [{ word: 'rhythm' }],
      'session:17': { wpm: 61 },
    })

    const file = await packStored(storage, VERSION, () => new Date('2026-11-16T10:00:00Z'))

    expect(file.format).toBe(TRANSFER_FORMAT)
    expect(file.schemaVersion).toBe(VERSION)
    expect(file.savedAt).toBe('2026-11-16T10:00:00.000Z')
    expect(Object.keys(file.entries)).toEqual(['golden-nuggets', 'preferences', 'session:17'])
    expect(file.entries['preferences']).toEqual({ caret: 'bar' })
  })

  it('packs an untouched browser without complaint', async () => {
    const file = await packStored(await storageWith({}), VERSION)

    expect(file.entries).toEqual({})
  })
})

describe('putting a file back', () => {
  it('reproduces the browser it came from, and says how much it wrote', async () => {
    const file = await packStored(await storageWith({ preferences: { caret: 'bar' }, 'library-texts': ['one'] }), VERSION)
    const fresh = await storageWith({})

    expect(await restoreStored(file, fresh)).toBe(2)
    expect(await fresh.read('preferences')).toEqual({ caret: 'bar' })
    expect(await fresh.read('library-texts')).toEqual(['one'])
  })

  it('replaces what was there rather than merging with it', async () => {
    const file = await packStored(await storageWith({ preferences: { caret: 'bar' } }), VERSION)
    const busy = await storageWith({ preferences: { caret: 'block' }, 'golden-nuggets': ['stale'] })

    await restoreStored(file, busy)

    expect(await busy.read('preferences')).toEqual({ caret: 'bar' })
    // The nuggets were not in the file, so they are not in the browser either.
    expect(await busy.read('golden-nuggets')).toBeNull()
    expect(await busy.keys()).toEqual(['preferences'])
  })

  it('leaves data belonging to anything else on the origin alone', async () => {
    const shared = createMemoryAdapter()
    await shared.write('somebody-else:v1:notes', 'not ours')
    const ours = withNamespace(shared, { namespace: 'typing-trainer', schemaVersion: VERSION })
    await ours.write('preferences', { caret: 'block' })

    await restoreStored(await packStored(await storageWith({}), VERSION), ours)

    expect(await shared.read('somebody-else:v1:notes')).toBe('not ours')
  })
})

describe('refusing a file it cannot restore', () => {
  const good = { format: TRANSFER_FORMAT, schemaVersion: VERSION, savedAt: '', entries: {} }

  it('accepts its own', () => {
    expect(readTransferFile(good, VERSION).schemaVersion).toBe(VERSION)
  })

  it.each([
    ['something that is not a file at all', 'a string'],
    ['a list', []],
    ['nothing', null],
    ['another application’s JSON', { format: 'some-other-app', entries: {} }],
    ['a file with no version', { ...good, schemaVersion: 'one' }],
    ['a file whose data is damaged', { ...good, entries: 'gone' }],
  ])('refuses %s', (_, value) => {
    expect(() => readTransferFile(value, VERSION)).toThrow(TransferError)
  })

  it('says to update when the file is newer than the site', () => {
    expect(() => readTransferFile({ ...good, schemaVersion: VERSION + 1 }, VERSION)).toThrow(/newer version/u)
  })

  it('says plainly when the file is older than the site keeps', () => {
    expect(() => readTransferFile({ ...good, schemaVersion: VERSION - 1 }, VERSION)).toThrow(/older version/u)
  })

  it('touches nothing when the file is refused', async () => {
    const storage = await storageWith({ preferences: { caret: 'block' } })

    expect(() => readTransferFile({ format: 'wrong' }, VERSION)).toThrow(TransferError)
    expect(await storage.read('preferences')).toEqual({ caret: 'block' })
  })
})

/*
 * Now that signing in is possible, a backup file is a file that could carry a
 * session token -- and these files get emailed to oneself, dropped in cloud
 * folders and handed between machines. Anyone holding one would be signed in
 * as the person who made it.
 *
 * It cannot, because the storage this reads through is scoped to this
 * application's own prefix and the sign-in library keeps its token outside it.
 * That is worth a test rather than a comment: it is one decorator away from
 * being untrue, and nothing else in the file would notice.
 */
describe('what a backup must never carry', () => {
  /** The real thing: supabase-js keys its session `sb-<project ref>-auth-token`. */
  const SUPABASE_KEYS = {
    'sb-abcdefghijkl-auth-token': {
      access_token: 'a-real-session',
      refresh_token: 'and-its-refresh',
    },
    'sb-abcdefghijkl-auth-token-code-verifier': 'the-pkce-verifier',
  }

  const browserWith = async (
    ours: Readonly<Record<string, unknown>>,
  ): Promise<{
    readonly whole: StorageAdapter
    readonly ours: StorageAdapter
  }> => {
    const whole = createMemoryAdapter()
    const scoped = withNamespace(whole, { namespace: 'typing-trainer', schemaVersion: VERSION })
    // oxlint-disable-next-line no-await-in-loop
    for (const [key, value] of Object.entries(SUPABASE_KEYS)) await whole.write(key, value)
    // oxlint-disable-next-line no-await-in-loop
    for (const [key, value] of Object.entries(ours)) await scoped.write(key, value)
    return { whole, ours: scoped }
  }

  it('leaves the sign-in token out of the file entirely', async () => {
    const browser = await browserWith({ preferences: { caret: 'bar' } })

    const file = await packStored(
      browser.ours,
      VERSION,
      () => new Date('2026-11-16T10:00:00Z'),
    )

    expect(Object.keys(file.entries)).toEqual(['preferences'])
    // Searched as text as well, so a token nested inside some other value
    // would be caught too, not only one under a key of its own.
    expect(JSON.stringify(file)).not.toContain('a-real-session')
    expect(JSON.stringify(file)).not.toContain('the-pkce-verifier')
  })

  it('does not sign the typist out when a file is restored over their browser', async () => {
    const browser = await browserWith({ preferences: { caret: 'bar' } })
    const file = await packStored(
      browser.ours,
      VERSION,
      () => new Date('2026-11-16T10:00:00Z'),
    )

    await restoreStored(
      readTransferFile(JSON.parse(JSON.stringify(file)), VERSION),
      browser.ours,
    )

    // Restoring clears first; it must clear this application's keys and stop.
    expect(await browser.whole.read('sb-abcdefghijkl-auth-token')).toEqual(
      SUPABASE_KEYS['sb-abcdefghijkl-auth-token'],
    )
  })
})

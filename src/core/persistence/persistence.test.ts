/**
 * One contract, run against every adapter.
 *
 * This is the point of the abstraction: when the IndexedDB adapter arrives, it
 * is added to the table below and must pass the identical suite. Any behaviour
 * an adapter is allowed to differ on does not belong in the interface.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { createLocalStorageAdapter } from './adapters/local-storage.adapter.ts'
import { createMemoryAdapter } from './adapters/memory.adapter.ts'
import { buildKeyPrefix, withNamespace } from './namespace.ts'
import type { StorageAdapter } from './types.ts'

const adapters: ReadonlyArray<readonly [string, () => StorageAdapter]> = [
  ['memory', createMemoryAdapter],
  ['localStorage', createLocalStorageAdapter],
]

describe.each(adapters)('StorageAdapter contract: %s', (_name, createAdapter) => {
  let adapter: StorageAdapter

  beforeEach(async () => {
    window.localStorage.clear()
    adapter = createAdapter()
    await adapter.clear()
  })

  it('returns null for a key that was never written', async () => {
    await expect(adapter.read('absent')).resolves.toBeNull()
  })

  it('round-trips a nested object without changing its shape', async () => {
    const value = { theme: 'dark', nested: { counts: [1, 2, 3], ok: true } }

    await adapter.write('prefs', value)

    await expect(adapter.read('prefs')).resolves.toEqual(value)
  })

  it('overwrites an existing key rather than merging', async () => {
    await adapter.write('key', { a: 1, b: 2 })
    await adapter.write('key', { a: 9 })

    await expect(adapter.read('key')).resolves.toEqual({ a: 9 })
  })

  it('does not alias stored objects to the caller reference', async () => {
    const value = { count: 1 }
    await adapter.write('mutable', value)

    value.count = 999

    await expect(adapter.read<typeof value>('mutable')).resolves.toEqual({ count: 1 })
  })

  it('removes a key', async () => {
    await adapter.write('doomed', 'value')
    await adapter.remove('doomed')

    await expect(adapter.read('doomed')).resolves.toBeNull()
  })

  it('treats removing an absent key as a no-op', async () => {
    await expect(adapter.remove('never-existed')).resolves.toBeUndefined()
  })

  it('lists written keys', async () => {
    await adapter.write('alpha', 1)
    await adapter.write('beta', 2)

    await expect(adapter.keys()).resolves.toEqual(
      expect.arrayContaining(['alpha', 'beta']),
    )
  })

  it('empties the store on clear', async () => {
    await adapter.write('alpha', 1)
    await adapter.clear()

    await expect(adapter.keys()).resolves.toEqual([])
  })

  it('preserves falsy values instead of confusing them with absence', async () => {
    await adapter.write('zero', 0)
    await adapter.write('false', false)
    await adapter.write('empty', '')

    await expect(adapter.read('zero')).resolves.toBe(0)
    await expect(adapter.read('false')).resolves.toBe(false)
    await expect(adapter.read('empty')).resolves.toBe('')
  })
})

describe('withNamespace', () => {
  const options = { namespace: 'typing-trainer', schemaVersion: 1 }

  beforeEach(() => {
    window.localStorage.clear()
  })

  it('prefixes physical keys with the namespace and schema version', async () => {
    const namespaced = withNamespace(createLocalStorageAdapter(), options)

    await namespaced.write('preferences', { theme: 'dark' })

    expect(window.localStorage.getItem('typing-trainer:v1:preferences')).toBe(
      JSON.stringify({ theme: 'dark' }),
    )
  })

  it('presents logical keys, without the prefix, to callers', async () => {
    const namespaced = withNamespace(createLocalStorageAdapter(), options)

    await namespaced.write('preferences', 1)

    await expect(namespaced.keys()).resolves.toEqual(['preferences'])
  })

  it('hides keys belonging to other namespaces', async () => {
    window.localStorage.setItem('someone-else:v1:data', '"not ours"')
    const namespaced = withNamespace(createLocalStorageAdapter(), options)

    await namespaced.write('ours', 1)

    await expect(namespaced.keys()).resolves.toEqual(['ours'])
    await expect(namespaced.read('data')).resolves.toBeNull()
  })

  it('clears only its own keys, leaving the rest of the origin intact', async () => {
    window.localStorage.setItem('someone-else:v1:data', '"not ours"')
    const namespaced = withNamespace(createLocalStorageAdapter(), options)
    await namespaced.write('ours', 1)

    await namespaced.clear()

    expect(window.localStorage.getItem('someone-else:v1:data')).toBe('"not ours"')
    await expect(namespaced.keys()).resolves.toEqual([])
  })

  it('separates data written under different schema versions', async () => {
    const v1 = withNamespace(createLocalStorageAdapter(), options)
    const v2 = withNamespace(createLocalStorageAdapter(), {
      ...options,
      schemaVersion: 2,
    })

    await v1.write('preferences', { theme: 'dark' })

    await expect(v2.read('preferences')).resolves.toBeNull()
  })

  it('builds a stable, inspectable key prefix', () => {
    expect(buildKeyPrefix(options)).toBe('typing-trainer:v1:')
  })
})

describe('localStorage adapter resilience', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('treats a corrupt value as missing and evicts it', async () => {
    const adapter = createLocalStorageAdapter()
    window.localStorage.setItem('broken', '{ this is not json')

    await expect(adapter.read('broken')).resolves.toBeNull()
    expect(window.localStorage.getItem('broken')).toBeNull()
  })
})

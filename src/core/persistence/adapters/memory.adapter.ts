/**
 * In-memory adapter.
 *
 * Used by tests and as the fallback when browser storage is unavailable
 * (private browsing, storage disabled by policy). Values are structurally
 * cloned on the way in and out, so a caller mutating an object it wrote cannot
 * corrupt what is "stored" — the same guarantee a real store gives.
 */

import type { StorageAdapter } from '../types.ts'

export const createMemoryAdapter = (): StorageAdapter => {
  const store = new Map<string, string>()

  return {
    read: <T>(key: string): Promise<T | null> => {
      const raw = store.get(key)
      if (raw === undefined) return Promise.resolve(null)
      return Promise.resolve(JSON.parse(raw) as T)
    },

    write: <T>(key: string, value: T): Promise<void> => {
      store.set(key, JSON.stringify(value))
      return Promise.resolve()
    },

    remove: (key: string): Promise<void> => {
      store.delete(key)
      return Promise.resolve()
    },

    keys: (): Promise<string[]> => Promise.resolve([...store.keys()]),

    clear: (): Promise<void> => {
      store.clear()
      return Promise.resolve()
    },
  }
}

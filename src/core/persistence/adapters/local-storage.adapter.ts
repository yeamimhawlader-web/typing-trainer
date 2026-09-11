/**
 * localStorage adapter — the default store today.
 *
 * Chosen because it is synchronous, universally available, and adequate for
 * preferences and a modest session history. It is explicitly *not* adequate for
 * the full keystroke archive this product will accumulate; when that lands, an
 * IndexedDB adapter implements the same interface and the factory swaps it in.
 *
 * Failure policy: a corrupt value is treated as missing and evicted rather than
 * thrown. A single bad key written by an old build should never be able to stop
 * a typist from practising.
 */

import { PersistenceError, type StorageAdapter } from '../types.ts'

/**
 * Probes for a genuinely usable localStorage. Presence of the object is not
 * enough — Safari private mode exposes it and throws on write.
 */
export const isLocalStorageAvailable = (): boolean => {
  try {
    const probe = '__typing_trainer_probe__'
    window.localStorage.setItem(probe, probe)
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

export const createLocalStorageAdapter = (): StorageAdapter => {
  const storage = window.localStorage

  return {
    read: <T>(key: string): Promise<T | null> => {
      const raw = storage.getItem(key)
      if (raw === null) return Promise.resolve(null)

      try {
        return Promise.resolve(JSON.parse(raw) as T)
      } catch {
        // Unreadable value: evict it so the next write starts clean.
        storage.removeItem(key)
        return Promise.resolve(null)
      }
    },

    write: <T>(key: string, value: T): Promise<void> => {
      try {
        storage.setItem(key, JSON.stringify(value))
        return Promise.resolve()
      } catch (cause) {
        return Promise.reject(
          new PersistenceError(
            `Failed to write "${key}" to localStorage. The quota may be exhausted.`,
            { cause, key },
          ),
        )
      }
    },

    remove: (key: string): Promise<void> => {
      storage.removeItem(key)
      return Promise.resolve()
    },

    keys: (): Promise<string[]> => {
      const result: string[] = []
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index)
        if (key !== null) result.push(key)
      }
      return Promise.resolve(result)
    },

    clear: (): Promise<void> => {
      // Note: the namespace decorator narrows this to our own keys. Calling
      // clear() on a bare adapter would wipe the whole origin, which is why
      // application code always goes through createStorage().
      storage.clear()
      return Promise.resolve()
    },
  }
}

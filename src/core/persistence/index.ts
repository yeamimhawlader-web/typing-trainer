/**
 * Public entry point for persistence.
 *
 * What exists today: a namespaced key/value store.
 * What does not exist yet, by design: repositories, migrations, an IndexedDB
 * adapter, and any session-history query API. Those are built on this contract
 * when there is session data to justify them — see DEVELOPMENT.md.
 */

export type { Serialisable, StorageAdapter } from './types.ts'
export { PersistenceError } from './types.ts'
export type { PersistenceErrorOptions } from './types.ts'

export { createStorage, storage } from './storage.ts'
export type { CreateStorageOptions } from './storage.ts'

export { buildKeyPrefix, withNamespace } from './namespace.ts'
export type { NamespaceOptions } from './namespace.ts'

export { createMemoryAdapter } from './adapters/memory.adapter.ts'
export {
  createLocalStorageAdapter,
  isLocalStorageAvailable,
} from './adapters/local-storage.adapter.ts'

/** Storage keys in use. Centralised so collisions are visible at a glance. */
export const STORAGE_KEYS = {
  preferences: 'preferences',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

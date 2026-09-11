/**
 * Storage composition: picks an adapter, applies namespacing, degrades safely.
 *
 * `createStorage` takes explicit options so it can be driven from a test with
 * no globals involved. `storage` is the single configured instance the
 * application uses; features import that rather than constructing their own,
 * so there is exactly one place where the backing store is decided.
 */

import { appConfig, type PersistenceDriver } from '@config'

import {
  createLocalStorageAdapter,
  isLocalStorageAvailable,
} from './adapters/local-storage.adapter.ts'
import { createMemoryAdapter } from './adapters/memory.adapter.ts'
import { withNamespace, type NamespaceOptions } from './namespace.ts'
import type { StorageAdapter } from './types.ts'

export interface CreateStorageOptions extends NamespaceOptions {
  readonly driver: PersistenceDriver
}

const selectAdapter = (driver: PersistenceDriver): StorageAdapter => {
  if (driver === 'memory') return createMemoryAdapter()

  if (!isLocalStorageAvailable()) {
    // Private browsing or a locked-down policy. Practising without history is
    // a far better outcome than refusing to start.
    console.warn(
      '[persistence] localStorage is unavailable; falling back to in-memory storage. Data will not survive a reload.',
    )
    return createMemoryAdapter()
  }

  return createLocalStorageAdapter()
}

export const createStorage = (options: CreateStorageOptions): StorageAdapter =>
  withNamespace(selectAdapter(options.driver), {
    namespace: options.namespace,
    schemaVersion: options.schemaVersion,
  })

/** The application's configured storage. */
export const storage: StorageAdapter = createStorage(appConfig.persistence)

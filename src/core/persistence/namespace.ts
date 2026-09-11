/**
 * Namespacing decorator.
 *
 * Wraps any StorageAdapter so that every key is prefixed with
 * `<namespace>:v<schemaVersion>:`. Two things fall out of this for free:
 *
 *   - `keys()` and `clear()` are scoped to this application's data, so clearing
 *     preferences cannot wipe unrelated data on the same origin.
 *   - The schema version is visible in the key itself, which makes a future
 *     migration a matter of reading old-prefix keys and writing new-prefix ones.
 *
 * Implemented as a decorator rather than baked into each adapter so that every
 * adapter — present and future — inherits the behaviour without repeating it.
 */

import type { StorageAdapter } from './types.ts'

export interface NamespaceOptions {
  readonly namespace: string
  readonly schemaVersion: number
}

export const buildKeyPrefix = ({
  namespace,
  schemaVersion,
}: NamespaceOptions): string => `${namespace}:v${schemaVersion}:`

export const withNamespace = (
  adapter: StorageAdapter,
  options: NamespaceOptions,
): StorageAdapter => {
  const prefix = buildKeyPrefix(options)
  const toPhysical = (key: string): string => `${prefix}${key}`

  return {
    read: <T>(key: string) => adapter.read<T>(toPhysical(key)),

    write: <T>(key: string, value: T) => adapter.write<T>(toPhysical(key), value),

    remove: (key: string) => adapter.remove(toPhysical(key)),

    keys: async (): Promise<string[]> => {
      const all = await adapter.keys()
      return all
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length))
    },

    clear: async (): Promise<void> => {
      const owned = await adapter.keys()
      await Promise.all(
        owned.filter((key) => key.startsWith(prefix)).map((key) => adapter.remove(key)),
      )
    },
  }
}

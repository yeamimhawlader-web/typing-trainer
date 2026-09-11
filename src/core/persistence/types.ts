/**
 * The persistence contract.
 *
 * Deliberately tiny: a key/value store of JSON-serialisable values. Everything
 * richer — repositories, queries, indexes — is built *on top of* this, not into
 * it, so that swapping the underlying store stays a one-file change.
 *
 * Two decisions worth stating outright:
 *
 * 1. Every method is async, even though the only adapter shipping today
 *    (localStorage) is synchronous. IndexedDB and a server-backed store are
 *    both async, and retrofitting async onto synchronous call sites later means
 *    touching every caller. Paying that cost now costs nothing.
 *
 * 2. The adapter owns serialisation. Callers hand over objects and get objects
 *    back. A future adapter storing structured records natively should not
 *    force every caller to keep JSON-stringifying for no reason.
 */

/** Values that survive a round trip through JSON without changing shape. */
export type Serialisable =
  | string
  | number
  | boolean
  | null
  | readonly Serialisable[]
  | { readonly [key: string]: Serialisable }

export interface StorageAdapter {
  /** Returns the stored value, or null when the key is absent or unreadable. */
  read<T>(key: string): Promise<T | null>
  write<T>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
  /** All keys currently held, without any namespace prefix. */
  keys(): Promise<string[]>
  /** Removes every key this adapter owns. Never touches keys it does not. */
  clear(): Promise<void>
}

export interface PersistenceErrorOptions {
  readonly cause?: unknown
  /** The key being read or written when the failure happened, when known. */
  readonly key?: string
}

/** Raised when a store fails in a way the caller could reasonably handle. */
export class PersistenceError extends Error {
  override readonly name = 'PersistenceError'
  readonly key: string | undefined

  constructor(message: string, options?: PersistenceErrorOptions) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.key = options?.key
  }
}

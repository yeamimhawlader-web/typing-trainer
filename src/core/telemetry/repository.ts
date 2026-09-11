/**
 * Where telemetry is kept — and why it is kept apart from sessions.
 *
 * ## The size problem
 *
 * A session record is roughly 400 bytes. Its telemetry, in the compact form, is
 * roughly 14 kB per thousand characters typed — a 60-word test is about 4 kB,
 * ten times the record it belongs to. Twenty tests a day is around 90 kB a day,
 * or 30 MB a year, against the roughly 5 MB `localStorage` allows in total.
 *
 * So telemetry cannot simply be a field on `TypingSession`:
 *
 * - it would multiply the cost of the history by ten, and `getAll()` would
 *   deserialise every keystroke of every session to draw a list of dates;
 * - a quota failure while saving telemetry would take the session record down
 *   with it, losing the result over data that is merely nice to have;
 * - and the existing persisted sessions would have to change shape.
 *
 * ## The decision
 *
 * Telemetry lives in its own repository, keyed by session id, behind its own
 * interface. `TypingSession` is untouched, so every session already on disk
 * stays valid and loads exactly as before. A session simply either has
 * telemetry or does not, and old ones do not — which is the truth, rather than
 * a fabricated empty record.
 *
 * Retention is capped: the most recent `RETENTION_LIMIT` sessions keep their
 * telemetry and older blobs are dropped. That bounds storage at a few hundred
 * kilobytes whatever the history does, and the cap is the honest expression of
 * what `localStorage` can hold.
 *
 * ## Moving to IndexedDB
 *
 * This is the layer that should move, and it can move alone. Either an
 * IndexedDB `StorageAdapter` passes the existing contract suite and is handed
 * to `createTelemetryRepository`, or a native implementation satisfies
 * `TelemetryRepository` directly. Neither touches the typing engine, the
 * session repository, or any screen — which is the whole point of putting the
 * interface here. The retention cap is then a policy choice rather than a
 * storage limit.
 */

import type { StorageAdapter } from '@core/persistence'
import type { SessionId } from '@core/types'

import { parseStoredTelemetry } from './encode.ts'
import type { StoredTelemetry } from './types.ts'

const TELEMETRY_KEY_PREFIX = 'telemetry:'
const INDEX_KEY = 'telemetry-index'

/**
 * How many sessions keep their telemetry.
 *
 * Fifty tests is a few weeks of daily practice and roughly 200 kB — enough to
 * study recent typing, small enough that it cannot crowd out the history it
 * describes.
 */
export const RETENTION_LIMIT = 50

const keyFor = (id: SessionId | string): string => `${TELEMETRY_KEY_PREFIX}${id}`

export interface TelemetryRepository {
  save(sessionId: SessionId, telemetry: StoredTelemetry): Promise<void>
  getById(sessionId: SessionId): Promise<StoredTelemetry | null>
  remove(sessionId: SessionId): Promise<void>
  clear(): Promise<void>
  /** Session ids that currently have telemetry, oldest first. */
  listIds(): Promise<readonly string[]>
}

export interface TelemetryRepositoryOptions {
  readonly retentionLimit?: number
}

export const createTelemetryRepository = (
  storage: StorageAdapter,
  options: TelemetryRepositoryOptions = {},
): TelemetryRepository => {
  const retentionLimit = options.retentionLimit ?? RETENTION_LIMIT

  // Same read-modify-write hazard as the session index, and the same answer:
  // overlapping writes would each rebuild the list from the same starting point
  // and lose one another's entries.
  let queue: Promise<unknown> = Promise.resolve()

  const serialise = <T>(operation: () => Promise<T>): Promise<T> => {
    const run = queue.then(operation, operation)
    queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  /** Session ids in save order, oldest first. */
  const readIndex = async (): Promise<string[]> => {
    const stored = await storage.read<unknown>(INDEX_KEY)
    if (!Array.isArray(stored)) return []
    return stored.filter((id): id is string => typeof id === 'string' && id.length > 0)
  }

  return {
    save: (sessionId, telemetry) =>
      serialise(async () => {
        await storage.write(keyFor(sessionId), telemetry)

        const index = await readIndex()
        const next = [...index.filter((id) => id !== sessionId), String(sessionId)]

        // Drop the oldest blobs past the cap. Their sessions keep their
        // results; only the keystroke detail ages out.
        const evicted = next.slice(0, Math.max(0, next.length - retentionLimit))
        await Promise.all(evicted.map((id) => storage.remove(keyFor(id))))

        await storage.write(INDEX_KEY, next.slice(-retentionLimit))
      }),

    getById: async (sessionId) =>
      parseStoredTelemetry(await storage.read<unknown>(keyFor(sessionId))),

    remove: (sessionId) =>
      serialise(async () => {
        await storage.remove(keyFor(sessionId))
        const index = await readIndex()
        await storage.write(
          INDEX_KEY,
          index.filter((id) => id !== sessionId),
        )
      }),

    clear: () =>
      serialise(async () => {
        // From the keys present rather than the index, so a blob the index lost
        // track of still goes.
        const keys = await storage.keys()
        await Promise.all(
          keys
            .filter((key) => key.startsWith(TELEMETRY_KEY_PREFIX))
            .map((key) => storage.remove(key)),
        )
        await storage.remove(INDEX_KEY)
      }),

    listIds: () => readIndex(),
  }
}

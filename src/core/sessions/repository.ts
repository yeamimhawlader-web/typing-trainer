/**
 * Session storage over the key/value `StorageAdapter`.
 *
 * Layout: one key per session, plus a small index listing ids newest first.
 *
 * The index is the reason this is not simply "one array under one key". A
 * single array means every save rewrites the entire history — after a year of
 * daily practice that is megabytes rewritten to record one test — and reading
 * the ten most recent means deserialising all of them. With an index, a save
 * writes two small values and `getRecent(10)` reads eleven.
 *
 * The index is a cache of an ordering, not the source of truth: records are
 * authoritative. Where the two disagree the records win, in both directions:
 * an entry pointing at a record that is gone is dropped, and a valid record the
 * index has lost track of is put back. See `reconcileIndex`.
 */

import type { StorageAdapter } from '@core/persistence'
import type { SessionId } from '@core/types'

import { parseTypingSession, assertValidSession } from './validation.ts'
import type { SessionRepository, TypingSession } from './types.ts'

const SESSION_KEY_PREFIX = 'session:'
const INDEX_KEY = 'session-index'

const keyFor = (id: SessionId | string): string => `${SESSION_KEY_PREFIX}${id}`

interface IndexEntry {
  readonly id: string
  readonly completedAt: number
}

const isIndexEntry = (value: unknown): value is IndexEntry => {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry['id'] === 'string' &&
    entry['id'].length > 0 &&
    typeof entry['completedAt'] === 'number' &&
    Number.isFinite(entry['completedAt'])
  )
}

/** Newest first; ties broken by id so the order is total and reproducible. */
const byNewest = (a: IndexEntry, b: IndexEntry): number =>
  b.completedAt - a.completedAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)

export const createSessionRepository = (storage: StorageAdapter): SessionRepository => {
  /**
   * Serialises everything that rewrites the index.
   *
   * Updating the index is read-modify-write, so two overlapping saves would
   * each read the same starting point and write back their own version — and
   * one of the two sessions would vanish from the listing while its record sat
   * there unreferenced. Tests aside, this is reachable from two tabs open on
   * the same origin.
   *
   * Reads are not queued: they take a consistent snapshot of whatever is
   * committed at the time.
   */
  let queue: Promise<unknown> = Promise.resolve()

  const serialise = <T>(operation: () => Promise<T>): Promise<T> => {
    const run = queue.then(operation, operation)
    // Swallowed here only so one failed write does not poison the queue for
    // every write after it; the caller still receives the original rejection.
    queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  const writeIndex = (entries: readonly IndexEntry[]): Promise<void> =>
    storage.write(INDEX_KEY, [...entries].sort(byNewest))

  /**
   * The index, repaired from the records actually present if it has lost track
   * of any of them.
   *
   * The index is only a cache of an ordering; the records are the history. But
   * the index is what every read goes through, so an index that is missing,
   * corrupted, or short of entries makes real sessions invisible — and the next
   * save used to write a fresh index containing only itself, turning a
   * recoverable glitch into permanent loss. The audit reproduced exactly that:
   * three valid records orphaned by one save.
   *
   * So before the index is trusted it is checked against the session keys that
   * exist. Records the index does not list are read, validated, and put back;
   * malformed ones are left out rather than guessed at; entries pointing at
   * records that no longer exist are dropped. When nothing is wrong this costs
   * one listing of keys and writes nothing.
   *
   * Always called inside `serialise`, because repairing is a write.
   */
  const reconcileIndex = async (): Promise<IndexEntry[]> => {
    const stored = await storage.read<unknown>(INDEX_KEY)
    const listed = Array.isArray(stored) ? stored.filter(isIndexEntry) : []
    const damaged =
      stored !== null && (!Array.isArray(stored) || listed.length !== stored.length)

    const recordIds = (await storage.keys())
      .filter((key) => key.startsWith(SESSION_KEY_PREFIX))
      .map((key) => key.slice(SESSION_KEY_PREFIX.length))
    const present = new Set(recordIds)
    const indexed = new Set(listed.map((entry) => entry.id))

    const unlisted = recordIds.filter((id) => !indexed.has(id))
    const dangling = listed.filter((entry) => !present.has(entry.id))

    if (!damaged && unlisted.length === 0 && dangling.length === 0) {
      return listed.sort(byNewest)
    }

    const recovered = (
      await Promise.all(unlisted.map((id) => storage.read<unknown>(keyFor(id))))
    )
      .map((record) => parseTypingSession(record))
      .filter((session): session is TypingSession => session !== null)
      .map((session) => ({ id: session.id, completedAt: session.completedAt }))

    const repaired = [...listed.filter((entry) => present.has(entry.id)), ...recovered]
    await writeIndex(repaired)

    if (recovered.length > 0 || damaged) {
      console.warn(
        `[sessions] rebuilt the session index: ${recovered.length} recovered, ${dangling.length} stale entries dropped`,
      )
    }

    return repaired.sort(byNewest)
  }

  /** Reads records for ids, dropping any that are missing or malformed. */
  const readMany = async (
    entries: readonly IndexEntry[],
  ): Promise<readonly TypingSession[]> => {
    const records = await Promise.all(
      entries.map((entry) => storage.read<unknown>(keyFor(entry.id))),
    )

    return records
      .map((record) => parseTypingSession(record))
      .filter((session): session is TypingSession => session !== null)
  }

  return {
    // `async` matters here. Validation runs before the queue so a malformed
    // session is rejected immediately rather than behind whatever is in
    // flight — but it has to surface as a *rejection*, not a synchronous
    // throw, or a caller's `.catch()` would never be attached and the error
    // would escape as an unhandled exception.
    save: async (session) => {
      assertValidSession(session)

      return serialise(async () => {
        // The record first: if the index write fails, the data still exists and
        // the next successful save repairs the ordering. The reverse order
        // would leave the index pointing at nothing.
        await storage.write(keyFor(session.id), session)

        // Reconciled, not merely read: a save must never write a fresh index
        // over a damaged one and orphan the history it failed to list.
        const entries = await reconcileIndex()
        const without = entries.filter((entry) => entry.id !== session.id)
        await writeIndex([
          ...without,
          { id: session.id, completedAt: session.completedAt },
        ])
      })
    },

    getById: async (id) => parseTypingSession(await storage.read<unknown>(keyFor(id))),

    getRecent: async (limit) => {
      if (limit <= 0) return []
      return readMany((await serialise(reconcileIndex)).slice(0, limit))
    },

    getAll: async () => readMany(await serialise(reconcileIndex)),

    count: async () => (await serialise(reconcileIndex)).length,

    remove: (id) =>
      serialise(async () => {
        await storage.remove(keyFor(id))
        const entries = await reconcileIndex()
        await writeIndex(entries.filter((entry) => entry.id !== id))
      }),

    clear: () =>
      serialise(async () => {
        // Driven from the keys actually present rather than from the index, so
        // that a record the index has lost track of is still removed.
        const keys = await storage.keys()
        await Promise.all(
          keys
            .filter((key) => key.startsWith(SESSION_KEY_PREFIX))
            .map((key) => storage.remove(key)),
        )
        await storage.remove(INDEX_KEY)
      }),
  }
}

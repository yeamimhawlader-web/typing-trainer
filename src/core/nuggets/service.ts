/**
 * Where Golden Nuggets are kept.
 *
 * One key holding the whole list. A typist's nuggets are a few dozen short
 * records at most — far smaller than a single test's telemetry — so one read
 * and one write per change is simpler than an index and costs nothing.
 *
 * Writes happen when a Hover Mode focus ends, never on a keystroke, and are
 * serialised: two focuses ending close together each read the list as the other
 * left it, rather than both starting from the same list and one losing the
 * other's change.
 *
 * What comes off disk is checked record by record. A malformed record is dropped
 * and the rest kept, the way the session history treats a bad row.
 */

import { STORAGE_KEYS, type StorageAdapter } from '@core/persistence'
import { HOVER_DIFFICULTIES } from '@core/types'

import { applyFocusOutcome, byLastSeen } from './merge.ts'
import type { GoldenNugget, HoverFocusOutcome } from './types.ts'

export interface GoldenNuggetService {
  /** Most recently seen first. */
  getAll(): Promise<readonly GoldenNugget[]>
  /**
   * Records how a focus ended. Resolves with the nugget created or updated, or
   * null when the outcome changed nothing — a word that cleared and was never a
   * nugget.
   */
  recordFocus(outcome: HoverFocusOutcome): Promise<GoldenNugget | null>
  clear(): Promise<void>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0

export const parseGoldenNugget = (value: unknown): GoldenNugget | null => {
  if (!isRecord(value)) return null
  const texts = ['id', 'word', 'language', 'lastTestId'] as const
  const counts = ['timesUnresolved', 'hoverSessions', 'mistakes', 'firstSeenAt', 'lastSeenAt'] as const
  if (!texts.every((field) => isText(value[field]))) return null
  if (!counts.every((field) => isCount(value[field]))) return null
  const difficulty = value['lastDifficulty']
  // Null where the word has never been focused: mistakes alone made it a nugget.
  if (difficulty !== null && !(HOVER_DIFFICULTIES as readonly unknown[]).includes(difficulty)) return null
  if (value['lastOutcome'] !== 'cleared' && value['lastOutcome'] !== 'unresolved') return null
  return value as unknown as GoldenNugget
}

export const createGoldenNuggetService = (storage: StorageAdapter): GoldenNuggetService => {
  let queue: Promise<unknown> = Promise.resolve()

  const serialise = <T>(operation: () => Promise<T>): Promise<T> => {
    const run = queue.then(operation, operation)
    // One failed write must not stop every write after it; the caller still
    // receives the rejection.
    queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  const read = async (): Promise<GoldenNugget[]> => {
    const stored = await storage.read<unknown>(STORAGE_KEYS.goldenNuggets)
    if (!Array.isArray(stored)) return []
    const seen = new Set<string>()
    const nuggets: GoldenNugget[] = []
    for (const entry of stored) {
      const nugget = parseGoldenNugget(entry)
      // A duplicate id would only come from a store edited by hand; the first wins.
      if (nugget === null || seen.has(nugget.id)) continue
      seen.add(nugget.id)
      nuggets.push(nugget)
    }
    return nuggets
  }

  return {
    // Through the queue, so a read never sees a write half done.
    getAll: () => serialise(async () => (await read()).toSorted(byLastSeen)),

    recordFocus: (outcome) =>
      serialise(async () => {
        const { nuggets, changed } = applyFocusOutcome(await read(), outcome)
        if (changed !== null) await storage.write(STORAGE_KEYS.goldenNuggets, nuggets)
        return changed
      }),

    clear: () => serialise(() => storage.remove(STORAGE_KEYS.goldenNuggets)),
  }
}

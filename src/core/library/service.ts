/**
 * Where your own texts are kept.
 *
 * One key holding the list, as Golden Nuggets are: a few dozen short records,
 * so one read and one write per change is simpler than an index and costs
 * nothing. Writes are serialised, so two saves in quick succession each read
 * the list as the other left it.
 *
 * What comes off disk is checked record by record, and a malformed one is
 * dropped while the rest are kept — the way session history treats a bad row.
 * Bodies are cleaned on the way in, never on the way out: what is stored is
 * already typeable.
 */

import { STORAGE_KEYS, type StorageAdapter } from '@core/persistence'

import { cleanBody, cleanTitle, isTypeable } from './text.ts'
import { LIBRARY_KINDS, LIBRARY_RULES, type LibraryDraft, type LibraryKind, type LibraryText } from './types.ts'

export interface LibraryService {
  /** Most recently changed first. */
  getAll(): Promise<readonly LibraryText[]>
  get(id: string): Promise<LibraryText | null>
  /**
   * Adds a text, or replaces the one the draft names. Resolves with what was
   * stored, or null when there is nothing typeable in it.
   */
  save(draft: LibraryDraft, now?: number): Promise<LibraryText | null>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

export const parseLibraryText = (value: unknown): LibraryText | null => {
  if (!isRecord(value)) return null
  if (!['id', 'title', 'body'].every((field) => isText(value[field]))) return null
  if (!['createdAt', 'updatedAt'].every((field) => isTime(value[field]))) return null
  if (!(LIBRARY_KINDS as readonly unknown[]).includes(value['kind'])) return null
  return value as unknown as LibraryText
}

const newId = (): string =>
  // Same source of ids as a session's; a collision would need the same call twice.
  globalThis.crypto?.randomUUID?.() ?? `text-${Date.now()}-${Math.random().toString(36).slice(2)}`

export const createLibraryService = (storage: StorageAdapter): LibraryService => {
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

  const read = async (): Promise<LibraryText[]> => {
    const stored = await storage.read<unknown>(STORAGE_KEYS.libraryTexts)
    if (!Array.isArray(stored)) return []
    const seen = new Set<string>()
    const texts: LibraryText[] = []
    for (const entry of stored) {
      const text = parseLibraryText(entry)
      if (text === null || seen.has(text.id)) continue
      seen.add(text.id)
      texts.push(text)
    }
    return texts
  }

  const newest = (texts: readonly LibraryText[]): readonly LibraryText[] =>
    texts.toSorted((a, b) => b.updatedAt - a.updatedAt)

  return {
    getAll: () => serialise(async () => newest(await read())),

    get: (id) => serialise(async () => (await read()).find((text) => text.id === id) ?? null),

    save: (draft, now = Date.now()) =>
      serialise(async () => {
        const kind: LibraryKind = draft.kind
        const body = cleanBody(draft.body, kind)
        if (!isTypeable(body, kind)) return null

        const texts = await read()
        const existing = draft.id === undefined ? undefined : texts.find((text) => text.id === draft.id)
        const saved: LibraryText = {
          id: existing?.id ?? newId(),
          title: cleanTitle(draft.title, body),
          body,
          kind,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        }

        const rest = texts.filter((text) => text.id !== saved.id)
        // The oldest go first when the library is full: what someone keeps
        // adding to is what they are using.
        const kept = newest([saved, ...rest]).slice(0, LIBRARY_RULES.maxTexts)
        await storage.write(STORAGE_KEYS.libraryTexts, kept)
        return saved
      }),

    remove: (id) =>
      serialise(async () => {
        const texts = await read()
        const kept = texts.filter((text) => text.id !== id)
        if (kept.length !== texts.length) await storage.write(STORAGE_KEYS.libraryTexts, kept)
      }),

    clear: () => serialise(() => storage.remove(STORAGE_KEYS.libraryTexts)),
  }
}

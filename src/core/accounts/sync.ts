/**
 * Keeping a browser and an account level with each other.
 *
 * Local first, always: every test is written to this browser as it always was,
 * and syncing is a second copy made afterwards. Nothing in the typing loop
 * waits for a network, and signing out leaves everything here untouched.
 *
 * ## Why a record of the last round
 *
 * Comparing what is here with what is there cannot, on its own, tell a row
 * that was added somewhere else from a row that was deleted here — both are
 * "on one side only". So each round writes down the ids it ended with, for
 * that account, and the next round reads the difference against it:
 *
 * - here, not there, not in the record → added here → upload it
 * - here, not there, in the record → deleted there → delete it here
 * - there, not here, not in the record → added there → download it
 * - there, not here, in the record → deleted here → delete it there
 *
 * A first round has no record, so nothing counts as a deletion and the two
 * sides are merged: everything on either side ends up on both. That is what a
 * typist signing in on a second browser expects, and it is the only safe
 * reading of an empty record.
 *
 * Sessions never change once saved, so an id is the whole comparison. Texts
 * are edited, so where both sides have one, the later `updatedAt` wins.
 *
 * ## Someone else signing in on the same browser
 *
 * A record belongs to one account, and a record for another account used to
 * read as no record at all — a first round — so everything on the browser was
 * merged into whoever signed in next: the first person's whole history,
 * copied into the second person's account, for good.
 *
 * Now what the previous account had synced is *withheld*: it stays on the
 * browser, since its keystrokes live nowhere else and deleting it would lose
 * them, but it is never sent to the account that signed in after it. The new
 * account's own history comes down as usual, and anything typed on the browser
 * that never belonged to an account goes up as it always did. The withheld ids
 * are kept in the record, so every later round holds them back too, and they
 * are let go of the moment the account turns out to hold them — which is what
 * happens when the first person signs back in.
 *
 * ## What is not synced
 *
 * Telemetry — every keystroke of every test — stays on the device that
 * recorded it. It is by far the largest thing stored, it is read only by the
 * analyses on that device, and the session records carry every number the
 * history and statistics pages show. A session deleted from another browser
 * takes its telemetry here with it, through the same deletion the history page
 * uses, so nothing is left orphaned.
 *
 * Settings stay local too: text size, sound and theme belong to the machine
 * being typed on more than to the person.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { historyDeletion, type HistoryDeletion } from '@core/history'
import { libraryService, parseLibraryText, type LibraryService, type LibraryText } from '@core/library'
import { STORAGE_KEYS, type StorageAdapter } from '@core/persistence'
import { parseTypingSession, sessionService, type SessionService, type TypingSession } from '@core/sessions'
import { sessionId } from '@core/types'

import type { AccountService, SyncResult, SyncService } from './types.ts'

/** The tables the application expects; created by docs/SUPABASE.md. */
export const SESSIONS_TABLE = 'sessions'
export const TEXTS_TABLE = 'texts'

/** Rows in one request. Small enough to stay well inside any limit. */
const BATCH = 200

/** Ids on this browser that belong to another account, and are never sent to this one. */
interface Withheld {
  readonly sessions: readonly string[]
  readonly texts: readonly string[]
}

const NOTHING_WITHHELD: Withheld = { sessions: [], texts: [] }

/** What the last round ended with, for the account it ended with. */
interface SyncRecord {
  readonly accountId: string
  /** On both sides at the end of the round. */
  readonly sessions: readonly string[]
  readonly texts: readonly string[]
  /** Here only, and another account's. Absent from records written before there was a switch to guard. */
  readonly withheld: Withheld
}

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')

/** The record as written, for whichever account wrote it. */
const parseRecord = (value: unknown): SyncRecord | null => {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (typeof record['accountId'] !== 'string') return null
  if (!isStrings(record['sessions']) || !isStrings(record['texts'])) return null
  const withheld = record['withheld'] as Record<string, unknown> | undefined
  const held =
    withheld !== undefined && isStrings(withheld['sessions']) && isStrings(withheld['texts'])
      ? { sessions: withheld['sessions'], texts: withheld['texts'] }
      : NOTHING_WITHHELD
  return { accountId: record['accountId'], sessions: record['sessions'], texts: record['texts'], withheld: held }
}

/**
 * What this round knows and what it holds back, from the record the last round
 * left. The same account: its record, as before. Another account: nothing known
 * — so nothing reads as a deletion, as on any first round — and everything that
 * account had, or was itself holding back, withheld from this one.
 */
const startingFrom = (
  previous: SyncRecord | null,
  accountId: string,
): { readonly known: Withheld; readonly withheld: Withheld } => {
  if (previous === null) return { known: NOTHING_WITHHELD, withheld: NOTHING_WITHHELD }
  if (previous.accountId === accountId) {
    return { known: { sessions: previous.sessions, texts: previous.texts }, withheld: previous.withheld }
  }
  return {
    known: NOTHING_WITHHELD,
    withheld: {
      sessions: [...previous.sessions, ...previous.withheld.sessions],
      texts: [...previous.texts, ...previous.withheld.texts],
    },
  }
}

/**
 * Runs one after another, not all at once: these are requests to one table for
 * one account, where a burst buys nothing but rate limiting.
 */
const inSequence = <T>(items: readonly T[], run: (item: T) => Promise<void>): Promise<void> =>
  items.reduce((waiting: Promise<void>, item) => waiting.then(() => run(item)), Promise.resolve())

const inBatches = <T>(items: readonly T[], run: (batch: readonly T[]) => Promise<void>): Promise<void> => {
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += BATCH) batches.push(items.slice(index, index + BATCH))
  return inSequence(batches, run)
}

/** What Supabase answers with, in the shape this file reads. */
interface Answer<T> {
  readonly data: T[] | null
  readonly error: { readonly message: string } | null
}

/** Rows, or the error thrown: every answer is read exactly this way. */
const rowsOf = <T>(answer: Answer<T>): readonly T[] => {
  if (answer.error !== null) throw new Error(answer.error.message)
  return answer.data ?? []
}

const thrownIfFailed = (answer: { readonly error: { readonly message: string } | null }): void => {
  if (answer.error !== null) throw new Error(answer.error.message)
}

export interface SyncOptions {
  /** The client, which arrives with the library that is loaded on demand. */
  readonly client: Promise<SupabaseClient>
  readonly accounts: AccountService
  readonly storage: StorageAdapter
  /** Injectable for tests; default to the application's own. */
  readonly sessions?: SessionService
  readonly library?: LibraryService
  readonly deletion?: HistoryDeletion
}

export const createSyncService = ({
  client: arriving,
  accounts,
  storage,
  sessions = sessionService,
  library = libraryService,
  deletion = historyDeletion,
}: SyncOptions): SyncService => {
  const listeners = new Set<(result: SyncResult | null, error: Error | null) => void>()
  /** The round in flight, so a second call joins it rather than racing it. */
  let running: Promise<SyncResult | null> | null = null

  const announce = (result: SyncResult | null, error: Error | null): void => {
    for (const listener of listeners) listener(result, error)
  }

  const syncSessions = async (
    client: SupabaseClient,
    accountId: string,
    known: ReadonlySet<string>,
    held: ReadonlySet<string>,
  ): Promise<Pick<SyncResult, 'sessionsUp' | 'sessionsDown'> & { readonly withheld: readonly string[] }> => {
    const local = await sessions.getAll()
    // Plain strings on both sides: ids arrive from the network unbranded, and
    // the comparison is between the two sets, not between two domains.
    const localIds = new Set<string>(local.map((session) => session.id))
    const remoteIds = new Set(
      rowsOf<{ id: string }>(await client.from(SESSIONS_TABLE).select('id')).map((row) => row.id),
    )

    // Another account's, still here and not this account's: kept back. One the
    // account turns out to hold is this account's after all, and is let go.
    const withheld = [...held].filter((id) => localIds.has(id) && !remoteIds.has(id))
    const holding = new Set(withheld)
    const added = local.filter((session) => !remoteIds.has(session.id) && !known.has(session.id) && !holding.has(session.id))
    const deletedThere = [...localIds].filter((id) => !remoteIds.has(id) && known.has(id))
    const deletedHere = [...remoteIds].filter((id) => !localIds.has(id) && known.has(id))
    const waiting = [...remoteIds].filter((id) => !localIds.has(id) && !known.has(id))

    await inBatches(added, async (batch) => {
      thrownIfFailed(
        await client.from(SESSIONS_TABLE).upsert(
          batch.map((session) => ({
            id: session.id,
            user_id: accountId,
            completed_at: session.completedAt,
            data: session,
          })),
        ),
      )
    })

    await inBatches(deletedHere, async (batch) => {
      thrownIfFailed(await client.from(SESSIONS_TABLE).delete().in('id', [...batch]))
    })

    let pulled = 0
    await inBatches(waiting, async (batch) => {
      const stored = rowsOf<{ data: unknown }>(
        await client.from(SESSIONS_TABLE).select('data').in('id', [...batch]),
      )
      await inSequence(stored, async (row) => {
        // This came from outside the browser, so it is checked exactly as
        // anything read off disk is, and a broken record is passed over.
        const session: TypingSession | null = parseTypingSession(row.data)
        if (session !== null) {
          await sessions.save(session)
          pulled += 1
        }
      })
    })

    // Deleted on another browser: taken off this one through the same deletion
    // the history page uses, so the keystrokes go with the session.
    await inSequence(deletedThere, async (id) => {
      await deletion.deleteSession(sessionId(id))
    })

    return { sessionsUp: added.length, sessionsDown: pulled, withheld }
  }

  const syncTexts = async (
    client: SupabaseClient,
    accountId: string,
    known: ReadonlySet<string>,
    held: ReadonlySet<string>,
  ): Promise<Pick<SyncResult, 'textsUp' | 'textsDown'> & { readonly withheld: readonly string[] }> => {
    const local = await library.getAll()
    const localById = new Map(local.map((text) => [text.id, text]))
    const remote = rowsOf<{ id: string; updated_at: number }>(
      await client.from(TEXTS_TABLE).select('id, updated_at'),
    )
    const remoteById = new Map(remote.map((row) => [row.id, row.updated_at]))
    const withheld = [...held].filter((id) => localById.has(id) && !remoteById.has(id))
    const holding = new Set(withheld)

    const up = local.filter((text) => {
      const there = remoteById.get(text.id)
      // Absent there and never synced: new here. Absent and synced before:
      // deleted there, so it is not sent back up.
      return there === undefined ? !known.has(text.id) && !holding.has(text.id) : text.updatedAt > there
    })
    const down = remote.filter((row) => {
      const here = localById.get(row.id)
      return here === undefined ? !known.has(row.id) : row.updated_at > here.updatedAt
    })
    const deletedThere = [...localById.keys()].filter((id) => !remoteById.has(id) && known.has(id))
    const deletedHere = [...remoteById.keys()].filter((id) => !localById.has(id) && known.has(id))

    await inBatches(up, async (batch) => {
      thrownIfFailed(
        await client.from(TEXTS_TABLE).upsert(
          batch.map((text) => ({
            id: text.id,
            user_id: accountId,
            updated_at: text.updatedAt,
            data: text,
          })),
        ),
      )
    })

    await inBatches(deletedHere, async (batch) => {
      thrownIfFailed(await client.from(TEXTS_TABLE).delete().in('id', [...batch]))
    })

    let pulled = 0
    await inBatches(
      down.map((row) => row.id),
      async (batch) => {
        const stored = rowsOf<{ data: unknown }>(await client.from(TEXTS_TABLE).select('data').in('id', [...batch]))
        await inSequence(stored, async (row) => {
          const text: LibraryText | null = parseLibraryText(row.data)
          if (text !== null) {
            await library.put(text)
            pulled += 1
          }
        })
      },
    )

    await inSequence(deletedThere, (id) => library.remove(id))

    return { textsUp: up.length, textsDown: pulled, withheld }
  }

  const round = async (accountId: string): Promise<SyncResult> => {
    const client = await arriving
    const { known, withheld } = startingFrom(
      parseRecord(await storage.read<unknown>(STORAGE_KEYS.accountSync)),
      accountId,
    )

    const { withheld: sessionsHeld, ...sessionsMoved } = await syncSessions(
      client,
      accountId,
      new Set(known.sessions),
      new Set(withheld.sessions),
    )
    const { withheld: textsHeld, ...textsMoved } = await syncTexts(
      client,
      accountId,
      new Set(known.texts),
      new Set(withheld.texts),
    )

    // What both sides now hold, read back rather than worked out, so a record
    // that was refused or trimmed by storage is not remembered as kept. What is
    // withheld is here only, so it is kept apart from that: listed as held, it
    // is never mistaken next round for something deleted from the account.
    const holdingSessions = new Set(sessionsHeld)
    const holdingTexts = new Set(textsHeld)
    await storage.write(STORAGE_KEYS.accountSync, {
      accountId,
      sessions: (await sessions.getAll()).map((session) => session.id).filter((id) => !holdingSessions.has(id)),
      texts: (await library.getAll()).map((text) => text.id).filter((id) => !holdingTexts.has(id)),
      withheld: { sessions: sessionsHeld, texts: textsHeld },
    } satisfies SyncRecord)

    return { ...sessionsMoved, ...textsMoved }
  }

  return {
    syncNow: () => {
      if (running !== null) return running

      const state = accounts.state()
      if (state.status !== 'signed-in') return Promise.resolve(null)

      const flight: Promise<SyncResult | null> = round(state.account.id).then(
        (result) => {
          running = null
          announce(result, null)
          return result
        },
        (cause: unknown) => {
          running = null
          const error = cause instanceof Error ? cause : new Error(String(cause))
          // A failed round leaves both sides as they were and is tried again
          // next time; the typist is told, and typing carries on regardless.
          console.warn('[accounts] sync failed', error)
          announce(null, error)
          return null
        },
      )
      running = flight
      return flight
    },

    syncing: () => running !== null,

    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/**
 * Accounts and syncing, over fakes of the two things that are not ours: the
 * database, and what Google says about a person.
 *
 * The sync tests are where the care is. Syncing is the one part of this
 * application that can lose a typist's work, and the way it loses it is always
 * the same: mistaking "added somewhere else" for "deleted here". So every one
 * of those four cases has a test of its own, in both directions, and the first
 * round — where there is no record of a previous one — is held to merging
 * rather than deleting.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'

import { createTypingEngine } from '@core/engine'
import { createLibraryService, type LibraryService, type LibraryText } from '@core/library'
import { createMemoryAdapter, type StorageAdapter } from '@core/persistence'
import {
  createSessionServiceOver,
  createTypingSession,
  DEFAULT_SESSION_CONTEXT,
  type SessionService,
  type TypingSession,
} from '@core/sessions'
import { sessionId, timestamp } from '@core/types'
import { createTelemetryServiceOver } from '@core/telemetry'
import { createHistoryDeletion } from '@core/history'

import { accountOf, createAccountService, createUnavailableAccountService } from './service.ts'
import { createSyncService, SESSIONS_TABLE, TEXTS_TABLE } from './sync.ts'
import type { AccountService, AccountState } from './types.ts'

// --- A database, in memory ---------------------------------------------

interface Row {
  readonly id: string
  readonly user_id: string
  readonly completed_at?: number
  readonly updated_at?: number
  readonly data: unknown
}

/** Only the columns this application asks for. */
const project = (row: Row, columns: string): Record<string, unknown> =>
  Object.fromEntries(
    columns
      .split(',')
      .map((column) => column.trim())
      .map((column) => [column, (row as unknown as Record<string, unknown>)[column]]),
  )

const fakeDatabase = () => {
  const tables = new Map<string, Map<string, Row>>([
    [SESSIONS_TABLE, new Map()],
    [TEXTS_TABLE, new Map()],
  ])
  /** Set to make the next request fail, as a network does. */
  let failWith: string | null = null

  const rowsOf = (name: string): Map<string, Row> => {
    const table = tables.get(name)
    if (table === undefined) throw new Error(`no table ${name}`)
    return table
  }

  const answer = <T>(data: T[]) =>
    failWith === null ? { data, error: null } : { data: null, error: { message: failWith } }

  const client = {
    from: (name: string) => ({
      select: (columns: string) => {
        const all = [...rowsOf(name).values()].map((row) => project(row, columns))
        const whole = Promise.resolve(answer(all))
        return Object.assign(whole, {
          in: (_column: string, ids: readonly string[]) =>
            Promise.resolve(
              answer([...rowsOf(name).values()].filter((row) => ids.includes(row.id)).map((row) => project(row, columns))),
            ),
        })
      },
      upsert: (incoming: readonly Row[]) => {
        if (failWith !== null) return Promise.resolve({ error: { message: failWith } })
        for (const row of incoming) rowsOf(name).set(row.id, row)
        return Promise.resolve({ error: null })
      },
      delete: () => ({
        in: (_column: string, ids: readonly string[]) => {
          if (failWith !== null) return Promise.resolve({ error: { message: failWith } })
          for (const id of ids) rowsOf(name).delete(id)
          return Promise.resolve({ error: null })
        },
      }),
    }),
  }

  return {
    client: client as unknown as SupabaseClient,
    rows: (name: string) => [...rowsOf(name).values()],
    put: (name: string, row: Row) => rowsOf(name).set(row.id, row),
    fail: (message: string | null) => {
      failWith = message
    },
  }
}

// --- An account -------------------------------------------------------

const ACCOUNT = { id: 'account-1', email: 'typist@example.com', name: 'A Typist', pictureUrl: null }

const signedIn = (): AccountService => ({
  available: true,
  state: (): AccountState => ({ status: 'signed-in', account: ACCOUNT }),
  subscribe: () => () => undefined,
  signInWithGoogle: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
})

// --- Records ----------------------------------------------------------

/** A real typed test, since a session is checked field by field on the way in. */
const TYPED = (() => {
  const engine = createTypingEngine()
  engine.start({ text: 'alpha bravo', sourceId: 'fixed' }, timestamp(0))
  Array.from('alpha bravo').forEach((key, index) => engine.input(key, timestamp((index + 1) * 90)))
  const result = engine.toResult()
  if (result === null) throw new Error('the test text was not finished')
  return result
})()

const session = (id: string, completedAt = 1000): TypingSession => ({
  ...createTypingSession({ result: TYPED, context: DEFAULT_SESSION_CONTEXT, completedAt: timestamp(completedAt) }),
  id: sessionId(id),
})

const text = (id: string, updatedAt: number, body = 'a passage worth typing'): LibraryText => ({
  id,
  title: `Text ${id}`,
  body,
  kind: 'passage',
  createdAt: 1,
  updatedAt,
})

describe('who is signed in', () => {
  it('reads a name and a picture from whichever field Google used', () => {
    expect(
      accountOf({ id: 'a', email: 'x@y.z', user_metadata: { full_name: 'A Typist', avatar_url: 'http://p/1' } } as unknown as User),
    ).toEqual({ id: 'a', email: 'x@y.z', name: 'A Typist', pictureUrl: 'http://p/1' })

    expect(
      accountOf({ id: 'a', email: 'x@y.z', user_metadata: { name: 'Other', picture: 'http://p/2' } } as unknown as User),
    ).toEqual({ id: 'a', email: 'x@y.z', name: 'Other', pictureUrl: 'http://p/2' })
  })

  it('leaves out what is missing, rather than inventing it', () => {
    expect(accountOf({ id: 'a', user_metadata: {} } as unknown as User)).toEqual({
      id: 'a',
      email: null,
      name: null,
      pictureUrl: null,
    })
  })

  it('answers the same state object every time where there is nothing to sign in to', () => {
    const accounts = createUnavailableAccountService()

    // React compares what this returns with what it returned last time; a new
    // object each call is a change each call, and renders without end.
    expect(accounts.state()).toBe(accounts.state())
    expect(accounts.available).toBe(false)
  })

  it('follows the session the client reports, and tells whoever is listening', async () => {
    let report: (event: string, session: { user: User } | null) => void = () => undefined
    const client = {
      auth: {
        onAuthStateChange: (listener: typeof report) => {
          report = listener
        },
        signOut: () => Promise.resolve({ error: null }),
      },
    } as unknown as SupabaseClient

    const accounts = createAccountService(Promise.resolve(client))
    // The client arrives on a later turn, exactly as the loaded library does.
    await Promise.resolve()
    const seen: AccountState[] = []
    accounts.subscribe((state) => seen.push(state))

    expect(accounts.state()).toEqual({ status: 'loading' })

    report('SIGNED_IN', { user: { id: 'account-1', email: 'x@y.z', user_metadata: { name: 'A' } } as unknown as User })
    expect(accounts.state()).toEqual({ status: 'signed-in', account: { id: 'account-1', email: 'x@y.z', name: 'A', pictureUrl: null } })

    report('SIGNED_OUT', null)
    expect(accounts.state()).toEqual({ status: 'signed-out' })
    expect(seen).toHaveLength(2)

    await accounts.signOut()
  })
})

describe('bringing a browser and an account level', () => {
  let database: ReturnType<typeof fakeDatabase>
  let storage: StorageAdapter
  let sessions: SessionService
  let library: LibraryService
  let sync: ReturnType<typeof createSyncService>

  const build = (accounts: AccountService = signedIn()) => {
    const adapter = createMemoryAdapter()
    storage = createMemoryAdapter()
    sessions = createSessionServiceOver(adapter)
    library = createLibraryService(adapter)
    const telemetry = createTelemetryServiceOver(adapter)
    sync = createSyncService({
      client: Promise.resolve(database.client),
      accounts,
      storage,
      sessions,
      library,
      deletion: createHistoryDeletion(sessions, telemetry),
    })
  }

  beforeEach(() => {
    database = fakeDatabase()
    build()
  })

  it('does nothing at all when nobody is signed in', async () => {
    build({ ...signedIn(), state: () => ({ status: 'signed-out' }) })
    await sessions.save(session('local-1'))

    expect(await sync.syncNow()).toBeNull()
    expect(database.rows(SESSIONS_TABLE)).toEqual([])
  })

  it('merges both sides the first time, taking nothing for a deletion', async () => {
    await sessions.save(session('here', 2000))
    database.put(SESSIONS_TABLE, { id: 'there', user_id: ACCOUNT.id, completed_at: 3000, data: session('there', 3000) })

    const result = await sync.syncNow()

    expect(result).toMatchObject({ sessionsUp: 1, sessionsDown: 1 })
    expect(database.rows(SESSIONS_TABLE).map((row) => row.id).toSorted()).toEqual(['here', 'there'])
    expect((await sessions.getAll()).map((stored) => stored.id).toSorted()).toEqual(['here', 'there'])
  })

  it('sends a test typed after the last round, and brings back one typed elsewhere', async () => {
    await sync.syncNow()

    await sessions.save(session('typed-here', 4000))
    database.put(SESSIONS_TABLE, { id: 'typed-there', user_id: ACCOUNT.id, completed_at: 5000, data: session('typed-there', 5000) })

    expect(await sync.syncNow()).toMatchObject({ sessionsUp: 1, sessionsDown: 1 })
    expect(database.rows(SESSIONS_TABLE)).toHaveLength(2)
    expect(await sessions.getAll()).toHaveLength(2)
  })

  it('takes a test deleted here off the account, instead of downloading it again', async () => {
    await sessions.save(session('doomed'))
    await sync.syncNow()

    await sessions.remove(sessionId('doomed'))
    const result = await sync.syncNow()

    expect(database.rows(SESSIONS_TABLE)).toEqual([])
    expect(await sessions.getAll()).toEqual([])
    expect(result?.sessionsDown).toBe(0)
  })

  it('takes a test deleted on another browser off this one', async () => {
    await sessions.save(session('doomed'))
    await sync.syncNow()

    database.fail(null)
    await database.client.from(SESSIONS_TABLE).delete().in('id', ['doomed'])
    await sync.syncNow()

    expect(await sessions.getAll()).toEqual([])
    // And not sent straight back up as though it were new here.
    expect(database.rows(SESSIONS_TABLE)).toEqual([])
  })

  it('keeps the later version of a text, whichever side it was edited on', async () => {
    await library.put(text('mine', 1000, 'the first version of this passage'))
    await sync.syncNow()

    // Edited here.
    await library.put(text('mine', 2000, 'the second version of this passage'))
    await sync.syncNow()
    expect(database.rows(TEXTS_TABLE)[0]?.updated_at).toBe(2000)

    // Edited somewhere else.
    database.put(TEXTS_TABLE, {
      id: 'mine',
      user_id: ACCOUNT.id,
      updated_at: 3000,
      data: text('mine', 3000, 'the third version of this passage'),
    })
    await sync.syncNow()

    expect((await library.get('mine'))?.body).toBe('the third version of this passage')
  })

  it('passes over a row that is not a record it knows, and keeps the rest', async () => {
    database.put(TEXTS_TABLE, { id: 'broken', user_id: ACCOUNT.id, updated_at: 1, data: { id: 'broken' } })
    database.put(TEXTS_TABLE, { id: 'good', user_id: ACCOUNT.id, updated_at: 1, data: text('good', 1) })

    await sync.syncNow()

    expect((await library.getAll()).map((stored) => stored.id)).toEqual(['good'])
  })

  it('joins a round already running rather than starting a second', async () => {
    await sessions.save(session('one'))

    const first = sync.syncNow()
    const second = sync.syncNow()

    expect(second).toBe(first)
    await first
    expect(sync.syncing()).toBe(false)
  })

  it('leaves both sides as they were when the network says no, and says so', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await sessions.save(session('local'))
    database.fail('network unreachable')

    const failures: (Error | null)[] = []
    sync.subscribe((_result, error) => failures.push(error))

    expect(await sync.syncNow()).toBeNull()
    expect(failures[0]?.message).toBe('network unreachable')
    // Still here, still typeable; the next round tries again.
    expect(await sessions.getAll()).toHaveLength(1)
    expect(await storage.read('account-sync')).toBeNull()

    database.fail(null)
    expect(await sync.syncNow()).toMatchObject({ sessionsUp: 1 })
  })
})

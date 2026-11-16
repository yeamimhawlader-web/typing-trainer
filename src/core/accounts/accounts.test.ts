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

const ACCOUNT_ID = 'account-1'

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
  /*
   * Who the request is coming from, and the whole of row-level security: the
   * policies in docs/SUPABASE.md mean a request only ever sees its own rows.
   * Without that here, every account in a test could see every other account's
   * rows, and a test would pass on evidence the real database would never give.
   */
  let asAccount = ACCOUNT_ID

  const rowsOf = (name: string): Map<string, Row> => {
    const table = tables.get(name)
    if (table === undefined) throw new Error(`no table ${name}`)
    return table
  }

  /** Off when a test wants to know what happens if the server forgets its rules. */
  let rowLevelSecurity = true

  const mine = (name: string): Row[] =>
    [...rowsOf(name).values()].filter((row) => !rowLevelSecurity || row.user_id === asAccount)

  const answer = <T>(data: T[]) =>
    failWith === null ? { data, error: null } : { data: null, error: { message: failWith } }

  /** A column's value on a row, for the filters below. */
  const valueOf = (row: Row, column: string): unknown => (row as unknown as Record<string, unknown>)[column]

  const client = {
    from: (name: string) => ({
      select: (columns: string) => {
        // Awaitable at any point, and narrowed by each filter in turn, which is
        // how the real client behaves and what lets a query name its owner.
        const query = (rows: readonly Row[]): unknown =>
          Object.assign(Promise.resolve(answer(rows.map((row) => project(row, columns)))), {
            eq: (column: string, value: unknown) => query(rows.filter((row) => valueOf(row, column) === value)),
            in: (column: string, values: readonly string[]) =>
              query(rows.filter((row) => values.includes(String(valueOf(row, column))))),
          })
        return query(mine(name))
      },
      upsert: (incoming: readonly Row[]) => {
        if (failWith !== null) return Promise.resolve({ error: { message: failWith } })
        for (const row of incoming) {
          // The insert policy's check: a row may only be written as its owner.
          if (row.user_id !== asAccount) return Promise.resolve({ error: { message: 'row-level security' } })
          rowsOf(name).set(row.id, row)
        }
        return Promise.resolve({ error: null })
      },
      delete: () => {
        const query = (rows: readonly Row[]): unknown => ({
          eq: (column: string, value: unknown) => query(rows.filter((row) => valueOf(row, column) === value)),
          in: (column: string, values: readonly string[]) => {
            if (failWith !== null) return Promise.resolve({ error: { message: failWith } })
            for (const row of rows) if (values.includes(String(valueOf(row, column)))) rowsOf(name).delete(row.id)
            return Promise.resolve({ error: null })
          },
        })
        return query(mine(name))
      },
    }),
  }

  return {
    client: client as unknown as SupabaseClient,
    rows: (name: string) => [...rowsOf(name).values()],
    put: (name: string, row: Row) => rowsOf(name).set(row.id, row),
    /** Whose request it is from here on, as signing in as someone else would be. */
    signedInAs: (id: string) => {
      asAccount = id
    },
    fail: (message: string | null) => {
      failWith = message
    },
    /**
     * Serves every row to everybody, as a project whose policies were never
     * applied would: a table rebuilt by hand, a migration half run, a restore
     * from before the rules existed.
     */
    forgetRowLevelSecurity: () => {
      rowLevelSecurity = false
    },
  }
}

// --- An account -------------------------------------------------------

const ACCOUNT = { id: ACCOUNT_ID, email: 'typist@example.com', name: 'A Typist', pictureUrl: null }

const signedIn = (): AccountService => ({
  available: true,
  state: (): AccountState => ({ status: 'signed-in', account: ACCOUNT }),
  subscribe: () => () => undefined,
  signInWithEmail: () => Promise.resolve(),
  signInWithGoogle: () => Promise.resolve(),
  googleOffered: true,
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


  it('sends a link to an address, and asks for it back at the page that asked', async () => {
    const asked: unknown[] = []
    const client = {
      auth: {
        onAuthStateChange: () => undefined,
        signInWithOtp: (options: unknown) => {
          asked.push(options)
          return Promise.resolve({ error: null })
        },
      },
    } as unknown as SupabaseClient

    const accounts = createAccountService(Promise.resolve(client))
    await accounts.signInWithEmail('typist@example.com', 'https://hover.test/gg/sign-in')

    expect(asked).toEqual([
      { email: 'typist@example.com', options: { emailRedirectTo: 'https://hover.test/gg/sign-in' } },
    ])
  })

  it('says so when the link could not be sent, rather than pretending it was', async () => {
    const client = {
      auth: {
        onAuthStateChange: () => undefined,
        signInWithOtp: () => Promise.resolve({ error: { message: 'email rate limit exceeded' } }),
      },
    } as unknown as SupabaseClient

    const accounts = createAccountService(Promise.resolve(client))

    await expect(accounts.signInWithEmail('typist@example.com', 'https://hover.test/')).rejects.toThrow(
      'email rate limit exceeded',
    )
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

  /*
   * Row-level security is the only lock an attacker cannot edit, and it lives
   * on a server nobody here can see. These say what the queries themselves do
   * when it is not there -- see the note at the top of sync.ts.
   *
   * Reading is where the filter earns its place, and the first of these fails
   * without it. Deleting was already bounded without any filter, because a row
   * is only ever deleted when this account's own record of the last round says
   * it was here before; the second is here to keep that true, not because it
   * is false today.
   */
  describe('when the database has forgotten its own rules', () => {
    const strangers = () => {
      database.put(SESSIONS_TABLE, {
        id: 'stranger-session',
        user_id: 'somebody-else',
        completed_at: 9000,
        data: session('stranger-session', 9000),
      })
      database.forgetRowLevelSecurity()
    }

    it('does not bring a stranger’s practice into this browser', async () => {
      strangers()

      await sync.syncNow()

      expect((await sessions.getAll()).map((stored) => stored.id)).not.toContain('stranger-session')
    })

    it('takes only what was deleted here, and leaves a stranger’s row where it is', async () => {
      await sessions.save(session('mine'))
      await sync.syncNow()
      strangers()

      await sessions.remove(sessionId('mine'))
      await sync.syncNow()

      expect(database.rows(SESSIONS_TABLE).map((row) => row.id)).toEqual(['stranger-session'])
    })

    it('still sends up what was typed here, under this account', async () => {
      strangers()
      await sessions.save(session('mine'))

      await sync.syncNow()

      const ours = database.rows(SESSIONS_TABLE).filter((row) => row.user_id === ACCOUNT.id)
      expect(ours.map((row) => row.id)).toEqual(['mine'])
    })
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

  describe('when someone else signs in on the same browser', () => {
    const OTHER = { id: 'account-2', email: 'someone@example.com', name: 'Someone Else', pictureUrl: null }
    let who = ACCOUNT

    const signInAs = (account: typeof ACCOUNT): void => {
      who = account
      database.signedInAs(account.id)
    }

    const idsOn = (table: string, account: typeof ACCOUNT): string[] =>
      database
        .rows(table)
        .filter((row) => row.user_id === account.id)
        .map((row) => row.id)
        .toSorted()

    const idsHere = async (): Promise<string[]> => (await sessions.getAll()).map((stored) => stored.id).toSorted()

    beforeEach(() => {
      who = ACCOUNT
      database = fakeDatabase()
      build({ ...signedIn(), state: () => ({ status: 'signed-in', account: who }) })
    })

    it("never sends the first account's history to the second", async () => {
      await sessions.save(session('first-test'))
      await library.put(text('first-text', 10))
      await sync.syncNow()

      signInAs(OTHER)
      database.put(SESSIONS_TABLE, { id: 'other-test', user_id: OTHER.id, completed_at: 3000, data: session('other-test', 3000) })
      const result = await sync.syncNow()

      expect(idsOn(SESSIONS_TABLE, OTHER)).toEqual(['other-test'])
      expect(idsOn(TEXTS_TABLE, OTHER)).toEqual([])
      expect(result).toMatchObject({ sessionsUp: 0, sessionsDown: 1, textsUp: 0 })
      // And nothing was taken off this browser: the first account's keystrokes
      // live only here, and deleting its tests would lose them for good.
      expect(await idsHere()).toEqual(['first-test', 'other-test'])
      expect((await library.getAll()).map((stored) => stored.id)).toEqual(['first-text'])
    })

    it('keeps holding it back on every later round, and still sends what is typed after the switch', async () => {
      await sessions.save(session('first-test'))
      await sync.syncNow()
      signInAs(OTHER)
      await sync.syncNow()

      await sessions.save(session('typed-after-switch', 5000))
      const later = await sync.syncNow()

      expect(later).toMatchObject({ sessionsUp: 1 })
      expect(idsOn(SESSIONS_TABLE, OTHER)).toEqual(['typed-after-switch'])
      expect(await idsHere()).toEqual(['first-test', 'typed-after-switch'])
    })

    it("gives the first account its own back, and keeps the second's out of it, when the first returns", async () => {
      await sessions.save(session('first-test'))
      await sync.syncNow()
      signInAs(OTHER)
      database.put(SESSIONS_TABLE, { id: 'other-test', user_id: OTHER.id, completed_at: 3000, data: session('other-test', 3000) })
      await sync.syncNow()

      signInAs(ACCOUNT)
      const back = await sync.syncNow()

      expect(idsOn(SESSIONS_TABLE, ACCOUNT)).toEqual(['first-test'])
      expect(idsOn(SESSIONS_TABLE, OTHER)).toEqual(['other-test'])
      expect(back).toMatchObject({ sessionsUp: 0, sessionsDown: 0 })
      expect(await idsHere()).toEqual(['first-test', 'other-test'])
    })

    it('still merges everything the first time a browser meets an account, as long as no other account came first', async () => {
      // A typist trying the application before signing up: what they typed is
      // theirs, and goes up with the first sign-in, as it always has.
      await sessions.save(session('typed-before-signing-up'))
      signInAs(OTHER)

      expect(await sync.syncNow()).toMatchObject({ sessionsUp: 1 })
      expect(idsOn(SESSIONS_TABLE, OTHER)).toEqual(['typed-before-signing-up'])
    })
  })
})

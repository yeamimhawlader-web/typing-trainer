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
import { createGoldenNuggetService, type GoldenNugget, type GoldenNuggetService } from '@core/nuggets'
import { createMemoryAdapter, type StorageAdapter } from '@core/persistence'
import { createPreferencesRecord, type PreferencesRecord } from '@core/preferences'
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
import { createSyncService, NUGGETS_TABLE, PREFERENCES_TABLE, SESSIONS_TABLE, TEXTS_TABLE } from './sync.ts'
import type { SyncOptions } from './sync.ts'
import type { AccountService, AccountState } from './types.ts'

// --- A database, in memory ---------------------------------------------

const ACCOUNT_ID = 'account-1'

interface Row {
  /** Absent on the preferences table, whose row is the account itself. */
  readonly id?: string
  readonly user_id: string
  readonly completed_at?: number
  readonly updated_at?: number
  readonly last_seen_at?: number
  readonly data: unknown
}

/**
 * What makes a row unique in each table, as docs/supabase-setup.sql declares it.
 *
 * Not the same in all four, and the differences are the point. A session or a
 * text has an id from `crypto.randomUUID`, so the id alone is enough. A
 * Golden Nugget's id is `language:word` -- every typist who struggles with
 * `because` has a row called `en:because` -- so the key is the pair, and a
 * fake that kept them by id alone would let one typist's word quietly stand in
 * for another's and never notice the collision this table exists to survive.
 * The preferences are one row per account, so the account is the key.
 */
const keyOf = (table: string, row: Row): string => {
  if (table === PREFERENCES_TABLE) return row.user_id
  if (table === NUGGETS_TABLE) return JSON.stringify([row.user_id, row.id])
  return row.id ?? ''
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
    [NUGGETS_TABLE, new Map()],
    [PREFERENCES_TABLE, new Map()],
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
      upsert: (
        incoming: readonly Row[],
        options?: { readonly onConflict?: string },
      ) => {
        if (failWith !== null) return Promise.resolve({ error: { message: failWith } })
        /*
         * Postgres resolves a conflict against the columns it is given, and
         * defaults to the primary key. A table whose key is more than the id
         * must say so, or the write is matched on the wrong thing: for the
         * nuggets that would mean trying to overwrite whichever typist got to
         * `en:because` first, which the policies refuse -- and the refusal
         * would break every round of syncing from then on rather than once.
         * So the fake refuses it here, loudly, where a test can see it.
         */
        const conflict = options?.onConflict ?? 'id'
        // Written out, not read from the constant the code under test uses:
        // comparing that constant with itself would agree however wrong it was.
        // These are the keys docs/supabase-setup.sql actually declares.
        const needed =
          name === NUGGETS_TABLE
            ? 'user_id,id'
            : name === PREFERENCES_TABLE
              ? 'user_id'
              : 'id'
        if (conflict !== needed) {
          return Promise.resolve({
            error: { message: `upsert on ${name} must conflict on ${needed}` },
          })
        }
        for (const row of incoming) {
          // The insert policy's check: a row may only be written as its owner.
          if (row.user_id !== asAccount) return Promise.resolve({ error: { message: 'row-level security' } })
          rowsOf(name).set(keyOf(name, row), row)
        }
        return Promise.resolve({ error: null })
      },
      delete: () => {
        const query = (rows: readonly Row[]): unknown => ({
          eq: (column: string, value: unknown) => query(rows.filter((row) => valueOf(row, column) === value)),
          in: (column: string, values: readonly string[]) => {
            if (failWith !== null) return Promise.resolve({ error: { message: failWith } })
            for (const row of rows) {
              if (values.includes(String(valueOf(row, column)))) rowsOf(name).delete(keyOf(name, row))
            }
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
    put: (name: string, row: Row) => rowsOf(name).set(keyOf(name, row), row),
    /** Taken off the account, as a deletion on another browser would. */
    remove: (name: string, row: Row) => rowsOf(name).delete(keyOf(name, row)),
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

/**
 * A word that has been costing mistakes. Every field is filled in: the record
 * is checked field by field on the way back off the network, exactly as one
 * read off disk is, and a fixture missing one would be silently dropped and
 * the test would pass for the wrong reason.
 */
const nugget = (word: string, over: Partial<GoldenNugget> = {}): GoldenNugget => ({
  id: `en:${word}`,
  word,
  language: 'en',
  timesUnresolved: 1,
  hoverSessions: 1,
  tests: 1,
  mistakes: 3,
  firstSeenAt: 1_000,
  lastSeenAt: 2_000,
  lastDifficulty: 'standard',
  lastOutcome: 'unresolved',
  lastTestId: 'test-1',
  ...over,
})

const text = (
  id: string,
  updatedAt: number,
  body = 'a passage worth typing',
): LibraryText => ({
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
  let nuggets: GoldenNuggetService
  let preferences: PreferencesRecord
  let sync: ReturnType<typeof createSyncService>

  const build = (accounts: AccountService = signedIn(), over: Partial<SyncOptions> = {}) => {
    const adapter = createMemoryAdapter()
    storage = createMemoryAdapter()
    sessions = createSessionServiceOver(adapter)
    library = createLibraryService(adapter)
    // Over this test's own adapter, not the application's. Left to default
    // they would be the real ones, and every test in the file would be
    // practising on the same list of words.
    nuggets = createGoldenNuggetService(adapter)
    preferences = createPreferencesRecord(adapter)
    const telemetry = createTelemetryServiceOver(adapter)
    sync = createSyncService({
      client: Promise.resolve(database.client),
      accounts,
      storage,
      sessions,
      library,
      nuggets,
      preferences,
      deletion: createHistoryDeletion(sessions, telemetry),
      ...over,
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

  /*
   * Golden Nuggets. Unlike a session, which is written once, and unlike a
   * text, which is replaced whole, a nugget is a tally that both sides go on
   * adding to -- so the case that matters most is the one where both sides
   * have the same word and neither of them is simply right.
   */
  describe('the words that keep costing mistakes', () => {
    const rowFor = (word: string, over: Partial<GoldenNugget> = {}) => {
      const record = nugget(word, over)
      return {
        id: record.id,
        user_id: ACCOUNT.id,
        last_seen_at: record.lastSeenAt,
        data: record,
      }
    }

    const wordsHere = async (): Promise<string[]> =>
      (await nuggets.getAll()).map((kept) => kept.id).toSorted()
    const wordsThere = (): string[] =>
      database
        .rows(NUGGETS_TABLE)
        .map((row) => row.id ?? '')
        .toSorted()

    it('merges both sides the first time, as it does with everything else', async () => {
      await nuggets.put(nugget('because'))
      database.put(NUGGETS_TABLE, rowFor('rhythm'))

      expect(await sync.syncNow()).toMatchObject({ nuggetsUp: 1, nuggetsDown: 1 })
      expect(await wordsHere()).toEqual(['en:because', 'en:rhythm'])
      expect(wordsThere()).toEqual(['en:because', 'en:rhythm'])
    })

    it('joins a word both sides know rather than choosing one of them', async () => {
      // Both have been counting since they last met: this browser has seen
      // more mistakes, the account has seen the word more recently.
      await nuggets.put(nugget('because', { mistakes: 9, tests: 4, lastSeenAt: 2_000 }))
      database.put(
        NUGGETS_TABLE,
        rowFor('because', {
          mistakes: 2,
          tests: 1,
          lastSeenAt: 7_000,
          lastTestId: 'later',
          lastOutcome: 'cleared',
        }),
      )

      expect(await sync.syncNow()).toMatchObject({ nuggetsUp: 1, nuggetsDown: 1 })

      const here = (await nuggets.getAll())[0]
      const there = database.rows(NUGGETS_TABLE)[0]?.data as GoldenNugget
      // Neither side's counting thrown away, and the later focus described.
      expect(here).toMatchObject({
        mistakes: 9,
        tests: 4,
        lastSeenAt: 7_000,
        lastOutcome: 'cleared',
      })
      expect(there).toEqual(here)
    })

    it('sends a word met since the last round, and brings back one met elsewhere', async () => {
      await sync.syncNow()

      await nuggets.put(nugget('queue'))
      database.put(NUGGETS_TABLE, rowFor('answer'))

      expect(await sync.syncNow()).toMatchObject({ nuggetsUp: 1, nuggetsDown: 1 })
      expect(await wordsHere()).toEqual(['en:answer', 'en:queue'])
    })

    it('takes a word off this browser when it was taken off the account', async () => {
      await nuggets.put(nugget('because'))
      await sync.syncNow()

      database.remove(NUGGETS_TABLE, {
        id: 'en:because',
        user_id: ACCOUNT.id,
        data: null,
      })

      await sync.syncNow()
      expect(await wordsHere()).toEqual([])
    })

    it('takes a word off the account when it was taken off this browser', async () => {
      await nuggets.put(nugget('because'))
      await sync.syncNow()
      expect(wordsThere()).toEqual(['en:because'])

      await nuggets.clear()

      await sync.syncNow()
      expect(wordsThere()).toEqual([])
    })

    /*
     * The test the table's shape exists for.
     *
     * A nugget's id is `language:word`, so two typists who both struggle with
     * `because` both have a record called `en:because`. Keyed on the id alone,
     * the second one to sync would be writing over the first one's row, and
     * the policy would refuse -- taking that typist's syncing down with it,
     * for every word, not only this one.
     */
    it('lets two typists struggle with the same word without colliding', async () => {
      await nuggets.put(nugget('because', { mistakes: 5 }))
      expect(await sync.syncNow()).toMatchObject({ nuggetsUp: 1 })

      const OTHER = { ...ACCOUNT, id: 'account-2', email: 'someone@example.com' }
      database.signedInAs(OTHER.id)
      build({ ...signedIn(), state: () => ({ status: 'signed-in', account: OTHER }) })
      await nuggets.put(nugget('because', { mistakes: 2 }))

      // Nothing refused, and nothing of the first typist's touched.
      expect(await sync.syncNow()).toMatchObject({ nuggetsUp: 1, nuggetsDown: 0 })

      const rows = database.rows(NUGGETS_TABLE)
      expect(rows).toHaveLength(2)
      expect(rows.map((row) => (row.data as GoldenNugget).mistakes).toSorted()).toEqual(
        [2, 5],
      )
    })

    it('passes over a row it cannot read, and writes a good one over it', async () => {
      await nuggets.put(nugget('because', { mistakes: 5 }))
      database.put(NUGGETS_TABLE, {
        id: 'en:because',
        user_id: ACCOUNT.id,
        last_seen_at: 1,
        data: { ruined: true },
      })
      database.put(NUGGETS_TABLE, {
        id: 'en:rhythm',
        user_id: ACCOUNT.id,
        last_seen_at: 1,
        data: null,
      })

      await sync.syncNow()

      const mended = database.rows(NUGGETS_TABLE).find((row) => row.id === 'en:because')
        ?.data as GoldenNugget
      // The unreadable row for a word this browser has is written over; the
      // one for a word it has not is left alone rather than deleted.
      expect(mended.mistakes).toBe(5)
      expect(await wordsHere()).toEqual(['en:because'])
      expect(wordsThere()).toEqual(['en:because', 'en:rhythm'])
    })
  })

  /*
   * The settings, which are one record and not a list: there is nothing to
   * compare id by id, so the side that chose last wins outright.
   */
  describe('the settings a typist types under', () => {
    const theirs = (): unknown => database.rows(PREFERENCES_TABLE)[0]?.data

    it('sends them up when the account has none', async () => {
      await preferences.write({ theme: 'flow-mint' }, 5_000)

      expect(await sync.syncNow()).toMatchObject({ settings: 'up' })
      expect(theirs()).toEqual({ theme: 'flow-mint' })
    })

    it("brings the account's down when they were chosen more recently", async () => {
      await preferences.write({ theme: 'flow-mint' }, 5_000)
      database.put(PREFERENCES_TABLE, {
        user_id: ACCOUNT.id,
        updated_at: 9_000,
        data: { theme: 'paper' },
      })

      expect(await sync.syncNow()).toMatchObject({ settings: 'down' })
      expect(await preferences.read()).toEqual({
        data: { theme: 'paper' },
        updatedAt: 9_000,
      })
    })

    it('leaves both sides alone when they already agree', async () => {
      await preferences.write({ theme: 'flow-mint' }, 5_000)
      database.put(PREFERENCES_TABLE, {
        user_id: ACCOUNT.id,
        updated_at: 5_000,
        data: { theme: 'flow-mint' },
      })

      expect(await sync.syncNow()).toMatchObject({ settings: 'unchanged' })
    })

    it('says nothing moved when neither side has any', async () => {
      expect(await sync.syncNow()).toMatchObject({ settings: 'unchanged' })
      expect(database.rows(PREFERENCES_TABLE)).toEqual([])
    })

    /*
     * A browser that has never saved a preference -- nothing changed on it, or
     * a record written before the time was kept -- loses to whatever the
     * account holds. That is what a typist signing in on a second machine
     * wants: the settings they have been using, not that machine's leftovers.
     */
    it('lets the account win over a browser that has never chosen anything', async () => {
      database.put(PREFERENCES_TABLE, {
        user_id: ACCOUNT.id,
        updated_at: 9_000,
        data: { theme: 'paper' },
      })

      expect(await sync.syncNow()).toMatchObject({ settings: 'down' })
      expect((await preferences.read()).data).toEqual({ theme: 'paper' })
    })

    /*
     * A round takes as long as the network does, and a typist is free to
     * change the theme in the middle of one. Their choice is the newer one and
     * has to stand, or the account quietly undoes a setting they watched
     * themselves change a second ago.
     */
    it('does not replace a choice made while the round was in flight', async () => {
      database.put(PREFERENCES_TABLE, { user_id: ACCOUNT.id, updated_at: 9_000, data: { theme: 'paper' } })

      // Reads the record as it was when the round began, then as the typist
      // left it a moment later.
      let reads = 0
      const arrived: unknown[] = []
      const racing: PreferencesRecord = {
        read: () => {
          reads += 1
          return Promise.resolve(
            reads === 1
              ? { data: { theme: 'flow-mint' }, updatedAt: 5_000 }
              : { data: { theme: 'lemondrop' }, updatedAt: 20_000 },
          )
        },
        write: () => Promise.resolve(),
        arrive: (data) => {
          arrived.push(data)
          return Promise.resolve()
        },
        subscribe: () => () => undefined,
      }
      build(signedIn(), { preferences: racing })

      expect(await sync.syncNow()).toMatchObject({ settings: 'unchanged' })
      // Nothing from the account landed on top of what they had just chosen.
      expect(arrived).toEqual([])
    })

    it('stamps an unstamped record on the way up, so it is not sent again every round', async () => {
      // As a version from before the time was kept would have left it.
      await preferences.write({ theme: 'flow-mint' }, 0)

      expect(await sync.syncNow()).toMatchObject({ settings: 'up' })
      expect((await preferences.read()).updatedAt).toBeGreaterThan(0)
      expect(await sync.syncNow()).toMatchObject({ settings: 'unchanged' })
    })
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
        // Every table this is asked about has ids; the preferences row, which
        // does not, is read by the tests that care about it directly.
        .map((row) => row.id ?? '')
        .toSorted()

    const idsHere = async (): Promise<string[]> => (await sessions.getAll()).map((stored) => stored.id).toSorted()

    beforeEach(() => {
      who = ACCOUNT
      database = fakeDatabase()
      build({ ...signedIn(), state: () => ({ status: 'signed-in', account: who }) })
    })

    /*
     * The same rule, for the two things added when the account started
     * carrying more than history: the words a typist struggles with, and the
     * settings they type under. Neither belongs to whoever signs in next.
     */
    it("never sends the first account's Golden Nuggets to the second", async () => {
      await nuggets.put(nugget('because'))
      await sync.syncNow()
      expect(database.rows(NUGGETS_TABLE)).toHaveLength(1)

      signInAs(OTHER)
      await sync.syncNow()

      // Still on the browser, where its counting lives, and on nobody else's
      // account.
      expect((await nuggets.getAll()).map((kept) => kept.id)).toEqual(['en:because'])
      expect(idsOn(NUGGETS_TABLE, OTHER)).toEqual([])
      expect(idsOn(NUGGETS_TABLE, ACCOUNT)).toEqual(['en:because'])
    })

    /*
     * The same rule where the two people struggle with the *same word*, which
     * is not a corner case at all: `because` and `rhythm` are what Golden
     * Nuggets is mostly made of.
     *
     * This is the one place where a nugget id being `language:word` rather
     * than something unique bites twice. For a session or a text, the account
     * holding the same id proves the id is this account's -- they come from
     * `crypto.randomUUID` and two people cannot land on one. For a word it
     * proves nothing: two typists struggling with `because` is the ordinary
     * case, and treating the match as proof would pour the first person's
     * count into the second person's record.
     */
    it("does not pour the first account's count into the second's record of the same word", async () => {
      await nuggets.put(nugget('because', { mistakes: 40 }))
      await sync.syncNow()

      // The second person has their own record of the same word, from their
      // own practice on their own machine.
      database.put(NUGGETS_TABLE, {
        id: 'en:because',
        user_id: OTHER.id,
        last_seen_at: 3_000,
        data: { ...nugget('because', { mistakes: 2, lastSeenAt: 3_000 }) },
      })
      signInAs(OTHER)
      await sync.syncNow()

      const theirs = database.rows(NUGGETS_TABLE).find((row) => row.user_id === OTHER.id)?.data as GoldenNugget
      expect(theirs.mistakes).toBe(2)
      // And this browser now shows the second person their own record.
      expect((await nuggets.getAll())[0]?.mistakes).toBe(2)
    })

    it("never sends the first account's settings to the second", async () => {
      await preferences.write({ theme: 'flow-mint' }, 5_000)
      await sync.syncNow()

      signInAs(OTHER)
      await sync.syncNow()

      expect(database.rows(PREFERENCES_TABLE).filter((row) => row.user_id === OTHER.id)).toEqual([])
    })

    /*
     * And goes on not sending them. The switch is noticed once, by comparing
     * the account on the record with the one signing in; every round after
     * that the record says the new account, so a guard that only looked at
     * the switch would hold the first person's settings back for exactly one
     * round and then send them.
     */
    it("still does not send them on the rounds after the switch", async () => {
      await preferences.write({ theme: 'flow-mint' }, 5_000)
      await sync.syncNow()

      signInAs(OTHER)
      await sync.syncNow()
      await sync.syncNow()
      await sync.syncNow()

      expect(database.rows(PREFERENCES_TABLE).filter((row) => row.user_id === OTHER.id)).toEqual([])
    })

    it("sends the second person's own settings as soon as they choose one", async () => {
      await preferences.write({ theme: 'flow-mint' }, 5_000)
      await sync.syncNow()

      signInAs(OTHER)
      await sync.syncNow()
      // The second person picks a theme. From here it is theirs, and goes up.
      await preferences.write({ theme: 'lemondrop' }, 30_000)
      expect(await sync.syncNow()).toMatchObject({ settings: 'up' })

      expect(database.rows(PREFERENCES_TABLE).find((row) => row.user_id === OTHER.id)?.data).toEqual({
        theme: 'lemondrop',
      })
    })

    it("does not let the first account's settings overwrite the second's", async () => {
      await preferences.write({ theme: 'flow-mint' }, 5_000)
      await sync.syncNow()

      // The second person has settings of their own, chosen on another machine
      // and longer ago. Being older must not mean being replaced by a stranger.
      database.put(PREFERENCES_TABLE, { user_id: OTHER.id, updated_at: 1_000, data: { theme: 'paper' } })
      signInAs(OTHER)
      await sync.syncNow()

      expect(database.rows(PREFERENCES_TABLE).find((row) => row.user_id === OTHER.id)?.data).toEqual({
        theme: 'paper',
      })
      // And the second person gets their own back on this browser.
      expect((await preferences.read()).data).toEqual({ theme: 'paper' })
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

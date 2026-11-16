/**
 * Keeping a browser and an account level with each other.
 *
 * Local first, always: every test is written to this browser as it always was,
 * and syncing is a second copy made afterwards. Nothing in the typing loop
 * waits for a network, and signing out leaves everything here untouched.
 *
 * ## Whose rows these are, said twice
 *
 * Every query here names the account whose rows it wants, although the
 * database is already told the same thing: row-level security scopes both
 * tables to `auth.uid()`, so a correctly configured project would return the
 * signed-in typist's rows and no one else's without being asked.
 *
 * It is said twice because one of the two is a setting on a server nobody
 * here can see. If row-level security were ever off -- a project restored from
 * a backup, a table rebuilt by hand, a migration half run -- then a plain
 * `select` would quietly return every typist's sessions, and the delete that
 * follows a local deletion would reach into strangers' rows. The filter costs
 * a few characters and turns that from a breach into a quiet afternoon.
 *
 * It is not a replacement for row-level security, which is the only part of
 * this an attacker cannot edit: anyone can open the console and run their own
 * query against the same table. It is the second lock, not the first. See
 * docs/SUPABASE.md.
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
import {
  goldenNuggetService,
  mergeNuggets,
  parseGoldenNugget,
  sameNugget,
  type GoldenNugget,
  type GoldenNuggetService,
} from '@core/nuggets'
import { STORAGE_KEYS, type StorageAdapter } from '@core/persistence'
import { preferencesRecord, type PreferencesRecord } from '@core/preferences'
import { parseTypingSession, sessionService, type SessionService, type TypingSession } from '@core/sessions'
import { sessionId } from '@core/types'

import type { AccountService, SettingsMoved, SyncResult, SyncService } from './types.ts'

/** The tables the application expects; created by docs/SUPABASE.md. */
export const SESSIONS_TABLE = 'sessions'
export const TEXTS_TABLE = 'texts'
export const NUGGETS_TABLE = 'nuggets'
export const PREFERENCES_TABLE = 'preferences'

/**
 * The columns a nugget row is identified by.
 *
 * Said explicitly because, alone among these tables, a nugget's id is not
 * unique in the world: it is `language:word`, so every typist who struggles
 * with `because` has a row whose id is `en:because`. The table's key is
 * therefore the pair, and an upsert has to name the pair or it would try to
 * overwrite a stranger's row -- which row-level security would refuse,
 * failing every round of syncing from then on. See docs/supabase-setup.sql.
 */
export const NUGGET_KEY = 'user_id,id'

/** Rows in one request. Small enough to stay well inside any limit. */
const BATCH = 200

/** Ids that were on both sides at the end of a round, per kind. */
interface Known {
  readonly sessions: readonly string[]
  readonly texts: readonly string[]
  /** Absent from records written before Golden Nuggets were kept with an account. */
  readonly nuggets: readonly string[]
}

const NOTHING_KNOWN: Known = { sessions: [], texts: [], nuggets: [] }

/** What on this browser belongs to another account, and is never sent to this one. */
interface Withheld extends Known {
  /**
   * The settings on this browser are the previous person's, and this is the
   * moment they were last chosen; null when they are nobody else's.
   *
   * A time rather than a list, because there is only ever one settings
   * record and so nothing to name. It is what makes the holding *last*: the
   * switch itself is visible for exactly one round -- after it, the record
   * names the new account and the two agree -- so a guard that watched only
   * for the switch would hold the first person's theme back once and send it
   * the round after. Holding the time instead means it stays held until the
   * moment it changes, which is the moment somebody chooses something here.
   */
  readonly settingsAt: number | null
}

const NOTHING_WITHHELD: Withheld = { ...NOTHING_KNOWN, settingsAt: null }

/** What the last round ended with, for the account it ended with. */
interface SyncRecord {
  readonly accountId: string
  /** On both sides at the end of the round. */
  readonly sessions: readonly string[]
  readonly texts: readonly string[]
  /**
   * Absent from every record written before Golden Nuggets were kept with an
   * account, which reads as "none known" -- so the first round after this
   * version arrives merges the two sides rather than reading either side's
   * words as deletions. That is the same rule a genuine first round follows,
   * and it is the only safe reading of a record that cannot speak for them.
   */
  readonly nuggets: readonly string[]
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
      ? {
          sessions: withheld['sessions'],
          texts: withheld['texts'],
          nuggets: isStrings(withheld['nuggets']) ? withheld['nuggets'] : [],
          settingsAt: typeof withheld['settingsAt'] === 'number' ? withheld['settingsAt'] : null,
        }
      : NOTHING_WITHHELD
  return {
    accountId: record['accountId'],
    sessions: record['sessions'],
    texts: record['texts'],
    nuggets: isStrings(record['nuggets']) ? record['nuggets'] : [],
    withheld: held,
  }
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
): { readonly known: Known; readonly withheld: Withheld; readonly switched: boolean } => {
  if (previous === null) return { known: NOTHING_KNOWN, withheld: NOTHING_WITHHELD, switched: false }
  if (previous.accountId === accountId) {
    return {
      known: { sessions: previous.sessions, texts: previous.texts, nuggets: previous.nuggets },
      withheld: previous.withheld,
      switched: false,
    }
  }
  return {
    known: NOTHING_KNOWN,
    withheld: {
      sessions: [...previous.sessions, ...previous.withheld.sessions],
      texts: [...previous.texts, ...previous.withheld.texts],
      nuggets: [...previous.nuggets, ...previous.withheld.nuggets],
      // Whatever is on this browser now is the previous person's; which
      // moment that is cannot be read here, so syncPreferences fills it in.
      settingsAt: null,
    },
    // Someone else was signed in here last. Lists are guarded id by id, above;
    // the settings are one record and need saying separately.
    switched: true,
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
  readonly nuggets?: GoldenNuggetService
  readonly preferences?: PreferencesRecord
  readonly deletion?: HistoryDeletion
}

export const createSyncService = ({
  client: arriving,
  accounts,
  storage,
  sessions = sessionService,
  library = libraryService,
  nuggets = goldenNuggetService,
  preferences = preferencesRecord,
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
      rowsOf<{ id: string }>(await client.from(SESSIONS_TABLE).select('id').eq('user_id', accountId)).map(
        (row) => row.id,
      ),
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
      thrownIfFailed(await client.from(SESSIONS_TABLE).delete().eq('user_id', accountId).in('id', [...batch]))
    })

    let pulled = 0
    await inBatches(waiting, async (batch) => {
      const stored = rowsOf<{ data: unknown }>(
        await client.from(SESSIONS_TABLE).select('data').eq('user_id', accountId).in('id', [...batch]),
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
      await client.from(TEXTS_TABLE).select('id, updated_at').eq('user_id', accountId),
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
      thrownIfFailed(await client.from(TEXTS_TABLE).delete().eq('user_id', accountId).in('id', [...batch]))
    })

    let pulled = 0
    await inBatches(
      down.map((row) => row.id),
      async (batch) => {
        const stored = rowsOf<{ data: unknown }>(
          await client.from(TEXTS_TABLE).select('data').eq('user_id', accountId).in('id', [...batch]),
        )
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

  /**
   * Golden Nuggets, which are neither written once like a session nor replaced
   * whole like a text: they are tallies that both sides go on adding to.
   *
   * So where a word is on one side only this works exactly as the two above
   * do -- added here, deleted there, and so on, read against the record of the
   * last round. Where a word is on *both* sides the two records are joined
   * rather than one of them chosen, and whichever side the join differs from
   * is written. See mergeNuggets for why a tally cannot simply take the newer
   * record.
   *
   * Every row is fetched with its contents, not just its id. A typist's
   * nuggets are a few dozen short records -- smaller together than one test's
   * keystrokes -- and fetching the lot means the join never has to assume that
   * two records with the same date are the same record.
   */
  const syncNuggets = async (
    client: SupabaseClient,
    accountId: string,
    known: ReadonlySet<string>,
    held: ReadonlySet<string>,
  ): Promise<
    Pick<SyncResult, 'nuggetsUp' | 'nuggetsDown'> & {
      readonly withheld: readonly string[]
    }
  > => {
    const local = await nuggets.getAll()
    const localById = new Map(local.map((nugget) => [nugget.id, nugget]))

    const rows = rowsOf<{ id: string; data: unknown }>(
      await client.from(NUGGETS_TABLE).select('id, data').eq('user_id', accountId),
    )
    const remoteById = new Map<string, GoldenNugget>()
    /*
     * A row that will not parse is passed over the way a bad row off disk is.
     * Its id is remembered so it is not then read as a word deleted here and
     * deleted there: it is already unreadable, and taking it away would be a
     * second loss on top of the first. If this browser has the same word, the
     * upload below writes over it, which quietly repairs it.
     */
    const unreadable = new Set<string>()
    for (const row of rows) {
      const nugget = parseGoldenNugget(row.data)
      if (nugget === null) unreadable.add(row.id)
      else remoteById.set(nugget.id, nugget)
    }

    const up: GoldenNugget[] = []
    const down: GoldenNugget[] = []
    const withheld: string[] = []
    const deleteThere: string[] = []
    const deleteHere: string[] = []

    for (const [id, here] of localById) {
      const there = remoteById.get(id)

      /*
       * Another account's word, still on this browser. Asked first, before
       * anything else looks at it, because every other branch below would
       * send it somewhere: uploaded, or -- worse -- joined with this
       * account's record of the same word and the two counts added together.
       *
       * This is where a nugget id being `language:word` costs a second time.
       * A session or a text found on both sides is proof the id is this
       * account's: ids come from `crypto.randomUUID` and two people cannot
       * land on one, which is why those two let a held id go the moment the
       * account turns out to have it. A *word* found on both sides proves
       * nothing at all -- two typists struggling with `because` is the
       * ordinary case -- so a held word stays held however familiar it looks.
       *
       * Where this account has the word, its own record is taken and fills
       * the one slot the browser keeps per word; the previous person's is not
       * lost by that, since a held word is by definition one their account
       * already has. Where it does not, the record stays on the browser
       * untouched and goes to nobody.
       */
      if (held.has(id)) {
        if (there === undefined) withheld.push(id)
        else if (!sameNugget(there, here)) down.push(there)
        continue
      }

      if (there !== undefined) {
        // On both sides and ours: joined, and written wherever it says more.
        const merged = mergeNuggets(here, there)
        if (!sameNugget(merged, here)) down.push(merged)
        if (!sameNugget(merged, there)) up.push(merged)
        continue
      }
      // A row that would not parse: this browser's copy is written over it,
      // which quietly repairs it. See `unreadable` above.
      if (unreadable.has(id)) up.push(here)
      else if (known.has(id)) deleteHere.push(id)
      else up.push(here)
    }

    for (const [id, there] of remoteById) {
      if (localById.has(id)) continue
      if (known.has(id)) deleteThere.push(id)
      else down.push(there)
    }

    await inBatches(up, async (batch) => {
      thrownIfFailed(
        await client.from(NUGGETS_TABLE).upsert(
          batch.map((nugget) => ({
            id: nugget.id,
            user_id: accountId,
            last_seen_at: nugget.lastSeenAt,
            data: nugget,
          })),
          // The pair, not the id: see NUGGET_KEY.
          { onConflict: NUGGET_KEY },
        ),
      )
    })

    await inBatches(deleteThere, async (batch) => {
      thrownIfFailed(
        await client
          .from(NUGGETS_TABLE)
          .delete()
          .eq('user_id', accountId)
          .in('id', [...batch]),
      )
    })

    await inSequence(down, (nugget) => nuggets.put(nugget))
    await inSequence(deleteHere, (id) => nuggets.remove(id))

    return { nuggetsUp: up.length, nuggetsDown: down.length, withheld }
  }

  /**
   * The settings, which are one record rather than a list, so there is nothing
   * to compare id by id: the side that chose last wins outright.
   *
   * A browser that has never saved a preference has no time against its
   * record -- either because nothing has been changed on it, or because it was
   * written by a version from before the time was kept. Such a record loses to
   * anything the account holds, which is the answer a typist signing in on a
   * second machine expects: the settings they have been using, not whatever
   * that machine was left on. Where the account holds nothing at all, this
   * browser's record goes up and is stamped with the moment it went, so the
   * next round has something to compare.
   *
   * The record is moved without being understood. What a valid theme or sound
   * pack is belongs to the settings themselves, which check whatever they are
   * given, from this account or from this disk, with the same code.
   */
  const syncPreferences = async (
    client: SupabaseClient,
    accountId: string,
    /** Whether the last round on this browser belonged to a different account. */
    switched: boolean,
    /** The settings time the last round held back, if it held one. */
    heldAt: number | null,
  ): Promise<{ readonly moved: SettingsMoved; readonly settingsAt: number | null }> => {
    const here = await preferences.read()
    const rows = rowsOf<{ updated_at: number; data: unknown }>(
      await client
        .from(PREFERENCES_TABLE)
        .select('updated_at, data')
        .eq('user_id', accountId),
    )
    const there = rows[0]

    const send = async (at: number): Promise<SettingsMoved> => {
      thrownIfFailed(
        await client
          .from(PREFERENCES_TABLE)
          .upsert([{ user_id: accountId, updated_at: at, data: here.data }], {
            onConflict: 'user_id',
          }),
      )
      // Stamped here too, so an unstamped record is not sent again every round.
      if (at !== here.updatedAt) await preferences.write(here.data, at)
      return 'up'
    }

    /*
     * Whose settings are on this browser. On the round where the account
     * changed, they are plainly the previous person's; after that, they are
     * still theirs for as long as nothing here has been chosen since -- which
     * is exactly what "the time has not moved" says.
     */
    const held = switched ? here.updatedAt : heldAt
    const theirs = held !== null && here.updatedAt === held

    /*
     * Someone else's, so they are not sent anywhere, exactly as their history
     * is not. The account's own settings are taken whatever their age: being
     * older than a stranger's is no reason to be replaced by them. Where the
     * account has none, nothing happens at all and the browser goes on looking
     * as the last person left it -- as it does for everything else until this
     * person types something. The moment they choose anything, the time moves,
     * these stop being withheld, and their choice goes up like anyone's.
     */
    if (theirs) {
      if (there === undefined) return { moved: 'unchanged', settingsAt: held }
      await preferences.arrive(there.data, there.updated_at)
      return { moved: 'down', settingsAt: null }
    }

    if (there === undefined) {
      // Nothing chosen on this browser either: there is nothing to send.
      if (here.data === null || here.data === undefined) return { moved: 'unchanged', settingsAt: null }
      return { moved: await send(here.updatedAt > 0 ? here.updatedAt : Date.now()), settingsAt: null }
    }

    if (here.updatedAt > there.updated_at) return { moved: await send(here.updatedAt), settingsAt: null }
    if (here.updatedAt === there.updated_at) return { moved: 'unchanged', settingsAt: null }

    /*
     * Read once more before writing. A round takes as long as the network
     * does, and a typist who changes the theme while one is in flight would
     * otherwise have it quietly replaced by what the account held when the
     * round began. Their choice is the newer one; it stands.
     */
    const now = await preferences.read()
    if (now.updatedAt >= there.updated_at) return { moved: 'unchanged', settingsAt: null }

    await preferences.arrive(there.data, there.updated_at)
    return { moved: 'down', settingsAt: null }
  }

  const round = async (accountId: string): Promise<SyncResult> => {
    const client = await arriving
    const { known, withheld, switched } = startingFrom(
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
    const { withheld: nuggetsHeld, ...nuggetsMoved } = await syncNuggets(
      client,
      accountId,
      new Set(known.nuggets),
      new Set(withheld.nuggets),
    )
    const settings = await syncPreferences(client, accountId, switched, withheld.settingsAt)

    // What both sides now hold, read back rather than worked out, so a record
    // that was refused or trimmed by storage is not remembered as kept. What is
    // withheld is here only, so it is kept apart from that: listed as held, it
    // is never mistaken next round for something deleted from the account.
    const holdingSessions = new Set(sessionsHeld)
    const holdingTexts = new Set(textsHeld)
    const holdingNuggets = new Set(nuggetsHeld)
    await storage.write(STORAGE_KEYS.accountSync, {
      accountId,
      sessions: (await sessions.getAll()).map((session) => session.id).filter((id) => !holdingSessions.has(id)),
      texts: (await library.getAll()).map((text) => text.id).filter((id) => !holdingTexts.has(id)),
      nuggets: (await nuggets.getAll()).map((nugget) => nugget.id).filter((id) => !holdingNuggets.has(id)),
      withheld: {
        sessions: sessionsHeld,
        texts: textsHeld,
        nuggets: nuggetsHeld,
        settingsAt: settings.settingsAt,
      },
    } satisfies SyncRecord)

    return { ...sessionsMoved, ...textsMoved, ...nuggetsMoved, settings: settings.moved }
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

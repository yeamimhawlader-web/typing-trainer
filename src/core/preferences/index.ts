/**
 * The preferences record: what was chosen, and when it was last chosen.
 *
 * Preferences themselves belong to the settings feature, which knows what a
 * valid theme or sound pack is. This is only the *record* of them — the blob
 * as it sits in storage, and the moment it was last written — and it lives in
 * core because two unrelated things now need it:
 *
 * - the settings store, which writes it whenever a typist changes something;
 * - account syncing, which copies it to and from the account.
 *
 * ## Why the blob is not read here
 *
 * What comes back is `unknown` on purpose. The rules for a valid preference —
 * which themes exist, which sound packs this build ships, what counts as a
 * practice length — live in the settings store, and duplicating them here
 * would mean two lists to keep level. Syncing does not need to understand a
 * preference to move it, and the settings store already treats whatever it
 * reads as untrusted, so a record arriving from the account is checked by
 * exactly the same code that checks one arriving from disk.
 *
 * ## Why the time is kept beside the preferences, not inside them
 *
 * The stored preferences are a bare `UserPreferences` object and have been
 * since the first version. Wrapping them now would mean every typist's
 * existing record read as empty on the next load, and everyone's settings
 * would reset. So the time goes in a key of its own, and a record written
 * before this existed simply has no time — which reads as "never written
 * here", and lets the account's copy win the first time the two meet. That is
 * the right answer: a typist signing in on a second browser wants the settings
 * they have been using, not that browser's leftovers.
 */

import { STORAGE_KEYS, storage, type StorageAdapter } from '@core/persistence'

export interface StoredPreferences {
  /**
   * The preferences as written. Untrusted: read it through the settings
   * store's own validation, never field by field here.
   */
  readonly data: unknown
  /** Epoch milliseconds, or 0 when nothing has ever been written here. */
  readonly updatedAt: number
}

export interface PreferencesRecord {
  read(): Promise<StoredPreferences>
  /**
   * Writes a choice made on this browser. Silent: whoever made the choice
   * already knows about it, and telling them again only risks their undoing
   * it. The time is given rather than taken from the clock here, so a record
   * can be written with the time it was chosen rather than the time it landed.
   */
  write(data: unknown, updatedAt: number): Promise<void>
  /**
   * Writes a record that came from the account, and tells anyone listening.
   *
   * Separate from `write` so that "these settings came from somewhere else" is
   * said outright rather than inferred from the clock. It used to be inferred:
   * listeners compared the time against the last one they wrote, which is
   * wrong exactly when it matters most -- a second person signing in on a
   * shared browser has to be given the account's settings even though the
   * first person's are newer.
   *
   * Whether an arriving record should win is decided in one place, by the
   * syncing in @core/accounts. By the time it reaches here, it has won.
   */
  arrive(data: unknown, updatedAt: number): Promise<void>
  /** Called on `arrive` only, never on a local `write`. */
  subscribe(listener: (stored: StoredPreferences) => void): () => void
}

/** What the time key holds. Its own object so a later version can add to it. */
const timeOf = (value: unknown): number => {
  if (typeof value !== 'object' || value === null) return 0
  const at = (value as Record<string, unknown>)['at']
  return typeof at === 'number' && Number.isFinite(at) && at > 0 ? at : 0
}

export const createPreferencesRecord = (adapter: StorageAdapter): PreferencesRecord => {
  const listeners = new Set<(stored: StoredPreferences) => void>()

  /*
   * The preferences first. If the second write fails, the typist's settings
   * are still on this machine and merely look older than they are, which costs
   * one round of syncing. The other order would claim a record had been
   * written that had not.
   */
  const store = async (data: unknown, updatedAt: number): Promise<void> => {
    await adapter.write(STORAGE_KEYS.preferences, data)
    await adapter.write(STORAGE_KEYS.preferencesSaved, { at: updatedAt })
  }

  return {
    read: async () => {
      const [data, saved] = await Promise.all([
        adapter.read<unknown>(STORAGE_KEYS.preferences),
        adapter.read<unknown>(STORAGE_KEYS.preferencesSaved),
      ])
      return { data: data ?? null, updatedAt: timeOf(saved) }
    },

    write: (data, updatedAt) => store(data, updatedAt),

    arrive: async (data, updatedAt) => {
      await store(data, updatedAt)
      for (const listener of listeners) listener({ data, updatedAt })
    },

    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** The application's preferences record, over the configured storage. */
export const preferencesRecord = createPreferencesRecord(storage)

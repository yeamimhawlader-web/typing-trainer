/**
 * Carrying a typist's data from one browser, or one address, to another.
 *
 * Everything Hover Typing remembers — history, telemetry, preferences, Golden
 * Nuggets, saved texts — lives in the browser it was typed in, under this
 * application's own prefix. Nothing is on a server. That is the privacy of it,
 * and also the catch: a browser is not a place data can be *kept*. Clearing
 * site data empties it, a second computer never had it, and moving the site to
 * its own domain hands every visitor a brand new, empty origin, because a
 * browser treats two addresses as two unrelated places.
 *
 * So the data has to be able to leave: packed into one file the typist holds,
 * and unpacked wherever they want it next.
 *
 * ## Everything, exactly
 *
 * The file is a plain copy of every key this application owns — not a chosen
 * subset — so a restore reproduces the browser it came from rather than an
 * approximation of it. Which keys exist is the storage's business, not this
 * module's; asking it for them means a repository added next year is carried
 * without anyone remembering to come back here.
 *
 * ## Replacing, not merging
 *
 * Restoring clears first. Merging two histories would mean deciding what a
 * session recorded twice means, which test a telemetry record belongs to, and
 * whose preferences win — questions with no answer that is right for everyone.
 * Replacing has one meaning, and the typist already holds the file they came
 * from, so nothing is unrecoverable.
 *
 * ## Refusing the wrong file
 *
 * A file is checked before a single key is touched: a half-applied restore over
 * a cleared store would be worse than either outcome on its own.
 */

import type { Serialisable, StorageAdapter } from './types.ts'

/** Marks a file as this application's, so another app's JSON is refused. */
export const TRANSFER_FORMAT = 'hover-typing/backup'

export interface TransferFile {
  readonly format: typeof TRANSFER_FORMAT
  /** The storage layout the entries were written under. */
  readonly schemaVersion: number
  /** When it was packed, for the typist's benefit rather than the code's. */
  readonly savedAt: string
  /** Every key this application held, unprefixed, to its stored value. */
  readonly entries: Readonly<Record<string, Serialisable>>
}

/** Raised when a file is not one this can restore. The message is shown to the typist. */
export class TransferError extends Error {
  override readonly name = 'TransferError'
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every key this storage owns, with its value, ready to be written to a file. */
export const packStored = async (
  storage: StorageAdapter,
  schemaVersion: number,
  now: () => Date = () => new Date(),
): Promise<TransferFile> => {
  const keys = await storage.keys()
  const entries: Record<string, Serialisable> = {}

  for (const key of keys.toSorted()) {
    // One at a time on purpose: a key that cannot be read is a key the browser
    // has already lost, and taking the rest is better than taking none.
    // oxlint-disable-next-line no-await-in-loop
    const value = await storage.read<Serialisable>(key)
    if (value !== null) entries[key] = value
  }

  return { format: TRANSFER_FORMAT, schemaVersion, savedAt: now().toISOString(), entries }
}

/**
 * Reads what was parsed from a file and hands back something restorable, or
 * says why it is not. Every refusal names what the typist should do about it.
 */
export const readTransferFile = (value: unknown, schemaVersion: number): TransferFile => {
  if (!isRecord(value)) throw new TransferError('That file does not contain Hover Typing data.')

  if (value['format'] !== TRANSFER_FORMAT) {
    throw new TransferError('That file was not saved by Hover Typing, so there is nothing here to restore.')
  }

  const version = value['schemaVersion']
  if (typeof version !== 'number') {
    throw new TransferError('That file does not say which version of Hover Typing saved it.')
  }
  if (version > schemaVersion) {
    throw new TransferError(
      'That file was saved by a newer version of Hover Typing than this one. Open the site again to update it, then try the file once more.',
    )
  }
  if (version < schemaVersion) {
    throw new TransferError(
      'That file was saved by an older version of Hover Typing, and this version keeps its data differently. It cannot be restored here.',
    )
  }

  const entries = value['entries']
  if (!isRecord(entries)) throw new TransferError('That file is a Hover Typing file, but the data in it is damaged.')

  return {
    format: TRANSFER_FORMAT,
    schemaVersion: version,
    savedAt: typeof value['savedAt'] === 'string' ? value['savedAt'] : '',
    entries: entries as Readonly<Record<string, Serialisable>>,
  }
}

/**
 * Puts a file's contents in place of whatever this storage holds. Returns how
 * many keys were written, which is what the typist is told afterwards.
 */
export const restoreStored = async (file: TransferFile, storage: StorageAdapter): Promise<number> => {
  const written = Object.entries(file.entries)

  await storage.clear()
  for (const [key, value] of written) {
    // oxlint-disable-next-line no-await-in-loop
    await storage.write(key, value)
  }

  return written.length
}

/**
 * Deleting history — the one way it is done.
 *
 * ## Why this exists
 *
 * A session is stored in two places: its record in the session repository, and
 * its keystroke detail in the telemetry repository. Deleting one without the
 * other is easy to do by accident, and it happened. The history list removed
 * both; the session detail page removed only the record, leaving 788 bytes of
 * what someone had typed sitting in storage, still readable and still indexed,
 * after they had asked for it to be gone.
 *
 * Every screen that deletes now goes through here, so there is no second path
 * to fall out of step with the first.
 *
 * ## Order, and what a failure leaves behind
 *
 * Telemetry goes first, then the session. If the second step fails, what is
 * left is a session still visible in history without its keystroke detail —
 * visible, so it can be deleted again. The opposite order could leave keystroke
 * detail with no session pointing at it: invisible, and so impossible to delete
 * from the interface at all.
 *
 * ## Undo
 *
 * Each deletion returns exactly what it removed — the session records and the
 * stored telemetry as it sat on disk — so it can be put back. That is what makes
 * a mis-click recoverable without a confirmation dialog on every keystroke of
 * the app's life. Held in memory by the caller, so it lasts until the page is
 * closed, which is the window in which "I didn't mean that" is actually said.
 */

import type { SessionService, TypingSession } from '@core/sessions'
import type { StoredTelemetry, TelemetryService } from '@core/telemetry'
import type { SessionId } from '@core/types'

/** Everything a deletion removed, in a form that can be restored. */
export interface DeletedHistory {
  readonly sessions: readonly TypingSession[]
  /** Stored telemetry by session id, for the sessions that had any. */
  readonly telemetry: readonly (readonly [SessionId, StoredTelemetry])[]
}

export interface HistoryDeletion {
  /** Removes one session and everything derived from it. */
  deleteSession(id: SessionId): Promise<DeletedHistory>
  /** Removes every session and all keystroke detail. */
  clearAll(): Promise<DeletedHistory>
  /** Puts back what a deletion removed. */
  restore(deleted: DeletedHistory): Promise<void>
}

const withTelemetry = async (
  telemetry: TelemetryService,
  sessions: readonly TypingSession[],
): Promise<DeletedHistory['telemetry']> => {
  const stored = await Promise.all(
    sessions.map(async (session) => [session.id, await telemetry.getStored(session.id)] as const),
  )

  return stored.filter(
    (entry): entry is readonly [SessionId, StoredTelemetry] => entry[1] !== null,
  )
}

export const createHistoryDeletion = (
  sessions: SessionService,
  telemetry: TelemetryService,
): HistoryDeletion => ({
  deleteSession: async (id) => {
    const session = await sessions.getById(id)
    const stored = await telemetry.getStored(id)

    await telemetry.remove(id)
    await sessions.remove(id)

    return {
      sessions: session === null ? [] : [session],
      telemetry: stored === null ? [] : [[id, stored]],
    }
  },

  clearAll: async () => {
    const all = await sessions.getAll()
    const stored = await withTelemetry(telemetry, all)

    // Both repositories clear by key prefix rather than by index, so detail left
    // behind by any earlier inconsistency goes too.
    await telemetry.clear()
    await sessions.clear()

    return { sessions: all, telemetry: stored }
  },

  restore: async (deleted) => {
    // Oldest first. Telemetry keeps only the most recent sessions, evicting in
    // the order records were saved, so restoring in completion order keeps the
    // same newest ones it kept before.
    const ordered = [...deleted.sessions].sort((a, b) => a.completedAt - b.completedAt)
    const storedById = new Map(deleted.telemetry)

    // Started in order and awaited together: each repository queues its writes
    // in the order they are requested, so the order above is the order they
    // land in.
    await Promise.all(
      ordered.flatMap((session) => {
        const stored = storedById.get(session.id)
        return stored === undefined
          ? [sessions.save(session)]
          : [sessions.save(session), telemetry.save(session.id, stored)]
      }),
    )
  },
})

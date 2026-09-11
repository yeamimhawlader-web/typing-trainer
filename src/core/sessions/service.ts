/**
 * The session service — the only thing the UI talks to about history.
 *
 * It sits between the typing screen and the repository so that neither the
 * screen nor the engine knows what storage exists:
 *
 *   engine → SessionResult → sessionService → SessionRepository → storage
 *
 * The six methods mirror the repository exactly, which looks like a pointless
 * layer until the first thing that is not storage needs to happen on save — a
 * personal best, a streak, an upload. That belongs here, above the thing whose
 * only job is to put bytes somewhere.
 *
 * Errors are *not* swallowed here. A caller that wants to carry on regardless
 * should say so explicitly, and the typing screen does exactly that.
 */

import type { SessionId } from '@core/types'

import { createSessionRepository } from './repository.ts'
import type { SessionRepository, TypingSession } from './types.ts'

/** How many sessions the history view asks for by default. */
export const DEFAULT_RECENT_LIMIT = 50

export interface SessionService {
  save(session: TypingSession): Promise<void>
  getById(id: SessionId): Promise<TypingSession | null>
  /** Newest first, at most `limit` records. */
  getRecent(limit?: number): Promise<readonly TypingSession[]>
  /** Newest first. */
  getAll(): Promise<readonly TypingSession[]>
  remove(id: SessionId): Promise<void>
  clear(): Promise<void>
}

export const createSessionService = (
  repository: SessionRepository,
): SessionService => ({
  save: (session) => repository.save(session),
  getById: (id) => repository.getById(id),
  getRecent: (limit = DEFAULT_RECENT_LIMIT) => repository.getRecent(limit),
  getAll: () => repository.getAll(),
  remove: (id) => repository.remove(id),
  clear: () => repository.clear(),
})

/** Convenience for the composition root: service over a storage adapter. */
export const createSessionServiceOver = (
  ...args: Parameters<typeof createSessionRepository>
): SessionService => createSessionService(createSessionRepository(...args))

/**
 * The telemetry service — the only thing outside this module talks to.
 *
 * Mirrors the session service: capture, read, delete, clear. Capture takes a
 * finished `SessionResult` and returns the compact form; reading gives back
 * fully derived telemetry, since a caller wants the analysis-ready record
 * rather than the packed one.
 */

import type { SessionId, SessionResult } from '@core/types'

import { deriveSessionTelemetry } from './derive.ts'
import { decodeTelemetry, encodeTelemetry } from './encode.ts'
import type { SessionTelemetryEntry } from './persistent.ts'
import { createTelemetryRepository, type TelemetryRepository } from './repository.ts'
import type { SessionTelemetry, StoredTelemetry } from './types.ts'

export interface TelemetryService {
  /** Packs a finished session's keystrokes. Pure; no storage touched. */
  capture(result: SessionResult): StoredTelemetry
  save(sessionId: SessionId, telemetry: StoredTelemetry): Promise<void>
  /**
   * Derived telemetry for a session, or null when none was kept.
   *
   * `text` is the session's target — the source of `expected`, and therefore of
   * everything about correctness. It is passed in rather than looked up so this
   * module never needs to know how sessions are stored.
   */
  getBySessionId(sessionId: SessionId, text: string): Promise<SessionTelemetry | null>
  /**
   * Derived telemetry for many sessions at once, in the order given.
   *
   * For cross-session analysis, which needs the whole set or none of it. A
   * session with no stored telemetry comes back as a null entry rather than
   * being dropped, so the caller can still say how many sessions it looked at
   * versus how many had detail — the difference is what makes "not enough
   * history yet" an honest message instead of a guess.
   *
   * One unreadable record does not fail the batch. A corrupt blob among thirty
   * should cost that one session, not the whole analysis.
   */
  getMany(
    sessions: readonly TelemetrySessionRef[],
  ): Promise<readonly SessionTelemetryEntry[]>
  remove(sessionId: SessionId): Promise<void>
  clear(): Promise<void>
}

/** The parts of a session this module needs: its id, and the text it was typed against. */
export interface TelemetrySessionRef {
  readonly id: SessionId
  readonly text: string
}

export const createTelemetryService = (
  repository: TelemetryRepository,
): TelemetryService => ({
  capture: (result) => encodeTelemetry(result.keystrokes),

  save: (sessionId, telemetry) => repository.save(sessionId, telemetry),

  getBySessionId: async (sessionId, text) => {
    const stored = await repository.getById(sessionId)
    if (stored === null) return null

    return deriveSessionTelemetry(decodeTelemetry(stored, text), text)
  },

  getMany: (sessions) =>
    Promise.all(
      sessions.map(async ({ id, text }): Promise<SessionTelemetryEntry> => {
        try {
          const stored = await repository.getById(id)
          const telemetry =
            stored === null ? null : deriveSessionTelemetry(decodeTelemetry(stored, text), text)

          return { sessionId: String(id), telemetry }
        } catch (error) {
          console.warn('[telemetry] failed to read detail for a session', id, error)
          return { sessionId: String(id), telemetry: null }
        }
      }),
    ),

  remove: (sessionId) => repository.remove(sessionId),
  clear: () => repository.clear(),
})

export const createTelemetryServiceOver = (
  ...args: Parameters<typeof createTelemetryRepository>
): TelemetryService => createTelemetryService(createTelemetryRepository(...args))

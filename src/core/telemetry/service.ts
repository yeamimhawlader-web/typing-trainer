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
  remove(sessionId: SessionId): Promise<void>
  clear(): Promise<void>
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

  remove: (sessionId) => repository.remove(sessionId),
  clear: () => repository.clear(),
})

export const createTelemetryServiceOver = (
  ...args: Parameters<typeof createTelemetryRepository>
): TelemetryService => createTelemetryService(createTelemetryRepository(...args))

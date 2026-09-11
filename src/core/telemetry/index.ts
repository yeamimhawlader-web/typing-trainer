/**
 * Typing telemetry — public entry point.
 *
 * Detailed keystroke data for a finished session: what was typed, when, where,
 * and what became of every mistake. Collected for future training modes to
 * build on; no analysis of it is built yet.
 *
 * Raw telemetry is not spread through the application. The typing screen
 * captures and saves it and never reads it back; anything wanting to study it
 * asks `telemetryService` for a derived record.
 */

import { storage } from '@core/persistence'

import { createTelemetryServiceOver } from './service.ts'

export type {
  CorrectionTelemetry,
  KeystrokeTelemetry,
  SessionTelemetry,
  StoredKeystroke,
  StoredTelemetry,
  TelemetrySummary,
  WordTelemetry,
} from './types.ts'
export { STORAGE_COST, TELEMETRY_VERSION } from './types.ts'

export { deriveSessionTelemetry } from './derive.ts'
export { decodeTelemetry, encodeTelemetry, parseStoredTelemetry } from './encode.ts'

export { createTelemetryRepository, RETENTION_LIMIT } from './repository.ts'
export type { TelemetryRepository, TelemetryRepositoryOptions } from './repository.ts'

export { createTelemetryService, createTelemetryServiceOver } from './service.ts'
export type { TelemetryService } from './service.ts'

/** The application's telemetry service, over the configured storage. */
export const telemetryService = createTelemetryServiceOver(storage)

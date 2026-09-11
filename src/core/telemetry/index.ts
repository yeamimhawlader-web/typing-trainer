/**
 * Typing telemetry — public entry point.
 *
 * Detailed keystroke data for a finished session: what was typed, when, where,
 * and what became of every mistake.
 *
 * Two analyses read it, both experiments and both saying so: `sequences` ranks
 * the slowest transitions of a single test, and `persistent` asks which ones
 * are consistently slow across accumulated history. Neither recommends anything
 * to practise; no training mode is built yet.
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

export { analyseSlowSequences, collectCleanTransitions, MINIMUM_OBSERVATIONS } from './sequences.ts'
export type {
  CleanTransitions,
  SequenceOptions,
  SequenceReport,
  SequenceTiming,
} from './sequences.ts'

export {
  analysePersistentSequences,
  MAX_SESSIONS_ANALYSED,
  PERSISTENT_THRESHOLDS,
} from './persistent.ts'
export type {
  PersistentSequenceOptions,
  PersistentSequenceReport,
  PersistentThresholds,
  SequenceEvidence,
  SessionTelemetryEntry,
} from './persistent.ts'

export { median, quantile, spreadOf } from './distribution.ts'
export type { Spread } from './distribution.ts'
export { decodeTelemetry, encodeTelemetry, parseStoredTelemetry } from './encode.ts'

export { createTelemetryRepository, RETENTION_LIMIT } from './repository.ts'
export type { TelemetryRepository, TelemetryRepositoryOptions } from './repository.ts'

export { createTelemetryService, createTelemetryServiceOver } from './service.ts'
export type { TelemetryService, TelemetrySessionRef } from './service.ts'

/** The application's telemetry service, over the configured storage. */
export const telemetryService = createTelemetryServiceOver(storage)

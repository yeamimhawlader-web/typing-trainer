/**
 * Typing telemetry — public entry point.
 *
 * Detailed keystroke data for a finished session: what was typed, when, where,
 * and what became of every mistake.
 *
 * Four analyses read it: `sequences` ranks the slowest transitions of a single
 * test, `persistent` asks which ones are consistently slow across accumulated
 * history, `shape` reads one test's speed and mistakes second by second, and
 * `keys` asks which single keys get missed.
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

export { compareToBaseline, measureDrill } from './drill.ts'
export type { DrillComparison, DrillOutcome } from './drill.ts'

export {
  analysePersistentSequences,
  EVIDENCE_TIERS,
  findSequenceBaseline,
  MAX_SESSIONS_ANALYSED,
  PERSISTENT_THRESHOLDS,
  signTestProbability,
} from './persistent.ts'
export type {
  EvidenceTier,
  PersistentSequenceOptions,
  PersistentSequenceReport,
  PersistentThresholds,
  SequenceBaseline,
  SequenceEvidence,
  SessionTelemetryEntry,
  TypicalRange,
} from './persistent.ts'

export { keyCosts, KEY_RULES } from './keys.ts'
export type { KeyCost, KeyCostReport } from './keys.ts'

export { shapeOfTest, SHAPE_RULES } from './shape.ts'
export type { TestShape, TestShapePoint } from './shape.ts'

export { median, quantile, spreadOf } from './distribution.ts'
export type { Spread } from './distribution.ts'
export { decodeTelemetry, encodeTelemetry, parseStoredTelemetry } from './encode.ts'

export { createTelemetryRepository, RETENTION_LIMIT } from './repository.ts'
export type { TelemetryRepository, TelemetryRepositoryOptions } from './repository.ts'

export { createTelemetryService, createTelemetryServiceOver } from './service.ts'
export type { TelemetryService, TelemetrySessionRef } from './service.ts'

/** The application's telemetry service, over the configured storage. */
export const telemetryService = createTelemetryServiceOver(storage)

/**
 * History maintenance — public entry point.
 *
 * Operations that span sessions and their telemetry together. Today that is
 * deletion, which must remove both or neither, from every screen alike.
 */

import { sessionService } from '@core/sessions'
import { telemetryService } from '@core/telemetry'

import { createHistoryDeletion } from './deletion.ts'

export { createHistoryDeletion } from './deletion.ts'
export type { DeletedHistory, HistoryDeletion } from './deletion.ts'

/** The application's deletion service, over the configured storage. */
export const historyDeletion = createHistoryDeletion(sessionService, telemetryService)

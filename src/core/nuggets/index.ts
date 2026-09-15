/**
 * Golden Nuggets — public entry point.
 *
 * Words Hover Mode released before they cleared, kept so they can be revisited.
 * See `types.ts` for what a record holds and why.
 */

import { storage } from '@core/persistence'

import { createGoldenNuggetService } from './service.ts'

export type { GoldenNugget, HoverFocusOutcome } from './types.ts'
export { applyFocusOutcome, byLastSeen, normaliseWord, nuggetIdOf } from './merge.ts'
export type { NuggetChange } from './merge.ts'
export { createGoldenNuggetService, parseGoldenNugget } from './service.ts'
export type { GoldenNuggetService } from './service.ts'

/** The application's Golden Nuggets, over the configured storage. */
export const goldenNuggetService = createGoldenNuggetService(storage)

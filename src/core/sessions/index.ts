/**
 * Session history — public entry point.
 *
 * The UI imports `sessionService` and the session type from here, and nothing
 * else. It never sees a repository, a storage adapter, or a browser storage API.
 */

import { storage } from '@core/persistence'

import { createSessionServiceOver } from './service.ts'

export type {
  HoverFocusRecord,
  HoverSessionRecord,
  KeyboardLayout,
  LanguageCode,
  SessionContext,
  SessionDifficulty,
  SessionMode,
  SessionRepository,
  TypingSession,
} from './types.ts'

export { difficultyOf, isTrainingMode, TRAINING_MODES } from './types.ts'

export { DEFAULT_SESSION_CONTEXT } from './defaults.ts'

export { createTypingSession } from './factory.ts'
export type { CreateSessionOptions } from './factory.ts'

export { createSessionRepository } from './repository.ts'

export {
  createSessionService,
  createSessionServiceOver,
  DEFAULT_RECENT_LIMIT,
} from './service.ts'
export type { SessionService } from './service.ts'

export {
  assertValidSession,
  InvalidSessionError,
  parseTypingSession,
} from './validation.ts'

/** The application's session service, over the configured storage. */
export const sessionService = createSessionServiceOver(storage)

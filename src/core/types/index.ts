/**
 * Public entry point for the shared domain vocabulary.
 * Import from '@core/types', never from the individual files.
 */

export type { Brand } from './brand.ts'

export type { Accuracy, Milliseconds, SessionId, Timestamp, Wpm } from './primitives.ts'

export {
  accuracy,
  CHARACTERS_PER_WORD,
  MILLISECONDS_PER_MINUTE,
  milliseconds,
  sessionId,
  timestamp,
  wpm,
} from './primitives.ts'

export type {
  CharacterState,
  Keystroke,
  KeystrokeKind,
  SessionMetrics,
  SessionResult,
  SessionStatus,
  SessionTarget,
} from './session.ts'

export type { PracticeWordCount, ThemePreference, UserPreferences } from './preferences.ts'
export { PRACTICE_WORD_COUNTS } from './preferences.ts'

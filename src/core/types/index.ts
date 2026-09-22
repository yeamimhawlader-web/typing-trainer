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

export type {
  HoverDifficulty,
  PaceChoice,
  PracticeMode,
  PracticeWordCount,
  TextSize,
  SoundPreference,
  StreamFont,
  ThemePreference,
  UserPreferences,
  Vocabulary,
} from './preferences.ts'
export {
  HOVER_DIFFICULTIES,
  PACE_CHOICES,
  PRACTICE_MODES,
  PRACTICE_WORD_COUNTS,
  STREAM_FONTS,
  TEXT_SIZES,
  VOCABULARIES,
} from './preferences.ts'

/**
 * Typing — public entry point.
 *
 * The typing test as a whole (`TypingTest`, the classic screen) and the parts a
 * second presentation needs to run the same test: the session composition, the
 * engine subscription hook, the live-figure selectors, the event-time rule, and
 * the result, hint and announcement components.
 */

export { TypingTest } from './TypingTest.tsx'
export type { DrillSettings, TypingTestProps } from './TypingTest.tsx'

export { useTypingScreen } from './hooks/useTypingScreen.ts'
export type { TypingScreen, TypingScreenOptions } from './hooks/useTypingScreen.ts'
export { WORD_COUNT_OPTIONS } from './hooks/useTypingSession.ts'
export type { SaveState, SessionModeHooks, WordCount, WordCountPreference } from './hooks/useTypingSession.ts'
export { useEngineValue } from './hooks/useEngineValue.ts'
export { resolveEventTime } from './hooks/useKeyboardInput.ts'

export {
  MIN_ELAPSED_FOR_WPM_MS,
  ACCURACY_STATES,
  selectAccuracyPercent,
  selectAccuracyState,
  selectElapsedSeconds,
  selectLiveWpm,
} from './live-values.ts'
export type { AccuracyState } from './live-values.ts'

export {
  clampTime,
  createTimedMode,
  CUSTOM_TIME,
  DEFAULT_SECONDS,
  isValidTime,
  TIME_OPTIONS,
  wordsForTime,
} from './modes/timed.ts'
export { SYLLABLE_MODE } from './modes/syllable.ts'
export type { TimeOption } from './modes/timed.ts'

export { ResultAnnouncement } from './components/ResultAnnouncement.tsx'
export { SessionHint } from './components/SessionHint.tsx'
export { TestResult } from './components/TestResult.tsx'

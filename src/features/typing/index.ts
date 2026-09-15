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
  selectAccuracyPercent,
  selectElapsedSeconds,
  selectLiveWpm,
} from './live-values.ts'

export { ResultAnnouncement } from './components/ResultAnnouncement.tsx'
export { SessionHint } from './components/SessionHint.tsx'
export { TestResult } from './components/TestResult.tsx'

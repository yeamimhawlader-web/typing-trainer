/**
 * The Syllable Trainer, as a shape of test.
 *
 * Nothing about how a test runs changes: it ends when the last letter is typed,
 * as a word test does, with the same idle cap on the clock, and every key is
 * compared by the engine exactly as it is anywhere else. The syllables are only
 * drawn over the text. What this adds is the name the test is saved under, so
 * history can tell a Syllable Trainer test from ordinary practice and analyses
 * of ordinary typing leave it out (see TRAINING_MODES).
 */

import type { SessionModeHooks } from '../hooks/useTypingSession.ts'
import { createTimedMode } from './timed.ts'

export const SYLLABLE_MODE: SessionModeHooks = {
  isComplete: (snapshot) => snapshot.cursorIndex >= snapshot.characters.length,
  finalContext: (context) => ({ ...context, mode: 'syllable' }),
  key: 'syllable',
}

/**
 * The Syllable Trainer against the clock: the timed test's rules — the time
 * ends it, idle time is still time, enough words that they do not run out —
 * saved under the trainer's name, with the time it ran for beside it.
 */
export const createTimedSyllableMode = (seconds: number): SessionModeHooks => {
  const timed = createTimedMode(seconds)
  return {
    ...timed,
    finalContext: (context) => ({ ...timed.finalContext(context), mode: 'syllable' }),
    key: `syllable:${timed.key}`,
  }
}

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

export const SYLLABLE_MODE: SessionModeHooks = {
  isComplete: (snapshot) => snapshot.cursorIndex >= snapshot.characters.length,
  finalContext: (context) => ({ ...context, mode: 'syllable' }),
  key: 'syllable',
}

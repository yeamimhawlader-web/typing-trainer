/**
 * Default user preferences — the state of a first-run install.
 *
 * Kept separate from appConfig because these are starting values the typist
 * will overwrite, not settings fixed by the build.
 */

import type { UserPreferences } from '@core/types'

export const DEFAULT_PREFERENCES: UserPreferences = {
  // Classic Milk: the first impression of a fresh installation. Only a
  // preference that was never saved takes it; a chosen theme is kept.
  theme: 'classic-milk',
  practiceWordCount: 30,
  // Words by default, as the application has always opened; thirty seconds is
  // the timed test it offers first.
  practiceMode: 'words',
  practiceSeconds: 30,
  textSize: 'sm',
  // The slab face, open and even at speed; the others are a press away.
  streamFont: 'slab',
  // The frequent words: where every typist starts.
  vocabulary: 'normal',
  // The least persistent: a word is repeated for one cycle and let go.
  hoverDifficulty: 'standard',
  // Silence until it is asked for, and at the level the packs were made at.
  sound: 'off',
  soundVolume: 100,
  // No caret to follow until one is chosen.
  pace: 'off',
  // Plain words, as the application has always opened; the harder drill is chosen.
  punctuation: false,
  numbers: false,
}

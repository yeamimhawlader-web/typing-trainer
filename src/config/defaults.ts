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
  // Arcade Gremlin, the recorded preset, from the first keystroke: the pack
  // under it and its recordings, as SOUND_PRESETS has them (a test keeps the
  // two the same). Only a preference never saved takes it — anyone who chose a
  // sound, Off included, keeps what they chose. At the level the packs were made at.
  sound: 'blip',
  soundVolume: 100,
  soundSamples: {
    key: 'anime-motion31-1high',
    space: 'balloon01-04slap',
    backspace: 'nes-action01-06throw',
    mistake: 'cat-synthetic01-1',
    mistakeStreak: 'princess-guard2',
    finish: 'success1',
    best: 'people-performance-uwaa1',
    selectorOpen: 'nyu2',
    selectorClose: 'cancel4',
    hoverCleared: 'line-girl1-yaa2',
    hoverMissed: 'line-girl1-uu2',
    hoverKept: 'maou_se_onepoint23',
    allInLaugh: 'line-girl1-ahahaha2',
    idle: 'line-girl1-zii1',
  },
  // No caret to follow until one is chosen.
  pace: 'off',
  // Plain words, as the application has always opened; the harder drill is chosen.
  punctuation: false,
  numbers: false,
  opening: 'portal',
  // The glide: the line break was the one moment in a test that lurched.
  lineScroll: 'glide',
  // The bar: a rule at the leading edge of the character being typed, which
  // is what most typing tests draw and what covers nothing. The block the
  // screen drew before it is a press away in settings.
  caret: 'bar',
}

/**
 * Default user preferences — the state of a first-run install.
 *
 * Kept separate from appConfig because these are starting values the typist
 * will overwrite, not settings fixed by the build.
 */

import type { UserPreferences } from '@core/types'

export const DEFAULT_PREFERENCES: UserPreferences = {
  // Dark by default: this is a tool for long, focused, daily sessions.
  theme: 'default-dark',
  practiceWordCount: 30,
  textSize: 'sm',
  // The least persistent: a word is repeated for one cycle and let go.
  hoverDifficulty: 'standard',
}

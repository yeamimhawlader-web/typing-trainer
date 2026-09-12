/**
 * User preferences — persisted, user-owned settings.
 *
 * Distinct from application configuration (see src/config): configuration is
 * fixed at build time and identical for everyone, preferences are chosen by the
 * typist at runtime and survive restarts.
 */

export type ThemePreference = 'dark' | 'light'

/** The practice lengths on offer, in words. */
export const PRACTICE_WORD_COUNTS = [15, 30, 60] as const
export type PracticeWordCount = (typeof PRACTICE_WORD_COUNTS)[number]

export interface UserPreferences {
  readonly theme: ThemePreference
  /**
   * The length ordinary practice opens at. Remembered because it is the one
   * choice a daily typist makes every visit; before, a 60-word typist had to pick
   * 60 again after every reload. Drills ignore it — a drill is its own length.
   */
  readonly practiceWordCount: PracticeWordCount
}

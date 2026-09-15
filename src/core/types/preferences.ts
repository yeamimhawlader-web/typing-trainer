/**
 * User preferences — persisted, user-owned settings.
 *
 * Distinct from application configuration (see src/config): configuration is
 * fixed at build time and identical for everyone, preferences are chosen by the
 * typist at runtime and survive restarts.
 */

/**
 * A theme, by its id in the GG.Typing theme registry
 * (`features/gg-ui/themes/themes.ts`).
 *
 * A string rather than a union of ids: the registry is the one list of themes,
 * so adding a theme is one object there and nothing here. A stored value is
 * checked against the registry when preferences are read, and the two themes of
 * earlier versions, `dark` and `light`, are carried over to their equivalents.
 */
export type ThemePreference = string

/** The practice lengths on offer, in words. */
export const PRACTICE_WORD_COUNTS = [15, 30, 60] as const
export type PracticeWordCount = (typeof PRACTICE_WORD_COUNTS)[number]

/** The sizes the typing text can be set in. */
export const TEXT_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const
export type TextSize = (typeof TEXT_SIZES)[number]

export interface UserPreferences {
  readonly theme: ThemePreference
  /**
   * The length ordinary practice opens at. Remembered because it is the one
   * choice a daily typist makes every visit; before, a 60-word typist had to pick
   * 60 again after every reload. Drills ignore it — a drill is its own length.
   */
  readonly practiceWordCount: PracticeWordCount
  /** The size of the typing text on the GG.Typing screen. */
  readonly textSize: TextSize
}

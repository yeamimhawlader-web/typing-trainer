/**
 * User preferences — persisted, user-owned settings.
 *
 * Distinct from application configuration (see src/config): configuration is
 * fixed at build time and identical for everyone, preferences are chosen by the
 * typist at runtime and survive restarts.
 */

export type ThemePreference = 'dark' | 'light'

export interface UserPreferences {
  readonly theme: ThemePreference
}

/**
 * The page's first paint, in the right scheme, before the application loads.
 *
 * The stylesheet arrives before the application's script runs, and on its own
 * it draws the page dark: that is the classic palette with no scheme chosen.
 * A fresh installation opens in Classic Milk, so for the moment before the
 * script runs its first impression would be a flash of near-black. This is a
 * few lines run inline in the page head, before anything is painted: they read
 * the saved theme straight from storage and set its scheme. With nothing saved
 * — a fresh installation — the scheme is Classic Milk's, light. A saved dark
 * theme stays dark, so nobody who chose one gets a flash of light instead.
 *
 * Built into index.html at build time (see vite.config.ts) from the theme
 * registry itself, so a new dark theme needs no change here. No DOM types: the
 * build reads this file too.
 */

import { GG_THEMES } from './themes.ts'

/** The storage key preferences are saved under: the application's namespace, version and key. */
export const PREFERENCES_STORAGE_KEY = 'typing-trainer:v1:preferences'

/** Every stored theme value that means a dark scheme: the dark themes, and the old `dark`. */
export const darkThemeValues = (): readonly string[] => [
  'dark',
  ...GG_THEMES.filter((theme) => theme.scheme === 'dark').map((theme) => theme.id),
]

export const firstPaintScript = (): string =>
  [
    '(function () {',
    '  var theme = null;',
    `  try { theme = JSON.parse(localStorage.getItem(${JSON.stringify(PREFERENCES_STORAGE_KEY)})).theme; } catch (error) {}`,
    `  document.documentElement.setAttribute('data-theme', ${JSON.stringify(darkThemeValues())}.indexOf(theme) >= 0 ? 'dark' : 'light');`,
    '})();',
  ].join('\n')

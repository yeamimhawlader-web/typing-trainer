/**
 * Puts a theme on `:root`, all at once.
 *
 * A switch is instant: every colour on the page changes on the same frame. The
 * GG components transition no colours of their own, but the application's
 * shared components inside the shell do — the result panel's buttons ease their
 * hover colours — and left alone they would trail the rest of the page into the
 * new theme. So transitions are held off for the moment the theme is written:
 * an attribute switches them off, the properties change, style is recalculated
 * with them off, and the attribute comes away again. Nothing animates, because
 * nothing was allowed to start.
 */

import { GG_THEMES, themeProperties, type GGTheme } from './themes.ts'

export const THEME_SWITCHING_ATTRIBUTE = 'data-gg-theme-switching'

export const applyTheme = (theme: GGTheme, root: HTMLElement = document.documentElement): void => {
  root.setAttribute(THEME_SWITCHING_ATTRIBUTE, '')

  for (const [property, value] of Object.entries(themeProperties(theme))) {
    root.style.setProperty(property, value)
  }
  root.dataset.ggTheme = theme.id

  // Style has to be worked out while transitions are still off; otherwise it
  // happens after the attribute is gone and the transitions start anyway. One
  // forced recalculation per theme switch, never while typing.
  void root.offsetWidth
  root.removeAttribute(THEME_SWITCHING_ATTRIBUTE)
}

/** Takes the theme's properties back off `:root`, for leaving the GG shell. */
export const removeTheme = (root: HTMLElement = document.documentElement): void => {
  root.removeAttribute(THEME_SWITCHING_ATTRIBUTE)
  // Only the property names are needed, and every theme writes the same ones.
  for (const property of Object.keys(themeProperties(GG_THEMES[0]))) {
    root.style.removeProperty(property)
  }
  delete root.dataset.ggTheme
}

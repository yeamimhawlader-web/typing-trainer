/**
 * Puts a theme on `:root`, cross-fading from whatever was there.
 *
 * The colour transition is not left on permanently. A standing
 * `transition: color 400ms` on every element would also fade each character
 * changing state mid-test, and typing feedback has to be instant. So the
 * transition is switched on by an attribute for exactly the length of a switch,
 * the properties change underneath it, and it is switched off again.
 *
 * With reduced motion the fade is shortened to 120ms rather than removed: a
 * whole-screen colour snap is itself a jolt.
 */

import { GG_THEMES, themeProperties, type GGTheme } from './themes.ts'

export const THEME_FADE_ATTRIBUTE = 'data-gg-theme-fading'
export const THEME_FADE_MS = 400
export const THEME_FADE_REDUCED_MS = 120
/** How long the transition rule outlives the fade itself. */
export const THEME_FADE_MARGIN_MS = 250

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

let fadeTimer: ReturnType<typeof setTimeout> | undefined

export const applyTheme = (
  theme: GGTheme,
  { fade = true, root = document.documentElement }: { fade?: boolean; root?: HTMLElement } = {},
): void => {
  if (fade) {
    root.setAttribute(THEME_FADE_ATTRIBUTE, '')
    // The attribute has to be in effect before the colours change, or there is
    // no transition to run. Reading a style flushes it.
    void getComputedStyle(root).color

    if (fadeTimer !== undefined) clearTimeout(fadeTimer)
    const duration = prefersReducedMotion() ? THEME_FADE_REDUCED_MS : THEME_FADE_MS
    // Well past the end. The transitions start on the next frame, not the
    // instant the properties change, and on a busy frame that is 100ms later;
    // removing the rule at the nominal end then cuts the last part of the fade
    // into a snap, which a browser trace here showed. Holding it longer costs
    // nothing, because nobody is typing while choosing a theme.
    fadeTimer = setTimeout(() => {
      root.removeAttribute(THEME_FADE_ATTRIBUTE)
      fadeTimer = undefined
    }, duration + THEME_FADE_MARGIN_MS)
  }

  for (const [property, value] of Object.entries(themeProperties(theme))) {
    root.style.setProperty(property, value)
  }
  root.dataset.ggTheme = theme.id
}

/** Takes the theme's properties back off `:root`, for leaving the GG shell. */
export const removeTheme = (root: HTMLElement = document.documentElement): void => {
  if (fadeTimer !== undefined) clearTimeout(fadeTimer)
  root.removeAttribute(THEME_FADE_ATTRIBUTE)
  // Only the property names are needed, and every theme writes the same ones.
  for (const property of Object.keys(themeProperties(GG_THEMES[0]))) {
    root.style.removeProperty(property)
  }
  delete root.dataset.ggTheme
}

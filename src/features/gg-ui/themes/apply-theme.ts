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
 *
 * The browser's own furniture is taken with it. A phone tints the bar above the
 * page, and a window installed from the site tints its title bar, both from
 * `theme-color`; left at one baked-in value, a typist on Midnight gets a cream
 * strip above a near-black page. So the theme writes that too, and leaving the
 * shell puts back what the document shipped with.
 */

import { GG_THEMES, themeProperties, type GGTheme } from './themes.ts'

export const THEME_SWITCHING_ATTRIBUTE = 'data-gg-theme-switching'

/** What the document was served with, kept so it can be restored. */
let shippedThemeColor: string | null = null

const themeColorMeta = (): HTMLMetaElement | null =>
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

const setBrowserChrome = (colour: string | null): void => {
  const meta = themeColorMeta()
  if (meta === null) return
  shippedThemeColor ??= meta.content
  meta.content = colour ?? shippedThemeColor
}

export const applyTheme = (theme: GGTheme, root: HTMLElement = document.documentElement): void => {
  root.setAttribute(THEME_SWITCHING_ATTRIBUTE, '')

  for (const [property, value] of Object.entries(themeProperties(theme))) {
    root.style.setProperty(property, value)
  }
  root.dataset.ggTheme = theme.id
  setBrowserChrome(theme.colors.bg)

  // Style has to be worked out while transitions are still off; otherwise it
  // happens after the attribute is gone and the transitions start anyway. One
  // forced recalculation per theme switch, never while typing.
  void root.offsetWidth
  root.removeAttribute(THEME_SWITCHING_ATTRIBUTE)
}

/** What `switchTheme` needs of the document: the browser's crossfade, where it has one. */
export interface Crossfader {
  startViewTransition?: (update: () => void) => unknown
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

const asksForLessMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION).matches

/**
 * Changes from one theme to another, crossfading where the browser can.
 *
 * `applyTheme` is instant by design, and stays so: every element changes on
 * the same frame, nothing trails. What changes here is what is *seen*. The
 * browser photographs the page, the theme is applied — instantly, as ever —
 * the page is photographed again, and the first picture fades into the second
 * over a quarter of a second, on the compositor, as two images rather than a
 * page full of elements each easing its own colours. So the switch reads as one
 * scheme melting into the other instead of a light being flicked, and costs the
 * same whatever is on the page.
 *
 * Where the browser has no crossfade, or the typist has asked their system for
 * less motion, it is the instant switch it always was.
 *
 * Only for a switch. The theme a page opens in is applied with `applyTheme`,
 * since there is nothing before it to fade from.
 */
export const switchTheme = (
  theme: GGTheme,
  {
    crossfade = typeof document === 'undefined' ? {} : (document as Crossfader),
    reducedMotion = asksForLessMotion(),
  }: { readonly crossfade?: Crossfader; readonly reducedMotion?: boolean } = {},
): void => {
  const start = crossfade.startViewTransition
  if (typeof start !== 'function' || reducedMotion) {
    applyTheme(theme)
    return
  }
  start.call(crossfade, () => applyTheme(theme))
}

/** Takes the theme's properties back off `:root`, for leaving the GG shell. */
export const removeTheme = (root: HTMLElement = document.documentElement): void => {
  root.removeAttribute(THEME_SWITCHING_ATTRIBUTE)
  // Only the property names are needed, and every theme writes the same ones.
  for (const property of Object.keys(themeProperties(GG_THEMES[0]))) {
    root.style.removeProperty(property)
  }
  delete root.dataset.ggTheme
  setBrowserChrome(null)
}

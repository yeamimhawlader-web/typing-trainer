/**
 * Which moves between pages fade from one into the other.
 *
 * A page change used to be a cut: one frame the old page, the next frame the
 * new one. Now the browser photographs the page, the router renders the new
 * one, and the first picture fades into the second (the same view transition
 * the theme switch uses; its timing is in gg-foundation.css). The top bar is
 * the same pixels in both pictures, so it holds perfectly still while the page
 * under it changes, and the app reads as one place rather than a set of pages.
 *
 * Not everything that is a route change is a change of page, though:
 *
 * - The typing screens the mode selector moves between — ordinary practice,
 *   Hover Mode, the Syllable Trainer, Hover Mode over Golden Nuggets — are
 *   routes, but moving between them plays the branch unfold, carried across
 *   the change of route on purpose. Fading over that would show two copies of
 *   the branches, one fading out over the other.
 * - A page into itself has nothing to fade.
 * - Anyone who has asked their system for less motion gets the cut.
 *
 * Back and forward are left to the browser as they always were: they never come
 * through `navigate`, which is where this is applied (app/router.tsx).
 */

import type { DataRouter, RouterNavigateOptions, To } from 'react-router'

import { ROUTES } from './routes.ts'

/** The screens the mode selector moves between, which carry their own motion across the change. */
const MODE_SCREENS: ReadonlySet<string> = new Set([
  ROUTES.gg,
  ROUTES.ggHover,
  ROUTES.ggSyllables,
  ROUTES.ggHoverNuggets,
])

const trimmed = (path: string): string => (path.length > 1 ? path.replace(/\/+$/, '') : path)

export const crossfadesBetween = (from: string, to: string, reducedMotion: boolean): boolean => {
  if (reducedMotion) return false
  const before = trimmed(from)
  const after = trimmed(to)
  if (before === after) return false
  return !(MODE_SCREENS.has(before) && MODE_SCREENS.has(after))
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

export const asksForLessMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION).matches

/** The path a navigation is going to, read the way the browser would resolve it. */
const destination = (to: To, from: string): string =>
  typeof to === 'string' ? new URL(to, `https://page${from}`).pathname : (to.pathname ?? from)

/**
 * Has `router` ask for the crossfade on every navigation that changes page.
 *
 * Done once, on the router itself, because every link and every `navigate()`
 * in the application arrives at `router.navigate`: the alternative was the same
 * option written into thirty-six places, and the thirty-seventh link forgetting
 * it. A navigation that already says what it wants keeps it, and going back or
 * forward by a number is passed through untouched.
 */
export const withPageCrossfade = <R extends DataRouter>(router: R, lessMotion: () => boolean = asksForLessMotion): R => {
  const navigate = router.navigate.bind(router) as (to: To | number | null, options?: RouterNavigateOptions) => Promise<void>

  const crossfading = (to: To | number | null, options?: RouterNavigateOptions): Promise<void> => {
    if (to === null || typeof to === 'number') return navigate(to, options)
    const from = router.state.location.pathname
    const fades = crossfadesBetween(from, destination(to, from), lessMotion())
    // `??` rather than a default spread under the options: a <Link> names every
    // option it knows, unset ones as undefined, and a present undefined would
    // win over a default spread beneath it.
    return navigate(to, fades ? { ...options, viewTransition: options?.viewTransition ?? true } : options)
  }

  router.navigate = crossfading as R['navigate']
  return router
}

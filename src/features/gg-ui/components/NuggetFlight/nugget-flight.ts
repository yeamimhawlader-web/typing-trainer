/**
 * A word going to Golden Nuggets, where the typist can see it go.
 *
 * When Hover Mode keeps a word — its third mistake — a gold copy of it pops up
 * where the word is, bounces, and flies in an arc to the Golden Nuggets link
 * under the field, which bounces as it lands. About a second and a half in
 * all, and none of it in the typist's way: the copy is not the word (that
 * stays where it is, still being repeated), it takes no focus and no clicks,
 * and it is drawn over the page rather than in it, so nothing reflows.
 *
 * Plain DOM and the Web Animations API, like the rest of Hover Mode's motion:
 * a moment, not a state, so nothing renders because of it. Only transforms and
 * opacity move.
 *
 * ## The arc
 *
 * Two nested elements, one moving across and one moving up and down, each on
 * its own easing: across at an even pace, up quickly and then down faster, the
 * way a thrown thing goes. One element with one easing can only go in a
 * straight line.
 *
 * ## Less motion
 *
 * Someone who has asked their system for less motion gets no flight: the link
 * is marked gold for a moment, without moving. The word is kept either way,
 * and said either way by the screen's own announcement.
 */

import { NUGGET_GOLD as GOLD } from '../../themes/themes.ts'

import styles from './NuggetFlight.module.css'

export const NUGGET_FLIGHT = {
  /** The pop and bounce where the word is. */
  bounceMs: 520,
  /** The flight to the link. */
  flightMs: 680,
  /** How high the arc rises above where it started, in pixels. */
  riseBy: 70,
  /** The link's bounce as the nugget lands. */
  landMs: 560,
} as const

const prefersLessMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const centreOf = (rect: DOMRect): { readonly x: number; readonly y: number } => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
})

/** The link's own bounce, and its moment of gold. */
const land = (target: HTMLElement, still: boolean): void => {
  target.style.setProperty('--gg-nugget-gold', GOLD.edge)
  target.dataset.nuggetLanded = ''
  const done = (): void => {
    delete target.dataset.nuggetLanded
  }
  if (still || typeof target.animate !== 'function') {
    window.setTimeout(done, NUGGET_FLIGHT.landMs * 2)
    return
  }
  const bounce = target.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.28)', offset: 0.22 },
      { transform: 'scale(0.92)', offset: 0.48 },
      { transform: 'scale(1.08)', offset: 0.72 },
      { transform: 'scale(1)' },
    ],
    { duration: NUGGET_FLIGHT.landMs, easing: 'ease-out' },
  )
  bounce.addEventListener('finish', () => window.setTimeout(done, 600))
  bounce.addEventListener('cancel', done)
}

/**
 * Flies `word` from `from` to `target`. Returns a stop, which removes the copy
 * at once: for a screen that is going away.
 */
export const flyNugget = (word: string, from: HTMLElement, target: HTMLElement): (() => void) => {
  const still = prefersLessMotion()
  if (still || typeof from.animate !== 'function') {
    land(target, true)
    return () => undefined
  }

  const start = centreOf(from.getBoundingClientRect())
  const end = centreOf(target.getBoundingClientRect())
  const font = getComputedStyle(from)

  // Across, then up-and-down inside it, then the nugget itself.
  const across = document.createElement('div')
  const arc = document.createElement('div')
  const nugget = document.createElement('div')
  across.className = styles.across ?? ''
  arc.className = styles.arc ?? ''
  nugget.className = styles.nugget ?? ''
  nugget.textContent = word
  nugget.style.fontFamily = font.fontFamily
  nugget.style.fontSize = font.fontSize
  across.style.setProperty('--gg-nugget-fill', GOLD.fill)
  across.style.setProperty('--gg-nugget-edge', GOLD.edge)
  across.style.setProperty('--gg-nugget-ink', GOLD.ink)
  across.style.left = `${start.x}px`
  across.style.top = `${start.y}px`
  across.setAttribute('aria-hidden', 'true')
  arc.append(nugget)
  across.append(arc)
  document.body.append(across)

  let stopped = false
  const stop = (): void => {
    if (stopped) return
    stopped = true
    across.remove()
  }

  const { bounceMs, flightMs, riseBy } = NUGGET_FLIGHT
  const dx = end.x - start.x
  const dy = end.y - start.y

  // 1. Pops out of the word and bounces, twice, lower the second time.
  const bounce = nugget.animate(
    [
      { transform: 'translateY(0) scale(0.5)', opacity: 0 },
      { transform: 'translateY(-26px) scale(1.2)', opacity: 1, offset: 0.3 },
      { transform: 'translateY(0) scale(0.94, 1.02)', offset: 0.55 },
      { transform: 'translateY(-11px) scale(1.05)', offset: 0.75 },
      { transform: 'translateY(0) scale(1)', opacity: 1 },
    ],
    { duration: bounceMs, easing: 'cubic-bezier(0.3, 0, 0.3, 1)', fill: 'forwards' },
  )

  bounce.addEventListener('finish', () => {
    if (stopped) return
    // 2. The flight: across evenly, up and over, shrinking as it goes.
    across.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }], {
      duration: flightMs,
      easing: 'cubic-bezier(0.4, 0, 0.6, 1)',
      fill: 'forwards',
    })
    arc.animate(
      [
        { transform: 'translateY(0)', easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' },
        { transform: `translateY(${Math.min(-riseBy, dy - riseBy)}px)`, offset: 0.42, easing: 'cubic-bezier(0.55, 0, 0.9, 0.5)' },
        { transform: `translateY(${dy}px)` },
      ],
      { duration: flightMs, fill: 'forwards' },
    )
    const shrink = nugget.animate(
      [
        { transform: 'scale(1) rotate(0deg)', opacity: 1 },
        { transform: 'scale(0.75) rotate(-8deg)', opacity: 1, offset: 0.7 },
        { transform: 'scale(0.35) rotate(0deg)', opacity: 0 },
      ],
      { duration: flightMs, easing: 'ease-in', fill: 'forwards' },
    )
    // 3. Lands a touch before the copy has quite gone, so the two read as one event.
    window.setTimeout(() => {
      if (!stopped) land(target, false)
    }, flightMs * 0.86)
    shrink.addEventListener('finish', stop)
    shrink.addEventListener('cancel', stop)
  })
  bounce.addEventListener('cancel', stop)

  return stop
}

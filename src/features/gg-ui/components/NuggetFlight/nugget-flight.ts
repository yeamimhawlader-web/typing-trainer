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
  bounceMs: 460,
  /** The flight to the link. */
  flightMs: 760,
  /**
   * How high the arc rises above the higher of its two ends. A share of the
   * distance travelled, so a throw across a wide screen arcs like a throw
   * rather than sliding flat, held between a floor — a short hop still looks
   * thrown — and a ceiling, past which it leaves the page and comes back.
   */
  riseOfDistance: 0.16,
  riseAtLeast: 48,
  riseAtMost: 150,
  /** The link's bounce as the nugget lands. */
  landMs: 480,
  /** How far through the flight the link begins to bounce. */
  landsAt: 0.93,
} as const

/** The arc's height for a flight of this length. */
export const riseFor = (dx: number, dy: number): number => {
  const { riseOfDistance, riseAtLeast, riseAtMost } = NUGGET_FLIGHT
  return Math.min(riseAtMost, Math.max(riseAtLeast, Math.hypot(dx, dy) * riseOfDistance))
}

const prefersLessMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const centreOf = (rect: DOMRect): { readonly x: number; readonly y: number } => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
})

/** The link's own bounce, and its moment of gold. */
const land = (target: HTMLElement, still: boolean): void => {
  const accent = getComputedStyle(target).getPropertyValue('--gg-accent').trim()
  target.style.setProperty('--gg-nugget-gold', accent === '' ? GOLD.edge : accent)
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
      { transform: 'scale(1.16)', offset: 0.25 },
      { transform: 'scale(0.96)', offset: 0.55 },
      { transform: 'scale(1.03)', offset: 0.78 },
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
  // The page's own colours, read where the word is: the copy sits on the body,
  // outside the theme, and should still look like it came from this page.
  const theme = (name: string, fallback: string): string => font.getPropertyValue(name).trim() || fallback
  across.style.setProperty('--gg-nugget-fill', theme('--gg-surface', theme('--gg-bg', GOLD.fill)))
  across.style.setProperty('--gg-nugget-edge', theme('--gg-accent', GOLD.edge))
  across.style.setProperty('--gg-nugget-ink', theme('--gg-fg', GOLD.ink))
  across.style.left = `${start.x}px`
  across.style.top = `${start.y}px`
  across.setAttribute('aria-hidden', 'true')
  arc.append(nugget)
  across.append(arc)
  document.body.append(across)

  const { bounceMs, flightMs, landsAt } = NUGGET_FLIGHT

  let stopped = false
  let sweep = 0
  const stop = (): void => {
    if (stopped) return
    stopped = true
    window.clearTimeout(sweep)
    across.remove()
  }

  /*
   * The copy leaves the page whatever becomes of the animations.
   *
   * Everything below hangs off the bounce reporting that it finished, and a
   * browser that never reports it — a tab asleep through the whole flight,
   * an engine that drops the event — would otherwise leave a word sitting
   * over the page for good. Long enough to be a backstop and not a schedule.
   */
  sweep = window.setTimeout(stop, (bounceMs + flightMs) * 3 + 1_000)

  const dx = end.x - start.x
  const dy = end.y - start.y
  const rise = riseFor(dx, dy)

  // 1. Pops out of the word and bounces, twice, lower the second time.
  const bounce = nugget.animate(
    [
      { transform: 'translateY(0) scale(0.85)', opacity: 0 },
      { transform: 'translateY(-18px) scale(1.06)', opacity: 1, offset: 0.35 },
      { transform: 'translateY(0) scale(1.03, 0.96)', offset: 0.62 },
      { transform: 'translateY(-5px) scale(1)', offset: 0.82 },
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
        { transform: `translateY(${Math.min(-rise, dy - rise)}px)`, offset: 0.42, easing: 'cubic-bezier(0.55, 0, 0.9, 0.5)' },
        { transform: `translateY(${dy}px)` },
      ],
      { duration: flightMs, fill: 'forwards' },
    )
    const shrink = nugget.animate(
      [
        { transform: 'scale(1) rotate(0deg)', opacity: 1 },
        { transform: 'scale(0.8) rotate(-3deg)', opacity: 1, offset: 0.75 },
        { transform: 'scale(0.5) rotate(0deg)', opacity: 0 },
      ],
      { duration: flightMs, easing: 'ease-in', fill: 'forwards' },
    )
    // 3. Lands as the copy arrives and fades, so the two read as one event.
    window.setTimeout(() => {
      if (!stopped) land(target, false)
    }, flightMs * landsAt)
    shrink.addEventListener('finish', stop)
    shrink.addEventListener('cancel', stop)
  })
  bounce.addEventListener('cancel', stop)

  return stop
}

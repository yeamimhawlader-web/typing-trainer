/**
 * The wordmark: HOVER TYPING, and the one time a visit sees it do what the
 * application does.
 *
 * The first time the shell appears in a visit, TYPING types itself in behind
 * the caret, slips on a letter, and lifts off the line the way Hover Mode lifts
 * a missed word — the light under it, three nodes — until three clean
 * repetitions fill the nodes and it settles back down. About six seconds, once
 * per visit (sessionStorage), and never for someone who has asked for less
 * motion. The numbers are Hover Mode's own (HOVER_MOTION), so the two are
 * recognisably the same movement.
 *
 * Only transforms and opacity move, on the compositor, and the letters keep
 * their width throughout — the untyped ones are there, faint — so nothing in
 * the bar shifts while it plays. It is decoration: hidden from assistive
 * technology, which reads the brand link's own name.
 */

import { useEffect, useRef } from 'react'

import { HOVER_MOTION } from '@features/ggtyping'

import styles from './TopBar.module.css'

const WORD = 'TYPING'
const SLIP_AFTER = 3
const SLIP = 'U'
const PLAYED_KEY = 'hover-typing:wordmark-played'

const asksForLessMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Whether this visit has already seen it. Storage that cannot be read counts as not. */
const alreadyPlayed = (): boolean => {
  try {
    return window.sessionStorage.getItem(PLAYED_KEY) !== null
  } catch {
    return false
  }
}

const markPlayed = (): void => {
  try {
    window.sessionStorage.setItem(PLAYED_KEY, '1')
  } catch {
    // Without storage it may play again on the next page load; nothing worse.
  }
}

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer)
      reject(new DOMException('stopped', 'AbortError'))
    })
  })

const em = (value: number): string => `${value}em`

const play = async (word: HTMLElement, signal: AbortSignal): Promise<void> => {
  const letters = word.querySelector<HTMLElement>('[data-part="letters"]')
  const pool = word.querySelector<HTMLElement>('[data-part="pool"]')
  const nodes = [...word.querySelectorAll<HTMLElement>('[data-part="node"]')]
  if (letters === null || pool === null || typeof letters.animate !== 'function') return

  const { enter, float, success, node, release } = HOVER_MOTION
  const glyphs = [...letters.children] as HTMLElement[]
  const caret = word.querySelector<HTMLElement>('[data-part="caret"]')
  const showTyped = (count: number, slip = false) => {
    glyphs.forEach((glyph, index) => {
      glyph.dataset.state = index < count ? 'typed' : 'ahead'
      glyph.textContent = slip && index === count ? SLIP : (WORD[index] ?? '')
      if (slip && index === count) glyph.dataset.state = 'slip'
    })
    // The caret sits after the last typed letter.
    const at = glyphs[Math.min(count + (slip ? 1 : 0), glyphs.length) - 1]
    if (caret !== null) caret.style.transform = `translateX(${at === undefined ? 0 : at.offsetLeft + at.offsetWidth}px)`
  }

  word.dataset.playing = ''
  try {
    showTyped(0)
    await sleep(500, signal)
    for (let count = 1; count <= SLIP_AFTER; count += 1) {
      showTyped(count)
      // One letter after another: the wait is the typing.
      // oxlint-disable-next-line no-await-in-loop
      await sleep(110, signal)
    }
    showTyped(SLIP_AFTER, true)
    await sleep(260, signal)

    // The slip is put right, and the word lifts: gather, then rise.
    showTyped(WORD.length)
    delete word.dataset.typing
    const enterMs = enter.gatherMs + enter.riseMs
    letters.animate(
      [
        { transform: 'translateY(0)' },
        { transform: `translateY(${em(enter.gatherEm)})`, offset: enter.gatherMs / enterMs },
        { transform: `translateY(${em(-enter.liftEm)})` },
      ],
      { duration: enterMs, easing: 'cubic-bezier(0.3, 0, 0.12, 1)', fill: 'forwards' },
    )
    pool.animate([{ opacity: 0 }, { opacity: 0.75 }], { duration: enter.riseMs, delay: enter.gatherMs, fill: 'forwards' })
    nodes.forEach((dot, index) =>
      dot.animate([{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'scale(1)' }], {
        duration: node.appearMs,
        delay: enter.gatherMs + 250 + index * node.appearStaggerMs,
        easing: 'cubic-bezier(0.3, 1.35, 0.6, 1)',
        fill: 'forwards',
      }),
    )
    await sleep(enterMs, signal)
    const floating = letters.animate(
      [
        { transform: `translateY(${em(-enter.liftEm)})` },
        { transform: `translateY(${em(-enter.liftEm - float.travelEm)})` },
        { transform: `translateY(${em(-enter.liftEm)})` },
      ],
      { duration: float.periodMs, iterations: Number.POSITIVE_INFINITY, easing: 'cubic-bezier(0.37, 0, 0.63, 1)' },
    )
    await sleep(370, signal)

    // Three clean repetitions: each fills a node, and the word dips and recovers.
    for (const dot of nodes) {
      // One repetition after another, as they are typed.
      // oxlint-disable-next-line no-await-in-loop
      await sleep(520, signal)
      dot.dataset.clean = ''
      dot.animate([{ scale: '1' }, { scale: String(node.popScale) }, { scale: '1' }], { duration: node.popMs, easing: 'ease-out' })
      word.animate([{ translate: '0 0' }, { translate: `0 ${em(success.dipEm)}` }, { translate: '0 0' }], {
        duration: success.downMs + success.upMs,
        easing: 'cubic-bezier(0.25, 0, 0.15, 1)',
      })
    }
    await sleep(600, signal)

    // Released: down to the line, a hair past it, and settled.
    floating.cancel()
    const downMs = release.descentMs + release.settleMs
    letters.animate(
      [
        { transform: `translateY(${em(-enter.liftEm)})` },
        { transform: `translateY(${em(release.undershootEm)})`, offset: release.descentMs / downMs },
        { transform: 'translateY(0)' },
      ],
      { duration: downMs, easing: 'cubic-bezier(0.45, 0, 0.35, 1)', fill: 'forwards' },
    )
    pool.animate([{ opacity: 0.75 }, { opacity: 0 }], { duration: release.fadeMs, fill: 'forwards' })
    nodes.forEach((dot, index) =>
      dot.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: release.nodeFadeMs,
        delay: index * release.nodeStaggerMs,
        fill: 'forwards',
      }),
    )
    await sleep(downMs, signal)
  } finally {
    // Whatever happened, it ends as the plain wordmark.
    glyphs.forEach((glyph, index) => {
      glyph.dataset.state = 'typed'
      glyph.textContent = WORD[index] ?? ''
    })
    for (const part of [letters, pool, word, ...nodes]) for (const animation of part.getAnimations()) animation.cancel()
    nodes.forEach((dot) => delete dot.dataset.clean)
    delete word.dataset.playing
    delete word.dataset.typing
  }
}

export const Wordmark = () => {
  const word = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const element = word.current
    if (element === null || alreadyPlayed() || asksForLessMotion()) return undefined
    markPlayed()
    element.dataset.typing = ''
    const stop = new AbortController()
    // After the web font, so the letters it measures are the letters it shows.
    void (document.fonts?.ready ?? Promise.resolve())
      .then(() => play(element, stop.signal))
      .catch(() => undefined)
    return () => stop.abort()
  }, [])

  return (
    <span className={styles.wordmark} aria-hidden="true">
      <span className={styles.gg}>HOVER</span>{' '}
      <span ref={word} className={styles.rest}>
        <span className={styles.letters} data-part="letters">
          {[...WORD].map((letter, index) => (
            // Fixed letters in a fixed order: the index is the identity.
            // oxlint-disable-next-line react/no-array-index-key
            <span key={index} data-state="typed">
              {letter}
            </span>
          ))}
        </span>
        <span className={styles.caret} data-part="caret" />
        <span className={styles.pool} data-part="pool" />
        <span className={styles.nodes}>
          <span className={styles.node} data-part="node" />
          <span className={styles.node} data-part="node" />
          <span className={styles.node} data-part="node" />
        </span>
      </span>
    </span>
  )
}

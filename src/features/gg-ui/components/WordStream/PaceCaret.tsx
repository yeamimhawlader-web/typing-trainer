/**
 * The pace caret: a slim line moving through the words at one of the typist's
 * own speeds, to hold or to chase.
 *
 * It keeps the test's time, not its own. It sets off with the first keystroke,
 * stops while the test is paused — Hover Mode pausing the text to repeat a word
 * pauses the pace with it — and goes when the test ends. Where it is comes from
 * `paceIndexAt` (`@core/statistics`): how many characters that speed covers in
 * the time so far, at five characters a word, as words per minute are counted.
 *
 * It asks nothing of React while it runs. One animation frame loop, only while a
 * test is running, works out which character the pace is on and moves the caret
 * there when that changes — a transform, by the positions the stream cursor has
 * already measured, so no layout is read. Along a line it glides for exactly one
 * character's time at that pace, so it moves continuously rather than in steps;
 * onto a new line it jumps. It is drawn for the eye alone: what it shows is the
 * speed chosen in the toolbar, which says so in words.
 */

import { useEffect, useRef } from 'react'

import type { TypingEngine } from '@core/engine'
import { paceIndexAt } from '@core/statistics'
import { CHARACTERS_PER_WORD, MILLISECONDS_PER_MINUTE } from '@core/types'

import type { StreamCursor } from './stream-cursor.ts'

import styles from './WordStream.module.css'

export interface PaceCaretProps {
  readonly engine: TypingEngine
  readonly cursor: StreamCursor
  /** Words per minute. */
  readonly wpm: number
  /** How many characters the text has: the pace stops at the end of it. */
  readonly length: number
}

export const PaceCaret = ({ engine, cursor, wpm, length }: PaceCaretProps) => {
  const caret = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const element = caret.current
    if (element === null) return undefined

    // One character's time at this pace: how long each glide along a line lasts.
    const glideMs = Math.round(MILLISECONDS_PER_MINUTE / (wpm * CHARACTERS_PER_WORD))
    let banked = 0
    let runningFrom: number | null = null
    let frame = 0
    let placedIndex = -1
    let placedTop = Number.NaN

    const show = (shown: boolean) => {
      element.dataset.shown = String(shown)
    }

    const place = (index: number) => {
      const box = cursor.boxOf(index)
      if (box === null) return
      const sameLine = Math.abs(box.y - placedTop) < 0.5
      element.style.setProperty('--gg-pace-glide', sameLine ? `${glideMs}ms` : '0ms')
      element.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`
      element.style.height = `${box.height}px`
      element.dataset.index = String(index)
      placedIndex = index
      placedTop = box.y
    }

    const elapsed = (at: number) => banked + (runningFrom === null ? 0 : at - runningFrom)

    const tick = () => {
      frame = 0
      if (runningFrom === null) return
      const index = paceIndexAt(elapsed(performance.now()), wpm, length)
      if (index !== placedIndex) place(index)
      frame = requestAnimationFrame(tick)
    }

    const run = (from: number) => {
      runningFrom = from
      if (frame === 0) frame = requestAnimationFrame(tick)
    }

    const halt = () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      frame = 0
    }

    // Chosen part-way through a test: it takes up the test's own time so far.
    const { status, elapsedMs } = engine.getSnapshot()
    if (status === 'running' || status === 'paused') {
      banked = elapsedMs
      place(paceIndexAt(banked, wpm, length))
      show(true)
      if (status === 'running') run(performance.now())
    }

    const stopEvents = engine.on((event) => {
      switch (event.type) {
        case 'started':
          banked = 0
          placedTop = Number.NaN
          place(0)
          show(true)
          run(event.at)
          break
        case 'paused':
          banked = elapsed(event.at)
          runningFrom = null
          halt()
          break
        case 'resumed':
          run(event.at)
          break
        case 'finished':
        case 'reset':
          banked = 0
          runningFrom = null
          placedIndex = -1
          halt()
          show(false)
          break
        default:
          break
      }
    })

    // A new measurement moves every character; the caret goes where its character now is.
    const stopMeasuring = cursor.onMeasure(() => {
      if (placedIndex < 0) return
      placedTop = Number.NaN
      place(placedIndex)
    })

    return () => {
      stopEvents()
      stopMeasuring()
      halt()
    }
  }, [cursor, engine, length, wpm])

  return <span ref={caret} className={styles.pace} data-pace="" data-shown="false" aria-hidden="true" />
}

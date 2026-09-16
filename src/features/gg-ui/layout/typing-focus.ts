/**
 * Focus while typing: once a test is under way, everything but the words, the
 * field and the live figures steps back.
 *
 * The chrome is marked where it is drawn (`data-recede`), and the shell's
 * element carries whether the typist is typing (`data-typing`); the stylesheet
 * does the rest, by opacity alone, so nothing moves and nothing is hidden from
 * assistive technology or the keyboard — a control that takes focus comes back
 * by itself.
 *
 * The typing screen says when typing starts and stops. The mouse says when the
 * typist wants the page back: a real movement — a few pixels, not a nudged desk —
 * brings everything forward at once, and the next keystroke lets it recede again.
 *
 * Nothing here runs per keystroke beyond comparing one boolean: the attribute is
 * written when the state changes, and the pointer is only listened to while the
 * chrome is stepped back.
 */

import { createContext } from 'react'

/** How far the pointer has to travel, in pixels, to count as wanting the page back. */
export const REVEAL_DISTANCE_PX = 8

export interface TypingFocus {
  /** The element whose `data-typing` the stylesheet reads. */
  readonly attach: (element: HTMLElement | null) => void
  /** Typing has started, or carried on; or stopped. */
  readonly typing: (typing: boolean) => void
}

export const createTypingFocus = (): TypingFocus => {
  let element: HTMLElement | null = null
  let receded = false
  let travelled = 0
  let last: { x: number; y: number } | null = null

  const write = () => {
    if (element !== null) element.dataset.typing = String(receded)
  }

  const onPointerMove = (event: PointerEvent) => {
    if (last !== null) travelled += Math.hypot(event.clientX - last.x, event.clientY - last.y)
    last = { x: event.clientX, y: event.clientY }
    if (travelled >= REVEAL_DISTANCE_PX) set(false)
  }

  function set(next: boolean): void {
    if (next === receded) return
    receded = next
    travelled = 0
    last = null
    if (typeof document !== 'undefined') {
      if (next) document.addEventListener('pointermove', onPointerMove, { passive: true })
      else document.removeEventListener('pointermove', onPointerMove)
    }
    write()
  }

  return {
    attach: (next) => {
      element = next
      write()
    },
    typing: set,
  }
}

export const TypingFocusContext = createContext<TypingFocus | null>(null)

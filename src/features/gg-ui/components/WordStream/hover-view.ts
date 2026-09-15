/**
 * What the word stream follows in Hover Mode.
 *
 * The caret is the text's own. The line kept first is normally the caret's too,
 * but while a focused word is repeated — and while it settles back after — the
 * focused word's line is held in view, even when the text's cursor has already
 * moved to the start of the next line. Without that, finishing the last word on
 * a line would scroll the very word being repeated out of sight.
 *
 * Holds are counted by focus, so a word still settling while the next one is
 * focused cannot release the other's hold.
 */

import type { TypingEngine, Unsubscribe } from '@core/engine'

import type { CursorSource } from './stream-cursor.ts'

export interface HoverView extends CursorSource {
  /** Keeps `index`'s line first on behalf of a focus. */
  hold(focusId: number, index: number): void
  release(focusId: number): void
}

export const createHoverView = (engine: TypingEngine): HoverView => {
  const holds = new Map<number, number>()
  const listeners = new Set<() => void>()

  const notify = (): void => {
    for (const listener of listeners) listener()
  }

  return {
    getCursorIndex: () => engine.getSnapshot().cursorIndex,

    // The most recent hold wins; with none, the caret's own line.
    getAnchorIndex: () => {
      let anchor: number | undefined
      for (const index of holds.values()) anchor = index
      return anchor ?? engine.getSnapshot().cursorIndex
    },

    subscribe: (listener): Unsubscribe => {
      listeners.add(listener)
      const stop = engine.subscribe(listener)
      return () => {
        stop()
        listeners.delete(listener)
      }
    },

    hold: (focusId, index) => {
      if (holds.get(focusId) === index) return
      holds.delete(focusId)
      holds.set(focusId, index)
      notify()
    },

    release: (focusId) => {
      if (holds.delete(focusId)) notify()
    },
  }
}

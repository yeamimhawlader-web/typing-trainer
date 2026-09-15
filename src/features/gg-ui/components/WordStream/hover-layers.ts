/**
 * The focus layers on screen, as a store the word stream renders from.
 *
 * Hover Mode's controller says what is focused; this says what is drawn, which
 * outlives it: a released word keeps its layer while it settles back onto the
 * line. It is updated synchronously on each of the controller's signals, and
 * read through `useSyncExternalStore`, so the layer, the hidden word in the text
 * and the held line all change in the same frame as the key that caused them.
 */

import type { Unsubscribe } from '@core/engine'
import type { HoverController } from '@features/ggtyping'

import type { HoverView } from './hover-view.ts'

export type LayerStage = 'pending' | 'repeating' | 'releasing'

export interface FocusLayerState {
  readonly id: number
  readonly word: string
  readonly wordIndex: number
  /** Position of the word's first character in the text. */
  readonly start: number
  readonly stage: LayerStage
  readonly required: number
  readonly successes: number
  /** Whether the release was the requirement met, rather than the limit. */
  readonly completed: boolean
  /** The latest moment to react to, numbered so each is played once. */
  readonly pulse: { readonly seq: number; readonly kind: 'failure' | 'success'; readonly added: number } | null
}

export interface HoverLayers {
  getSnapshot(): readonly FocusLayerState[]
  subscribe(listener: () => void): Unsubscribe
  /** Starts following the controller. Returns the matching stop. */
  connect(): Unsubscribe
  /** A released layer has landed. */
  done(id: number): void
  /** Everything off the screen at once: a new text. */
  clear(): void
}

export const createHoverLayers = (hover: HoverController, view: HoverView): HoverLayers => {
  let layers: readonly FocusLayerState[] = []
  let seq = 0
  const listeners = new Set<() => void>()

  const set = (next: readonly FocusLayerState[]): void => {
    layers = next
    for (const listener of listeners) listener()
  }

  const update = (id: number, change: (layer: FocusLayerState) => FocusLayerState): void => {
    set(layers.map((layer) => (layer.id === id ? change(layer) : layer)))
  }

  const remove = (id: number): void => {
    view.release(id)
    if (layers.some((layer) => layer.id === id)) set(layers.filter((layer) => layer.id !== id))
  }

  return {
    getSnapshot: () => layers,

    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    connect: () =>
      hover.onSignal(({ signal, snapshot, record }) => {
        const id = snapshot.focusId
        const focus = snapshot.focus

        switch (signal) {
          case 'activated':
            if (focus === null) return
            set([
              ...layers,
              {
                id,
                word: focus.word,
                wordIndex: focus.wordIndex,
                start: focus.start,
                stage: 'pending',
                required: focus.required,
                successes: focus.successes,
                completed: false,
                pulse: null,
              },
            ])
            return

          case 'repeating':
            if (focus !== null) view.hold(id, focus.start)
            update(id, (layer) => ({ ...layer, stage: 'repeating' }))
            return

          case 'failure':
            if (focus === null) return
            seq += 1
            update(id, (layer) => ({
              ...layer,
              required: focus.required,
              pulse: { seq, kind: 'failure', added: focus.required - layer.required },
            }))
            return

          case 'success':
            if (focus === null) return
            seq += 1
            update(id, (layer) => ({
              ...layer,
              successes: focus.successes,
              pulse: { seq, kind: 'success', added: 0 },
            }))
            return

          case 'released':
            update(id, (layer) => ({
              ...layer,
              stage: 'releasing',
              required: record?.required ?? layer.required,
              successes: record?.successes ?? layer.successes,
              completed: record?.completed ?? false,
            }))
            return

          case 'ended':
            remove(id)
            return
        }
      }),

    done: remove,

    clear: () => {
      for (const layer of layers) view.release(layer.id)
      if (layers.length > 0) set([])
    },
  }
}

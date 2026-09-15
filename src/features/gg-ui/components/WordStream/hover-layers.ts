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
import type { HoverController, HoverProgress } from '@features/ggtyping'

import type { HoverView } from './hover-view.ts'

export type LayerStage = 'pending' | 'repeating' | 'releasing'

/** A moment to play once, numbered so it is. */
export type LayerPulse =
  | { readonly seq: number; readonly kind: 'failure'; readonly added: number }
  | { readonly seq: number; readonly kind: 'repetition'; readonly clean: boolean; readonly index: number }

export interface FocusLayerState {
  readonly id: number
  readonly word: string
  readonly wordIndex: number
  /** Position of the word's first character in the text. */
  readonly start: number
  readonly stage: LayerStage
  readonly progress: HoverProgress
  /** Whether the release was the word clearing. */
  readonly cleared: boolean
  readonly pulse: LayerPulse | null
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

const EMPTY: HoverProgress = { nodes: [], groupSize: null }

/** Repetitions shown as done — clean or missed. */
const markedOf = (progress: HoverProgress): number => progress.nodes.filter((node) => node !== 'open').length

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
      hover.onSignal(({ signal, snapshot, record, progress }) => {
        const id = snapshot.focusId
        const focus = snapshot.focus
        const shown = progress ?? EMPTY

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
                progress: shown,
                cleared: false,
                pulse: null,
              },
            ])
            return

          case 'repeating':
            if (focus !== null) view.hold(id, focus.start)
            update(id, (layer) => ({ ...layer, stage: 'repeating' }))
            return

          case 'failure':
            seq += 1
            update(id, (layer) => ({
              ...layer,
              progress: shown,
              pulse: { seq, kind: 'failure', added: Math.max(0, shown.nodes.length - layer.progress.nodes.length) },
            }))
            return

          case 'success':
          case 'missed':
          case 'cycle': {
            seq += 1
            const index = markedOf(shown) - 1
            update(id, (layer) => ({
              ...layer,
              progress: shown,
              // Tired shows only clean repetitions, so a missed one marks nothing.
              pulse: { seq, kind: 'repetition', clean: shown.nodes[index] === 'clean' && markedOf(shown) > markedOf(layer.progress), index },
            }))
            return
          }

          case 'released': {
            seq += 1
            const index = markedOf(shown) - 1
            update(id, (layer) => ({
              ...layer,
              stage: 'releasing',
              progress: shown,
              cleared: record?.cleared ?? false,
              pulse: { seq, kind: 'repetition', clean: shown.nodes[index] === 'clean', index },
            }))
            return
          }

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

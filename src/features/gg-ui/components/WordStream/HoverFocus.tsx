/**
 * Hover Mode's focused word, drawn over the word stream.
 *
 * ## Not a copy in the text
 *
 * The text is left exactly as it is. The focused word is drawn a second time in
 * a layer positioned over it from the stream's own measurements, and while that
 * layer shows, the word in the text is hidden — `visibility`, so nothing
 * reflows. The layer is what lifts, floats and settles; the text never moves.
 * When the focus is released and the layer has landed exactly where the word
 * sits, the layer goes and the word in the text is shown again, with the marks
 * of the mistake that started it still on it.
 *
 * ## What it shows, and from where
 *
 * - The letters of the repetition in progress, with the repetition engine's
 *   state for each and its caret. Each letter subscribes to its own state, as in
 *   the stream, so a keystroke re-renders one or two letters.
 * - A row of nodes for the repetitions the difficulty asks for: a ring for one
 *   to come, a dot for a clean one, a bar for one with a mistake. Standard and
 *   All In mark every repetition, grouped by cycle; Tired fills its clean
 *   repetitions and grows the row for each miss. Shape as well as colour, and
 *   read out by a status region.
 * - Everything else is motion (see `@features/ggtyping`), played on the layer's
 *   elements when the mode signals a moment. Nothing moves on a keystroke.
 *
 * ## Layers
 *
 * One per focus. A word still settling after its release keeps its layer while
 * the next word, mistyped straight after, gets its own, so a quick typist never
 * sees a focus cut short. See `hover-layers.ts`.
 */

import { memo, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

import type { TypingEngine } from '@core/engine'
import type { CharacterState } from '@core/types'
import {
  createHoverMotion,
  playWordJump,
  type HoverController,
  type HoverMotion,
  type HoverSignalEvent,
  type ProgressNode,
} from '@features/ggtyping'
import { useEngineValue } from '@features/typing'
import { cx } from '@shared/lib'

import { createHoverLayers, type FocusLayerState, type HoverLayers } from './hover-layers.ts'
import type { HoverView } from './hover-view.ts'
import type { StreamCursor } from './stream-cursor.ts'

import styles from './HoverFocus.module.css'
import streamStyles from './WordStream.module.css'

// --- The word in the text ------------------------------------------------

/** How many layers are hiding each word element, so one cannot show a word another hides. */
const hiders = new WeakMap<HTMLElement, number>()

const hideWord = (element: HTMLElement): (() => void) => {
  hiders.set(element, (hiders.get(element) ?? 0) + 1)
  element.style.visibility = 'hidden'
  return () => {
    const remaining = (hiders.get(element) ?? 1) - 1
    hiders.set(element, remaining)
    if (remaining <= 0) element.style.visibility = ''
  }
}

const childrenOf = (element: HTMLElement | null): HTMLElement[] =>
  Array.from(element?.children ?? []) as HTMLElement[]

// --- Letters -------------------------------------------------------------

interface LetterProps {
  readonly attempt: TypingEngine
  readonly index: number
  readonly character: string
  /** While repeating, null: the repetition's own state. Otherwise this. */
  readonly settled: CharacterState | null
}

const Letter = ({ attempt, index, character, settled }: LetterProps) => {
  const state = useEngineValue(attempt, (snapshot) => settled ?? snapshot.characterStates[index] ?? 'pending')
  const caret = useEngineValue(
    attempt,
    (snapshot) => settled === null && snapshot.status === 'running' && snapshot.cursorIndex === index,
  )

  return (
    <span
      className={cx(streamStyles.character, streamStyles[state], caret && styles.caret)}
      data-hover-state={state}
      data-caret={caret}
    >
      {character}
    </span>
  )
}

// --- One focus -----------------------------------------------------------

interface FocusLayerProps {
  readonly layer: FocusLayerState
  readonly attempt: TypingEngine
  readonly cursor: StreamCursor
  readonly layers: HoverLayers
}

const FocusLayer = memo(({ layer, attempt, cursor, layers }: FocusLayerProps) => {
  const { id, word, wordIndex, start, stage, progress, cleared, pulse } = layer

  const [origin, setOrigin] = useState(() => cursor.originOf(start))
  // A resize or a new text size moves the word, and the layer with it.
  useEffect(() => cursor.onMeasure(() => setOrigin(cursor.originOf(start))), [cursor, start])

  const anchor = useRef<HTMLDivElement>(null)
  const lift = useRef<HTMLSpanElement>(null)
  const accent = useRef<HTMLSpanElement>(null)
  const float = useRef<HTMLSpanElement>(null)
  const drift = useRef<HTMLSpanElement>(null)
  const tilt = useRef<HTMLSpanElement>(null)
  const glow = useRef<HTMLSpanElement>(null)
  const pool = useRef<HTMLSpanElement>(null)
  const nodes = useRef<HTMLSpanElement>(null)
  const motion = useRef<HoverMotion | null>(null)
  const handledPulse = useRef(0)

  const placed = origin !== null

  // Caught: the word in the text jumps where it is, as a mistake makes it jump
  // in ordinary practice — here after one mistake rather than three — and its
  // nodes grow in underneath.
  useLayoutEffect(() => {
    const parts = [lift, accent, float, drift, tilt, glow, pool].map((ref) => ref.current)
    if (!placed || motion.current !== null || parts.some((part) => part === null)) return
    const [liftEl, accentEl, floatEl, driftEl, tiltEl, glowEl, poolEl] = parts as HTMLElement[]
    motion.current = createHoverMotion({
      lift: liftEl as HTMLElement,
      accent: accentEl as HTMLElement,
      float: floatEl as HTMLElement,
      drift: driftEl as HTMLElement,
      tilt: tiltEl as HTMLElement,
      glow: glowEl as HTMLElement,
      pool: poolEl as HTMLElement,
    })

    const element = anchor.current?.parentElement?.querySelector<HTMLElement>(`[data-word="${wordIndex}"]`)
    if (stage === 'pending') {
      if (element !== null && element !== undefined) playWordJump(element)
      motion.current.appear(childrenOf(nodes.current))
    }
  }, [placed, stage, wordIndex])

  // While the layer stands in for the word, the word in the text is hidden.
  const standingIn = stage !== 'pending'
  useLayoutEffect(() => {
    if (!standingIn) return undefined
    const element = anchor.current?.parentElement?.querySelector<HTMLElement>(`[data-word="${wordIndex}"]`)
    return element === null || element === undefined ? undefined : hideWord(element)
  }, [standingIn, wordIndex])

  // Lift-off, and the hover.
  useLayoutEffect(() => {
    if (stage === 'repeating') motion.current?.enter()
  }, [stage])

  // A repetition or a miss, once the nodes it changed are on the page.
  useLayoutEffect(() => {
    if (pulse === null || pulse.seq === handledPulse.current) return
    handledPulse.current = pulse.seq
    const all = childrenOf(nodes.current)
    if (pulse.kind === 'failure') motion.current?.fail(all.slice(all.length - pulse.added))
    else if (pulse.clean && stage === 'repeating') motion.current?.succeed(all[pulse.index] ?? null)
  }, [pulse, stage])

  // Release: down to the line, then the layer goes and the word is back.
  useLayoutEffect(() => {
    if (stage !== 'releasing') return undefined
    let active = true
    void (motion.current?.release(childrenOf(nodes.current)) ?? Promise.resolve()).then(() => {
      if (active) layers.done(id)
    })
    return () => {
      active = false
    }
  }, [id, layers, stage])

  useEffect(
    () => () => {
      motion.current?.stop()
      motion.current = null
    },
    [],
  )

  if (origin === null) return null

  const letters = Array.from(word)
  const settled: CharacterState | null = stage === 'repeating' ? null : cleared ? 'correct' : 'pending'
  /* Position is a letter's identity, as in the stream: the word never changes
     for the life of a focus, and each letter subscribes by its index. */
  const letterAt = (character: string, position: number) => (
    <Letter key={position} attempt={attempt} index={position} character={character} settled={settled} />
  )
  /* A node is its repetition's place in the row, the same way. */
  const nodeAt = (node: ProgressNode, position: number) => (
    <span
      key={position}
      className={cx(
        styles.node,
        progress.groupSize !== null && position > 0 && position % progress.groupSize === 0 && styles.groupStart,
      )}
      data-node={node}
      data-filled={node !== 'open'}
    />
  )

  return (
    <div
      ref={anchor}
      className={styles.anchor}
      style={{ transform: `translate3d(${origin.x}px, ${origin.lineTop}px, 0)` }}
      data-stage={stage}
      data-focus-word={word}
      aria-hidden="true"
    >
      <span ref={pool} className={styles.pool} />
      <span ref={lift} className={styles.layer}>
        <span ref={accent} className={styles.layer}>
          <span ref={float} className={styles.layer}>
            <span ref={drift} className={styles.layer}>
              <span ref={tilt} className={styles.layer}>
                <span ref={glow} className={styles.glow} />
                <span className={styles.letters}>
                  <span className={styles.word}>
                    {letters.map(letterAt)}
                    <span ref={nodes} className={styles.nodes}>
                      {progress.nodes.map(nodeAt)}
                    </span>
                  </span>
                  <Letter attempt={attempt} index={letters.length} character=" " settled={settled} />
                </span>
              </span>
            </span>
          </span>
        </span>
      </span>
    </div>
  )
})

FocusLayer.displayName = 'FocusLayer'

// --- All focuses ---------------------------------------------------------

const plural = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`

/** How many are left, in the terms the difficulty counts them. */
const left = (snapshot: HoverSignalEvent['snapshot']): string =>
  snapshot.difficulty === 'tired'
    ? `${plural(snapshot.remaining, 'clean repetition')} to go`
    : `${plural(snapshot.remaining, 'repetition')} to go`

const INTRODUCTIONS = {
  standard: 'type it 3 times',
  'all-in': 'type it 3 times, twice over',
  tired: 'type it cleanly 3 times',
} as const

/** What a screen reader hears. The nodes say the same thing to the eye. */
const announce = ({ signal, snapshot, record }: HoverSignalEvent): string => {
  const { focus } = snapshot
  switch (signal) {
    case 'activated':
      return focus === null ? '' : `Focused on “${focus.word}”. Finish it, then ${INTRODUCTIONS[focus.difficulty]}.`
    case 'repeating':
      return focus === null ? '' : `Repeat “${focus.word}”: ${left(snapshot)}.`
    case 'success':
      return `${left(snapshot)}.`
    case 'missed':
      return `That one had a mistake. ${left(snapshot)}.`
    case 'cycle':
      return `First cycle done. ${left(snapshot)}.`
    case 'failure':
      return snapshot.difficulty === 'tired' ? `A mistake. ${left(snapshot)}.` : 'A mistake in this one.'
    case 'released':
      if (record === null) return ''
      return record.cleared
        ? `“${record.word}” cleared. Carry on.`
        : `Moving on from “${record.word}”. It is kept in Golden Nuggets.`
    case 'ended':
      return ''
  }
}

export interface HoverFocusProps {
  readonly engine: TypingEngine
  readonly hover: HoverController
  readonly view: HoverView
  readonly cursor: StreamCursor
}

export const HoverFocus = ({ engine, hover, view, cursor }: HoverFocusProps) => {
  const [layers] = useState(() => createHoverLayers(hover, view))
  const shown = useSyncExternalStore(layers.subscribe, layers.getSnapshot)
  const phase = useSyncExternalStore(hover.subscribe, () => hover.getSnapshot().phase)
  const [announcement, setAnnouncement] = useState('')
  const status = useRef<HTMLSpanElement>(null)

  useEffect(() => layers.connect(), [layers])
  useEffect(() => hover.onSignal((event) => setAnnouncement(announce(event))), [hover])

  // A new text: nothing from the last one stays on screen.
  useEffect(
    () =>
      engine.on((event) => {
        if (event.type === 'reset' || event.type === 'started') layers.clear()
      }),
    [engine, layers],
  )

  // The stream's own caret is hidden while the focused word has one.
  useLayoutEffect(() => {
    const block = status.current?.closest<HTMLElement>('[data-size]')
    if (block !== null && block !== undefined) block.dataset.hover = phase
  }, [phase])

  return (
    <>
      {shown.map((layer) => (
        <FocusLayer key={layer.id} layer={layer} attempt={hover.attempt} cursor={cursor} layers={layers} />
      ))}
      <span ref={status} className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </span>
    </>
  )
}

/**
 * Places the block cursor and scrolls the stream, without reading layout on a
 * keystroke. Plain TypeScript over three elements and the typing engine;
 * `useStreamCursor` connects it to React.
 *
 * ## Where the cursor is
 *
 * The engine's `cursorIndex`, read from its snapshot. Nothing here decides where
 * a key moves the cursor — with word-synchronised error recovery that is not
 * always one step on — it only draws the position the engine reports.
 *
 * ## Why positions are measured up front
 *
 * The cursor is one element that slides. The simple way to move it is to read
 * the current character's `offsetLeft` on every key — but that makes the browser
 * finish style and layout inside the keystroke, which is exactly the work that
 * makes typing feel sticky. So every character's position is read once, in a
 * single pass, whenever positions can change: new text, a new size, a resize,
 * fonts finishing loading. A keystroke then looks a position up and writes at
 * most two transforms — and nothing at all when the position has not changed,
 * which is what every clock tick the engine announces looks like.
 *
 * ## Lines
 *
 * The line holding the cursor is kept as the first visible line. Moving on a
 * line shifts the content up with a transform — instantly, since no motion other
 * than the cursor runs on a keystroke. The cursor's coordinates are taken after
 * that shift, so across a line break it slides back along the top line rather
 * than dropping in from above.
 *
 * ## The line above
 *
 * The viewport reaches a little above the first line, so a word that jumps on it
 * (the GGTyping word jump, which only ever happens on the line being typed) is
 * not cut off at the top. That strip would otherwise show the bottom of the line
 * before, so that one line is hidden while it sits there. It changes when the
 * line does, a few times a test, and costs a style change with no layout.
 *
 * ## Holding the view
 *
 * Normally the caret's line is the first line. A source can name another
 * character to keep in view instead — Hover Mode keeps the focused word's line
 * first while the word is repeated, even when the text's cursor has already
 * moved on to the next line. The caret is still drawn where the source says.
 */

import type { TypingEngine, Unsubscribe } from '@core/engine'

/** Where the caret is, and which character's line to keep first. */
export interface CursorSource {
  getCursorIndex(): number
  /** Defaults to the caret's own position. */
  getAnchorIndex?(): number
  subscribe(listener: () => void): Unsubscribe
}

export const engineCursorSource = (engine: TypingEngine): CursorSource => ({
  getCursorIndex: () => engine.getSnapshot().cursorIndex,
  subscribe: engine.subscribe,
})

/** A character's position, as the last measurement found it, in content coordinates. */
export interface CharacterOrigin {
  readonly x: number
  /** Top of the line box the character sits in, not of the glyph box. */
  readonly lineTop: number
}

interface StreamLayout {
  readonly spans: readonly HTMLElement[]
  readonly xs: Float64Array
  readonly ys: Float64Array
  /** Top of each visual line, in content coordinates, first line first. */
  readonly lineTops: readonly number[]
  /** Index of the first character on each visual line. */
  readonly lineStarts: readonly number[]
  readonly endX: number
  readonly endY: number
  /** Distance from the top of a line box to the top of a character's box in it. */
  readonly glyphInset: number
}

export interface StreamCursor {
  /** Ref callbacks that hand the controller its three elements. */
  readonly attachViewport: (element: HTMLDivElement | null) => void
  readonly attachContent: (element: HTMLDivElement | null) => void
  readonly attachCursor: (element: HTMLSpanElement | null) => void
  /** Re-measure after anything that moves characters: new text, a new size. */
  measure(): void
  /** Moves the cursor to the source's position. Cheap; no layout reads. */
  place(): void
  /** Follows a cursor source until the returned stop is called. */
  follow(source: CursorSource): () => void
  /** A character's measured position, or null before the first measurement. No layout reads. */
  originOf(index: number): CharacterOrigin | null
  /** Called after every measurement, for anything positioned from it. */
  onMeasure(listener: () => void): Unsubscribe
  /** Starts watching for resizes and font loading. Returns the stop. */
  observe(): () => void
}

export const lineIndexOf = (lineTops: readonly number[], y: number): number => {
  let low = 0
  let high = lineTops.length - 1
  let found = 0
  while (low <= high) {
    const middle = (low + high) >> 1
    if ((lineTops[middle] as number) <= y + 0.5) {
      found = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return found
}

export const createStreamCursor = (): StreamCursor => {
  let viewport: HTMLDivElement | null = null
  let content: HTMLDivElement | null = null
  let cursor: HTMLSpanElement | null = null
  let source: CursorSource | null = null
  let layout: StreamLayout | null = null
  let scroll = Number.NaN
  let placedIndex = Number.NaN
  let placedAnchor = Number.NaN
  const measureListeners = new Set<() => void>()
  let hidden: readonly HTMLElement[] = []

  const setHidden = (spans: readonly HTMLElement[]): void => {
    for (const span of hidden) span.style.visibility = ''
    for (const span of spans) span.style.visibility = 'hidden'
    hidden = spans
  }

  const place = (): void => {
    if (layout === null || content === null || cursor === null || source === null) return

    const index = source.getCursorIndex()
    const anchor = source.getAnchorIndex?.() ?? index
    // The engine notifies on clock ticks too; those move nothing.
    if (index === placedIndex && anchor === placedAnchor) return
    placedIndex = index
    placedAnchor = anchor

    const yOf = (position: number): number =>
      position < (layout as StreamLayout).ys.length ? ((layout as StreamLayout).ys[position] as number) : (layout as StreamLayout).endY
    const x = index < layout.xs.length ? (layout.xs[index] as number) : layout.endX
    const y = yOf(index)

    const line = lineIndexOf(layout.lineTops, yOf(anchor))
    const offset = (layout.lineTops[line] as number) - (layout.lineTops[0] ?? 0)

    if (offset !== scroll) {
      content.style.transform = `translate3d(0, ${-offset}px, 0)`
      scroll = offset
      setHidden(
        line === 0 ? [] : layout.spans.slice(layout.lineStarts[line - 1] as number, layout.lineStarts[line] as number),
      )
    }
    cursor.style.transform = `translate3d(${x}px, ${y - offset}px, 0)`
  }

  const measure = (): void => {
    if (content === null || cursor === null) return

    const spans = Array.from(content.querySelectorAll<HTMLElement>('[data-i]'))
    const count = spans.length
    if (count === 0) return

    // Visibility does not move anything, so this changes no measurement; it is
    // cleared first because the lines are about to be worked out again.
    setHidden([])

    const xs = new Float64Array(count)
    const ys = new Float64Array(count)
    const lineTops: number[] = []
    const lineStarts: number[] = []

    // One read pass; nothing is written until it is finished, so the browser
    // lays out once rather than once per character. Rectangles rather than
    // offsetTop/offsetLeft, which round to whole pixels: at 48.64px a line, a
    // rounded line top drifts against the fade band as lines go by. Both are
    // taken relative to the content, so a transform already on it cancels out.
    const origin = content.getBoundingClientRect()
    let lastRect: DOMRect | null = null
    spans.forEach((span, index) => {
      const rect = span.getBoundingClientRect()
      const top = rect.top - origin.top
      xs[index] = rect.left - origin.left
      ys[index] = top
      lastRect = rect
      if (lineTops.length === 0 || top > (lineTops[lineTops.length - 1] as number) + 0.5) {
        lineTops.push(top)
        lineStarts.push(index)
      }
    })

    const firstRect = (spans[0] as HTMLElement).getBoundingClientRect()
    const endRect = lastRect ?? firstRect
    layout = {
      // The first line's box starts at the top of the content, so how far down
      // its first character sits is exactly how far every character sits below
      // the top of its line. Measured rather than worked out from the font:
      // baseline alignment of the word boxes moves it by fractions of a pixel.
      glyphInset: ys[0] ?? 0,
      spans,
      xs,
      ys,
      lineTops,
      lineStarts,
      endX: endRect.right - origin.left,
      endY: endRect.top - origin.top,
    }

    // Re-placed without the slide: a new layout is not the cursor moving.
    cursor.style.transition = 'none'
    cursor.style.width = `${firstRect.width}px`
    cursor.style.height = `${firstRect.height}px`
    scroll = Number.NaN
    placedIndex = Number.NaN
    placedAnchor = Number.NaN
    place()
    void cursor.offsetWidth
    cursor.style.transition = ''
    cursor.dataset.placed = 'true'

    for (const listener of measureListeners) listener()
  }

  return {
    attachViewport: (element) => {
      viewport = element
    },
    attachContent: (element) => {
      content = element
    },
    attachCursor: (element) => {
      cursor = element
    },

    measure,
    place,

    follow: (next) => {
      source = next
      placedIndex = Number.NaN
      placedAnchor = Number.NaN
      place()
      const stop = next.subscribe(place)
      return () => {
        stop()
        if (source === next) source = null
      }
    },

    originOf: (index) => {
      if (layout === null) return null
      const inText = index < layout.xs.length
      return {
        x: inText ? (layout.xs[index] as number) : layout.endX,
        lineTop: (inText ? (layout.ys[index] as number) : layout.endY) - layout.glyphInset,
      }
    },

    onMeasure: (listener) => {
      measureListeners.add(listener)
      return () => {
        measureListeners.delete(listener)
      }
    },

    observe: () => {
      const observer =
        viewport === null || typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure())
      if (viewport !== null) observer?.observe(viewport)

      let active = true
      void document.fonts?.ready.then(() => {
        if (active) measure()
      })

      return () => {
        active = false
        observer?.disconnect()
      }
    },
  }
}

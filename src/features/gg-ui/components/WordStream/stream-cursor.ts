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
 */

import type { TypingEngine } from '@core/engine'

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
}

export interface StreamCursor {
  /** Ref callbacks that hand the controller its three elements. */
  readonly attachViewport: (element: HTMLDivElement | null) => void
  readonly attachContent: (element: HTMLDivElement | null) => void
  readonly attachCursor: (element: HTMLSpanElement | null) => void
  /** Re-measure after anything that moves characters: new text, a new size. */
  measure(): void
  /** Moves the cursor to the engine's position. Cheap; no layout reads. */
  place(): void
  /** Follows an engine's cursor until the returned stop is called. */
  follow(engine: TypingEngine): () => void
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
  let engine: TypingEngine | null = null
  let layout: StreamLayout | null = null
  let scroll = Number.NaN
  let placedIndex = Number.NaN
  let hidden: readonly HTMLElement[] = []

  const setHidden = (spans: readonly HTMLElement[]): void => {
    for (const span of hidden) span.style.visibility = ''
    for (const span of spans) span.style.visibility = 'hidden'
    hidden = spans
  }

  const place = (): void => {
    if (layout === null || content === null || cursor === null || engine === null) return

    const index = engine.getSnapshot().cursorIndex
    // The engine notifies on clock ticks too; those move nothing.
    if (index === placedIndex) return
    placedIndex = index

    const inText = index < layout.xs.length
    const x = inText ? (layout.xs[index] as number) : layout.endX
    const y = inText ? (layout.ys[index] as number) : layout.endY

    const line = lineIndexOf(layout.lineTops, y)
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
    place()
    void cursor.offsetWidth
    cursor.style.transition = ''
    cursor.dataset.placed = 'true'
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
      engine = next
      placedIndex = Number.NaN
      place()
      const stop = next.subscribe(place)
      return () => {
        stop()
        if (engine === next) engine = null
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

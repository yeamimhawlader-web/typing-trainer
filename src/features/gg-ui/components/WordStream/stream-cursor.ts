/**
 * Places the block cursor and scrolls the stream, without reading layout on a
 * keystroke. Plain TypeScript over three elements; `useStreamCursor` connects it
 * to React.
 *
 * ## Why positions are measured up front
 *
 * The cursor is one element that slides. The simple way to move it is to read
 * the current character's `offsetLeft` on every key — but that makes the browser
 * finish style and layout inside the keystroke, which is exactly the work that
 * makes typing feel sticky. So every character's position is read once, in a
 * single pass, whenever positions can change: new text, a new size, a resize,
 * fonts finishing loading. A keystroke then looks a position up and writes at
 * most two transforms.
 *
 * ## Lines
 *
 * The line holding the cursor is kept as the first visible line. Moving on a
 * line shifts the content up with a transform — instantly, since the brief
 * allows no per-keystroke motion except the cursor. The cursor's coordinates are
 * taken after that shift, so across a line break it slides back along the top
 * line rather than dropping in from above.
 */

import type { TypingSource } from '../../typing/typing-source.ts'

interface StreamLayout {
  readonly xs: Float64Array
  readonly ys: Float64Array
  /** Top of each visual line, in content coordinates, first line first. */
  readonly lineTops: readonly number[]
  readonly endX: number
  readonly endY: number
}

export interface StreamCursor {
  /** Ref callbacks that hand the controller its three elements. */
  readonly attachViewport: (element: HTMLDivElement | null) => void
  readonly attachContent: (element: HTMLDivElement | null) => void
  readonly attachCursor: (element: HTMLSpanElement | null) => void
  /** Which source to follow. Re-measures, since new text lays out anew. */
  setSource(source: TypingSource): void
  /** Re-measure after anything that moves characters, such as a size change. */
  measure(): void
  /** Moves the cursor to the source's current position. Cheap; no layout reads. */
  place(): void
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
  let source: TypingSource | null = null
  let layout: StreamLayout | null = null
  let scroll = Number.NaN

  const place = (): void => {
    if (layout === null || content === null || cursor === null || source === null) return

    const index = source.getCurrentIndex()
    const inText = index < layout.xs.length
    const x = inText ? (layout.xs[index] as number) : layout.endX
    const y = inText ? (layout.ys[index] as number) : layout.endY

    const line = lineIndexOf(layout.lineTops, y)
    const offset = (layout.lineTops[line] as number) - (layout.lineTops[0] ?? 0)

    if (offset !== scroll) {
      content.style.transform = `translate3d(0, ${-offset}px, 0)`
      scroll = offset
    }
    cursor.style.transform = `translate3d(${x}px, ${y - offset}px, 0)`
  }

  const measure = (): void => {
    if (content === null || cursor === null) return

    const spans = content.querySelectorAll<HTMLElement>('[data-i]')
    const count = spans.length
    if (count === 0) return

    const xs = new Float64Array(count)
    const ys = new Float64Array(count)
    const lineTops: number[] = []

    // One read pass; nothing is written until it is finished, so the browser
    // lays out once rather than once per character. Rectangles rather than
    // offsetTop/offsetLeft, which round to whole pixels: at 48.64px a line, a
    // rounded line top drifts against the fade band as lines go by.
    const origin = content.getBoundingClientRect()
    let lastRect: DOMRect | null = null
    spans.forEach((span, index) => {
      const rect = span.getBoundingClientRect()
      const top = rect.top - origin.top
      xs[index] = rect.left - origin.left
      ys[index] = top
      lastRect = rect
      if (lineTops.length === 0 || top > (lineTops[lineTops.length - 1] as number) + 0.5) lineTops.push(top)
    })

    const firstRect = (spans[0] as HTMLElement).getBoundingClientRect()
    const endRect = lastRect ?? firstRect
    layout = {
      xs,
      ys,
      lineTops,
      endX: endRect.right - origin.left,
      endY: endRect.top - origin.top,
    }
    const width = firstRect.width
    const height = firstRect.height

    // Re-placed without the slide: a new layout is not the cursor moving.
    cursor.style.transition = 'none'
    cursor.style.width = `${width}px`
    cursor.style.height = `${height}px`
    scroll = Number.NaN
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

    setSource: (next) => {
      source = next
      measure()
    },

    measure,
    place,

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

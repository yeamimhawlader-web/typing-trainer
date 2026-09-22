/**
 * Connects the stream cursor to a component. See `stream-cursor.ts` for how it
 * avoids reading layout on a keystroke.
 */

import { useEffect, useLayoutEffect, useState } from 'react'

import { createStreamCursor, type CursorSource, type StreamCursor } from './stream-cursor.ts'

/**
 * `size` is anything whose change moves the characters — the text size, and
 * the typeface with it — so a change of either is measured before paint.
 */
export const useStreamCursor = (source: CursorSource, text: string, size: string): StreamCursor => {
  const [cursor] = useState(createStreamCursor)

  // New text or a new size moves every character: measure before paint, so
  // nothing is ever drawn in the wrong place.
  useLayoutEffect(() => {
    if (text.length > 0 && size.length > 0) cursor.measure()
  }, [cursor, size, text])

  useLayoutEffect(() => cursor.follow(source), [cursor, source])

  useEffect(() => cursor.observe(), [cursor])

  return cursor
}

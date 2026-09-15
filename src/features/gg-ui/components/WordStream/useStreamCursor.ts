/**
 * Connects the stream cursor to a component. See `stream-cursor.ts` for how it
 * avoids reading layout on a keystroke.
 */

import { useEffect, useLayoutEffect, useState } from 'react'

import type { TypingSource } from '../../typing/typing-source.ts'
import { createStreamCursor, type StreamCursor } from './stream-cursor.ts'

export const useStreamCursor = (source: TypingSource, size: string): StreamCursor => {
  const [cursor] = useState(createStreamCursor)

  // New text: measure before paint, so nothing is drawn in the wrong place.
  useLayoutEffect(() => {
    cursor.setSource(source)
  }, [cursor, source])

  // A new size moves every character.
  useLayoutEffect(() => {
    if (size.length > 0) cursor.measure()
  }, [cursor, size])

  useEffect(() => cursor.observe(), [cursor])

  useEffect(() => source.subscribe(cursor.place), [cursor, source])

  return cursor
}

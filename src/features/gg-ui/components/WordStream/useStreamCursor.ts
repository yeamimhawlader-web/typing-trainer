/**
 * Connects the stream cursor to a component. See `stream-cursor.ts` for how it
 * avoids reading layout on a keystroke.
 */

import { useEffect, useLayoutEffect, useState } from 'react'

import type { TypingEngine } from '@core/engine'

import { createStreamCursor, type StreamCursor } from './stream-cursor.ts'

export const useStreamCursor = (engine: TypingEngine, text: string, size: string): StreamCursor => {
  const [cursor] = useState(createStreamCursor)

  // New text or a new size moves every character: measure before paint, so
  // nothing is ever drawn in the wrong place.
  useLayoutEffect(() => {
    if (text.length > 0 && size.length > 0) cursor.measure()
  }, [cursor, size, text])

  useLayoutEffect(() => cursor.follow(engine), [cursor, engine])

  useEffect(() => cursor.observe(), [cursor])

  return cursor
}

/**
 * Owns the engine instance, the keyboard, and the clock for one typing screen.
 *
 * Note what this hook does *not* do: it holds no per-keystroke state in React.
 * Keystrokes go straight into the engine, and components subscribe to the
 * slices they display. Putting the cursor or the character states in `useState`
 * here would re-render the entire screen on every key, which is exactly the
 * thing to avoid.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { BACKSPACE, createTypingEngine, type TypingEngine } from '@core/engine'
import type { TextProvider } from '@core/text'
import { timestamp, type SessionTarget, type Timestamp } from '@core/types'

/** How often the clock advances while running, in milliseconds. */
const TICK_INTERVAL_MS = 100

export const WORD_COUNT_OPTIONS = [15, 30, 60] as const
export type WordCount = (typeof WORD_COUNT_OPTIONS)[number]
export const DEFAULT_WORD_COUNT: WordCount = 30

/**
 * Prefers the browser's own timestamp for the key press over the time the
 * handler happened to run. Under load those differ by more than a keystroke
 * interval, and this application measures keystroke intervals for a living.
 *
 * Falls back when the value is not on the same time origin as
 * `performance.now()`, which would otherwise throw the session clock years into
 * the future and leave it there.
 */
const resolveEventTime = (event: KeyboardEvent): Timestamp => {
  const now = performance.now()
  const sameOrigin = event.timeStamp > 0 && Math.abs(event.timeStamp - now) < 1_000
  return timestamp(sameOrigin ? event.timeStamp : now)
}

/** True when the key event belongs to a real text field rather than the test. */
const isEditableTarget = (event: KeyboardEvent): boolean => {
  const target = event.target
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA'
  )
}

export interface TypingSession {
  readonly engine: TypingEngine
  readonly target: SessionTarget
  readonly wordCount: WordCount
  readonly setWordCount: (count: WordCount) => void
  readonly restart: () => void
}

export const useTypingSession = (provider: TextProvider): TypingSession => {
  const engine = useMemo(() => createTypingEngine(), [])
  const [wordCount, setWordCountState] = useState<WordCount>(DEFAULT_WORD_COUNT)
  const [target, setTarget] = useState<SessionTarget>(() =>
    provider.provide({ wordCount: DEFAULT_WORD_COUNT }),
  )

  const loadTest = useCallback(
    (count: WordCount) => {
      engine.reset()
      setTarget(provider.provide({ wordCount: count }))
    },
    [engine, provider],
  )

  const restart = useCallback(() => {
    loadTest(wordCount)
  }, [loadTest, wordCount])

  const setWordCount = useCallback(
    (count: WordCount) => {
      setWordCountState(count)
      loadTest(count)
    },
    [loadTest],
  )

  /**
   * The listener is re-attached whenever the loaded test changes, which is once
   * per test rather than once per keystroke. Holding `target` and `restart` in
   * refs to avoid that would mean writing to a ref during render — cheaper in
   * theory, wrong in practice, and invisible to the typist either way.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Leave browser and OS shortcuts alone.
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (isEditableTarget(event)) return

      if (event.key === 'Tab') {
        event.preventDefault()
        restart()
        return
      }

      const isBackspace = event.key === BACKSPACE
      const isCharacter = Array.from(event.key).length === 1
      if (!isBackspace && !isCharacter) return

      // Space would scroll the page and Backspace can navigate back.
      event.preventDefault()

      const status = engine.getSnapshot().status
      const at = resolveEventTime(event)

      if (status === 'idle') {
        // First keystroke starts the test — no button to press first.
        if (isBackspace) return
        engine.start(target, at)
      } else if (status !== 'running') {
        // A finished test is left alone; Tab starts a new one. Otherwise a
        // stray key would silently throw away the result just produced.
        return
      }

      engine.input(event.key, at)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [engine, target, restart])

  /**
   * Drives the clock while a test is running.
   *
   * Started and stopped from engine events rather than from React state, so
   * that a session beginning or ending does not re-render this component and,
   * through it, the whole screen.
   */
  useEffect(() => {
    let intervalId: number | undefined

    const stop = (): void => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId)
        intervalId = undefined
      }
    }

    const start = (): void => {
      stop()
      intervalId = window.setInterval(() => {
        engine.tick(timestamp(performance.now()))
      }, TICK_INTERVAL_MS)
    }

    const unsubscribe = engine.on((event) => {
      if (event.type === 'started' || event.type === 'resumed') start()
      else if (
        event.type === 'finished' ||
        event.type === 'paused' ||
        event.type === 'reset'
      ) {
        stop()
      }
    })

    return () => {
      stop()
      unsubscribe()
    }
  }, [engine])

  return { engine, target, wordCount, setWordCount, restart }
}

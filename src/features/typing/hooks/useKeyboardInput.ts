/**
 * The classic typing screen's input adapter: keys pressed anywhere on the page.
 *
 * It reads `keydown` on the window and turns it into the session's commands. The
 * rules for what a key does to a test live in `useTypingSession`; this file only
 * decides which keys are the test's rather than the browser's — shortcuts,
 * controls with focus, and real text fields keep their own keys.
 */

import { useEffect } from 'react'

import { BACKSPACE } from '@core/engine'
import { timestamp, type Timestamp } from '@core/types'

import type { TypingSessionController } from './useTypingSession.ts'

/**
 * Prefers the browser's own timestamp for the key press over the time the
 * handler happened to run. Under load those differ by more than a keystroke
 * interval, and this application measures keystroke intervals for a living.
 *
 * Falls back when the value is not on the same time origin as
 * `performance.now()`, which would otherwise throw the session clock years into
 * the future and leave it there.
 */
export const resolveEventTime = (event: Event): Timestamp => {
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

/**
 * True when a control has focus and the key would normally operate it.
 *
 * Space and Enter activate a focused button or link. Swallowing them to feed
 * the typing test would break the one thing a keyboard user relies on, so those
 * two keys are left alone whenever a control is what is focused. Every other
 * character still reaches the test, so typing from anywhere keeps working.
 */
const isControlActivation = (event: KeyboardEvent): boolean => {
  if (event.key !== ' ' && event.key !== 'Enter') return false

  const target = event.target
  if (!(target instanceof HTMLElement)) return false

  return (
    target.tagName === 'BUTTON' ||
    target.tagName === 'A' ||
    target.tagName === 'SELECT' ||
    target.getAttribute('role') === 'button'
  )
}

/**
 * True when the event asks for the previous word to be deleted.
 *
 * Ctrl+Backspace is the Windows and Linux binding, Alt+Backspace the macOS one;
 * a browser app gets both, because it has no idea which keyboard is in front of
 * it. Nobody typing at speed deletes a mistake one character at a time, so
 * without this the only way back is holding Backspace and watching.
 *
 * Cmd is deliberately excluded rather than folded in. On macOS Cmd+Backspace
 * means "delete to the start of the line", which here would throw away the
 * whole test — a different and much more destructive request that this does not
 * claim to implement.
 *
 * This is the *only* modified chord the typing screen takes. Everything else
 * with Ctrl, Alt or Cmd held falls through to the browser, so Ctrl+R, Ctrl+T,
 * Ctrl+W and the rest keep working exactly as they did.
 */
const isWordDelete = (event: KeyboardEvent): boolean =>
  event.key === BACKSPACE && (event.ctrlKey || event.altKey) && !event.metaKey


export const useKeyboardInput = ({
  engine,
  inputKey,
  deleteWord,
  restart,
}: Pick<TypingSessionController, 'engine' | 'inputKey' | 'deleteWord' | 'restart'>): void => {
  /**
   * The listener is re-attached whenever the loaded test changes, which is once
   * per test rather than once per keystroke.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // A real text field owns its own keys, modifiers included.
      if (isEditableTarget(event)) return

      /**
       * Ctrl+Backspace and Alt+Backspace delete the previous word.
       *
       * Checked before the modifier bail-out below, because that line exists to
       * leave browser and OS chords alone and this is the single exception to
       * it. Only while actually typing, which the command decides: swallowing
       * the key on the results would take it from the browser for no reason.
       */
      if (isWordDelete(event)) {
        if (deleteWord(resolveEventTime(event))) event.preventDefault()
        return
      }

      // Leave every other browser and OS shortcut alone.
      if (event.ctrlKey || event.metaKey || event.altKey) return

      const status = engine.getSnapshot().status

      /**
       * Tab abandons a test in progress and starts a fresh one.
       *
       * Only while actually typing. Once a test finishes there are results on
       * screen with their own controls, and swallowing Tab there would make
       * them unreachable — the same keyboard trap that taking Tab on the idle
       * screen used to create.
       */
      if (event.key === 'Tab') {
        if (status !== 'running') return
        event.preventDefault()
        restart()
        return
      }

      /**
       * Enter starts the next test from the results.
       *
       * Enter does nothing on an empty page, so claiming it costs the browser
       * no behaviour — unlike Tab, which is how people move around. It keeps
       * the repeat loop to a single key while leaving the results navigable.
       */
      if (event.key === 'Enter') {
        if (status !== 'completed' || isControlActivation(event)) return
        event.preventDefault()
        restart()
        return
      }

      // Space and Enter operating a focused control belong to that control.
      if (isControlActivation(event)) return

      // Space would scroll the page and Backspace can navigate back.
      if (inputKey(event.key, resolveEventTime(event))) event.preventDefault()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [engine, inputKey, deleteWord, restart])
}

/**
 * Where the typist types. Glass #3 of 3.
 *
 * GG.Typing's input adapter. It turns what arrives in the field into the typing
 * session's commands — `inputKey`, `deleteWord`, `restart` — and does nothing
 * else: whether a key was right, where the cursor goes and when the test ends
 * are the engine's to decide, and the stream above draws what it decided. It is
 * the second of two adapters over the same commands; the classic screen's
 * window `keydown` is the other, and a test cannot tell them apart.
 *
 * ## Input events, not key events
 *
 * Text arrives through `beforeinput`, not `keydown`. A physical keyboard fires
 * both, but input methods, dictation and automation often fire only the input
 * event — sometimes with several characters at once, and with `key` reported as
 * "Unidentified" on the key event. Listening to `beforeinput` sees all of them
 * the same way. Each character becomes its own `inputKey`, in order, with the
 * event's own timestamp.
 *
 * The browser never edits the field. It shows the word being typed, as an echo
 * of the characters the session accepted, and starts over on a space. Pasting
 * and dropping are refused, because a typing test types. Composition is left
 * alone and not counted; on-screen keyboards are not supported, the same as on
 * the classic screen.
 *
 * ## Keys that are not text
 *
 * - Ctrl+Backspace or Alt+Backspace arrives as `deleteWordBackward`: the
 *   session's word delete.
 * - Enter, on a finished test, starts the next.
 * - Tab, while a test is running, restarts it. Otherwise Tab moves focus, so
 *   the page stays navigable from here.
 *
 * ## Focus
 *
 * The glow is the focus indicator — an accent edge and a soft halo fading in
 * together — so there is no ring on top of it.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

import { BACKSPACE } from '@core/engine'
import type { SessionStatus } from '@core/types'
import { resolveEventTime, useEngineValue, type TypingScreen } from '@features/typing'

import styles from './InputField.module.css'

export type InputFieldProps = Pick<TypingScreen, 'engine' | 'inputKey' | 'deleteWord' | 'restart'>

const PLACEHOLDERS: Readonly<Record<SessionStatus, string>> = {
  idle: 'Start typing the words above',
  running: '',
  paused: '',
  completed: 'Press Enter for the next test',
  abandoned: 'Press Enter for the next test',
}

export const InputField = forwardRef<HTMLTextAreaElement | null, InputFieldProps>(
  ({ engine, inputKey, deleteWord, restart }, ref) => {
    const field = useRef<HTMLTextAreaElement>(null)
    useImperativeHandle<HTMLTextAreaElement | null, HTMLTextAreaElement | null>(ref, () => field.current, [])
    // Status changes when a test starts or ends, never on a keystroke.
    const placeholder = PLACEHOLDERS[useEngineValue(engine, (snapshot) => snapshot.status)]

    // A test that starts, ends or is reset starts with an empty field.
    useEffect(
      () =>
        engine.on((event) => {
          if (field.current === null) return
          if (event.type === 'started' || event.type === 'finished' || event.type === 'reset') {
            field.current.value = ''
          }
        }),
      [engine],
    )

    useEffect(() => {
      const element = field.current
      if (element === null) return undefined

      const isFinished = () => {
        const { status } = engine.getSnapshot()
        return status === 'completed' || status === 'abandoned'
      }

      const onBeforeInput = (event: InputEvent) => {
        if (event.isComposing) return

        // Nothing typed here is ever the browser's to insert.
        event.preventDefault()
        const at = resolveEventTime(event)

        switch (event.inputType) {
          case 'insertText':
          case 'insertReplacementText': {
            for (const character of Array.from(event.data ?? '')) {
              if (!inputKey(character, at)) continue
              // The last character of a test ends it, and clears the field with it.
              const typing = engine.getSnapshot().status === 'running'
              element.value = typing && !/\s/u.test(character) ? element.value + character : ''
            }
            return
          }

          case 'deleteContentBackward': {
            if (inputKey(BACKSPACE, at)) element.value = element.value.slice(0, -1)
            return
          }

          case 'deleteWordBackward': {
            if (deleteWord(at)) element.value = ''
            return
          }

          case 'insertLineBreak':
          case 'insertParagraph': {
            if (isFinished()) restart()
            return
          }

          default:
            // Paste, drop, forward deletes, line deletes: not part of a test.
            return
        }
      }

      /*
       * Tab and Enter are read from the key as well. Tab never reaches the
       * field as input at all; Enter does on a keyboard, but not from every
       * source of key events, so the key is the one path both always take.
       * Handling it here cancels the line break, so it never counts twice.
       */
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return

        const restartOn =
          (event.key === 'Tab' && engine.getSnapshot().status === 'running') ||
          (event.key === 'Enter' && isFinished())
        if (!restartOn) return

        event.preventDefault()
        restart()
      }

      element.addEventListener('beforeinput', onBeforeInput)
      element.addEventListener('keydown', onKeyDown)
      return () => {
        element.removeEventListener('beforeinput', onBeforeInput)
        element.removeEventListener('keydown', onKeyDown)
      }
    }, [deleteWord, engine, inputKey, restart])

    return (
      <div className={styles.field}>
        <textarea
          ref={field}
          className={styles.input}
          aria-label="Type the words above"
          placeholder={placeholder}
          rows={2}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>
    )
  },
)

InputField.displayName = 'InputField'

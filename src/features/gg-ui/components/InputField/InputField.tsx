/**
 * Where the typist types. Glass #3 of 3.
 *
 * ## Input events, not key events
 *
 * Text arrives through `beforeinput`, not `keydown`. A physical keyboard fires
 * both, but a phone's keyboard, dictation and most input methods fire only the
 * input event — often with several characters at once, and with `key` reported
 * as "Unidentified" on the key event. Listening to `beforeinput` sees all of
 * them the same way. Each character is handed to the typing source as its own
 * `onKeyPress`, in order.
 *
 * The field's contents are owned here rather than left to the browser: it shows
 * the word being typed and starts over on space, the way word-at-a-time tests
 * read. Pasting and new lines are refused, because a typing test types.
 * Composition (for scripts typed through an input method) is left alone for
 * now; the wiring pass decides how composed text should count.
 *
 * ## Focus
 *
 * The glow is the focus indicator — an accent edge and a soft halo fading in
 * together — so there is no ring on top of it.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

import type { TypingSource } from '../../typing/typing-source.ts'

import styles from './InputField.module.css'

export interface InputFieldProps {
  readonly source: TypingSource
}

export const InputField = forwardRef<HTMLTextAreaElement | null, InputFieldProps>(({ source }, ref) => {
  const field = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle<HTMLTextAreaElement | null, HTMLTextAreaElement | null>(ref, () => field.current, [])

  useEffect(() => {
    const element = field.current
    if (element === null) return undefined

    // A test that has not started yet starts with an empty field.
    if (source.getCurrentIndex() === 0) element.value = ''

    const onBeforeInput = (event: InputEvent) => {
      if (event.isComposing) return

      switch (event.inputType) {
        case 'insertText':
        case 'insertReplacementText': {
          event.preventDefault()
          for (const character of Array.from(event.data ?? '')) {
            source.onKeyPress(character)
            element.value = character === ' ' ? '' : element.value + character
          }
          return
        }

        case 'deleteContentBackward': {
          event.preventDefault()
          source.onKeyPress('Backspace')
          element.value = element.value.slice(0, -1)
          return
        }

        default:
          // Paste, drop, new lines, word deletes: not part of this stub.
          event.preventDefault()
      }
    }

    element.addEventListener('beforeinput', onBeforeInput)
    return () => element.removeEventListener('beforeinput', onBeforeInput)
  }, [source])

  return (
    <div className={styles.field}>
      <textarea
        ref={field}
        className={styles.input}
        aria-label="Type the words above"
        placeholder="Type the words above"
        rows={2}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  )
})

InputField.displayName = 'InputField'

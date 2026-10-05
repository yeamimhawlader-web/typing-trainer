/**
 * Where the typist types. Glass, of the one material the chrome is made of.
 *
 * ## One word wide
 *
 * The field holds one word — it echoes the word being typed and starts over on
 * a space — so it is sized for one word rather than for the page. It was a page
 * wide and two lines tall for a long while, which made the brightest,
 * hardest-edged thing on a screen that is otherwise stepping back the largest
 * thing on it as well, repeating what the words above already show. Now it is a
 * line, centred under them, and the words are what the screen is about.
 *
 * What that costs is room for a sentence, so the placeholders are two words and
 * the sentence they used to carry is said under the field by the hint, and the
 * Caps Lock note moved from the corner of the field to beside it.
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
 * - Tab starts the next test the moment one is finished, and restarts one that
 *   is under way. It is the fast way back to typing: finish, Tab, type.
 * - Enter, on a finished test, does the same, for anyone who reaches for it.
 * - While a test is idle — nothing typed yet — Tab does nothing here and moves
 *   focus as usual, so the page stays navigable from the field. Both keys are
 *   read on this element alone, so Tab from anywhere else on the page still
 *   moves focus, including to the result's own controls.
 *
 * "Under way" includes paused: Hover Mode pauses the text while a word is
 * repeated, and the typist is still typing.
 *
 * ## Caps Lock
 *
 * Every key is compared exactly, so Caps Lock turns a whole test red before
 * anyone notices why. The field says so the moment it is on — a small note in
 * its corner, spoken once — read from the keys it already receives, and it
 * changes only when the state does, never on an ordinary keystroke.
 *
 * ## Focus
 *
 * The glow is the focus indicator — an accent edge and a soft halo fading in
 * together — so there is no ring on top of it.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

import { BACKSPACE } from '@core/engine'
import type { SessionStatus } from '@core/types'
import { resolveEventTime, useEngineValue, type TypingScreen } from '@features/typing'

import styles from './InputField.module.css'

export type InputFieldProps = Pick<TypingScreen, 'engine' | 'inputKey' | 'deleteWord' | 'restart'>

/**
 * Two words each, because the field is one word wide. What these used to say in
 * a sentence — which words to type, which key starts the next test — is said
 * under the field by the hint, which has the room for a sentence. The field
 * keeps its own label for anyone who arrives at it by keyboard or by screen
 * reader rather than by looking at it.
 */
const PLACEHOLDERS: Readonly<Record<SessionStatus, string>> = {
  idle: 'Start typing',
  running: '',
  paused: '',
  completed: 'Tab for next',
  abandoned: 'Tab for next',
}

/**
 * Longer than any word the field is wide enough for, at any of the sizes it is
 * set in. Nothing is measured below it, which is every ordinary word: a count
 * is not a layout.
 */
const LONGEST_THAT_FITS = 20

/**
 * A word longer than the field scrolls along under the caret.
 *
 * The browser does that by itself for text a person types, but this field is
 * written to rather than typed into — the value is the echo of what the session
 * accepted — and a written value leaves the view where it was. So the end is
 * brought back into view by hand.
 *
 * The measurement this takes is the kind a keystroke must not pay for, which is
 * why it is behind a length no real word reaches. On the words anyone actually
 * types, this is one comparison and nothing else.
 */
const keepEndInView = (element: HTMLTextAreaElement): void => {
  if (element.value.length <= LONGEST_THAT_FITS) return
  element.scrollLeft = element.scrollWidth
}

export const InputField = forwardRef<HTMLTextAreaElement | null, InputFieldProps>(
  ({ engine, inputKey, deleteWord, restart }, ref) => {
    const field = useRef<HTMLTextAreaElement>(null)
    useImperativeHandle<HTMLTextAreaElement | null, HTMLTextAreaElement | null>(ref, () => field.current, [])
    // Status changes when a test starts or ends, never on a keystroke.
    const placeholder = PLACEHOLDERS[useEngineValue(engine, (snapshot) => snapshot.status)]
    const [capsLock, setCapsLock] = useState(false)

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

      const isUnderWay = () => {
        const { status } = engine.getSnapshot()
        return status === 'running' || status === 'paused'
      }

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
              const typing = isUnderWay()
              element.value = typing && !/\s/u.test(character) ? element.value + character : ''
              keepEndInView(element)
            }
            return
          }

          case 'deleteContentBackward': {
            if (!inputKey(BACKSPACE, at)) return
            element.value = element.value.slice(0, -1)
            keepEndInView(element)
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
      // What the keyboard says about Caps Lock, as each key arrives. A render
      // only when it changes: a repeated identical state is not one.
      let caps = false
      const readCapsLock = (event: KeyboardEvent) => {
        const on = event.getModifierState('CapsLock')
        if (on === caps) return
        caps = on
        setCapsLock(on)
      }
      const onBlur = () => {
        caps = false
        setCapsLock(false)
      }

      const onKeyDown = (event: KeyboardEvent) => {
        readCapsLock(event)
        if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return

        const restartOn =
          (event.key === 'Tab' && (isUnderWay() || isFinished())) ||
          (event.key === 'Enter' && isFinished())
        if (!restartOn) return

        event.preventDefault()
        restart()
      }

      element.addEventListener('beforeinput', onBeforeInput)
      element.addEventListener('keydown', onKeyDown)
      element.addEventListener('keyup', readCapsLock)
      element.addEventListener('blur', onBlur)
      return () => {
        element.removeEventListener('beforeinput', onBeforeInput)
        element.removeEventListener('keydown', onKeyDown)
        element.removeEventListener('keyup', readCapsLock)
        element.removeEventListener('blur', onBlur)
      }
    }, [deleteWord, engine, inputKey, restart])

    return (
      <div className={styles.field}>
        <textarea
          ref={field}
          className={styles.input}
          aria-label="Type the words above"
          placeholder={placeholder}
          rows={1}
          /* A word longer than the field scrolls along under the caret rather
             than wrapping onto a second line the field is not tall enough to
             show. */
          wrap="off"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {/* Always in the page, so it is announced when it fills; empty while Caps Lock is off. */}
        <span className={styles.caps} role="status" data-on={capsLock}>
          {capsLock && (
            <>
              <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true" focusable="false">
                <path d="M6 1.5 1.75 6.25h2.5V9h3.5V6.25h2.5Z" />
                <path d="M4.25 10.75h3.5" />
              </svg>
              Caps Lock is on
            </>
          )}
        </span>
      </div>
    )
  },
)

InputField.displayName = 'InputField'

/**
 * A destructive action that asks once before it acts.
 *
 * The audit found "Clear history" deleting 76 sessions on a single click, and
 * single deletions just as immediate. This is the smallest thing that stops a
 * mis-click being a loss: the first press turns the control into an inline
 * question with an explicit confirm and cancel, in place, with no dialog to
 * dismiss and nothing added to the typing loop, which never deletes anything.
 *
 * Focus moves to Cancel when the question appears, so an accidental second
 * Enter or Space does the safe thing, and returns to the original control when
 * cancelled. Escape cancels.
 */

import { useEffect, useRef, useState } from 'react'

import { cx } from '@shared/lib'

import styles from './ConfirmAction.module.css'

export interface ConfirmActionProps {
  /** Text on the control before it is pressed. */
  readonly label: string
  /** Accessible name for that control, when the visible label is not enough. */
  readonly triggerLabel?: string
  /** The question, e.g. "Delete this test?". */
  readonly prompt: string
  /** Text on the button that carries the action out. */
  readonly confirmLabel: string
  readonly onConfirm: () => void
  /** Styling for the initial control, so it can match where it sits. */
  readonly triggerClassName?: string | undefined
}

export const ConfirmAction = ({
  label,
  triggerLabel,
  prompt,
  confirmLabel,
  onConfirm,
  triggerClassName,
}: ConfirmActionProps) => {
  const [confirming, setConfirming] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  /** Whether focus should go back to the trigger when it reappears. */
  const restoreFocus = useRef(false)

  useEffect(() => {
    if (confirming) {
      cancelRef.current?.focus()
    } else if (restoreFocus.current) {
      restoreFocus.current = false
      triggerRef.current?.focus()
    }
  }, [confirming])

  const cancel = (): void => {
    restoreFocus.current = true
    setConfirming(false)
  }

  if (!confirming) {
    return (
      <button
        ref={triggerRef}
        type="button"
        className={cx(styles.trigger, triggerClassName)}
        aria-label={triggerLabel}
        onClick={() => setConfirming(true)}
      >
        {label}
      </button>
    )
  }

  return (
    <span
      role="group"
      aria-label={prompt}
      className={styles.group}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          cancel()
        }
      }}
    >
      <span className={styles.prompt}>{prompt}</span>
      <button
        type="button"
        className={cx(styles.button, styles.confirm)}
        onClick={() => {
          setConfirming(false)
          onConfirm()
        }}
      >
        {confirmLabel}
      </button>
      <button ref={cancelRef} type="button" className={styles.button} onClick={cancel}>
        Cancel
      </button>
    </span>
  )
}

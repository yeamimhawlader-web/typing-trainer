/**
 * What ends a test: a number of words, or a length of time.
 *
 * Two groups of pills, one caption each, in the order they are usually wanted.
 * Only one of them has a choice made in it, and that is the shape the next test
 * takes — so which kind of test is on is visible without a mode switch beside
 * it. Choosing in the other group changes both at once, which is what pressing
 * "30s" means.
 *
 * A custom time is the last pill. Pressing it shows a small field, already
 * holding the time in use, and any whole number of seconds inside the range is
 * accepted as it is typed; anything outside is refused rather than silently
 * rounded, and the test keeps the time it had.
 */

import { useEffect, useRef, useState } from 'react'

import { PRACTICE_WORD_COUNTS, type PracticeMode, type PracticeWordCount } from '@core/types'
import { CUSTOM_TIME, isValidTime, TIME_OPTIONS } from '@features/typing'

import { PillGroup, type PillOption } from '../controls/controls.tsx'

import styles from './TestShape.module.css'

const WORD_OPTIONS: readonly PillOption<PracticeWordCount>[] = PRACTICE_WORD_COUNTS.map((count) => ({
  value: count,
  label: String(count),
  accessibleLabel: `${count} words`,
}))

/** 15s, 30s, 1m — and the custom time, which is a pill and a field. */
const CUSTOM = 'custom'

const timeLabel = (seconds: number): string => (seconds % 60 === 0 ? `${seconds / 60}m` : `${seconds}s`)

const TIME_PILLS: readonly PillOption<string>[] = [
  ...TIME_OPTIONS.map((seconds) => ({
    value: String(seconds),
    label: timeLabel(seconds),
    accessibleLabel: `${seconds} seconds`,
  })),
  { value: CUSTOM, label: 'Custom', accessibleLabel: 'A custom time' },
]

export interface TestShapeProps {
  readonly mode: PracticeMode
  readonly words: PracticeWordCount
  readonly seconds: number
  readonly onWords: (words: PracticeWordCount) => void
  readonly onTime: (seconds: number) => void
}

export const TestShape = ({ mode, words, seconds, onWords, onTime }: TestShapeProps) => {
  const custom = mode === 'time' && !(TIME_OPTIONS as readonly number[]).includes(seconds)
  const [editing, setEditing] = useState(custom)
  const [draft, setDraft] = useState(String(seconds))
  const field = useRef<HTMLInputElement>(null)

  // Opened by pressing Custom: the field is where the typist is looking.
  const opened = useRef(false)
  useEffect(() => {
    if (editing && !opened.current) field.current?.focus()
    opened.current = editing
  }, [editing])

  const chooseTime = (value: string) => {
    if (value !== CUSTOM) {
      setEditing(false)
      onTime(Number(value))
      return
    }
    setDraft(String(seconds))
    setEditing(true)
    // Custom with a time that is already one of the pills keeps that time until
    // another is typed: pressing Custom chooses nothing by itself.
    onTime(seconds)
  }

  const typeTime = (value: string) => {
    setDraft(value)
    const asNumber = Number(value)
    if (value !== '' && isValidTime(asNumber)) onTime(asNumber)
  }

  return (
    <div className={styles.shape}>
      <PillGroup
        name="gg-length"
        label="Test length in words"
        caption="Words"
        options={WORD_OPTIONS}
        value={mode === 'words' ? words : null}
        onChange={onWords}
      />

      <PillGroup
        name="gg-time"
        label="Test length in time"
        caption="Time"
        options={TIME_PILLS}
        value={mode === 'time' ? (custom ? CUSTOM : String(seconds)) : null}
        onChange={chooseTime}
      />

      {editing && (
        <span className={styles.custom}>
          <input
            ref={field}
            type="number"
            className={styles.field}
            inputMode="numeric"
            min={CUSTOM_TIME.min}
            max={CUSTOM_TIME.max}
            step={5}
            value={draft}
            aria-label="Custom time in seconds"
            aria-invalid={draft !== '' && !isValidTime(Number(draft))}
            aria-describedby="gg-custom-time-range"
            onChange={(event) => typeTime(event.target.value)}
            onBlur={() => setDraft(String(seconds))}
          />
          <span className={styles.unit} id="gg-custom-time-range">
            s ({CUSTOM_TIME.min}–{CUSTOM_TIME.max})
          </span>
        </span>
      )}
    </div>
  )
}

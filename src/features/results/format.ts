/**
 * Display formatting for a stored session.
 *
 * Every screen that shows a result — the panel after a test, the history table,
 * the detail page — formats through these functions, so a duration is written
 * the same way everywhere.
 *
 * Note what is *not* here: no speed, accuracy or character count is calculated.
 * Those arrive already computed on `session.metrics`, and this file only decides
 * how to write them down. Recomputing any of them here would create the second
 * source of truth the architecture exists to avoid.
 */

import type { TypingSession } from '@core/sessions'

const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export const formatCompletedAt = (session: TypingSession): string =>
  dateTime.format(new Date(session.completedAt))

/** Machine-readable form for the `datetime` attribute. */
export const toIsoString = (session: TypingSession): string =>
  new Date(session.completedAt).toISOString()

/**
 * Durations read as seconds below a minute and m:ss above it. A typing test is
 * a handful of seconds to a couple of minutes, so hours never appear.
 */
/**
 * A test's duration, as whole seconds or minutes and seconds.
 *
 * Rounded down, like a stopwatch — and shared with the live timer, so the time
 * showing when a test ends is the time the result reports. They used to differ:
 * the live timer read 15s while the result said 16s for the same 15.77 seconds.
 */
export const formatDuration = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  if (totalSeconds < 60) return `${totalSeconds}s`

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export const formatWpm = (wpm: number): string => String(Math.round(wpm))

export const formatAccuracy = (accuracy: number): string =>
  `${Math.round(accuracy * 100)}%`

const MODE_LABELS: Record<TypingSession['context']['mode'], string> = {
  words: 'Words',
  time: 'Time',
  quote: 'Quote',
  drill: 'Drill',
}

/**
 * How a session was run.
 *
 * A drill names the sequence it was built around, because "Drill" on its own
 * tells a reader nothing about which one they did.
 */
export const formatMode = (session: TypingSession): string => {
  const label = MODE_LABELS[session.context.mode]
  const target = session.context.targetSequence

  return session.context.mode === 'drill' && target !== undefined
    ? `${label}: ${target}`
    : label
}

const SOURCE_LABELS: Record<string, string> = {
  'common-words': 'Common words',
}

/** Falls back to the raw id so a source added later still reads sensibly. */
export const formatSource = (session: TypingSession): string =>
  SOURCE_LABELS[session.textSourceId] ?? session.textSourceId

export const formatCount = (value: number): string => String(value)

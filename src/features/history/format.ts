/**
 * Display formatting for session history.
 *
 * Kept out of the components so the rules are testable on their own, and so
 * "how a duration is written" is decided in one place rather than per row.
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
export const formatDuration = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000))
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
}

export const formatMode = (session: TypingSession): string =>
  MODE_LABELS[session.context.mode]

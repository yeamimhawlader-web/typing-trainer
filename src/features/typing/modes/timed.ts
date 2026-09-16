/**
 * Time-based practice: the test ends when the clock runs out.
 *
 * It is the engine's own completion seam, nothing more — the same one word
 * practice uses to end on the last character and Hover Mode uses to wait for a
 * focused word. There is no second engine, no second clock and no separate
 * timer: the session's clock already advances while running, and this says when
 * it has advanced far enough.
 *
 * ## The clock is the clock
 *
 * Word practice caps idle gaps (see `IDLE_GAP_CAP_MS`): a typist who stops for
 * a minute is not typing, and that minute is not charged to their speed. A
 * timed test is the opposite promise — thirty seconds means thirty seconds,
 * whether or not anyone is typing — so the cap is off here, and the clock runs
 * from the first keystroke to the end of the time.
 *
 * ## Material
 *
 * Enough words for the time at a speed well past the fastest typists, so the
 * text does not run out before the clock does; the ceiling keeps a long custom
 * test from building a page of text nobody will reach.
 */

import type { SessionContext } from '@core/sessions'

import type { SessionModeHooks } from '../hooks/useTypingSession.ts'

/** The times offered as their own choice; anything else is a custom time. */
export const TIME_OPTIONS = [15, 30, 60] as const
export type TimeOption = (typeof TIME_OPTIONS)[number]

/** What a custom time may be, in seconds. */
export const CUSTOM_TIME = { min: 5, max: 120 } as const

export const DEFAULT_SECONDS: TimeOption = 30

/** A time this build will run: a whole number of seconds inside the range. */
export const isValidTime = (seconds: unknown): seconds is number =>
  typeof seconds === 'number' &&
  Number.isInteger(seconds) &&
  seconds >= CUSTOM_TIME.min &&
  seconds <= CUSTOM_TIME.max

/** A time brought into range, for a value that came from outside this build. */
export const clampTime = (seconds: number): number =>
  Math.min(CUSTOM_TIME.max, Math.max(CUSTOM_TIME.min, Math.round(seconds)))

/**
 * Words of material for a time: enough for 360 words per minute, which is past
 * any real typist, plus a few to start on. Capped, so a long custom test does
 * not render a page nobody reaches.
 */
export const wordsForTime = (seconds: number): number => Math.min(800, Math.ceil(seconds * 6) + 20)

/** The hooks a timed test runs through. */
export const createTimedMode = (seconds: number): SessionModeHooks => {
  const limit = clampTime(seconds)
  return {
    isComplete: (snapshot) => snapshot.elapsedMs >= limit * 1000,
    finalContext: (context: SessionContext): SessionContext => ({
      ...context,
      mode: 'time',
      durationSeconds: limit,
    }),
    // The timer is authoritative: idle time is still time.
    maxGapMs: null,
    textWords: wordsForTime(limit),
    key: `time:${limit}`,
  }
}

/**
 * The streak: how many days in a row this typist has practised.
 *
 * Daily practice is what actually makes someone faster, and it is the one
 * thing history knows that nothing on screen says. Counted on local calendar
 * days, as the activity chart is: what counts as "today" is the typist's own
 * midnight, not UTC's.
 *
 * A day counts if any test was finished in it — a drill, Hover Mode, thirty
 * seconds of ordinary words. The rule is showing up, so anything counts.
 *
 * A streak survives today until midnight: someone who typed yesterday and has
 * not typed yet today is still on their streak, and is told it is theirs to
 * keep rather than that it is already broken.
 */

import { startOfLocalDay, toLocalDayKey } from './range.ts'

export interface Streak {
  /** Days in a row up to and including today, or up to yesterday if today is still empty. */
  readonly days: number
  /** Whether a test has already been finished today. */
  readonly typedToday: boolean
}

const NONE: Streak = { days: 0, typedToday: false }

export const streakOf = (
  sessions: readonly { readonly completedAt: number }[],
  now: number,
): Streak => {
  if (sessions.length === 0) return NONE

  const days = new Set(sessions.map((session) => toLocalDayKey(session.completedAt)))
  const today = startOfLocalDay(now)
  const typedToday = days.has(toLocalDayKey(today))

  // Count back from today, or from yesterday while today is still empty.
  const from = new Date(today)
  if (!typedToday) from.setDate(from.getDate() - 1)

  let count = 0
  while (days.has(toLocalDayKey(from.getTime()))) {
    count += 1
    from.setDate(from.getDate() - 1)
  }

  return { days: count, typedToday }
}

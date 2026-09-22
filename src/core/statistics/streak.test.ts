import { describe, expect, it } from 'vitest'

import { streakOf } from './streak.ts'

/** Local noon `daysAgo` days back, so a test never lands near a midnight. */
const daysAgo = (days: number, now = Date.now()): number => {
  const date = new Date(now)
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date.getTime()
}

const sessionsOn = (...days: readonly number[]) =>
  days.map((day) => ({ completedAt: daysAgo(day) }))

describe('the streak', () => {
  const now = Date.now()

  it('counts the days in a row up to today', () => {
    expect(streakOf(sessionsOn(0, 1, 2), now)).toEqual({ days: 3, typedToday: true })
  })

  it('counts several tests in one day as the one day it was', () => {
    expect(streakOf(sessionsOn(0, 0, 0, 1), now).days).toBe(2)
  })

  it('stands until midnight: yesterday’s streak is still yours before today’s test', () => {
    expect(streakOf(sessionsOn(1, 2, 3), now)).toEqual({ days: 3, typedToday: false })
  })

  it('is broken by a day missed', () => {
    expect(streakOf(sessionsOn(0, 1, 3, 4), now).days).toBe(2)
  })

  it('is over when the last test was the day before yesterday', () => {
    expect(streakOf(sessionsOn(2, 3, 4), now)).toEqual({ days: 0, typedToday: false })
  })

  it('is nothing at all with no history', () => {
    expect(streakOf([], now)).toEqual({ days: 0, typedToday: false })
  })

  it('counts local days, not UTC ones', () => {
    // Late in the evening, local: still today wherever the typist is.
    const evening = new Date()
    evening.setHours(23, 30, 0, 0)

    expect(streakOf([{ completedAt: evening.getTime() }], evening.getTime())).toEqual({
      days: 1,
      typedToday: true,
    })
  })
})

/**
 * Datasets for drawing.
 *
 * Chart-agnostic on purpose: arrays of numbers and dates, chronological, with
 * no scales, pixels or colours decided. A sparkline, a table and a screen
 * reader can all be built from the same values.
 */

import type { TypingSession } from '@core/sessions'

import { mean } from './aggregate.ts'
import { startOfLocalDay, toLocalDayKey } from './range.ts'
import type { DailyPoint, SessionTrends, TrendPoint } from './types.ts'

/** Oldest first. Sorts a copy: the caller's history keeps its own order. */
const chronological = (sessions: readonly TypingSession[]): readonly TypingSession[] =>
  [...sessions].sort((a, b) => a.completedAt - b.completedAt)

const toPoints = (
  sessions: readonly TypingSession[],
  select: (session: TypingSession) => number,
): readonly TrendPoint[] =>
  sessions.map((session) => ({
    sessionId: session.id,
    at: session.completedAt,
    value: select(session),
  }))

/**
 * One entry per local calendar day that has sessions, oldest first.
 *
 * Days without sessions are absent rather than zero-filled. Whether a gap
 * should be drawn as a zero or as a break in the line is a question for the
 * chart, and inventing rows here would take that choice away from it.
 */
const toDailyPoints = (sessions: readonly TypingSession[]): readonly DailyPoint[] => {
  const byDay = new Map<string, TypingSession[]>()

  for (const session of sessions) {
    const day = toLocalDayKey(session.completedAt)
    const existing = byDay.get(day)
    if (existing === undefined) byDay.set(day, [session])
    else existing.push(session)
  }

  return [...byDay.entries()]
    .map(([day, daySessions]) => ({
      day,
      startOfDay: startOfLocalDay((daySessions[0] as TypingSession).completedAt),
      sessionCount: daySessions.length,
      typingTimeMs: daySessions.reduce((total, s) => total + s.durationMs, 0),
      averageWpm: mean(daySessions.map((s) => s.metrics.netWpm)),
    }))
    .sort((a, b) => a.startOfDay - b.startOfDay)
}

export const computeTrends = (sessions: readonly TypingSession[]): SessionTrends => {
  const ordered = chronological(sessions)

  return {
    wpm: toPoints(ordered, (session) => session.metrics.netWpm),
    rawWpm: toPoints(ordered, (session) => session.metrics.rawWpm),
    accuracy: toPoints(ordered, (session) => session.metrics.accuracy),
    daily: toDailyPoints(ordered),
  }
}

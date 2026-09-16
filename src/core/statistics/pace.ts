/**
 * The pace a ghost caret keeps: the typist's own speeds, read off their history.
 *
 * A pace caret is only worth following if it is the typist's pace, not a number
 * someone else chose. So the three paces are the typist's: their recent typical
 * speed (the median, so one great or awful test does not drag it), their fastest
 * recent test, and a push — a little past the typical, which is the speed a
 * session of practice is trying to make the new typical.
 *
 * Only ordinary tests count. Training modes shape their text on purpose (see
 * TRAINING_MODES), and a drill of one awkward transition says nothing about
 * how fast someone types prose. Until there are a few ordinary tests there is
 * no pace to offer, rather than a guess at one.
 *
 * Pure: sessions in, numbers out.
 */

import type { TypingSession } from '@core/sessions'
import { isTrainingMode } from '@core/sessions/types.ts'
import { CHARACTERS_PER_WORD, MILLISECONDS_PER_MINUTE, type PaceChoice } from '@core/types'

import { isUsableSession, median } from './aggregate.ts'

export const PACE_RULES = {
  /** How many of the most recent ordinary tests the paces are read from. */
  recent: 20,
  /** Fewer than this, and there is no pace yet. */
  minimum: 3,
  /** The push: this far past the typical speed, and always at least one word per minute. */
  push: 1.05,
} as const

export type PaceRules = typeof PACE_RULES

export interface PaceTargets {
  /** Words per minute, or null while there is too little history. */
  readonly average: number | null
  readonly best: number | null
  readonly push: number | null
  /** How many tests they were read from. */
  readonly from: number
}

export const paceTargets = (sessions: readonly TypingSession[], rules: PaceRules = PACE_RULES): PaceTargets => {
  const ordinary = sessions
    .filter((session) => session.status === 'completed' && !isTrainingMode(session.context.mode) && isUsableSession(session))
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, rules.recent)

  const speeds = ordinary.map((session) => session.metrics.netWpm)
  const typical = median(speeds)
  if (typical === null || ordinary.length < rules.minimum) {
    return { average: null, best: null, push: null, from: ordinary.length }
  }

  const average = Math.round(typical)
  return {
    average,
    best: Math.round(Math.max(...speeds)),
    push: Math.max(average + 1, Math.round(typical * rules.push)),
    from: ordinary.length,
  }
}

/** The pace a choice stands for, in words per minute, or null for none. */
export const paceFor = (choice: PaceChoice, targets: PaceTargets | null): number | null =>
  choice === 'off' || targets === null ? null : targets[choice]

/**
 * How far into the text a pace has got after `elapsedMs` of typing time: the
 * character it is on, never past the end.
 */
export const paceIndexAt = (elapsedMs: number, wpm: number, length: number): number => {
  if (!(wpm > 0) || !(elapsedMs > 0)) return 0
  // Words per minute are counted in characters of five, as the engine counts them.
  return Math.min(length, Math.floor((elapsedMs * wpm * CHARACTERS_PER_WORD) / MILLISECONDS_PER_MINUTE))
}

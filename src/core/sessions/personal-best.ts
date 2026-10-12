/**
 * Whether a finished test beat every earlier test of the same kind.
 *
 * "The same kind" is what makes a speed comparable: 25 words is not 100 words,
 * 15 seconds is not 60, and punctuation slows everyone down. So a test is only
 * measured against earlier tests with the same mode, the same length — word
 * count, or seconds for a timed test — the same difficulty and the same
 * language.
 *
 * Training modes never count. A drill's lopsided text, Hover Mode's repeated
 * words and the Syllable Trainer are shaped on purpose, so their speeds say
 * nothing about a best.
 *
 * The very first test of a kind is not a personal best: there was nothing to
 * beat, and a celebration on someone's first ever test would mean nothing.
 */

import type { Wpm } from '@core/types'

import { isTrainingMode, type TypingSession } from './types.ts'

export interface PersonalBest {
  /** The best speed before this test, which it beat. */
  readonly previousWpm: Wpm
}

/** Words in a test's text, counted the way the text was made: separated by spaces. */
const wordsIn = (text: string): number => text.split(' ').filter((word) => word.length > 0).length

/** What a test has to share with another for their speeds to be compared. Null when it never counts. */
export const personalBestKind = (session: TypingSession): string | null => {
  const { mode, difficulty, language, durationSeconds } = session.context
  if (session.status !== 'completed' || isTrainingMode(mode)) return null
  const length = mode === 'time' ? `${durationSeconds ?? 0}s` : mode === 'words' ? `${wordsIn(session.text)}w` : ''
  return [mode, length, difficulty, language].join('|')
}

/**
 * The best this test beat, or null when it beat nothing.
 *
 * `history` may or may not already hold the test itself, depending on whether
 * saving it has finished; it is left out by id either way.
 */
export const personalBestOf = (session: TypingSession, history: readonly TypingSession[]): PersonalBest | null => {
  const kind = personalBestKind(session)
  if (kind === null) return null

  let previous: Wpm | null = null
  for (const earlier of history) {
    if (earlier.id === session.id || personalBestKind(earlier) !== kind) continue
    if (previous === null || earlier.metrics.netWpm > previous) previous = earlier.metrics.netWpm
  }

  return previous !== null && session.metrics.netWpm > previous ? { previousWpm: previous } : null
}

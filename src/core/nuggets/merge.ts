/**
 * How a focus outcome changes the Golden Nuggets. Pure.
 *
 * | Outcome | No record for the word | A record for the word |
 * | --- | --- | --- |
 * | Released without clearing | created, unresolved once | unresolved +1 |
 * | Cleared | nothing: the word did its job | updated: last outcome cleared |
 *
 * In both updating cases the mistakes are added, the last seen date, difficulty
 * and outcome replaced, and the test counted once however many focuses on the
 * word it contained.
 */

import type { LanguageCode } from '@core/sessions'

import type { GoldenNugget, HoverFocusOutcome } from './types.ts'

export const normaliseWord = (word: string, language: LanguageCode): string => word.toLocaleLowerCase(language)

export const nuggetIdOf = (word: string, language: LanguageCode): string =>
  `${language}:${normaliseWord(word, language)}`

export interface NuggetChange {
  readonly nuggets: readonly GoldenNugget[]
  /** The record created or updated, or null when the outcome changed nothing. */
  readonly changed: GoldenNugget | null
}

export const applyFocusOutcome = (nuggets: readonly GoldenNugget[], outcome: HoverFocusOutcome): NuggetChange => {
  const id = nuggetIdOf(outcome.word, outcome.language)
  const existing = nuggets.find((nugget) => nugget.id === id)
  const lastOutcome = outcome.cleared ? 'cleared' : 'unresolved'

  if (existing === undefined) {
    if (outcome.cleared) return { nuggets, changed: null }
    const created: GoldenNugget = {
      id,
      word: normaliseWord(outcome.word, outcome.language),
      language: outcome.language,
      timesUnresolved: 1,
      hoverSessions: 1,
      mistakes: outcome.mistakes,
      firstSeenAt: outcome.at,
      lastSeenAt: outcome.at,
      lastDifficulty: outcome.difficulty,
      lastOutcome,
      lastTestId: outcome.testId,
    }
    return { nuggets: [...nuggets, created], changed: created }
  }

  const updated: GoldenNugget = {
    ...existing,
    timesUnresolved: existing.timesUnresolved + (outcome.cleared ? 0 : 1),
    hoverSessions: existing.hoverSessions + (existing.lastTestId === outcome.testId ? 0 : 1),
    mistakes: existing.mistakes + outcome.mistakes,
    lastSeenAt: Math.max(existing.lastSeenAt, outcome.at),
    lastDifficulty: outcome.difficulty,
    lastOutcome,
    lastTestId: outcome.testId,
  }
  return { nuggets: nuggets.map((nugget) => (nugget.id === id ? updated : nugget)), changed: updated }
}

/** Most recently seen first. */
export const byLastSeen = (a: GoldenNugget, b: GoldenNugget): number => b.lastSeenAt - a.lastSeenAt

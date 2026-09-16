/**
 * How a focus outcome changes the Golden Nuggets. Pure.
 *
 * | Outcome | No record for the word | A record for the word |
 * | --- | --- | --- |
 * | A focus released without clearing | created, unresolved once | unresolved +1 |
 * | A focus that cleared | nothing: the word did its job | updated: last outcome cleared |
 * | Five mistakes in a test | created | mistakes added |
 *
 * In every updating case the mistakes are added, the last seen date replaced and
 * the test counted once however many times the word cost something in it. Only
 * a focus moves the Hover Mode counts or the last outcome: mistakes adding up
 * says nothing about how a focus went, because there was not one.
 */

import type { LanguageCode } from '@core/sessions'

import type { GoldenNugget, HoverFocusOutcome } from './types.ts'

/** Distinct tests a record has counted, reading an older record's Hover Mode count. */
export const testsOf = (nugget: GoldenNugget): number => nugget.tests ?? nugget.hoverSessions

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
  const released = (outcome.reason ?? 'released') === 'released'
  const lastOutcome = outcome.cleared ? 'cleared' : 'unresolved'

  if (existing === undefined) {
    if (outcome.cleared) return { nuggets, changed: null }
    const created: GoldenNugget = {
      id,
      word: normaliseWord(outcome.word, outcome.language),
      language: outcome.language,
      timesUnresolved: released ? 1 : 0,
      hoverSessions: outcome.difficulty === undefined || outcome.difficulty === null ? 0 : 1,
      tests: 1,
      mistakes: outcome.mistakes,
      firstSeenAt: outcome.at,
      lastSeenAt: outcome.at,
      lastDifficulty: outcome.difficulty ?? null,
      lastOutcome,
      lastTestId: outcome.testId,
    }
    return { nuggets: [...nuggets, created], changed: created }
  }

  const sameTest = existing.lastTestId === outcome.testId
  const updated: GoldenNugget = {
    ...existing,
    timesUnresolved: existing.timesUnresolved + (released && !outcome.cleared ? 1 : 0),
    tests: testsOf(existing) + (sameTest ? 0 : 1),
    hoverSessions:
      existing.hoverSessions +
      // A test counts once, and only a Hover Mode focus counts at all.
      (outcome.difficulty === undefined || outcome.difficulty === null || sameTest ? 0 : 1),
    mistakes: existing.mistakes + outcome.mistakes,
    lastSeenAt: Math.max(existing.lastSeenAt, outcome.at),
    lastDifficulty: outcome.difficulty ?? existing.lastDifficulty,
    lastOutcome: released ? lastOutcome : existing.lastOutcome,
    lastTestId: outcome.testId,
  }
  return { nuggets: nuggets.map((nugget) => (nugget.id === id ? updated : nugget)), changed: updated }
}

/** Most recently seen first. */
export const byLastSeen = (a: GoldenNugget, b: GoldenNugget): number => b.lastSeenAt - a.lastSeenAt

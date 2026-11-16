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

/**
 * One word's record as held in two places, joined into the record that keeps
 * everything both of them know.
 *
 * Used when a browser and an account both have a record for the same word,
 * which is the ordinary case the moment a typist practises on two machines.
 *
 * ## Why not simply take the newer one
 *
 * Because a nugget is a tally, not a document. Take the newer record whole and
 * the older one's counting is thrown away: a laptop that logged six mistakes
 * on `because` offline, and a desktop that logged two a minute later, would
 * end up saying two.
 *
 * Every count here only ever rises — `applyFocusOutcome` adds and never
 * subtracts — so the larger of two counts is the one that has seen more, and
 * taking the larger of each can never report less than either side already
 * knew. It is still not a perfect total: both sides counting separately
 * between two rounds of syncing ends at the larger, not the sum, so a word
 * worked on in two browsers at once can be undercounted. That is a deliberate
 * trade. Counting the true sum needs each browser to keep its own running
 * tally for every word forever, which is a great deal of machinery for a
 * number that says "this word keeps costing you" — and the alternative of
 * taking the newer record is not merely imprecise but actively loses work.
 *
 * The dates are treated as what they are: the first sighting is the earlier of
 * the two, the last is the later.
 *
 * ## Why the tie is broken on the test id
 *
 * The fields that describe the most recent focus — how it ended, at what
 * difficulty, in which test — have to be taken from one side or the other,
 * since averaging them means nothing. They come from whichever side saw the
 * word last. Two records with the same `lastSeenAt` to the millisecond are
 * vanishingly unlikely but not impossible, and if the answer depended on which
 * side happened to be passed first, two browsers merging the same pair could
 * reach different records and then sync them back and forth forever. Comparing
 * the test ids settles it the same way on every machine.
 */
/**
 * The side whose record describes the more recent focus, with a dead heat
 * settled on the test id so that two browsers joining the same pair cannot
 * reach different answers and then push them at each other forever.
 */
const laterOf = (a: GoldenNugget, b: GoldenNugget): GoldenNugget => {
  if (a.lastSeenAt !== b.lastSeenAt) return a.lastSeenAt > b.lastSeenAt ? a : b
  return a.lastTestId >= b.lastTestId ? a : b
}

export const mergeNuggets = (a: GoldenNugget, b: GoldenNugget): GoldenNugget => {
  return {
    ...laterOf(a, b),
    timesUnresolved: Math.max(a.timesUnresolved, b.timesUnresolved),
    hoverSessions: Math.max(a.hoverSessions, b.hoverSessions),
    tests: Math.max(testsOf(a), testsOf(b)),
    mistakes: Math.max(a.mistakes, b.mistakes),
    firstSeenAt: Math.min(a.firstSeenAt, b.firstSeenAt),
    lastSeenAt: Math.max(a.lastSeenAt, b.lastSeenAt),
  }
}

/** Whether two records say the same thing, so an unchanged one is not written. */
export const sameNugget = (a: GoldenNugget, b: GoldenNugget): boolean =>
  a.id === b.id &&
  a.timesUnresolved === b.timesUnresolved &&
  a.hoverSessions === b.hoverSessions &&
  testsOf(a) === testsOf(b) &&
  a.mistakes === b.mistakes &&
  a.firstSeenAt === b.firstSeenAt &&
  a.lastSeenAt === b.lastSeenAt &&
  a.lastDifficulty === b.lastDifficulty &&
  a.lastOutcome === b.lastOutcome &&
  a.lastTestId === b.lastTestId

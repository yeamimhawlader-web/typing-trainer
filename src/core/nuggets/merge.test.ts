/**
 * Joining one word's record as two browsers hold it.
 *
 * This runs whenever a typist practises on more than one machine, and it is
 * the only place in Golden Nuggets where two true records disagree and one
 * answer has to come out. Three properties matter, and each has a test:
 *
 * - it never reports less than either side already knew;
 * - it gives the same answer whichever way round the two are handed to it;
 * - joining a record with itself changes nothing.
 *
 * The second and third are what keep two browsers from pushing different
 * answers at each other forever.
 */

import { describe, expect, it } from 'vitest'

import { mergeNuggets, sameNugget } from './merge.ts'
import type { GoldenNugget } from './types.ts'

const nugget = (over: Partial<GoldenNugget> = {}): GoldenNugget => ({
  id: 'en:because',
  word: 'because',
  language: 'en',
  timesUnresolved: 1,
  hoverSessions: 1,
  tests: 1,
  mistakes: 3,
  firstSeenAt: 1_000,
  lastSeenAt: 2_000,
  lastDifficulty: 'standard',
  lastOutcome: 'unresolved',
  lastTestId: 'test-1',
  ...over,
})

describe('joining one word as two browsers hold it', () => {
  it('keeps the larger of every count, so neither side stops counting', () => {
    const laptop = nugget({
      timesUnresolved: 4,
      hoverSessions: 3,
      tests: 7,
      mistakes: 11,
    })
    const desktop = nugget({
      timesUnresolved: 1,
      hoverSessions: 5,
      tests: 2,
      mistakes: 6,
    })

    expect(mergeNuggets(laptop, desktop)).toMatchObject({
      timesUnresolved: 4,
      hoverSessions: 5,
      tests: 7,
      mistakes: 11,
    })
  })

  it('takes the earlier first sighting and the later last one', () => {
    const early = nugget({ firstSeenAt: 500, lastSeenAt: 2_000 })
    const late = nugget({ firstSeenAt: 9_000, lastSeenAt: 9_500 })

    expect(mergeNuggets(early, late)).toMatchObject({
      firstSeenAt: 500,
      lastSeenAt: 9_500,
    })
  })

  it('describes the most recent focus from the side that saw the word last', () => {
    const older = nugget({
      lastSeenAt: 2_000,
      lastOutcome: 'unresolved',
      lastDifficulty: 'standard',
      lastTestId: 'a',
    })
    const newer = nugget({
      lastSeenAt: 8_000,
      lastOutcome: 'cleared',
      lastDifficulty: 'tired',
      lastTestId: 'b',
    })

    expect(mergeNuggets(older, newer)).toMatchObject({
      lastOutcome: 'cleared',
      lastDifficulty: 'tired',
      lastTestId: 'b',
    })
  })

  it('reads an older record that counted no tests as its Hover Mode count', () => {
    // `tests` arrived after `hoverSessions`, so a record written before it has
    // none; taking it as zero would make the join report fewer tests than the
    // record already showed on the page.
    const { tests: _none, ...before } = nugget({ hoverSessions: 6 })
    const after = nugget({ tests: 2, hoverSessions: 2 })

    expect(mergeNuggets(before as GoldenNugget, after).tests).toBe(6)
  })

  it('gives the same answer whichever way round the two are handed to it', () => {
    const one = nugget({ mistakes: 11, tests: 7, lastSeenAt: 2_000, lastTestId: 'a' })
    const other = nugget({ mistakes: 6, tests: 9, lastSeenAt: 8_000, lastTestId: 'b' })

    expect(mergeNuggets(one, other)).toEqual(mergeNuggets(other, one))
  })

  it('changes nothing when a record is joined with itself', () => {
    const only = nugget({ mistakes: 11, tests: 7 })

    expect(mergeNuggets(only, only)).toEqual(only)
  })

  it('settles a dead heat the same way on every machine', () => {
    // Two records last seen in the same millisecond. If the answer depended on
    // which side happened to be first, two browsers would reach different
    // records and then push them at each other without end.
    const one = nugget({ lastSeenAt: 5_000, lastTestId: 'aaa', lastOutcome: 'cleared' })
    const other = nugget({
      lastSeenAt: 5_000,
      lastTestId: 'bbb',
      lastOutcome: 'unresolved',
    })

    expect(mergeNuggets(one, other)).toEqual(mergeNuggets(other, one))
    expect(mergeNuggets(one, other).lastTestId).toBe('bbb')
  })

  it('is settled after one join: joining the answer again moves nothing', () => {
    const one = nugget({ mistakes: 11, tests: 7, lastSeenAt: 2_000 })
    const other = nugget({ mistakes: 6, tests: 9, lastSeenAt: 8_000, lastTestId: 'b' })
    const joined = mergeNuggets(one, other)

    expect(mergeNuggets(joined, one)).toEqual(joined)
    expect(mergeNuggets(joined, other)).toEqual(joined)
  })
})

describe('telling two records apart', () => {
  it('sees a record as the same as itself', () => {
    expect(sameNugget(nugget(), nugget())).toBe(true)
  })

  it('notices a difference in any field the join can move', () => {
    const changes: readonly Partial<GoldenNugget>[] = [
      { timesUnresolved: 9 },
      { hoverSessions: 9 },
      { tests: 9 },
      { mistakes: 9 },
      { firstSeenAt: 9 },
      { lastSeenAt: 9 },
      { lastDifficulty: 'tired' },
      { lastOutcome: 'cleared' },
      { lastTestId: 'other' },
      { id: 'en:other' },
    ]

    // Each on its own, so a field left out of the comparison is named by the
    // failure rather than hidden behind the one beside it.
    for (const change of changes)
      expect([change, sameNugget(nugget(), nugget(change))]).toEqual([change, false])
  })

  it('reads a missing test count as the Hover Mode count on both sides', () => {
    const { tests: _none, ...older } = nugget({ hoverSessions: 4 })

    expect(
      sameNugget(older as GoldenNugget, nugget({ hoverSessions: 4, tests: 4 })),
    ).toBe(true)
  })
})

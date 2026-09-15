/**
 * Golden Nuggets: words worth coming back to.
 *
 * A word becomes a Golden Nugget when Hover Mode releases it without it having
 * cleared — the typist had the repetitions their difficulty gives, and the word
 * was still costing mistakes at the end. After that, every Hover Mode focus on
 * the same word updates the same record, cleared or not, so the record says
 * both how often the word has got away and how it went last time.
 *
 * Deliberately a log, not a score: counts and dates, nothing ranked against
 * anyone, and nothing inferred.
 *
 * ## Identity
 *
 * One record per word per language: `because` focused in ten tests is one
 * record whose counts rise, never ten rows. Words are compared in lower case,
 * so a capitalised word at the start of a quote would join the same record. The
 * language is part of the identity so a second language's `die` and English
 * `die` never merge.
 *
 * ## Room to grow
 *
 * Training a nugget, ordering by frequency or by what it costs in speed,
 * comparing before and after, archiving — none exist yet. The first and last
 * dates, per-outcome counts and language are kept so those can be built on
 * the record without migrating it.
 */

import type { LanguageCode } from '@core/sessions'
import type { HoverDifficulty } from '@core/types'

export interface GoldenNugget {
  /** `language:word`. The record's identity. */
  readonly id: string
  /** The word, in lower case. */
  readonly word: string
  readonly language: LanguageCode
  /** Hover Mode focuses on the word that ended without it clearing. */
  readonly timesUnresolved: number
  /** Distinct Hover Mode tests the word has been focused in since it became a nugget. */
  readonly hoverSessions: number
  /** Wrong keystrokes on the word across those focuses, in the text and in repetitions. */
  readonly mistakes: number
  /** Epoch milliseconds. */
  readonly firstSeenAt: number
  /** Epoch milliseconds. */
  readonly lastSeenAt: number
  readonly lastDifficulty: HoverDifficulty
  /** How the most recent focus on the word ended. */
  readonly lastOutcome: 'cleared' | 'unresolved'
  /** The test the most recent focus happened in, so a test is counted once. */
  readonly lastTestId: string
}

/** How one Hover Mode focus on a word ended. */
export interface HoverFocusOutcome {
  readonly word: string
  readonly language: LanguageCode
  readonly difficulty: HoverDifficulty
  /** Whether the word cleared by its difficulty's rule. */
  readonly cleared: boolean
  readonly mistakes: number
  /** Epoch milliseconds. */
  readonly at: number
  /** The test it happened in. */
  readonly testId: string
}

/**
 * Three mistakes on a word in Hover Mode keep it, there and then.
 *
 * A focus starts on a word's first mistake and counts each repetition that
 * goes wrong after it. The third time the word is got wrong — the slip that
 * started the focus and two repetitions, say — it is a Golden Nugget, without
 * waiting to see how the focus ends: three is already the answer to whether
 * the word is worth coming back to. The focus carries on as it was; this
 * changes nothing about how many repetitions are asked for.
 *
 * It is told to the screen as it happens (`onKeep`), which is what lets the
 * word be seen going to Golden Nuggets, and written once. The write carries no
 * mistakes of its own: the focus hands over its whole count when it is
 * released (golden-nuggets.ts), and counting them here as well would say the
 * word cost twice what it did.
 *
 * Counts go when the test does: a new test's words start from nothing.
 */

import type { Unsubscribe } from '@core/engine'
import type { GoldenNugget, GoldenNuggetService } from '@core/nuggets'
import type { LanguageCode } from '@core/sessions'

import type { HoverController } from './hover-controller.ts'

/** How many times a word is got wrong before it is kept. */
export const STRIKES_TO_KEEP = 3

export interface KeptWord {
  readonly word: string
  /** Its position among the text's words. */
  readonly wordIndex: number
}

export interface ThreeStrikesOptions {
  readonly language: LanguageCode
  /** Injectable for tests; wall-clock milliseconds. */
  readonly now?: () => number
  /** The moment a word is kept, before anything is written. */
  readonly onKeep?: (kept: KeptWord) => void
  /** Once it is written: the record as it now stands. */
  readonly onRecorded?: (nugget: GoldenNugget | null) => void
}

export const keepAfterThreeStrikes = (
  hover: HoverController,
  service: GoldenNuggetService,
  { language, now = Date.now, onKeep, onRecorded }: ThreeStrikesOptions,
): Unsubscribe => {
  let testId: string | null = null
  const strikes = new Map<number, number>()

  return hover.onSignal(({ signal, snapshot }) => {
    if (snapshot.testId !== testId) {
      testId = snapshot.testId
      strikes.clear()
    }
    // The slip that starts a focus, and each repetition that goes wrong.
    if (signal !== 'activated' && signal !== 'failure') return
    const { focus, focusId } = snapshot
    if (focus === null) return

    const count = (strikes.get(focusId) ?? 0) + 1
    strikes.set(focusId, count)
    if (count !== STRIKES_TO_KEEP) return

    onKeep?.({ word: focus.word, wordIndex: focus.wordIndex })
    service
      .recordFocus({
        reason: 'mistakes',
        word: focus.word,
        language,
        difficulty: snapshot.difficulty,
        cleared: false,
        // The focus hands its own count over when it is released.
        mistakes: 0,
        at: now(),
        testId: snapshot.testId,
      })
      .then(onRecorded, (error: unknown) => {
        console.warn('[golden nuggets] failed to keep a word after three mistakes', error)
      })
  })
}

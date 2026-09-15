/**
 * Hands each finished Hover Mode focus to Golden Nuggets.
 *
 * Only on release — the moment a focus has had its full chance — and never on
 * a keystroke. Whether the word goes in, or updates a record already there, is
 * `@core/nuggets`' decision; this passes on how the focus ended. A focus cut
 * short by a restart is not passed on: it never had its chance.
 *
 * The write is started and not awaited. A failed write costs a log entry, not
 * the test being typed.
 */

import type { Unsubscribe } from '@core/engine'
import type { GoldenNuggetService } from '@core/nuggets'
import type { LanguageCode } from '@core/sessions'

import type { HoverController } from './hover-controller.ts'

export interface GoldenNuggetRecorderOptions {
  /** The language of the text being typed. */
  readonly language: LanguageCode
  /** Injectable for tests; wall-clock milliseconds. */
  readonly now?: () => number
}

export const recordGoldenNuggets = (
  hover: HoverController,
  service: GoldenNuggetService,
  { language, now = Date.now }: GoldenNuggetRecorderOptions,
): Unsubscribe =>
  hover.onSignal(({ signal, record, snapshot }) => {
    if (signal !== 'released' || record === null) return

    service
      .recordFocus({
        word: record.word,
        language,
        difficulty: snapshot.difficulty,
        cleared: record.cleared,
        mistakes: record.mistakes,
        at: now(),
        testId: snapshot.testId,
      })
      .catch((error: unknown) => {
        console.warn('[golden nuggets] failed to record a focus', error)
      })
  })

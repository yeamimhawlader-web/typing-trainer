/**
 * Watches a test for words that keep costing mistakes, and keeps them.
 *
 * Five wrong keystrokes on the same word make it a Golden Nugget, wherever the
 * typing happens: ordinary practice, a timed test, or Hover Mode, where the
 * repetitions count towards the same total as the text does.
 *
 * Which word a mistake belongs to is the engine's own account of it — the word
 * boundaries it worked out when the text loaded, and the position the keystroke
 * acted on — so nothing is recomputed or guessed at here.
 *
 * Nothing is written while typing except the one moment a word crosses the
 * line: the tally is in memory, one increment per mistake, and goes when the
 * test does. A test where no word crosses writes nothing at all.
 */

import type { TypingEngine, Unsubscribe } from '@core/engine'
import { createMistakeTally, type GoldenNuggetService } from '@core/nuggets'
import type { LanguageCode } from '@core/sessions'

export interface WordMistakeOptions {
  readonly language: LanguageCode
  /** The test the mistakes happened in, so a test is counted once. */
  readonly testId: () => string
  readonly now?: () => number
  /** How many mistakes make a nugget. The rule's own number by default. */
  readonly threshold?: number
}

/**
 * Follows `engine`, keeping a word the moment it has cost enough mistakes.
 * Returns the matching stop.
 */
export const keepTroublesomeWords = (
  engine: TypingEngine,
  service: GoldenNuggetService,
  { language, testId, now = Date.now, threshold }: WordMistakeOptions,
): Unsubscribe => {
  const tally = createMistakeTally(threshold)

  return engine.on((event) => {
    if (event.type === 'reset') {
      tally.reset()
      return
    }
    if (event.type !== 'keystroke') return

    const { keystroke } = event
    // Backspaces are not mistakes, and a key that was right costs nothing.
    if (keystroke.kind !== 'character' || keystroke.correct) return

    const { words } = engine.getSnapshot()
    const word = words.find((range) => keystroke.index >= range.start && keystroke.index < range.end)
    if (word === undefined) return

    const crossed = tally.note(word.text)
    if (crossed === null) return

    // One write, for the one moment the word crossed the line.
    void service
      .recordFocus({
        reason: 'mistakes',
        word: crossed,
        language,
        cleared: false,
        mistakes: tally.countOf(crossed),
        at: now(),
        testId: testId(),
      })
      .catch((error: unknown) => {
        console.warn('[golden nuggets] failed to keep a word', error)
      })
  })
}

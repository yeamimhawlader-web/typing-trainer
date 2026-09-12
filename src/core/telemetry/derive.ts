/**
 * Deriving telemetry from an engine keystroke log.
 *
 * Runs once, after a session ends, over data the engine had already collected.
 * Nothing here is computed while typing.
 *
 * Three passes, each doing one thing: enrich the events, then walk the errors,
 * then summarise per word. Deliberately not one clever pass — this runs on a
 * few hundred events after the typing is over, and being readable is worth more
 * than being fast.
 */

import {
  computeWordRanges,
  cursorAfterCharacter,
  toCharacters,
  type WordRange,
} from '@core/engine'
import { milliseconds, type Keystroke, type Milliseconds } from '@core/types'

import type {
  CorrectionTelemetry,
  KeystrokeTelemetry,
  SessionTelemetry,
  TelemetrySummary,
  WordTelemetry,
} from './types.ts'

/** Word containing each code-point index, or -1 for whitespace. */
const buildWordLookup = (
  characters: readonly string[],
  words: readonly WordRange[],
): { readonly wordOf: Int32Array; readonly offsetOf: Int32Array } => {
  const wordOf = new Int32Array(characters.length).fill(-1)
  const offsetOf = new Int32Array(characters.length).fill(-1)

  for (const word of words) {
    for (let index = word.start; index < word.end; index += 1) {
      wordOf[index] = word.index
      offsetOf[index] = index - word.start
    }
  }

  return { wordOf, offsetOf }
}

/**
 * Errors and their fate.
 *
 * An error is closed by the next *correct* character landing on the same
 * position. Backspaces counted against it are the ones on that position between
 * the two, which is the direct measure of "how much deleting this mistake
 * cost" rather than an inference about intent.
 */
const deriveCorrections = (
  keystrokes: readonly Keystroke[],
  wordOf: Int32Array,
  characters: readonly string[],
  words: readonly WordRange[],
): readonly CorrectionTelemetry[] => {
  interface OpenError {
    readonly index: number
    readonly typedKey: string
    readonly expectedKey: string
    readonly errorAt: Milliseconds
    backspaces: number
    firstBackspaceAt: Milliseconds | null
  }

  const open: OpenError[] = []
  const closed: CorrectionTelemetry[] = []

  const finish = (error: OpenError, correctedAt: Milliseconds | null): void => {
    closed.push({
      index: error.index,
      wordIndex: wordOf[error.index] ?? -1,
      typedKey: error.typedKey,
      expectedKey: error.expectedKey,
      errorAt: error.errorAt,
      backspaces: error.backspaces,
      firstBackspaceAt: error.firstBackspaceAt,
      correctedAt,
      detectionLatencyMs:
        error.firstBackspaceAt === null ? null : error.firstBackspaceAt - error.errorAt,
      correctionLatencyMs: correctedAt === null ? null : correctedAt - error.errorAt,
      outcome: correctedAt === null ? 'uncorrected' : 'corrected',
    })
  }

  /**
   * Where the cursor stood before the event being read.
   *
   * Needed because a deletion can clear more than one position: Ctrl+Backspace
   * is recorded as a single event at the index it landed on, so the span it
   * cleared is everything from there up to wherever the cursor had been. A
   * plain backspace is simply the case where that span is one character wide,
   * which is why this generalises the old equality test rather than replacing
   * it with something different.
   *
   * A character does not always move the cursor on by one. An extra character
   * at a word boundary leaves it where it was, and a space part-way through a
   * word moves it to the next word, so the movement comes from the same rule the
   * engine applied live rather than being assumed here.
   *
   * Sessions recorded before that rule existed always moved on by one, so for
   * them a backspace straight after a letter typed on a space may be credited
   * one position differently. Only the per-error backspace count and detection
   * latency can be affected; no metric, ranking or drill figure reads them.
   */
  let cursor = 0

  for (const keystroke of keystrokes) {
    if (keystroke.kind === 'backspace') {
      for (const error of open) {
        // Every position the deletion actually cleared, not just its last. A
        // backspace that removes an extra leaves the cursor where it was, so
        // its span is at least the position it acted on.
        const spanEnd = Math.max(cursor, keystroke.index + 1)
        if (error.index < keystroke.index || error.index >= spanEnd) continue
        error.backspaces += 1
        error.firstBackspaceAt ??= keystroke.at
      }
      cursor = keystroke.index
      continue
    }

    cursor = cursorAfterCharacter(characters, words, keystroke.index, keystroke.key)

    if (keystroke.correct) {
      // Close every outstanding error on this position.
      for (let i = open.length - 1; i >= 0; i -= 1) {
        const error = open[i] as OpenError
        if (error.index !== keystroke.index) continue
        finish(error, keystroke.at)
        open.splice(i, 1)
      }
      continue
    }

    open.push({
      index: keystroke.index,
      typedKey: keystroke.key,
      expectedKey: keystroke.expected ?? '',
      errorAt: keystroke.at,
      backspaces: 0,
      firstBackspaceAt: null,
    })
  }

  // Whatever is still open was never put right.
  for (const error of open) finish(error, null)

  return closed.sort((a, b) => a.errorAt - b.errorAt)
}

const deriveWords = (
  keystrokes: readonly KeystrokeTelemetry[],
  words: readonly WordRange[],
): readonly WordTelemetry[] =>
  words.map((word) => {
    const inWord = keystrokes.filter(
      (keystroke) => keystroke.index >= word.start && keystroke.index < word.end,
    )
    const characters = inWord.filter((keystroke) => keystroke.kind === 'character')

    const first = inWord[0]
    const last = inWord[inWord.length - 1]

    // Positions in the full log, so the events on either side can be found.
    const firstAt = first === undefined ? -1 : keystrokes.indexOf(first)
    const lastAt = last === undefined ? -1 : keystrokes.indexOf(last)
    const before = firstAt > 0 ? keystrokes[firstAt - 1] : undefined
    const after = lastAt >= 0 ? keystrokes[lastAt + 1] : undefined

    const errors = characters.filter((keystroke) => !keystroke.correct)

    return {
      wordIndex: word.index,
      text: word.text,
      start: word.start,
      end: word.end,
      firstKeystrokeAt: first?.at ?? null,
      lastKeystrokeAt: last?.at ?? null,
      typingDurationMs:
        first === undefined || last === undefined || first === last
          ? null
          : last.at - first.at,
      characterKeystrokes: characters.length,
      backspaces: inWord.length - characters.length,
      errors: errors.length,
      correctedErrors: errors.filter((keystroke) => keystroke.correctedLater).length,
      pauseBeforeMs:
        first === undefined || before === undefined ? null : first.at - before.at,
      pauseAfterMs:
        last === undefined || after === undefined ? null : after.at - last.at,
    }
  })

const summarise = (
  keystrokes: readonly KeystrokeTelemetry[],
  corrections: readonly CorrectionTelemetry[],
): TelemetrySummary => {
  const characters = keystrokes.filter((keystroke) => keystroke.kind === 'character')
  const corrected = corrections.filter((entry) => entry.outcome === 'corrected')

  return {
    keystrokeCount: keystrokes.length,
    characterKeystrokes: characters.length,
    backspaceCount: keystrokes.length - characters.length,
    errorCount: corrections.length,
    correctedErrorCount: corrected.length,
    uncorrectedErrorCount: corrections.length - corrected.length,
    lastEventAt: keystrokes[keystrokes.length - 1]?.at ?? null,
  }
}

/**
 * Enriches an engine keystroke log into full telemetry.
 *
 * `text` is the target the session was typed against; positions are indices
 * into its code points.
 */
export const deriveSessionTelemetry = (
  keystrokes: readonly Keystroke[],
  text: string,
): SessionTelemetry => {
  const characters = toCharacters(text)
  const words = computeWordRanges(characters)
  const { wordOf, offsetOf } = buildWordLookup(characters, words)

  const corrections = deriveCorrections(keystrokes, wordOf, characters, words)

  // Positions a later correct keystroke landed on, so each error knows whether
  // it was eventually put right.
  const correctedIndices = new Set(
    corrections
      .filter((entry) => entry.outcome === 'corrected')
      .map((entry) => entry.index),
  )

  let previousCharacterAt: number | null = null

  const enriched: KeystrokeTelemetry[] = keystrokes.map((keystroke, position) => {
    const previous = position > 0 ? keystrokes[position - 1] : undefined
    const sincePreviousCharacter =
      keystroke.kind === 'character' && previousCharacterAt !== null
        ? keystroke.at - previousCharacterAt
        : null

    if (keystroke.kind === 'character') previousCharacterAt = keystroke.at

    return {
      kind: keystroke.kind,
      key: keystroke.key,
      expected: keystroke.expected,
      correct: keystroke.correct,
      at: keystroke.at,
      index: keystroke.index,
      wordIndex: wordOf[keystroke.index] ?? -1,
      indexInWord: offsetOf[keystroke.index] ?? -1,
      interKeystrokeMs: previous === undefined ? null : keystroke.at - previous.at,
      sincePreviousCharacterMs: sincePreviousCharacter,
      correctedLater:
        keystroke.kind === 'character' &&
        !keystroke.correct &&
        correctedIndices.has(keystroke.index),
    }
  })

  return {
    keystrokes: enriched,
    words: deriveWords(enriched, words),
    corrections,
    summary: summarise(enriched, corrections),
  }
}

/** Rebuilds the engine's own record from a position and the target text. */
export const rehydrateKeystroke = (
  characters: readonly string[],
  deltaSum: number,
  index: number,
  key: string,
): Keystroke => {
  if (key === '') {
    return {
      kind: 'backspace',
      key: 'Backspace',
      expected: null,
      index,
      correct: false,
      at: milliseconds(deltaSum),
    }
  }

  const expected = characters[index] ?? null

  return {
    kind: 'character',
    key,
    expected,
    index,
    correct: expected !== null && key === expected,
    at: milliseconds(deltaSum),
  }
}

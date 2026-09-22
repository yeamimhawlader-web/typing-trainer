/**
 * The shape of one test: how fast the hands were running, second by second,
 * and where they slipped.
 *
 * A finished test says one speed and one accuracy. Neither says where the test
 * was actually won or lost — the burst at the start that faded, the stall on
 * one long word, the three mistakes bunched in the last five seconds. This
 * reads that out of the keystrokes already captured, for the result panel to
 * draw.
 *
 * Speed here is the speed of the moment, not the running average: the
 * characters typed correctly inside a window ending at that second, over that
 * window. A running average flattens exactly the dips worth seeing. Before the
 * window is full, the window is however much test there has been, so the first
 * seconds read as what they were rather than as a fraction of themselves.
 *
 * Mistakes are counted where they happened — the second the wrong key went
 * down — and a corrected one still counts, because it cost the time either way.
 */

import type { KeystrokeTelemetry, SessionTelemetry } from './types.ts'

export const SHAPE_RULES = {
  /** The window speed is measured over, ending at each second. */
  windowMs: 5000,
  /** Characters to a word, the standard the rest of the application counts in. */
  charactersPerWord: 5,
  /** Below this many seconds there is no curve worth drawing. */
  minimumSeconds: 3,
} as const

export interface TestShapePoint {
  /** Whole seconds since the first keystroke. */
  readonly second: number
  /** Speed over the window ending at this second, in words a minute. */
  readonly wpm: number
  /** Characters mistyped during this second, corrected or not. */
  readonly errors: number
}

export interface TestShape {
  readonly points: readonly TestShapePoint[]
  /** The fastest second of the test, in words a minute. */
  readonly peakWpm: number
  /** Where the mistakes were, as seconds; a second with two mistakes appears twice. */
  readonly errorSeconds: readonly number[]
}

const EMPTY: TestShape = { points: [], peakWpm: 0, errorSeconds: [] }

const isCharacter = (keystroke: KeystrokeTelemetry): boolean => keystroke.kind === 'character'

/**
 * The test's shape, or nothing at all for a test too short to have one.
 *
 * Only whole seconds are drawn: a final part-second would be measured over a
 * shorter window than the rest and read as a collapse that never happened.
 */
export const shapeOfTest = (telemetry: SessionTelemetry): TestShape => {
  const characters = telemetry.keystrokes.filter(isCharacter)
  const first = characters[0]
  const last = characters.at(-1)
  if (first === undefined || last === undefined) return EMPTY

  const startedAt = first.at
  const seconds = Math.floor((last.at - startedAt) / 1000)
  if (seconds < SHAPE_RULES.minimumSeconds) return EMPTY

  const errorSeconds: number[] = []
  for (const keystroke of characters) {
    if (!keystroke.correct) errorSeconds.push(Math.floor((keystroke.at - startedAt) / 1000))
  }

  const points: TestShapePoint[] = []
  let peakWpm = 0
  for (let second = 1; second <= seconds; second += 1) {
    const endsAt = startedAt + second * 1000
    // The window is the last five seconds, or the whole test while it is younger.
    const windowMs = Math.min(SHAPE_RULES.windowMs, second * 1000)
    const startsAt = endsAt - windowMs
    const correct = characters.filter(
      (keystroke) => keystroke.correct && keystroke.at > startsAt && keystroke.at <= endsAt,
    ).length
    const wpm = Math.round((correct / SHAPE_RULES.charactersPerWord / windowMs) * 60_000)
    peakWpm = Math.max(peakWpm, wpm)
    points.push({ second, wpm, errors: errorSeconds.filter((at) => at === second - 1).length })
  }

  return { points, peakWpm, errorSeconds }
}

/**
 * Cutting a recording of many key presses into one press each.
 *
 * A keyboard recording is several seconds of the same key pressed again and
 * again, with quiet between. Played whole, one keystroke would rattle off a
 * dozen. So the quiet is found, the recording is cut at each new press, and a
 * keystroke plays one of them — a different one each time, which is what a real
 * keyboard does.
 *
 * Read from the loudness of 5ms windows: a press is a window loud against the
 * recording's own peak, after enough quiet that it cannot be the tail of the
 * press before it.
 */

/** Each window's loudness is measured over this long. */
const WINDOW_MS = 5
/** Louder than this share of the peak starts a press. */
const ONSET = 0.12
/** Quieter than this share of the peak counts as quiet. */
const QUIET = 0.06
/** How much quiet has to come before a new press. */
const QUIET_BEFORE_MS = 50
/** No press runs longer than this, however long the quiet after it. */
const LONGEST_PRESS_MS = 450

/** Start and end samples of each press, in order. One range covering everything when there is one press or none. */
export const pressesIn = (samples: Float32Array, sampleRate: number): ReadonlyArray<readonly [number, number]> => {
  const window = Math.max(1, Math.round((sampleRate * WINDOW_MS) / 1000))
  const loudness: number[] = []
  for (let start = 0; start < samples.length; start += window) {
    let loudest = 0
    const end = Math.min(start + window, samples.length)
    for (let at = start; at < end; at += 1) loudest = Math.max(loudest, Math.abs(samples[at] ?? 0))
    loudness.push(loudest)
  }

  const peak = Math.max(0, ...loudness)
  const whole = [[0, samples.length] as const]
  if (peak === 0) return whole

  const quietWindows = Math.round(QUIET_BEFORE_MS / WINDOW_MS)
  const starts: number[] = []
  let quietFor = quietWindows
  loudness.forEach((level, index) => {
    if (level >= peak * ONSET && quietFor >= quietWindows) starts.push(index)
    quietFor = level < peak * QUIET ? quietFor + 1 : 0
  })
  if (starts.length < 2) return whole

  const longest = Math.round((sampleRate * LONGEST_PRESS_MS) / 1000)
  return starts.map((index, n) => {
    // A window early, so the very start of the press is not clipped.
    const from = Math.max(0, (index - 1) * window)
    const next = starts[n + 1]
    const to = Math.min(next === undefined ? samples.length : (next - 1) * window, from + longest)
    return [from, to] as const
  })
}

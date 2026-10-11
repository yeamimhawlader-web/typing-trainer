/**
 * Runs `work` once the browser has drawn the next frame.
 *
 * For work that should not stand between an input and the frame that shows
 * it. A `requestAnimationFrame` callback runs just *before* a frame is drawn,
 * so the work is queued from inside it as a task of its own, which the browser
 * reaches only after drawing.
 *
 * A page in the background draws no frames, so a timer runs the work anyway
 * after `fallbackMs`: nothing waits on the tab being looked at. Whichever comes
 * first runs it, once.
 *
 * Returns a cancel, for work that belongs to something that may be gone by
 * then.
 */
export const afterNextPaint = (work: () => void, fallbackMs = 250): (() => void) => {
  let settled = false
  const run = (): void => {
    if (settled) return
    settled = true
    work()
  }

  const frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => setTimeout(run, 0)) : null
  const fallback = setTimeout(run, fallbackMs)

  return () => {
    settled = true
    if (frame !== null) cancelAnimationFrame(frame)
    clearTimeout(fallback)
  }
}

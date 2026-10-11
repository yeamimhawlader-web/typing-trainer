import { afterEach, describe, expect, it, vi } from 'vitest'

import { afterNextPaint } from './after-next-paint.ts'

describe('afterNextPaint', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('waits for the frame to be drawn, then runs the work as a task of its own', () => {
    vi.useFakeTimers()
    const frames: FrameRequestCallback[] = []
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => frames.push(callback))
    const work = vi.fn()

    afterNextPaint(work)
    expect(work).not.toHaveBeenCalled()

    // The frame's callback runs before drawing; the work must not run inside it.
    for (const callback of frames.splice(0)) callback(0)
    expect(work).not.toHaveBeenCalled()

    vi.advanceTimersByTime(0)
    expect(work).toHaveBeenCalledTimes(1)
  })

  it('runs the work anyway, once, where no frame comes — a page in the background', () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1)
    const work = vi.fn()

    afterNextPaint(work, 250)
    vi.advanceTimersByTime(249)
    expect(work).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    vi.advanceTimersByTime(1_000)
    expect(work).toHaveBeenCalledTimes(1)
  })

  it('runs nothing once cancelled', () => {
    vi.useFakeTimers()
    const frames: FrameRequestCallback[] = []
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => frames.push(callback))
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => undefined)
    const work = vi.fn()

    const cancel = afterNextPaint(work)
    cancel()
    for (const callback of frames.splice(0)) callback(0)
    vi.advanceTimersByTime(1_000)

    expect(work).not.toHaveBeenCalled()
  })
})

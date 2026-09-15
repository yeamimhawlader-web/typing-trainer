/**
 * Hover Mode's rules, event by event. Pure, so every case is a list of events
 * and the state they leave behind.
 */

import { describe, expect, it } from 'vitest'

import { HOVER_RULES, NORMAL, remainingOf, stepHover, type HoverEvent, type HoverState, type HoverStep } from './hover-rules.ts'

const mistake = (wordIndex = 2, word = 'brown', at = 1_000): HoverEvent => ({ type: 'mistake', wordIndex, word, at })
const leftWord: HoverEvent = { type: 'left-word', at: 1_200 }
const slip: HoverEvent = { type: 'attempt-mistake', at: 1_300 }
const done = (at = 1_500): HoverEvent => ({ type: 'attempt-completed', at })
const end: HoverEvent = { type: 'end', at: 9_000 }

/** Runs events from `normal`, returning every step. */
const run = (...events: readonly HoverEvent[]): HoverStep[] => {
  let state: HoverState = NORMAL
  return events.map((event) => {
    const step = stepHover(state, event)
    state = step.state
    return step
  })
}

const last = (steps: readonly HoverStep[]): HoverStep => steps[steps.length - 1] as HoverStep

const focusOf = (step: HoverStep) => {
  if (step.state.phase === 'normal') throw new Error('nothing is focused')
  return step.state.focus
}

/** A clean repetition. */
const clean = [done()] as const
/** A repetition with a mistake in it. */
const failed = [slip, done()] as const

describe('Hover Mode rules', () => {
  it('leaves ordinary typing alone until there is a mistake', () => {
    for (const event of [leftWord, slip, done(), end]) {
      expect(stepHover(NORMAL, event)).toEqual({ state: NORMAL, signal: null, record: null })
    }
  })

  it('focuses a word on its first mistake, asking for three clean repetitions', () => {
    const step = last(run(mistake(2, 'brown', 1_000)))

    expect(step.signal).toBe('activated')
    expect(step.state.phase).toBe('pending')
    expect(focusOf(step)).toEqual({
      wordIndex: 2,
      word: 'brown',
      activatedAt: 1_000,
      required: 3,
      successes: 0,
      failures: 0,
      attempts: 0,
    })
  })

  it('lets the typist finish the word in the text before repeating it', () => {
    const steps = run(mistake(), slip, done())

    // Repetition events mean nothing until the word has been left.
    expect(steps.map((step) => step.state.phase)).toEqual(['pending', 'pending', 'pending'])

    const repeating = last(run(mistake(), leftWord))
    expect(repeating.signal).toBe('repeating')
    expect(repeating.state).toMatchObject({ phase: 'repeating', attemptFailed: false })
  })

  it('releases the word after three clean repetitions, and not before', () => {
    const steps = run(mistake(), leftWord, ...clean, ...clean, ...clean)

    expect(steps.slice(2).map((step) => step.signal)).toEqual(['success', 'success', 'released'])
    expect(steps.slice(2, 4).map((step) => remainingOf(focusOf(step)))).toEqual([2, 1])
    expect(last(steps).state).toBe(NORMAL)
    expect(last(steps).record).toEqual({
      word: 'brown',
      wordIndex: 2,
      required: 3,
      successes: 3,
      failures: 0,
      completed: true,
      limitReached: false,
      focusMs: 500,
    })
  })

  it('adds three to the requirement for a failed repetition, keeping the successes', () => {
    const steps = run(mistake(), leftWord, ...clean, ...clean, slip)
    const focus = focusOf(last(steps))

    expect(last(steps).signal).toBe('failure')
    expect(focus).toMatchObject({ required: 6, successes: 2, failures: 1 })
    // The example from the brief: 3 required, two clean, a miss, four to go.
    expect(remainingOf(focus)).toBe(4)
  })

  it('counts a repetition with several mistakes as one failure', () => {
    const steps = run(mistake(), leftWord, slip, slip, slip)

    expect(steps.slice(2).map((step) => step.signal)).toEqual(['failure', null, null])
    expect(focusOf(last(steps))).toMatchObject({ required: 6, failures: 1 })
  })

  it('does not count the failed repetition as a success when it is finished', () => {
    const steps = run(mistake(), leftWord, ...failed)

    expect(last(steps).signal).toBeNull()
    expect(focusOf(last(steps))).toMatchObject({ required: 6, successes: 0, failures: 1, attempts: 1 })
    expect(last(steps).state).toMatchObject({ attemptFailed: false })
  })

  it('accumulates failures across repetitions and releases once the total is met', () => {
    const steps = run(
      mistake(),
      leftWord,
      ...clean, // 1 of 3
      ...failed, // 1 of 6
      ...clean, // 2 of 6
      ...failed, // 2 of 9
      ...clean,
      ...clean,
      ...clean,
      ...clean,
      ...clean,
      ...clean, // 8 of 9
    )
    expect(focusOf(last(steps))).toMatchObject({ required: 9, successes: 8, failures: 2 })
    expect(remainingOf(focusOf(last(steps)))).toBe(1)

    const final = stepHover(last(steps).state, done())

    expect(final.signal).toBe('released')
    expect(final.record).toMatchObject({ required: 9, successes: 9, failures: 2, completed: true })
  })

  it('never asks for more than twelve clean repetitions', () => {
    const steps = run(mistake(), leftWord, ...failed, ...failed, ...failed, ...failed, ...failed)

    expect(focusOf(last(steps))).toMatchObject({ required: HOVER_RULES.maxRequired, failures: 5 })
    expect(HOVER_RULES.maxRequired).toBe(12)
  })

  it('releases a focus that reaches the attempt limit, as not completed', () => {
    const misses = Array.from({ length: HOVER_RULES.maxAttempts }, () => failed).flat()
    const steps = run(mistake(), leftWord, ...misses)

    expect(last(steps).signal).toBe('released')
    expect(last(steps).state).toBe(NORMAL)
    expect(last(steps).record).toMatchObject({
      completed: false,
      limitReached: true,
      successes: 0,
      failures: 20,
      required: 12,
    })
    // Nothing is left that could hold the typist.
    expect(steps.filter((step) => step.state.phase === 'normal')).toHaveLength(1)
  })

  it('counts clean repetitions towards the limit too', () => {
    // Eleven misses first would make the requirement 12; nine clean then brings
    // the attempts to 20 with 9 of 12 done.
    const events = [
      ...Array.from({ length: 11 }, () => failed).flat(),
      ...Array.from({ length: 9 }, () => clean).flat(),
    ]
    const steps = run(mistake(), leftWord, ...events)

    expect(last(steps).record).toMatchObject({ successes: 9, required: 12, completed: false, limitReached: true })
  })

  it('never starts a second focus while one exists', () => {
    const pending = run(mistake(2, 'brown'), mistake(3, 'fox'))
    expect(last(pending).signal).toBeNull()
    expect(focusOf(last(pending)).word).toBe('brown')

    const repeating = run(mistake(2, 'brown'), leftWord, mistake(3, 'fox'))
    expect(last(repeating).signal).toBeNull()
    expect(focusOf(last(repeating)).word).toBe('brown')
  })

  it('focuses the next mistaken word once the previous focus is released', () => {
    const steps = run(mistake(2, 'brown'), leftWord, ...clean, ...clean, ...clean, mistake(3, 'fox', 4_000))

    expect(last(steps).signal).toBe('activated')
    expect(focusOf(last(steps))).toMatchObject({ word: 'fox', required: 3, successes: 0, activatedAt: 4_000 })
  })

  it('ends a focus that is pending or repeating, recording it as unfinished', () => {
    const fromPending = last(run(mistake(), end))
    expect(fromPending).toMatchObject({ state: NORMAL, signal: 'ended' })
    expect(fromPending.record).toMatchObject({ completed: false, limitReached: false, successes: 0 })

    const fromRepeating = last(run(mistake(), leftWord, ...clean, end))
    expect(fromRepeating.record).toMatchObject({ completed: false, successes: 1, focusMs: 8_000 })
  })

  it('is deterministic: the same events give the same states', () => {
    const events = [mistake(), leftWord, ...clean, ...failed, ...clean, slip, done(), end]

    expect(run(...events)).toEqual(run(...events))
  })
})

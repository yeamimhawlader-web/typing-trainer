/**
 * Hover Mode's rules, event by event, for each difficulty. Pure, so every case is
 * a list of events and the state they leave behind.
 */

import { describe, expect, it } from 'vitest'

import type { HoverDifficulty } from '@core/types'

import {
  cyclesOf,
  HOVER_RULES,
  NORMAL,
  progressOf,
  remainingOf,
  stepHover,
  type HoverEvent,
  type HoverState,
  type HoverStep,
} from './hover-rules.ts'

const mistake = (difficulty: HoverDifficulty = 'standard', wordIndex = 2, word = 'brown', at = 1_000): HoverEvent => ({
  type: 'mistake',
  wordIndex,
  word,
  difficulty,
  at,
})
const leftWord: HoverEvent = { type: 'left-word', at: 1_200 }
const slip: HoverEvent = { type: 'attempt-mistake', at: 1_300 }
const done = (at = 1_500): HoverEvent => ({ type: 'attempt-completed', at })
const end: HoverEvent = { type: 'end', at: 9_000 }

/** A clean repetition. */
const clean = [done()] as const
/** A repetition with a mistake in it. */
const missed = [slip, done()] as const
const times = (count: number, events: readonly HoverEvent[]) => Array.from({ length: count }, () => events).flat()

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

/** Starts a focus at a difficulty and begins its repetitions. */
const start = (difficulty: HoverDifficulty) => [mistake(difficulty), leftWord] as const

describe('Hover Mode rules', () => {
  describe('for every difficulty', () => {
    it.each(['standard', 'all-in', 'tired'] as const)('leaves %s typing alone until there is a mistake', () => {
      for (const event of [leftWord, slip, done(), end]) {
        expect(stepHover(NORMAL, event)).toEqual({ state: NORMAL, signal: null, record: null, final: null })
      }
    })

    it.each(['standard', 'all-in', 'tired'] as const)('lets the %s typist finish the word in the text first', (difficulty) => {
      const steps = run(mistake(difficulty), slip, done())
      expect(steps.map((step) => step.state.phase)).toEqual(['pending', 'pending', 'pending'])

      const repeating = last(run(mistake(difficulty), leftWord))
      expect(repeating).toMatchObject({ signal: 'repeating', state: { phase: 'repeating', attemptFailed: false } })
    })

    it('counts every mistake on the word, in the text and in its repetitions', () => {
      const steps = run(
        mistake('tired'),
        mistake('tired', 2), // another on the same word, still in the text
        mistake('tired', 3, 'fox'), // another word: not this focus's
        leftWord,
        slip,
        slip, // a second mistake in the same repetition
        done(),
      )

      expect(focusOf(last(steps))).toMatchObject({ mistakes: 4, failures: 1 })
    })

    it('never starts a second focus while one exists', () => {
      for (const difficulty of ['standard', 'all-in', 'tired'] as const) {
        const steps = run(mistake(difficulty, 2, 'brown'), leftWord, mistake(difficulty, 3, 'fox'))
        expect(last(steps).signal).toBeNull()
        expect(focusOf(last(steps)).word).toBe('brown')
      }
    })

    it('ends a focus cut short as unfinished, and never as a Golden Nugget', () => {
      for (const difficulty of ['standard', 'all-in', 'tired'] as const) {
        const step = last(run(...start(difficulty), ...missed, end))
        expect(step).toMatchObject({ state: NORMAL, signal: 'ended' })
        expect(step.record).toMatchObject({ cleared: false, goldenNugget: false, attempts: 1, failures: 1 })
      }
    })

    it('is deterministic', () => {
      const events = [...start('tired'), ...clean, ...missed, ...clean, slip, done(), end]
      expect(run(...events)).toEqual(run(...events))
    })
  })

  describe('Standard', () => {
    it('asks for one cycle of three repetitions', () => {
      const focus = focusOf(last(run(mistake('standard'))))

      expect(focus).toMatchObject({ difficulty: 'standard', required: 3 })
      expect(progressOf(focus)).toEqual({ nodes: ['open', 'open', 'open'], groupSize: null })
    })

    it('releases the word after three clean repetitions, cleared', () => {
      const steps = run(...start('standard'), ...clean, ...clean, ...clean)

      expect(steps.slice(2).map((step) => step.signal)).toEqual(['success', 'success', 'released'])
      expect(last(steps).state).toBe(NORMAL)
      expect(last(steps).record).toEqual({
        word: 'brown',
        wordIndex: 2,
        required: 3,
        cycles: 1,
        attempts: 3,
        successes: 3,
        failures: 0,
        mistakes: 1,
        cleared: true,
        limitReached: false,
        goldenNugget: false,
        focusMs: 500,
      })
    })

    it('releases the word after three repetitions even with mistakes in them, and starts no second cycle', () => {
      const steps = run(...start('standard'), ...clean, ...missed, ...clean)

      expect(steps.slice(2).map((step) => step.signal)).toEqual(['success', 'failure', 'missed', 'released'])
      expect(last(steps).record).toMatchObject({
        required: 3,
        cycles: 1,
        attempts: 3,
        successes: 2,
        failures: 1,
        cleared: false,
        goldenNugget: true,
      })
    })

    it('marks each repetition in its progress, clean or missed', () => {
      const steps = run(...start('standard'), ...clean, ...missed)
      const focus = focusOf(last(steps))

      expect(progressOf(focus).nodes).toEqual(['clean', 'missed', 'open'])
      expect(remainingOf(focus)).toBe(1)
    })

    it('does not add to the requirement for a mistake', () => {
      const steps = run(...start('standard'), slip)
      expect(focusOf(last(steps))).toMatchObject({ required: 3, failures: 1 })
    })
  })

  describe('All In', () => {
    it('asks for two cycles of three, shown as two groups', () => {
      const focus = focusOf(last(run(mistake('all-in'))))

      expect(focus.required).toBe(6)
      expect(progressOf(focus)).toEqual({ nodes: ['open', 'open', 'open', 'open', 'open', 'open'], groupSize: 3 })
    })

    it('always goes on to the second cycle, even after a clean first one', () => {
      const steps = run(...start('all-in'), ...times(3, clean))

      expect(last(steps).signal).toBe('cycle')
      expect(last(steps).state.phase).toBe('repeating')
      expect(cyclesOf(focusOf(last(steps)))).toBe(2)
    })

    it('releases after the second cycle, six clean repetitions, cleared', () => {
      const steps = run(...start('all-in'), ...times(6, clean))

      expect(steps.slice(2).map((step) => step.signal)).toEqual([
        'success',
        'success',
        'cycle',
        'success',
        'success',
        'released',
      ])
      expect(last(steps).record).toMatchObject({ required: 6, cycles: 2, attempts: 6, successes: 6, cleared: true, goldenNugget: false })
    })

    it('never runs a third cycle, however the second went', () => {
      const steps = run(...start('all-in'), ...times(6, missed))

      expect(last(steps).signal).toBe('released')
      expect(last(steps).state).toBe(NORMAL)
      expect(last(steps).record).toMatchObject({ cycles: 2, attempts: 6, successes: 0, failures: 6, cleared: false, goldenNugget: true })
    })

    it('clears a word whose second cycle was clean, whatever happened in the first', () => {
      const steps = run(...start('all-in'), ...missed, ...clean, ...clean, ...times(3, clean))

      expect(last(steps).record).toMatchObject({ successes: 5, failures: 1, cleared: true, goldenNugget: false })
    })

    it('does not clear a word with a mistake in its second cycle', () => {
      const steps = run(...start('all-in'), ...times(3, clean), ...clean, ...clean, ...missed)

      expect(last(steps).record).toMatchObject({ successes: 5, failures: 1, cleared: false, goldenNugget: true })
    })
  })

  describe('Tired', () => {
    it('starts at three clean repetitions', () => {
      const focus = focusOf(last(run(mistake('tired'))))

      expect(focus.required).toBe(3)
      expect(progressOf(focus)).toEqual({ nodes: ['open', 'open', 'open'], groupSize: null })
    })

    it('adds three for a repetition with a mistake, and three again for the next, keeping the clean ones', () => {
      const once = run(...start('tired'), ...clean, ...clean, slip)
      expect(last(once).signal).toBe('failure')
      expect(focusOf(last(once))).toMatchObject({ required: 6, failures: 1 })
      // Three required, two clean, a miss: four to go.
      expect(remainingOf(focusOf(last(once)))).toBe(4)

      const twice = run(...start('tired'), ...missed, ...missed)
      expect(focusOf(last(twice))).toMatchObject({ required: 9, failures: 2 })
    })

    it('adds only once for a repetition with several mistakes', () => {
      const steps = run(...start('tired'), slip, slip, slip)

      expect(steps.slice(2).map((step) => step.signal)).toEqual(['failure', null, null])
      expect(focusOf(last(steps))).toMatchObject({ required: 6, failures: 1 })
    })

    it('clears a word that meets its requirement below the ceiling', () => {
      const steps = run(...start('tired'), ...missed, ...missed, ...times(9, clean))

      expect(last(steps).record).toMatchObject({
        required: 9,
        cycles: 3,
        successes: 9,
        failures: 2,
        cleared: true,
        limitReached: false,
        goldenNugget: false,
      })
    })

    it('stops the requirement at ten: 9, then one more, never 12', () => {
      const steps = run(...start('tired'), ...missed, ...missed, ...missed, ...missed, ...missed)

      expect(focusOf(last(steps))).toMatchObject({ required: HOVER_RULES.tired.maxRequired, failures: 5, atCeiling: true })
      expect(HOVER_RULES.tired.maxRequired).toBe(10)
      expect(Math.max(...steps.filter((step) => step.state.phase !== 'normal').map((step) => focusOf(step).required))).toBe(10)
    })

    it('releases a word that reached the ceiling once its ten clean repetitions are done, without clearing it', () => {
      const steps = run(...start('tired'), ...missed, ...missed, ...missed, ...times(9, clean))
      expect(last(steps).state.phase).toBe('repeating')
      expect(remainingOf(focusOf(last(steps)))).toBe(1)

      const final = stepHover(last(steps).state, done())

      expect(final.signal).toBe('released')
      expect(final.record).toMatchObject({
        required: 10,
        cycles: 4,
        successes: 10,
        failures: 3,
        cleared: false,
        limitReached: true,
        goldenNugget: true,
      })
    })

    it('never asks for more than ten clean repetitions in total', () => {
      // Every other repetition missed, for as long as it takes.
      const steps = run(...start('tired'), ...times(15, [...missed, ...clean]))

      const released = steps.find((step) => step.signal === 'released')
      expect(released?.record?.successes).toBeLessThanOrEqual(10)
      expect(released?.record?.required).toBe(10)
    })

    it('releases a word that cannot be typed cleanly at all after twenty repetitions', () => {
      const steps = run(...start('tired'), ...times(HOVER_RULES.tired.maxAttempts, missed))

      expect(last(steps).signal).toBe('released')
      expect(last(steps).record).toMatchObject({
        attempts: 20,
        successes: 0,
        failures: 20,
        required: 10,
        cleared: false,
        limitReached: true,
        goldenNugget: true,
      })
      expect(steps.filter((step) => step.state.phase === 'normal')).toHaveLength(1)
    })

    it('fills its progress with clean repetitions only', () => {
      const steps = run(...start('tired'), ...clean, ...missed)

      expect(progressOf(focusOf(last(steps)))).toEqual({
        nodes: ['clean', 'open', 'open', 'open', 'open', 'open'],
        groupSize: null,
      })
    })
  })

  it('focuses the next mistaken word once the previous focus is released', () => {
    const steps = run(...start('standard'), ...times(3, clean), mistake('standard', 3, 'fox', 4_000))

    expect(last(steps).signal).toBe('activated')
    expect(focusOf(last(steps))).toMatchObject({ word: 'fox', required: 3, activatedAt: 4_000 })
  })
})

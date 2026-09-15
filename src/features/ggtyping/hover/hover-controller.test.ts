/**
 * Hover Mode over real typing engines, at each difficulty.
 *
 * The session engine and the repetition engine are both the application's
 * engine; keys are fed the way the session's own command feeds them. What is
 * under test is the join: which keys go where, when the text pauses and
 * resumes, what the session ends up recording, and that nothing about the text
 * pass is changed by the mode.
 */

import { describe, expect, it } from 'vitest'

import { BACKSPACE, createTypingEngine, type TypingEngine } from '@core/engine'
import { DEFAULT_SESSION_CONTEXT } from '@core/sessions'
import { timestamp, type HoverDifficulty, type Timestamp } from '@core/types'

import { createHoverController, type HoverSignalEvent } from './hover-controller.ts'
import { HOVER_RULES } from './hover-rules.ts'

const TEXT = 'the quick brown fox'

/** The session's own command, as `useTypingSession` defines it. */
const typeIntoTextOf = (engine: TypingEngine, text: string) => (key: string, at: Timestamp): boolean => {
  const { status } = engine.getSnapshot()
  if (status !== 'idle' && status !== 'running') return false
  if (status === 'idle') {
    if (key === BACKSPACE || /\s/u.test(key)) return true
    engine.start({ text, sourceId: 'test' }, at)
  }
  engine.input(key, at)
  return true
}

const setup = (difficulty: HoverDifficulty = 'standard', text = TEXT) => {
  let tests = 0
  const hover = createHoverController({ difficulty, createTestId: () => `test-${(tests += 1)}` })
  const main = createTypingEngine({ isComplete: hover.isComplete })
  hover.connect(main)

  const events: HoverSignalEvent[] = []
  hover.onSignal((event) => events.push(event))
  const signals = () => events.map((event) => event.signal)

  const typeIntoText = typeIntoTextOf(main, text)
  let clock = 1_000
  const type = (keys: string | readonly string[]) => {
    for (const key of typeof keys === 'string' ? Array.from(keys) : keys) {
      clock += 100
      hover.inputKey(key, timestamp(clock), typeIntoText)
    }
  }

  return { hover, main, events, signals, type }
}

const released = (events: readonly HoverSignalEvent[]) =>
  events.filter((event) => event.signal === 'released').map((event) => event.record)

describe('Hover Mode controller', () => {
  describe('at every difficulty', () => {
    it('leaves ordinary typing alone before the first mistake', () => {
      const { hover, main, signals, type } = setup('tired')

      type('the quick ')

      expect(hover.getSnapshot().phase).toBe('normal')
      expect(signals()).toEqual([])
      expect(main.getSnapshot().cursorIndex).toBe(10)
      expect(hover.attempt.getSnapshot().status).toBe('idle')
    })

    it('focuses the word on one mistake, while the typist is still on it', () => {
      const { hover, main, signals, type } = setup('all-in')

      type('the quick brx')

      const snapshot = hover.getSnapshot()
      expect(signals()).toEqual(['activated'])
      expect(snapshot).toMatchObject({ phase: 'pending', difficulty: 'all-in', remaining: 6 })
      expect(snapshot.focus).toMatchObject({ word: 'brown', wordIndex: 2, start: 10, end: 15, difficulty: 'all-in' })
      expect(main.getSnapshot().status).toBe('running')
    })

    it('begins the repetitions once the word is left, pausing the text at the next word', () => {
      const { hover, main, signals, type } = setup()

      type('the quick brxwn ')

      expect(signals()).toEqual(['activated', 'repeating'])
      expect(main.getSnapshot()).toMatchObject({ status: 'paused', cursorIndex: 16 })
      expect(hover.attempt.getSnapshot()).toMatchObject({ status: 'running', cursorIndex: 0 })
      expect(hover.attempt.getSnapshot().target.text).toBe('brown ')
    })

    it('types repetitions into the repetition engine, never the text', () => {
      const { hover, main, type } = setup()
      type('the quick brxwn ')
      const textKeystrokes = main.getSnapshot().keystrokes.length

      type('bro')

      expect(main.getSnapshot().keystrokes).toHaveLength(textKeystrokes)
      expect(hover.attempt.getSnapshot().characterStates.slice(0, 4)).toEqual(['correct', 'correct', 'correct', 'pending'])
    })

    it('counts a mistake put right with backspace as a repetition with a mistake, as the engine does', () => {
      const { hover, type } = setup('tired')
      type('the quick brxwn ')

      type(['b', 'x', BACKSPACE, 'r', 'o', 'w', 'n', ' '])

      expect(hover.getSnapshot().focus).toMatchObject({ failures: 1, outcomes: ['missed'], required: 6 })
    })

    it('ignores a space before a repetition has started, as the engine ignores it', () => {
      const { hover, type } = setup()
      type('the quick brxwn ')

      type(' brown ')

      expect(hover.getSnapshot().focus).toMatchObject({ outcomes: ['clean'], failures: 0 })
    })

    it('counts every mistake on the word, in the text and in the repetitions', () => {
      const { hover, type } = setup('tired')

      type('the quick bxxwn ') // two in the text
      type('bzown ') // one in a repetition
      type('brown brown brown brown brown brown ')

      expect(hover.records()).toEqual([expect.objectContaining({ word: 'brown', mistakes: 3, failures: 1 })])
    })

    it('keeps the focus on its word when the typist moves to other words before leaving it', () => {
      const { hover, type } = setup()
      type('the quick brx')

      type([BACKSPACE, BACKSPACE, BACKSPACE, BACKSPACE, 'z'])
      expect(hover.getSnapshot().focus).toMatchObject({ word: 'brown' })

      type([BACKSPACE, ' ', 'b', 'r', 'o', 'w', 'n', ' '])
      expect(hover.getSnapshot()).toMatchObject({ phase: 'repeating' })
      expect(hover.getSnapshot().focus).toMatchObject({ word: 'brown', wordIndex: 2 })
    })

    it('never has two focuses at once', () => {
      const { hover, signals, type } = setup()
      type('the quxck brxwn ')

      expect(signals().filter((signal) => signal === 'activated')).toHaveLength(1)
      expect(hover.getSnapshot().focus).toMatchObject({ word: 'quick' })
    })

    it('holds the end of the text open while its last word is focused', () => {
      const { hover, main, type } = setup()

      type('the quick brown fxx')

      expect(main.getSnapshot().status).toBe('paused')
      expect(hover.getSnapshot().focus).toMatchObject({ word: 'fox' })

      type('fox fox fox ')

      expect(main.getSnapshot().status).toBe('completed')
    })

    it('clears everything on restart', () => {
      const { hover, main, signals, type } = setup('tired')
      type('the quick brxwn bro')

      main.reset()

      expect(signals().at(-1)).toBe('ended')
      expect(hover.getSnapshot()).toMatchObject({ phase: 'normal', focus: null })
      expect(hover.attempt.getSnapshot().status).toBe('idle')
      expect(hover.records()).toEqual([])

      type('the')
      expect(main.getSnapshot()).toMatchObject({ status: 'running', cursorIndex: 3 })
    })

    it('starts each test with no records from the one before, and a test id of its own', () => {
      const { hover, main, type } = setup('standard', 'ab cd')
      type('ax ab ab ab cd')
      expect(main.getSnapshot().status).toBe('completed')
      expect(hover.records()).toHaveLength(1)
      const first = hover.getSnapshot().testId

      main.reset()
      type('ab cd')

      expect(hover.records()).toEqual([])
      expect(hover.getSnapshot().testId).not.toBe(first)
    })

    it('leaves the text pass measured exactly as an ordinary engine measures it', () => {
      const { main, type } = setup()
      type('the quick brxwn brown brown brown fox')
      const hovered = main.toResult()

      // The same text keys, at the same moments, into a plain engine paused for
      // the same interval.
      const plain = createTypingEngine()
      let clock = 1_000
      Array.from('the quick brxwn ').forEach((key, index) => {
        clock += 100
        if (index === 0) plain.start({ text: TEXT, sourceId: 'test' }, timestamp(clock))
        plain.input(key, timestamp(clock))
      })
      plain.pause(timestamp(clock))
      clock += 100 * Array.from('brown brown brown ').length
      plain.resume(timestamp(clock))
      for (const key of 'fox') {
        clock += 100
        plain.input(key, timestamp(clock))
      }
      const expected = plain.toResult()

      expect(hovered?.metrics).toEqual(expected?.metrics)
      expect(hovered?.keystrokes).toEqual(expected?.keystrokes)
      expect(hovered?.durationMs).toBe(expected?.durationMs)
      expect(hovered?.target.text).toBe(TEXT)
    })
  })

  describe('Standard', () => {
    it('releases after one cycle of three clean repetitions and carries on with the next word', () => {
      const { main, events, signals, type } = setup('standard')
      type('the quick brxwn ')

      type('brown brown brown ')

      expect(signals()).toEqual(['activated', 'repeating', 'success', 'success', 'released'])
      expect(released(events)).toEqual([
        expect.objectContaining({ word: 'brown', cycles: 1, attempts: 3, successes: 3, cleared: true, goldenNugget: false }),
      ])
      expect(main.getSnapshot()).toMatchObject({ status: 'running', cursorIndex: 16 })

      type('fox')
      expect(main.getSnapshot().status).toBe('completed')
    })

    it('releases after three repetitions with a mistake in one, and does not repeat the word again', () => {
      const { hover, main, events, type } = setup('standard')
      type('the quick brxwn ')

      type('brown bxown brown ')

      expect(hover.getSnapshot().phase).toBe('normal')
      expect(main.getSnapshot().status).toBe('running')
      expect(released(events)).toEqual([
        expect.objectContaining({ attempts: 3, successes: 2, failures: 1, cleared: false, goldenNugget: true }),
      ])
      // The next keys are the text's.
      type('fox')
      expect(main.getSnapshot().status).toBe('completed')
    })
  })

  describe('All In', () => {
    it('runs a second cycle after a clean first one, then releases after six', () => {
      const { hover, events, signals, type } = setup('all-in')
      type('the quick brxwn ')

      type('brown brown brown ')
      expect(signals().at(-1)).toBe('cycle')
      expect(hover.getSnapshot()).toMatchObject({ phase: 'repeating', remaining: 3 })
      expect(hover.getSnapshot().progress).toEqual({
        nodes: ['clean', 'clean', 'clean', 'open', 'open', 'open'],
        groupSize: 3,
      })

      type('brown brown brown ')

      expect(hover.getSnapshot().phase).toBe('normal')
      expect(released(events)).toEqual([
        expect.objectContaining({ required: 6, cycles: 2, attempts: 6, successes: 6, cleared: true, goldenNugget: false }),
      ])
    })

    it('stops after two cycles however badly they went', () => {
      const { hover, events, type } = setup('all-in')
      type('the quick brxwn ')

      for (let repetition = 0; repetition < 6; repetition += 1) type('bxown ')

      expect(hover.getSnapshot().phase).toBe('normal')
      expect(released(events)).toEqual([
        expect.objectContaining({ cycles: 2, attempts: 6, successes: 0, failures: 6, cleared: false, goldenNugget: true }),
      ])
    })
  })

  describe('Tired', () => {
    it('adds three for a repetition with a mistake, keeping the clean ones', () => {
      const { hover, events, type } = setup('tired')
      type('the quick brxwn ')

      type('brown ')
      type('brwn ')
      expect(hover.getSnapshot()).toMatchObject({ remaining: 5 })
      expect(hover.getSnapshot().focus).toMatchObject({ required: 6, failures: 1 })

      type('brown brown brown brown brown ')

      expect(released(events)).toEqual([
        expect.objectContaining({ required: 6, successes: 6, failures: 1, cleared: true, goldenNugget: false }),
      ])
    })

    it('stops the requirement at ten, and releases a word that reached it without clearing it', () => {
      const { hover, main, events, type } = setup('tired')
      type('the quick brxwn ')

      type('bxown bxown bxown bxown ')
      expect(hover.getSnapshot().focus).toMatchObject({ required: 10, failures: 4 })

      for (let repetition = 0; repetition < 10; repetition += 1) type('brown ')

      expect(hover.getSnapshot().phase).toBe('normal')
      expect(main.getSnapshot().status).toBe('running')
      expect(released(events)).toEqual([
        expect.objectContaining({ required: 10, successes: 10, failures: 4, cleared: false, limitReached: true, goldenNugget: true }),
      ])
    })

    it('releases at the attempt limit a word that never goes cleanly', () => {
      const { hover, main, events, type } = setup('tired')
      type('the quick brxwn ')

      for (let repetition = 0; repetition < HOVER_RULES.tired.maxAttempts; repetition += 1) type('bxown ')

      expect(hover.getSnapshot().phase).toBe('normal')
      expect(main.getSnapshot().status).toBe('running')
      expect(released(events)).toEqual([
        expect.objectContaining({ attempts: 20, successes: 0, cleared: false, limitReached: true, goldenNugget: true }),
      ])
    })
  })

  describe('several focuses in one test', () => {
    it('records each in order, saved with the difficulty the test was typed at', () => {
      const { hover, type } = setup('standard')

      type('thx the the the ') // "the": three clean repetitions
      type('quick brxwn ')
      type('brown bxown brown ') // "brown": one missed
      type('fox')

      const context = hover.finalContext({ ...DEFAULT_SESSION_CONTEXT, mode: 'hover' })
      expect(context).toMatchObject({ mode: 'hover', difficulty: 'normal' })
      expect(context.hover?.difficulty).toBe('standard')
      expect(context.hover?.focuses).toEqual([
        expect.objectContaining({ word: 'the', wordIndex: 0, cleared: true, goldenNugget: false }),
        expect.objectContaining({ word: 'brown', wordIndex: 2, cleared: false, goldenNugget: true }),
      ])
    })
  })

  describe('changing difficulty', () => {
    it('applies at once before a test starts, and to the next test once one is under way', () => {
      const { hover, main, type } = setup('standard')

      hover.setDifficulty('tired')
      expect(hover.getSnapshot().difficulty).toBe('tired')

      type('the qux')
      hover.setDifficulty('all-in')
      expect(hover.getSnapshot()).toMatchObject({ difficulty: 'tired' })
      expect(hover.getSnapshot().focus).toMatchObject({ difficulty: 'tired' })

      main.reset()
      type('t')
      expect(hover.getSnapshot().difficulty).toBe('all-in')
    })
  })
})

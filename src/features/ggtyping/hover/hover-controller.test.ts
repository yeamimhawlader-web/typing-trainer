/**
 * Hover Mode over real typing engines.
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
import { timestamp, type Timestamp } from '@core/types'

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

const setup = (text = TEXT) => {
  const hover = createHoverController()
  const main = createTypingEngine({ isComplete: hover.isComplete })
  hover.connect(main)

  const signals: HoverSignalEvent['signal'][] = []
  hover.onSignal((event) => signals.push(event.signal))

  const typeIntoText = typeIntoTextOf(main, text)
  let clock = 1_000
  const type = (keys: string | readonly string[]) => {
    for (const key of typeof keys === 'string' ? Array.from(keys) : keys) {
      clock += 100
      hover.inputKey(key, timestamp(clock), typeIntoText)
    }
  }

  return { hover, main, signals, type, now: () => clock }
}

describe('Hover Mode controller', () => {
  it('leaves ordinary typing alone before the first mistake', () => {
    const { hover, main, signals, type } = setup()

    type('the quick ')

    expect(hover.getSnapshot().phase).toBe('normal')
    expect(signals).toEqual([])
    expect(main.getSnapshot().cursorIndex).toBe(10)
    expect(hover.attempt.getSnapshot().status).toBe('idle')
  })

  it('focuses the word on one mistake, while the typist is still on it', () => {
    const { hover, main, signals, type } = setup()

    type('the quick brx')

    const snapshot = hover.getSnapshot()
    expect(signals).toEqual(['activated'])
    expect(snapshot.phase).toBe('pending')
    expect(snapshot.focus).toMatchObject({ word: 'brown', wordIndex: 2, start: 10, end: 15, required: 3 })
    expect(snapshot.remaining).toBe(3)
    // The text is still being typed.
    expect(main.getSnapshot().status).toBe('running')
  })

  it('begins the repetitions once the word is left, pausing the text at the next word', () => {
    const { hover, main, signals, type } = setup()

    type('the quick brxwn ')

    expect(signals).toEqual(['activated', 'repeating'])
    expect(hover.getSnapshot().phase).toBe('repeating')
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

  it('releases after three clean repetitions and carries on with the next word', () => {
    const { hover, main, signals, type } = setup()
    type('the quick brxwn ')

    type('brown brown ')
    expect(hover.getSnapshot()).toMatchObject({ phase: 'repeating', remaining: 1 })

    type('brown ')

    expect(signals).toEqual(['activated', 'repeating', 'success', 'success', 'released'])
    expect(hover.getSnapshot().phase).toBe('normal')
    expect(main.getSnapshot()).toMatchObject({ status: 'running', cursorIndex: 16 })
    expect(hover.attempt.getSnapshot().status).toBe('idle')

    type('fox')
    expect(main.getSnapshot().characterStates.slice(16)).toEqual(['correct', 'correct', 'correct'])
    expect(main.getSnapshot().status).toBe('completed')
  })

  it('adds three clean repetitions for a repetition with a mistake, and releases once they are done', () => {
    const { hover, signals, type } = setup()
    type('the quick brxwn ')

    type('brown ')
    type('brwn ')
    expect(hover.getSnapshot()).toMatchObject({ remaining: 5 })
    expect(hover.getSnapshot().focus).toMatchObject({ required: 6, successes: 1, failures: 1 })

    type('brown brown brown brown ')
    expect(hover.getSnapshot().remaining).toBe(1)
    type('brown ')

    expect(signals.filter((signal) => signal === 'failure')).toHaveLength(1)
    expect(hover.records()).toEqual([
      expect.objectContaining({ word: 'brown', required: 6, successes: 6, failures: 1, completed: true }),
    ])
  })

  it('counts a mistake fixed with backspace as a failed repetition, as the engine does', () => {
    const { hover, type } = setup()
    type('the quick brxwn ')

    type(['b', 'x', BACKSPACE, 'r', 'o', 'w', 'n', ' '])

    expect(hover.getSnapshot().focus).toMatchObject({ successes: 0, failures: 1, required: 6 })
  })

  it('marks the failure at the mistake, while the repetition is still being typed', () => {
    const { hover, signals, type } = setup()
    type('the quick brxwn ')

    type('bx')

    expect(signals.at(-1)).toBe('failure')
    expect(hover.getSnapshot()).toMatchObject({ attemptFailed: true, remaining: 6 })
    // The typist finishes the same repetition; it is not restarted under them.
    expect(hover.attempt.getSnapshot().cursorIndex).toBe(2)
  })

  it('ignores a space before a repetition has started, as the engine ignores it', () => {
    const { hover, type } = setup()
    type('the quick brxwn ')

    type(' brown ')

    expect(hover.getSnapshot().focus).toMatchObject({ successes: 1, failures: 0 })
  })

  it('keeps the focus on its word when the typist moves to other words before leaving it', () => {
    const { hover, type } = setup()
    type('the quick brx')

    // Back into "quick", a mistake there, and forward again.
    type([BACKSPACE, BACKSPACE, BACKSPACE, BACKSPACE, 'z'])
    expect(hover.getSnapshot().focus).toMatchObject({ word: 'brown' })

    type([BACKSPACE, ' ', 'b', 'r', 'o', 'w', 'n', ' '])
    expect(hover.getSnapshot()).toMatchObject({ phase: 'repeating' })
    expect(hover.getSnapshot().focus).toMatchObject({ word: 'brown', wordIndex: 2 })
  })

  it('never has two focuses at once', () => {
    const { hover, signals, type } = setup()
    type('the quxck brxwn ')

    expect(signals.filter((signal) => signal === 'activated')).toHaveLength(1)
    expect(hover.getSnapshot().focus).toMatchObject({ word: 'quick' })
  })

  it('holds the end of the text open while its last word is focused', () => {
    const { hover, main, type } = setup()

    type('the quick brown fxx')

    expect(main.getSnapshot().status).toBe('paused')
    expect(hover.getSnapshot()).toMatchObject({ phase: 'repeating' })
    expect(hover.getSnapshot().focus).toMatchObject({ word: 'fox' })

    type('fox fox fox ')

    expect(main.getSnapshot().status).toBe('completed')
    expect(hover.finalContext(DEFAULT_SESSION_CONTEXT).hover?.focuses).toEqual([
      expect.objectContaining({ word: 'fox', successes: 3, completed: true }),
    ])
  })

  it('releases at the attempt limit and lets the text carry on', () => {
    const { hover, main, type } = setup()
    type('the quick brxwn ')

    for (let repetition = 0; repetition < HOVER_RULES.maxAttempts; repetition += 1) type('bxown ')

    expect(hover.getSnapshot().phase).toBe('normal')
    expect(main.getSnapshot().status).toBe('running')
    expect(hover.records()).toEqual([
      expect.objectContaining({ completed: false, limitReached: true, successes: 0, failures: 20, required: 12 }),
    ])
  })

  it('clears everything on restart', () => {
    const { hover, main, signals, type } = setup()
    type('the quick brxwn bro')

    main.reset()

    expect(signals.at(-1)).toBe('ended')
    expect(hover.getSnapshot()).toMatchObject({ phase: 'normal', focus: null })
    expect(hover.attempt.getSnapshot().status).toBe('idle')
    expect(hover.records()).toEqual([])

    // A new test types normally from the first key.
    type('the')
    expect(main.getSnapshot()).toMatchObject({ status: 'running', cursorIndex: 3 })
  })

  it('starts each test with no records from the one before', () => {
    const { hover, main, type } = setup('ab cd')
    type('ax ab ab ab cd')
    expect(main.getSnapshot().status).toBe('completed')
    expect(hover.records()).toHaveLength(1)

    main.reset()
    type('ab cd')

    expect(main.getSnapshot().status).toBe('completed')
    expect(hover.records()).toEqual([])
  })

  it('saves the mode context and every focus with the finished test', () => {
    const { hover, type } = setup()
    type('the quick brxwn brown brown brown fox')

    const context = hover.finalContext({ ...DEFAULT_SESSION_CONTEXT, mode: 'hover' })

    expect(context).toMatchObject({ mode: 'hover', difficulty: 'normal' })
    expect(context.hover).toEqual({
      focuses: [
        {
          word: 'brown',
          wordIndex: 2,
          required: 3,
          successes: 3,
          failures: 0,
          completed: true,
          limitReached: false,
          focusMs: expect.any(Number),
        },
      ],
    })
  })

  it('leaves the text pass measured exactly as an ordinary engine measures it', () => {
    const { main, type } = setup()
    type('the quick brxwn brown brown brown fox')
    const hovered = main.toResult()

    // The same text keys, at the same moments, into a plain engine paused for
    // the same interval.
    const plain = createTypingEngine()
    const keys = Array.from('the quick brxwn ')
    let clock = 1_000
    keys.forEach((key, index) => {
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

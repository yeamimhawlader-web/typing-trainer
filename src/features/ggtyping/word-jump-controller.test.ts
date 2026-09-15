/**
 * The word jump, driven by a real engine.
 *
 * Keystrokes go into the actual typing engine, so what counts as a mistake,
 * where the cursor goes and when a word is complete are the engine's decisions,
 * not a fixture's. The animation is replaced with a recording fake: what is
 * under test is which word is asked to jump and when, not pixels.
 */

import { describe, expect, it, vi } from 'vitest'

import { BACKSPACE, computeWordRanges, createTypingEngine, toCharacters, type TypingEngine } from '@core/engine'
import { deriveSessionTelemetry } from '@core/telemetry'
import { sessionId, timestamp } from '@core/types'

import { createWordJumpController } from './word-jump-controller.ts'

const BS = BACKSPACE

interface FakeAnimation {
  playState: AnimationPlayState
  readonly cancel: ReturnType<typeof vi.fn>
  addEventListener(type: string, listener: () => void): void
  /** Ends the fake as a finished animation would. */
  end(): void
}

const fakeAnimation = (): FakeAnimation => {
  const listeners: (() => void)[] = []
  const animation: FakeAnimation = {
    playState: 'running',
    cancel: vi.fn(() => {
      animation.playState = 'idle'
    }),
    addEventListener: (type, listener) => {
      if (type === 'finish') listeners.push(listener)
    },
    end: () => {
      animation.playState = 'finished'
      for (const listener of listeners) listener()
    },
  }
  return animation
}

/**
 * An engine, a controller connected to it, and one element per word.
 *
 * `type` behaves like the typing screen: the first key starts the test.
 */
const harness = (text: string, engine: TypingEngine = createTypingEngine()) => {
  const plays: { readonly word: number; readonly animation: FakeAnimation }[] = []
  const controller = createWordJumpController({
    play: (element) => {
      const animation = fakeAnimation()
      plays.push({ word: Number(element.dataset.word), animation })
      return animation as unknown as Animation
    },
  })

  for (const word of computeWordRanges(toCharacters(text))) {
    const element = document.createElement('span')
    element.dataset.word = String(word.index)
    controller.register(word.index, element)
  }

  const disconnect = controller.connect(engine)
  let at = 1_000

  const type = (...keys: readonly string[]): void => {
    for (const key of keys) {
      if (engine.getSnapshot().status === 'idle') {
        engine.start({ text, sourceId: 'test' }, timestamp(at))
      }
      at += 90
      engine.input(key, timestamp(at))
    }
  }

  return {
    engine,
    type,
    disconnect,
    plays,
    jumped: () => plays.map((play) => play.word),
  }
}

/** A wrong letter and its deletion: one mistake, cursor back where it was. */
const slip = ['x', BS] as const

describe('the trigger', () => {
  it('does nothing for one mistake on a word', () => {
    const { type, jumped, engine } = harness('alpha bravo charlie')

    type(...slip)

    expect(engine.getSnapshot().errorCount).toBe(1)
    expect(jumped()).toEqual([])
  })

  it('does nothing for two consecutive mistakes on a word', () => {
    const { type, jumped, engine } = harness('alpha bravo charlie')

    type(...slip, ...slip)

    expect(engine.getSnapshot().errorCount).toBe(2)
    expect(jumped()).toEqual([])
  })

  it('makes the word jump on the third consecutive mistake', () => {
    const { type, jumped } = harness('alpha bravo charlie')

    type(...slip, ...slip, 'x')

    expect(jumped()).toEqual([0])
  })

  it('counts whatever the engine calls a mistake, including an early space and an extra letter', () => {
    // Extra letter where the space belongs, twice, then a space part-way
    // through the next attempt… all on "alpha", all mistakes to the engine.
    const { type, jumped, engine } = harness('alpha bravo charlie')

    type('a', 'l', 'p', 'h', 'a', 'z', BS, 'z', BS, 'q')

    expect(engine.getSnapshot().errorCount).toBe(3)
    expect(jumped()).toEqual([0])
  })
})

describe('resets', () => {
  it('starts the count again after the word is completed correctly', () => {
    const { type, jumped } = harness('alpha bravo charlie')

    // Two mistakes, then "alpha" typed right: a correct completion.
    type(...slip, ...slip, 'a', 'l', 'p', 'h', 'a')
    // Two extra letters at the boundary. Without the reset that would be four.
    type('z', BS, 'z', BS)
    expect(jumped()).toEqual([])

    // The third since the reset does jump.
    type('z')
    expect(jumped()).toEqual([0])
  })

  it('does not reset on a completion that still has a wrong letter in it', () => {
    const { type, jumped } = harness('alpha bravo charlie')

    // Mistake at the first letter, left in, word run to its end; then two extras.
    type('x', 'l', 'p', 'h', 'a', 'z', BS, 'z')

    expect(jumped()).toEqual([0])
  })

  it('ends a word’s streak when the typist moves to another word', () => {
    const { type, jumped } = harness('alpha bravo charlie')

    type('a', 'l', 'p', 'h', 'a', ' ')
    type(...slip, ...slip) // two on "bravo"
    type(BS) // back into the space after "alpha": a different word
    type(' ') // and forward again
    type(...slip, ...slip) // two more on "bravo", but a fresh streak

    expect(jumped()).toEqual([])

    type('x')
    expect(jumped()).toEqual([1])
  })

  it('clears every streak and cancels a jump in the air when the test restarts', () => {
    const { type, jumped, engine, plays } = harness('alpha bravo charlie')

    type(...slip, ...slip, 'x')
    expect(jumped()).toEqual([0])

    type(BS, ...slip, ...slip) // two more on "alpha", not yet a second jump
    engine.reset()

    expect(plays[0]?.animation.cancel).toHaveBeenCalled()

    // The new test's first mistake on the same word is a first mistake.
    type(...slip)
    expect(jumped()).toEqual([0])
    type(...slip)
    expect(jumped()).toEqual([0])
  })

  it('clears all animation state when the test completes', () => {
    const { type, jumped, engine, plays } = harness('ab cd')

    type('a', 'b', ' ', ...slip, ...slip, 'x')
    expect(jumped()).toEqual([1])
    const inTheAir = plays[0]?.animation

    // Fix it and finish the test while the word is still jumping.
    type(BS, 'c', 'd')
    expect(engine.getSnapshot().status).toBe('completed')
    expect(inTheAir?.cancel).toHaveBeenCalled()

    // Nothing carries into the next test.
    engine.reset()
    type('a', 'b', ' ', ...slip, ...slip)
    expect(jumped()).toEqual([1])
  })

  it('stops listening, and cancels anything running, when disconnected', () => {
    const { type, jumped, disconnect, plays } = harness('alpha bravo charlie')

    type(...slip, ...slip, 'x')
    disconnect()

    expect(plays[0]?.animation.cancel).toHaveBeenCalled()
    type(BS, ...slip, ...slip, 'x')
    expect(jumped()).toEqual([0])
  })
})

describe('words are independent', () => {
  it('jumps only the word that earned it', () => {
    const { type, jumped } = harness('alpha bravo charlie delta')

    type(...slip, ...slip, 'x') // "alpha": three
    type(BS, 'a', 'l', 'p', 'h', 'a', ' ')
    type(...slip, ...slip) // "bravo": two

    expect(jumped()).toEqual([0])
  })

  it('does not make the next word jump because the last one did', () => {
    const { type, jumped } = harness('alpha bravo charlie delta')

    type(...slip, ...slip, 'x') // "alpha" jumps
    type(BS, 'a', 'l', 'p', 'h', 'a', ' ')
    type('b', 'r', 'a', 'v', 'o', ' ') // "bravo" clean
    type(...slip) // "charlie": one

    expect(jumped()).toEqual([0])
  })
})

describe('repeated triggering', () => {
  it('jumps again on the sixth consecutive mistake once the first jump has landed', () => {
    const { type, jumped, plays } = harness('alpha bravo charlie')

    type(...slip, ...slip, 'x')
    plays[0]?.animation.end()
    type(BS, ...slip, ...slip, 'x')

    expect(jumped()).toEqual([0, 0])
  })

  it('lets a jump still in the air finish rather than restarting it', () => {
    const { type, jumped, plays } = harness('alpha bravo charlie')

    type(...slip, ...slip, 'x')
    type(BS, ...slip, ...slip, 'x') // sixth, while the first is running

    expect(jumped()).toEqual([0])
    expect(plays[0]?.animation.cancel).not.toHaveBeenCalled()

    plays[0]?.animation.end()
    type(BS, ...slip, ...slip, 'x') // ninth, after it landed
    expect(jumped()).toEqual([0, 0])
  })
})

describe('what it cannot touch', () => {
  /** A fixed script with plenty of jumps in it, on "alpha" and "bravo". */
  const script = [
    ...slip, ...slip, 'x', BS, ...slip, ...slip, 'x', BS,
    'a', 'l', 'p', 'h', 'a', ' ',
    ...slip, ...slip, 'x', BS,
    'b', 'r', 'a', 'v', 'o', ' ',
    'c', 'h', 'a', 'r', 'l', 'i', 'e',
  ]
  const text = 'alpha bravo charlie'
  const fixedId = () => sessionId('same-session')

  const runWithout = () => {
    const engine = createTypingEngine({ createSessionId: fixedId })
    let at = 1_000
    engine.start({ text, sourceId: 'test' }, timestamp(at))
    for (const key of script) {
      at += 90
      engine.input(key, timestamp(at))
    }
    return engine.toResult()
  }

  const runWith = () => {
    const engine = createTypingEngine({ createSessionId: fixedId })
    const { type, jumped } = harness(text, engine)
    type(...script)
    return { result: engine.toResult(), jumps: jumped().length }
  }

  it('produces the same WPM and raw WPM with jumps as without', () => {
    const without = runWithout()
    const { result, jumps } = runWith()

    // "alpha" and "bravo" each jump; the sixth mistake on "alpha" lands while its
    // first jump is still running and is let go, as designed.
    expect(jumps).toBe(2)
    expect(result?.metrics.netWpm).toBe(without?.metrics.netWpm)
    expect(result?.metrics.rawWpm).toBe(without?.metrics.rawWpm)
  })

  it('produces the same accuracy with jumps as without', () => {
    const without = runWithout()
    const { result } = runWith()

    expect(result?.metrics.accuracy).toBe(without?.metrics.accuracy)
    // And every other figure, while it is here.
    expect(result).toEqual(without)
  })

  it('produces the same keystroke log and telemetry with jumps as without', () => {
    const without = runWithout()
    const { result } = runWith()

    expect(result?.keystrokes).toEqual(without?.keystrokes)
    expect(deriveSessionTelemetry(result?.keystrokes ?? [], text)).toEqual(
      deriveSessionTelemetry(without?.keystrokes ?? [], text),
    )
  })

  it('only listens: it never calls anything on the engine that changes it', () => {
    const engine = createTypingEngine()
    const calls: string[] = []
    const watched = new Proxy(engine, {
      get(target, property, receiver) {
        const value: unknown = Reflect.get(target, property, receiver)
        if (typeof value !== 'function') return value
        return (...args: unknown[]) => {
          calls.push(String(property))
          return (value as (...parameters: unknown[]) => unknown).apply(target, args)
        }
      },
    })

    const controller = createWordJumpController({ play: () => null })
    const disconnect = controller.connect(watched)
    let at = 1_000
    engine.start({ text, sourceId: 'test' }, timestamp(at))
    for (const key of script) {
      at += 90
      engine.input(key, timestamp(at))
    }
    disconnect()

    expect(new Set(calls)).toEqual(new Set(['on', 'getSnapshot']))
  })
})

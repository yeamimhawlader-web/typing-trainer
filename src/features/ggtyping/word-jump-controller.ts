/**
 * Connects the engine's events to the word jump, without going through React.
 *
 * ## Why not React state
 *
 * A jump is a moment, not a state of the screen. Putting it in React would mean
 * re-rendering at least the word on every trigger and a subscription per word
 * evaluated on every change — work on the typing path to produce something the
 * DOM can do on its own. So the controller holds a plain map of word index to
 * element, filled by the word spans' refs, and plays the animation directly.
 * No component renders because a word jumped.
 *
 * ## What it reads, and when
 *
 * - `started`: the word ranges of the new test, read once from the snapshot the
 *   engine has just built anyway. Nothing is carried over from before.
 * - `keystroke`: the keystroke's own `index`, `kind` and `correct` — the
 *   engine's verdict. No snapshot is read per keystroke.
 * - `word-completed`: the finished word's character states, to tell a correct
 *   completion from an incorrect one. The snapshot read here is the same cached
 *   object the screen is about to read, so it costs no extra build.
 * - `reset` and `finished`: every streak cleared and every running jump
 *   cancelled, so nothing from one test can move in the next.
 *
 * It only ever listens. It never calls into the engine, so speed, accuracy,
 * the keystroke log and everything derived from them cannot be affected.
 *
 * ## A trigger during a jump
 *
 * If a word earns another jump while one is still in the air — six mistakes in
 * under half a second — the running one is left to finish rather than being
 * restarted from the ground, which would snap the word down mid-flight.
 */

import type { EngineEvent, TypingEngine, Unsubscribe, WordRange } from '@core/engine'

import { createMistakeStreaks, wordOwning } from './mistake-streak.ts'
import { playWordJump } from './motion/word-jump.ts'

export interface WordJumpController {
  /** Makes a word's element available to jump. Returns the matching removal. */
  register(wordIndex: number, element: HTMLElement): () => void
  /** Starts listening to an engine. Returns the matching stop. */
  connect(engine: TypingEngine): Unsubscribe
}

export interface WordJumpControllerOptions {
  /** Injectable for tests; defaults to the real animation. */
  readonly play?: (element: HTMLElement) => Animation | null
}

const isRight = (state: string | undefined): boolean =>
  state === 'correct' || state === 'corrected'

export const createWordJumpController = ({
  play = playWordJump,
}: WordJumpControllerOptions = {}): WordJumpController => {
  const elements = new Map<number, HTMLElement>()
  const running = new Map<number, Animation>()
  const streaks = createMistakeStreaks()
  let words: readonly WordRange[] = []

  const cancelAll = (): void => {
    for (const animation of running.values()) animation.cancel()
    running.clear()
  }

  const clear = (): void => {
    streaks.clear()
    cancelAll()
  }

  const jump = (wordIndex: number): void => {
    const element = elements.get(wordIndex)
    if (element === undefined) return

    const current = running.get(wordIndex)
    if (current !== undefined && current.playState === 'running') return

    const animation = play(element)
    if (animation === null) {
      running.delete(wordIndex)
      return
    }

    running.set(wordIndex, animation)
    animation.addEventListener('finish', () => {
      if (running.get(wordIndex) === animation) running.delete(wordIndex)
    })
  }

  const handle = (engine: TypingEngine, event: EngineEvent): void => {
    switch (event.type) {
      case 'started':
        clear()
        words = engine.getSnapshot().words
        return

      case 'keystroke': {
        const { keystroke } = event
        // Only if a test somehow started before this controller connected.
        if (words.length === 0) words = engine.getSnapshot().words

        const wordIndex = wordOwning(words, keystroke.index)
        if (wordIndex < 0) return

        if (streaks.keystroke(wordIndex, keystroke.kind, keystroke.correct)) jump(wordIndex)
        return
      }

      case 'word-completed': {
        const { characterStates } = engine.getSnapshot()
        const { start, end, index } = event.word

        for (let position = start; position < end; position += 1) {
          if (!isRight(characterStates[position])) return
        }
        // Extras typed where the following space belongs leave that space
        // marked wrong: the word is not right until they are gone.
        if (characterStates[end] === 'incorrect') return

        streaks.completedCorrectly(index)
        return
      }

      case 'reset':
      case 'finished':
        clear()
        return

      case 'paused':
      case 'resumed':
        return
    }
  }

  return {
    register: (wordIndex, element) => {
      elements.set(wordIndex, element)

      return () => {
        if (elements.get(wordIndex) === element) elements.delete(wordIndex)
        const animation = running.get(wordIndex)
        if (animation !== undefined) {
          animation.cancel()
          running.delete(wordIndex)
        }
      }
    },

    connect: (engine) => {
      const stop = engine.on((event) => {
        handle(engine, event)
      })

      return () => {
        stop()
        clear()
      }
    },
  }
}

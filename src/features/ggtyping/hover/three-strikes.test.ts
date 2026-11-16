/**
 * Three mistakes on a word keep it, over the real controller and real engines.
 */

import { describe, expect, it, vi } from 'vitest'

import { BACKSPACE, createTypingEngine, type TypingEngine } from '@core/engine'
import { createGoldenNuggetService } from '@core/nuggets'
import { createMemoryAdapter } from '@core/persistence'
import { timestamp, type HoverDifficulty, type Timestamp } from '@core/types'

import { recordGoldenNuggets } from './golden-nuggets.ts'
import { createHoverController } from './hover-controller.ts'
import { keepAfterThreeStrikes, type KeptWord } from './three-strikes.ts'

const TEXT = 'the quick brown fox'

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

const setup = (difficulty: HoverDifficulty = 'standard') => {
  let tests = 0
  const hover = createHoverController({ difficulty, createTestId: () => `test-${(tests += 1)}` })
  const main = createTypingEngine({ isComplete: hover.isComplete })
  hover.connect(main)
  const service = createGoldenNuggetService(createMemoryAdapter())
  const kept: KeptWord[] = []
  keepAfterThreeStrikes(hover, service, { language: 'en', now: () => 5_000, onKeep: (word) => kept.push(word) })

  const typeIntoText = typeIntoTextOf(main, TEXT)
  let clock = 1_000
  const type = (keys: string) => {
    for (const key of Array.from(keys)) {
      clock += 100
      hover.inputKey(key, timestamp(clock), typeIntoText)
    }
  }
  return { hover, main, service, kept, type }
}

describe('three mistakes on a word in Hover Mode', () => {
  it('keeps the word on the third: the slip that started the focus, and two repetitions gone wrong', async () => {
    const { service, kept, type } = setup()

    // The slip, then the rest of the word and its space: the focus is repeating.
    type('the quixk ')
    expect(kept).toEqual([])
    type('quicx ')
    expect(kept).toEqual([])
    type('quicx ')

    expect(kept).toEqual([{ word: 'quick', wordIndex: 1 }])
    await vi.waitFor(async () => {
      expect((await service.getAll()).map((nugget) => nugget.word)).toEqual(['quick'])
    })
  })

  it('keeps it once, however many more times it goes wrong', () => {
    const { kept, type } = setup('tired')

    type('the quixk ')
    type('quicx quicx quicx quicx ')

    expect(kept).toHaveLength(1)
  })

  it('does not keep a word got wrong twice', async () => {
    const { service, kept, type } = setup()

    type('the quixk ')
    type('quicx quick quick ')

    expect(kept).toEqual([])
    // Standard lets it go after its three repetitions; whether it is kept then is the release's to say.
    expect(await service.getAll()).toEqual([])
  })

  it('counts the mistakes once, with the focus that hands them over when it ends', async () => {
    const { hover, service, type } = setup()
    recordGoldenNuggets(hover, service, { language: 'en', now: () => 6_000 })

    type('the quixk ')
    type('quicx quicx quick ')

    await vi.waitFor(async () => {
      const [nugget] = await service.getAll()
      // The slip in the text and one in each of two repetitions: three, not six.
      expect(nugget).toMatchObject({ word: 'quick', mistakes: 3, tests: 1, hoverSessions: 1 })
    })
  })

  it('starts each word, and each test, from nothing', () => {
    const { hover, main, kept, type } = setup()

    type('the quixk ')
    type('quicx ')
    // A new test: the two so far are gone with the old one.
    main.reset()
    hover.setDifficulty('standard')
    type('the quixk ')
    type('quicx ')

    expect(kept).toEqual([])
  })
})

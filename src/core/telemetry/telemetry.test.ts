/**
 * Telemetry tests.
 *
 * Most drive the real engine rather than hand-building keystroke logs: the
 * point of telemetry is that it describes what actually happened, and a
 * fixture written by hand can agree with a derivation that is wrong about the
 * engine.
 *
 * Timings are exact because the engine takes its clock as an argument, so
 * every latency below is a number that can be checked by hand.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { createTypingEngine } from '@core/engine'
import { createMemoryAdapter, type StorageAdapter } from '@core/persistence'
import { sessionId, timestamp, type Keystroke, type SessionTarget } from '@core/types'

import { deriveSessionTelemetry } from './derive.ts'
import { decodeTelemetry, encodeTelemetry, parseStoredTelemetry } from './encode.ts'
import { createTelemetryRepository } from './repository.ts'
import { analyseSlowSequences } from './sequences.ts'
import { createTelemetryService } from './service.ts'
import { STORAGE_COST, TELEMETRY_VERSION } from './types.ts'

const target = (text: string): SessionTarget => ({ text, sourceId: 'test' })

/**
 * Types a script against the engine at a fixed pace.
 *
 * Every entry is either a character or 'Backspace'; each advances the clock by
 * `step`, so the nth event sits at exactly `n * step` milliseconds.
 */
const run = (text: string, script: readonly string[], step = 100) => {
  const engine = createTypingEngine()
  engine.start(target(text), timestamp(0))

  script.forEach((key, index) => {
    engine.input(key, timestamp((index + 1) * step))
  })

  const result = engine.toResult()
  return {
    engine,
    result,
    keystrokes: engine.getSnapshot().keystrokes,
    telemetry: deriveSessionTelemetry(engine.getSnapshot().keystrokes, text),
  }
}

const characters = (text: string): readonly string[] => Array.from(text)

describe('keystroke telemetry', () => {
  it('records nothing for a session with no input', () => {
    const telemetry = deriveSessionTelemetry([], 'hello world')

    expect(telemetry.keystrokes).toEqual([])
    expect(telemetry.corrections).toEqual([])
    expect(telemetry.summary.keystrokeCount).toBe(0)
    expect(telemetry.summary.lastEventAt).toBeNull()
    // Words are still described, as never attempted.
    expect(telemetry.words).toHaveLength(2)
    expect(telemetry.words[0]?.firstKeystrokeAt).toBeNull()
  })

  it('keeps timestamps in order and on the session clock', () => {
    const { telemetry } = run('abc', ['a', 'b', 'c'])

    expect(telemetry.keystrokes.map((k) => k.at)).toEqual([100, 200, 300])

    const times = telemetry.keystrokes.map((k) => k.at)
    expect([...times].sort((a, b) => a - b)).toEqual(times)
  })

  it('describes a correct key', () => {
    const { telemetry } = run('abc', ['a'])

    expect(telemetry.keystrokes[0]).toMatchObject({
      kind: 'character',
      key: 'a',
      expected: 'a',
      correct: true,
      index: 0,
      wordIndex: 0,
      indexInWord: 0,
      correctedLater: false,
    })
  })

  it('describes an incorrect key', () => {
    const { telemetry } = run('abc', ['x'])

    expect(telemetry.keystrokes[0]).toMatchObject({
      key: 'x',
      expected: 'a',
      correct: false,
      index: 0,
      correctedLater: false,
    })
  })

  it('describes a backspace', () => {
    const { telemetry } = run('abc', ['a', 'Backspace'])

    expect(telemetry.keystrokes[1]).toMatchObject({
      kind: 'backspace',
      key: 'Backspace',
      expected: null,
      correct: false,
      index: 0,
    })
  })

  it('measures the interval between consecutive events', () => {
    const { telemetry } = run('abc', ['a', 'b', 'c'], 120)

    expect(telemetry.keystrokes.map((k) => k.interKeystrokeMs)).toEqual([
      null,
      120,
      120,
    ])
  })

  it('separates time-since-any-key from time-since-the-previous-character', () => {
    // a(100) x(200) backspace(300) b(400): the 'b' lands 100ms after the
    // backspace but 200ms after the last character. A digraph timing built from
    // the wrong one would be silently wrong, which is why both are recorded.
    const { telemetry } = run('abc', ['a', 'x', 'Backspace', 'b', 'c'])
    const b = telemetry.keystrokes[3]

    expect(b?.key).toBe('b')
    expect(b?.interKeystrokeMs).toBe(100)
    expect(b?.sincePreviousCharacterMs).toBe(200)
  })

  it('leaves the first character without a previous-character interval', () => {
    const { telemetry } = run('ab', ['a', 'b'])

    expect(telemetry.keystrokes[0]?.sincePreviousCharacterMs).toBeNull()
    expect(telemetry.keystrokes[1]?.sincePreviousCharacterMs).toBe(100)
  })

  it('places every character in its word', () => {
    const { telemetry } = run('ab cd', ['a', 'b', ' ', 'c', 'd'])

    expect(
      telemetry.keystrokes.map((k) => [k.index, k.wordIndex, k.indexInWord]),
    ).toEqual([
      [0, 0, 0],
      [1, 0, 1],
      // The space belongs to no word, and says so rather than guessing.
      [2, -1, -1],
      [3, 1, 0],
      [4, 1, 1],
    ])
  })

  it('handles repeated characters without confusing their positions', () => {
    const { telemetry } = run('aaa', ['a', 'a', 'a'])

    expect(telemetry.keystrokes.map((k) => k.index)).toEqual([0, 1, 2])
    expect(telemetry.keystrokes.every((k) => k.correct)).toBe(true)
  })

  it('records the same key pressed repeatedly at different positions', () => {
    const { telemetry } = run('ab', ['a', 'a'])

    expect(telemetry.keystrokes.map((k) => [k.key, k.index, k.correct])).toEqual([
      ['a', 0, true],
      ['a', 1, false],
    ])
  })

  it('records punctuation as an ordinary character', () => {
    const { telemetry } = run("don't.", ['d', 'o', 'n', "'", 't', '.'])

    const apostrophe = telemetry.keystrokes[3]
    expect(apostrophe).toMatchObject({ key: "'", expected: "'", correct: true })
    // Punctuation is part of the word it sits in.
    expect(apostrophe?.wordIndex).toBe(0)
  })

  it('records a space as a character outside any word', () => {
    const { telemetry } = run('a b', ['a', ' ', 'b'])

    expect(telemetry.keystrokes[1]).toMatchObject({
      key: ' ',
      expected: ' ',
      correct: true,
      wordIndex: -1,
      indexInWord: -1,
    })
  })

  it('records a missed space as an ordinary error', () => {
    const { telemetry } = run('a b', ['a', 'x'])

    expect(telemetry.keystrokes[1]).toMatchObject({
      key: 'x',
      expected: ' ',
      correct: false,
    })
  })
})

describe('corrections', () => {
  it('records an error that was never put right', () => {
    const { telemetry } = run('ab', ['x', 'b'])

    expect(telemetry.corrections).toHaveLength(1)
    expect(telemetry.corrections[0]).toMatchObject({
      index: 0,
      typedKey: 'x',
      expectedKey: 'a',
      errorAt: 100,
      backspaces: 0,
      firstBackspaceAt: null,
      correctedAt: null,
      detectionLatencyMs: null,
      correctionLatencyMs: null,
      outcome: 'uncorrected',
    })
  })

  it('records an error that was backspaced and retyped', () => {
    // x at 100, backspace at 200, a at 300.
    const { telemetry } = run('ab', ['x', 'Backspace', 'a', 'b'])

    expect(telemetry.corrections[0]).toMatchObject({
      index: 0,
      typedKey: 'x',
      expectedKey: 'a',
      errorAt: 100,
      backspaces: 1,
      firstBackspaceAt: 200,
      correctedAt: 300,
      detectionLatencyMs: 100, // noticed one keystroke later
      correctionLatencyMs: 200, // total cost of the mistake
      outcome: 'corrected',
    })
  })

  it('counts every backspace spent on one position', () => {
    // Typed wrong, deleted twice (the second is a no-op at index 0), retyped.
    const { telemetry } = run('ab', ['x', 'Backspace', 'a', 'b'])

    expect(telemetry.corrections[0]?.backspaces).toBe(1)
  })

  it('counts a mistake backspaced over from further along', () => {
    // Wrong at 0, carried on to 1, then deleted back through both and retyped.
    // The target has to be longer than the mistake, or typing the last
    // character would end the test before the correction could happen.
    const { telemetry } = run('abc', [
      'x',
      'b',
      'Backspace',
      'Backspace',
      'a',
      'b',
      'c',
    ])
    const [first] = telemetry.corrections

    expect(first).toMatchObject({ index: 0, outcome: 'corrected', backspaces: 1 })
  })

  it('records two separate errors on the same position', () => {
    const { telemetry } = run('ab', ['x', 'Backspace', 'y', 'Backspace', 'a'])

    expect(telemetry.corrections).toHaveLength(2)
    expect(telemetry.corrections.map((c) => c.typedKey)).toEqual(['x', 'y'])
    // Both were eventually put right by the same correct keystroke.
    expect(telemetry.corrections.every((c) => c.outcome === 'corrected')).toBe(true)
  })

  it('marks the keystroke itself as corrected later', () => {
    const { telemetry } = run('ab', ['x', 'Backspace', 'a'])

    expect(telemetry.keystrokes[0]).toMatchObject({
      correct: false,
      correctedLater: true,
    })
  })

  it('orders corrections by when the mistake happened', () => {
    const { telemetry } = run('abc', [
      'x',
      'Backspace',
      'a',
      'y',
      'Backspace',
      'b',
      'c',
    ])

    const times = telemetry.corrections.map((c) => c.errorAt)
    expect([...times].sort((a, b) => a - b)).toEqual(times)
  })
})

describe('word telemetry', () => {
  it('describes each word of the target', () => {
    const { telemetry } = run('ab cd', ['a', 'b', ' ', 'c', 'd'])

    expect(telemetry.words.map((w) => [w.wordIndex, w.text, w.start, w.end])).toEqual([
      [0, 'ab', 0, 2],
      [1, 'cd', 3, 5],
    ])
  })

  it('times a word from its first to its last keystroke', () => {
    const { telemetry } = run('ab cd', ['a', 'b', ' ', 'c', 'd'])

    expect(telemetry.words[0]).toMatchObject({
      firstKeystrokeAt: 100,
      lastKeystrokeAt: 200,
      typingDurationMs: 100,
      characterKeystrokes: 2,
    })
  })

  it('measures the pause before and after a word', () => {
    // a(100) b(200) space(300) c(400) d(500)
    const { telemetry } = run('ab cd', ['a', 'b', ' ', 'c', 'd'])

    // The first word has nothing before it.
    expect(telemetry.words[0]?.pauseBeforeMs).toBeNull()
    // and the space follows it 100ms later.
    expect(telemetry.words[0]?.pauseAfterMs).toBe(100)
    // The second word starts 100ms after that space.
    expect(telemetry.words[1]?.pauseBeforeMs).toBe(100)
    expect(telemetry.words[1]?.pauseAfterMs).toBeNull()
  })

  it('shows a long hesitation before a word', () => {
    const engine = createTypingEngine()
    engine.start(target('ab cd'), timestamp(0))
    engine.input('a', timestamp(100))
    engine.input('b', timestamp(200))
    engine.input(' ', timestamp(300))
    engine.input('c', timestamp(2_300)) // two seconds of thinking
    engine.input('d', timestamp(2_400))

    const telemetry = deriveSessionTelemetry(engine.getSnapshot().keystrokes, 'ab cd')

    expect(telemetry.words[1]?.pauseBeforeMs).toBe(2_000)
  })

  it('counts errors and corrections per word', () => {
    const { telemetry } = run('ab cd', ['a', 'x', 'Backspace', 'b', ' ', 'c', 'z'])

    expect(telemetry.words[0]).toMatchObject({
      errors: 1,
      correctedErrors: 1,
      backspaces: 1,
    })
    expect(telemetry.words[1]).toMatchObject({
      errors: 1,
      correctedErrors: 0,
      backspaces: 0,
    })
  })

  it('leaves an unreached word empty rather than absent', () => {
    const { telemetry } = run('ab cd', ['a', 'b'])

    expect(telemetry.words[1]).toMatchObject({
      wordIndex: 1,
      text: 'cd',
      firstKeystrokeAt: null,
      typingDurationMs: null,
      characterKeystrokes: 0,
    })
  })
})

describe('summary', () => {
  it('counts what happened', () => {
    const { telemetry } = run('abc', ['x', 'Backspace', 'a', 'b', 'z'])

    expect(telemetry.summary).toEqual({
      keystrokeCount: 5,
      characterKeystrokes: 4,
      backspaceCount: 1,
      errorCount: 2,
      correctedErrorCount: 1,
      uncorrectedErrorCount: 1,
      lastEventAt: 500,
    })
  })
})

describe('encoding', () => {
  it('round-trips a keystroke log exactly', () => {
    const { keystrokes } = run('the quick brown', [
      't',
      'h',
      'x',
      'Backspace',
      'e',
      ' ',
      'q',
      'u',
      'i',
      'c',
      'k',
    ])

    const restored = decodeTelemetry(encodeTelemetry(keystrokes), 'the quick brown')

    expect(restored).toEqual(keystrokes)
  })

  it('reconstructs what was expected from the text alone', () => {
    const { keystrokes } = run('hello', ['h', 'x'])

    const restored = decodeTelemetry(encodeTelemetry(keystrokes), 'hello')

    expect(restored[1]).toMatchObject({ key: 'x', expected: 'e', correct: false })
  })

  it('round-trips text with characters outside the basic plane', () => {
    const { keystrokes } = run('a👍b', ['a', '👍', 'b'])

    const restored = decodeTelemetry(encodeTelemetry(keystrokes), 'a👍b')

    expect(restored).toEqual(keystrokes)
    expect(restored[1]?.key).toBe('👍')
  })

  it('stores times as deltas rather than absolutes', () => {
    const { keystrokes } = run('abc', ['a', 'b', 'c'], 100)

    const stored = encodeTelemetry(keystrokes)

    expect(stored.keystrokes.map(([delta]) => delta)).toEqual([100, 100, 100])
  })

  it('marks its own version', () => {
    expect(encodeTelemetry([]).version).toBe(TELEMETRY_VERSION)
  })

  it('refuses to guess at a version it does not know', () => {
    const { keystrokes } = run('abc', ['a', 'b'])
    const stored = { ...encodeTelemetry(keystrokes), version: 99 }

    expect(decodeTelemetry(stored, 'abc')).toEqual([])
  })

  it.each([
    ['null', null],
    ['a string', 'telemetry'],
    ['an array', []],
    ['an object with no version', { keystrokes: [] }],
    ['an object with no keystrokes', { version: 1 }],
  ])('rejects %s', (_label, value) => {
    expect(parseStoredTelemetry(value)).toBeNull()
  })

  it('drops malformed events but keeps the good ones', () => {
    const parsed = parseStoredTelemetry({
      version: 1,
      keystrokes: [
        [100, 0, 'a'],
        ['not a number', 1, 'b'],
        [200, 1, 'b'],
        [300, -1, 'c'],
        null,
      ],
    })

    // A partial keystroke log is still worth having.
    expect(parsed?.keystrokes).toEqual([
      [100, 0, 'a'],
      [200, 1, 'b'],
    ])
  })
})

describe('storage cost', () => {
  it('stays within the documented budget per thousand characters', () => {
    // A thousand characters at a realistic error rate.
    const text = 'the quick brown fox '.repeat(50)
    const script: string[] = []
    Array.from(text).forEach((character, index) => {
      if (index > 0 && index % 40 === 0) {
        script.push('X', 'Backspace')
      }
      script.push(character)
    })

    const { keystrokes } = run(text, script, 90)
    const bytes = JSON.stringify(encodeTelemetry(keystrokes)).length

    expect(keystrokes.length).toBeGreaterThan(1_000)
    expect(bytes / keystrokes.length).toBeLessThan(
      STORAGE_COST.approximateBytesPerEvent + 4,
    )
    // The documented figure is per 1,000 characters typed.
    expect(bytes).toBeLessThan(STORAGE_COST.approximateBytesPerThousandCharacters * 1.3)
  })

  it('is far smaller than the enriched form it rebuilds', () => {
    const text = 'the quick brown fox '.repeat(10)
    const { keystrokes, telemetry } = run(text, Array.from(text), 90)

    const compact = JSON.stringify(encodeTelemetry(keystrokes)).length
    const enriched = JSON.stringify(telemetry.keystrokes).length

    expect(compact * 5).toBeLessThan(enriched)
  })
})

describe('telemetry repository', () => {
  let adapter: StorageAdapter

  beforeEach(() => {
    adapter = createMemoryAdapter()
  })

  const someTelemetry = () => encodeTelemetry(run('abc', ['a', 'b', 'c']).keystrokes)

  it('saves and reads telemetry back', async () => {
    const repository = createTelemetryRepository(adapter)
    const telemetry = someTelemetry()

    await repository.save(sessionId('one'), telemetry)

    await expect(repository.getById(sessionId('one'))).resolves.toEqual(telemetry)
  })

  it('returns null for a session that has none', async () => {
    const repository = createTelemetryRepository(adapter)

    await expect(repository.getById(sessionId('absent'))).resolves.toBeNull()
  })

  it('removes telemetry for one session', async () => {
    const repository = createTelemetryRepository(adapter)
    await repository.save(sessionId('one'), someTelemetry())

    await repository.remove(sessionId('one'))

    await expect(repository.getById(sessionId('one'))).resolves.toBeNull()
    await expect(repository.listIds()).resolves.toEqual([])
  })

  it('clears everything', async () => {
    const repository = createTelemetryRepository(adapter)
    await repository.save(sessionId('one'), someTelemetry())
    await repository.save(sessionId('two'), someTelemetry())

    await repository.clear()

    await expect(repository.listIds()).resolves.toEqual([])
    await expect(repository.getById(sessionId('one'))).resolves.toBeNull()
  })

  it('keeps only the most recent sessions', async () => {
    const repository = createTelemetryRepository(adapter, { retentionLimit: 3 })

    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      // Sequential on purpose: retention is about the order they arrived in.
      // eslint-disable-next-line no-await-in-loop
      await repository.save(sessionId(id), someTelemetry())
    }

    await expect(repository.listIds()).resolves.toEqual(['c', 'd', 'e'])
    // The evicted blobs are gone, not merely unlisted.
    await expect(repository.getById(sessionId('a'))).resolves.toBeNull()
    await expect(repository.getById(sessionId('e'))).resolves.not.toBeNull()
  })

  it('does not lose entries when several are saved at once', async () => {
    const repository = createTelemetryRepository(adapter)

    await Promise.all(
      ['a', 'b', 'c', 'd'].map((id) => repository.save(sessionId(id), someTelemetry())),
    )

    await expect(repository.listIds()).resolves.toHaveLength(4)
  })

  it('survives a blob that is not telemetry', async () => {
    const repository = createTelemetryRepository(adapter)
    await adapter.write('telemetry:one', { rubbish: true })

    await expect(repository.getById(sessionId('one'))).resolves.toBeNull()
  })
})

describe('telemetry service', () => {
  const createService = () =>
    createTelemetryService(createTelemetryRepository(createMemoryAdapter()))

  it('captures a finished session and gives it back derived', async () => {
    const service = createService()
    const { result } = run('ab cd', ['a', 'x', 'Backspace', 'b', ' ', 'c', 'd'])
    if (result === null) throw new Error('expected a completed session')

    await service.save(result.id, service.capture(result))
    const telemetry = await service.getBySessionId(result.id, result.target.text)

    expect(telemetry?.summary.characterKeystrokes).toBe(6)
    expect(telemetry?.corrections[0]).toMatchObject({
      typedKey: 'x',
      outcome: 'corrected',
    })
    expect(telemetry?.words[1]?.text).toBe('cd')
  })

  it('returns null for a session recorded before telemetry existed', async () => {
    const service = createService()

    // The case every session already on disk is in.
    await expect(
      service.getBySessionId(sessionId('older-session'), 'hello world'),
    ).resolves.toBeNull()
  })

  it('captures without touching storage', () => {
    const service = createService()
    const { result } = run('ab', ['a', 'b'])
    if (result === null) throw new Error('expected a completed session')

    // Pure: the packed form is available before anything is written, which is
    // what lets the save be fired and forgotten.
    expect(service.capture(result).keystrokes).toHaveLength(2)
  })
})

describe('the engine is unaffected', () => {
  it('reports the same result whether or not telemetry is derived', () => {
    const script = ['h', 'x', 'Backspace', 'e', 'l', 'l', 'o']

    const plain = run('hello', script).result
    const observed = run('hello', script)
    deriveSessionTelemetry(observed.keystrokes, 'hello')
    encodeTelemetry(observed.keystrokes)

    // Everything but the id, which is a fresh random value per engine.
    expect(observed.result?.metrics).toEqual(plain?.metrics)
    expect(observed.result?.keystrokes).toEqual(plain?.keystrokes)
    expect(observed.result?.durationMs).toEqual(plain?.durationMs)
    expect(observed.result?.status).toEqual(plain?.status)
  })

  it('does not alter the keystroke log it reads', () => {
    const { keystrokes } = run('hello', ['h', 'e'])
    const before: readonly Keystroke[] = keystrokes.map((k) => ({ ...k }))

    deriveSessionTelemetry(keystrokes, 'hello')
    encodeTelemetry(keystrokes)

    expect(keystrokes).toEqual(before)
  })

  it('leaves speed and accuracy exactly as the engine computed them', () => {
    const { result, telemetry } = run('hello world', [
      'h',
      'e',
      'l',
      'l',
      'o',
      ' ',
      'w',
      'o',
      'r',
      'l',
      'd',
    ])

    expect(result?.metrics.accuracy).toBe(1)
    expect(result?.metrics.netWpm).toBeCloseTo(120, 10)
    // Telemetry counted the same events, without changing them.
    expect(telemetry.summary.characterKeystrokes).toBe(result?.metrics.typedCharacters)
  })
})

describe('large sessions', () => {
  it('handles a long session without losing anything', () => {
    const text = 'the quick brown fox jumps over the lazy dog '.repeat(25)
    const script = Array.from(text)

    const { keystrokes, telemetry } = run(text, script, 85)

    expect(keystrokes.length).toBeGreaterThan(1_000)
    expect(telemetry.keystrokes).toHaveLength(keystrokes.length)
    expect(telemetry.words.length).toBe(Array.from(text.trim().split(/\s+/u)).length)

    const times = telemetry.keystrokes.map((k) => k.at)
    expect([...times].sort((a, b) => a - b)).toEqual(times)
  })

  it('round-trips a long session exactly', () => {
    const text = 'the quick brown fox '.repeat(30)
    const { keystrokes } = run(text, Array.from(text), 85)

    expect(decodeTelemetry(encodeTelemetry(keystrokes), text)).toEqual(keystrokes)
  })
})

describe('character coverage', () => {
  it('preserves the exact characters typed, for later sequence analysis', () => {
    const text = 'ab, cd.'
    const { telemetry } = run(text, Array.from(text))

    // Every code point of the target is accounted for, in order — which is what
    // makes digraph and trigraph analysis possible later without storing them.
    expect(telemetry.keystrokes.map((k) => k.key).join('')).toBe(text)
    expect(telemetry.keystrokes.map((k) => k.expected).join('')).toBe(text)
    expect(characters(text)).toHaveLength(telemetry.keystrokes.length)
  })
})

describe('word-wise deletion', () => {
  /**
   * Types a script in which 'CtrlBackspace' means a word-wise delete, at the
   * same fixed pace as `run` above, so every latency below is checkable by hand.
   */
  const runWithWordDelete = (text: string, script: readonly string[], step = 100) => {
    const engine = createTypingEngine()
    engine.start(target(text), timestamp(0))

    script.forEach((key, index) => {
      const at = timestamp((index + 1) * step)
      if (key === 'CtrlBackspace') engine.deleteWord(at)
      else engine.input(key, at)
    })

    return deriveSessionTelemetry(engine.getSnapshot().keystrokes, text)
  }

  it('credits the deletion to every position it cleared', () => {
    // "hello wxr", then one Ctrl+Backspace clearing w, x and r together.
    const telemetry = runWithWordDelete('hello world', [
      'h', 'e', 'l', 'l', 'o', ' ', 'w', 'x', 'r', 'CtrlBackspace',
    ])

    const [error] = telemetry.corrections
    expect(telemetry.corrections).toHaveLength(1)
    expect(error?.index).toBe(7)

    // The error sat inside the span, not at the index the deletion landed on.
    // Counting only that index would leave this at zero and never-noticed.
    expect(error?.backspaces).toBe(1)
    expect(error?.firstBackspaceAt).toBe(1000)
    expect(error?.detectionLatencyMs).toBe(200)
  })

  it('leaves a single backspace behaving exactly as before', () => {
    // The generalisation must not change the one-character case: the same
    // script through a plain backspace gives the same figures.
    const telemetry = runWithWordDelete('hello world', [
      'h', 'e', 'l', 'l', 'o', ' ', 'x', 'Backspace',
    ])

    const [error] = telemetry.corrections
    expect(error?.index).toBe(6)
    expect(error?.backspaces).toBe(1)
    expect(error?.firstBackspaceAt).toBe(800)
    expect(error?.detectionLatencyMs).toBe(100)
  })

  it('does not credit positions the deletion never reached', () => {
    // Two errors, one inside the deleted word and one in an earlier word that
    // the deletion stopped short of.
    const telemetry = runWithWordDelete('hello world', [
      'h', 'e', 'l', 'x', 'o', ' ', 'w', 'x', 'r', 'CtrlBackspace',
    ])

    const earlier = telemetry.corrections.find((entry) => entry.index === 3)
    const inside = telemetry.corrections.find((entry) => entry.index === 7)

    expect(earlier?.backspaces).toBe(0)
    expect(earlier?.firstBackspaceAt).toBeNull()
    expect(inside?.backspaces).toBe(1)
  })

  it('counts one backspace, not one per character removed', () => {
    const telemetry = runWithWordDelete('hello world', [
      'h', 'e', 'l', 'l', 'o', ' ', 'w', 'o', 'r', 'CtrlBackspace',
    ])

    // Nine characters and one deletion. Recording three would overstate both
    // this count and the correction counts that read from it.
    expect(telemetry.summary.backspaceCount).toBe(1)
    expect(telemetry.summary.characterKeystrokes).toBe(9)
    expect(telemetry.summary.keystrokeCount).toBe(10)
  })

  it('leaves no zero-millisecond gaps in the rhythm', () => {
    const telemetry = runWithWordDelete('hello world', [
      'h', 'e', 'l', 'l', 'o', ' ', 'w', 'o', 'r', 'CtrlBackspace', 'w',
    ])

    const gaps = telemetry.keystrokes
      .map((keystroke) => keystroke.interKeystrokeMs)
      .filter((gap): gap is number => gap !== null)

    // The whole argument for one event per key press: synthetic events sharing
    // a timestamp would show up here as a run of zeros.
    expect(gaps).not.toContain(0)
    expect(gaps.every((gap) => gap === 100)).toBe(true)
  })

  it('survives the round trip through storage unchanged', () => {
    const script = ['h', 'e', 'l', 'l', 'o', ' ', 'w', 'x', 'r', 'CtrlBackspace', 'w']
    const engine = createTypingEngine()
    engine.start(target('hello world'), timestamp(0))
    script.forEach((key, index) => {
      const at = timestamp((index + 1) * 100)
      if (key === 'CtrlBackspace') engine.deleteWord(at)
      else engine.input(key, at)
    })

    const live = engine.getSnapshot().keystrokes
    const restored = decodeTelemetry(encodeTelemetry(live), 'hello world')

    // The stored form keeps the index the deletion landed on, which is all the
    // span needs — so no format change and no version bump.
    expect(restored).toEqual(live)
    expect(deriveSessionTelemetry(restored, 'hello world').corrections).toEqual(
      deriveSessionTelemetry(live, 'hello world').corrections,
    )
  })

  it('does not let a deleted pair count as a clean transition', () => {
    const telemetry = runWithWordDelete('hello world', [
      'h', 'e', 'l', 'l', 'o', ' ', 'w', 'o', 'r', 'CtrlBackspace', 'w', 'o',
    ])

    const sequences = analyseSlowSequences(telemetry, { minimumObservations: 1 })
    const counted = sequences.ranked.map((entry) => entry.sequence)

    // Nothing spans the deletion. The last character before it was 'r' at 8 and
    // the first after it 'w' at 6, which is neither adjacent in the log nor a
    // consecutive position, so no phantom transition is invented across it.
    expect(counted).not.toContain('rw')
    expect(counted).not.toContain('ow')

    // The retyped 'wo' does count a second time, and should: the typist really
    // did make that movement twice, and the interval between the two keys was
    // really measured. Re-typing known text may well be faster than typing it
    // cold, which is a confound this shares with every correction — and a
    // reason the single-session ranking was never trustworthy on its own.
    expect(sequences.ranked.find((entry) => entry.sequence === 'wo')?.observations).toBe(2)
  })
})

describe('word-synchronised input in telemetry', () => {
  it('records an extra at the boundary and credits the backspace that removes it', () => {
    // "thee cat": the second e is an extra on the space at index 3, removed by
    // one backspace, then the space is typed correctly.
    const { telemetry } = run('the cat', ['t', 'h', 'e', 'e', 'Backspace', ' ', 'c', 'a', 't'])

    expect(telemetry.corrections).toHaveLength(1)
    const [extra] = telemetry.corrections
    expect(extra?.index).toBe(3)
    expect(extra?.typedKey).toBe('e')
    expect(extra?.expectedKey).toBe(' ')
    expect(extra?.backspaces).toBe(1)
    expect(extra?.outcome).toBe('corrected')
  })

  it('records an early space as one error at the letter it replaced', () => {
    const { telemetry } = run('quick fox', ['q', 'u', 'i', ' ', 'f', 'o', 'x'])

    expect(telemetry.corrections).toHaveLength(1)
    expect(telemetry.corrections[0]).toMatchObject({ index: 3, typedKey: ' ', expectedKey: 'c', outcome: 'uncorrected' })
    expect(telemetry.summary.characterKeystrokes).toBe(7)
  })

  it('credits backspaces that walk back into missed letters', () => {
    // Early space after "qui", then three backspaces reach the c, which is
    // retyped: the error at index 3 was noticed and put right.
    const { telemetry } = run('quick fox', ['q', 'u', 'i', ' ', 'Backspace', 'Backspace', 'Backspace', 'c', 'k', ' ', 'f', 'o', 'x'])

    const [early] = telemetry.corrections
    expect(early?.index).toBe(3)
    expect(early?.backspaces).toBe(1)
    expect(early?.outcome).toBe('corrected')
  })

  it('keeps the next word fully measurable after a contained error', () => {
    // An extra in "thee" must not stop "cat" contributing clean transitions.
    const { telemetry } = run('the cat', ['t', 'h', 'e', 'e', ' ', 'c', 'a', 't'])
    const clean = analyseSlowSequences(telemetry, { minimumObservations: 1 })
      .ranked.map((entry) => entry.sequence)
      .sort()

    // th and he from "the"; ca and at from "cat". Nothing paired across the extra.
    expect(clean).toEqual(['at', 'ca', 'he', 'th'])
  })

  it('does not pair a transition across a skipped word', () => {
    const { telemetry } = run('quick fox', ['q', 'u', 'i', ' ', 'f', 'o', 'x'])
    const clean = analyseSlowSequences(telemetry, { minimumObservations: 1 })
      .ranked.map((entry) => entry.sequence)
      .sort()

    expect(clean).toEqual(['fo', 'ox', 'qu', 'ui'])
  })

  it('survives the storage round trip unchanged', () => {
    const script = ['t', 'h', 'e', 'e', 'e', 'Backspace', ' ', 'c', 'a', ' ', 'd', 'o', 'g']
    const { keystrokes } = run('the cat dog', script)

    const restored = decodeTelemetry(encodeTelemetry(keystrokes), 'the cat dog')

    expect(restored).toEqual(keystrokes)
    expect(deriveSessionTelemetry(restored, 'the cat dog')).toEqual(
      deriveSessionTelemetry(keystrokes, 'the cat dog'),
    )
  })
})

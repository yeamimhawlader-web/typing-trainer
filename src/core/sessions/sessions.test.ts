/**
 * Session persistence tests.
 *
 * The repository is exercised over both a real `localStorage` adapter and an
 * in-memory one, because the point of the abstraction is that it does not care
 * which is underneath. Storage failure and corrupt records are tested
 * explicitly: both are things that happen to real browsers, and neither is
 * allowed to take the application down.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createLocalStorageAdapter,
  createMemoryAdapter,
  withNamespace,
  type StorageAdapter,
} from '@core/persistence'
import {
  accuracy,
  milliseconds,
  sessionId,
  timestamp,
  wpm,
  type SessionResult,
} from '@core/types'

import { DEFAULT_SESSION_CONTEXT } from './defaults.ts'
import { createTypingSession } from './factory.ts'
import { createSessionRepository } from './repository.ts'
import { createSessionService, DEFAULT_RECENT_LIMIT } from './service.ts'
import type { TypingSession } from './types.ts'
import { InvalidSessionError, parseTypingSession } from './validation.ts'

const makeSession = (overrides: Partial<TypingSession> = {}): TypingSession => ({
  id: sessionId('session-1'),
  startedAt: timestamp(1_000),
  completedAt: timestamp(2_000),
  durationMs: milliseconds(1_000),
  text: 'hello world',
  textSourceId: 'test',
  context: DEFAULT_SESSION_CONTEXT,
  metrics: {
    netWpm: wpm(120),
    rawWpm: wpm(125),
    accuracy: accuracy(0.97),
    totalCharacters: 11,
    typedCharacters: 11,
    correctCharacters: 11,
    incorrectCharacters: 0,
    correctedCharacters: 0,
    errorCount: 1,
  },
  status: 'completed',
  ...overrides,
})

/** Distinct sessions, oldest first. */
const makeSeries = (count: number): TypingSession[] =>
  Array.from({ length: count }, (_unused, index) =>
    makeSession({
      id: sessionId(`session-${index}`),
      completedAt: timestamp(1_000 + index * 1_000),
    }),
  )

const adapters: ReadonlyArray<readonly [string, () => StorageAdapter]> = [
  ['memory', createMemoryAdapter],
  [
    'localStorage',
    () =>
      withNamespace(createLocalStorageAdapter(), { namespace: 'tt', schemaVersion: 1 }),
  ],
]

describe.each(adapters)('SessionRepository over %s', (_name, createAdapter) => {
  let repository: ReturnType<typeof createSessionRepository>

  beforeEach(async () => {
    window.localStorage.clear()
    repository = createSessionRepository(createAdapter())
    await repository.clear()
  })

  it('saves a session and reads it back by id', async () => {
    const session = makeSession()

    await repository.save(session)

    await expect(repository.getById(session.id)).resolves.toEqual(session)
  })

  it('returns null for an id that was never saved', async () => {
    await expect(repository.getById(sessionId('absent'))).resolves.toBeNull()
  })

  it('returns every saved session, newest first', async () => {
    await Promise.all(makeSeries(3).map((session) => repository.save(session)))

    const all = await repository.getAll()

    expect(all.map((session) => session.id)).toEqual([
      'session-2',
      'session-1',
      'session-0',
    ])
  })

  it('returns only the most recent when asked for a limit', async () => {
    await Promise.all(makeSeries(5).map((session) => repository.save(session)))

    const recent = await repository.getRecent(2)

    expect(recent.map((session) => session.id)).toEqual(['session-4', 'session-3'])
  })

  it('returns nothing for a non-positive limit', async () => {
    await repository.save(makeSession())

    await expect(repository.getRecent(0)).resolves.toEqual([])
    await expect(repository.getRecent(-3)).resolves.toEqual([])
  })

  it('orders by completion time rather than insertion order', async () => {
    const older = makeSession({ id: sessionId('older'), completedAt: timestamp(1_000) })
    const newer = makeSession({ id: sessionId('newer'), completedAt: timestamp(9_000) })

    await repository.save(newer)
    await repository.save(older)

    expect((await repository.getAll()).map((session) => session.id)).toEqual([
      'newer',
      'older',
    ])
  })

  it('replaces a session saved twice rather than duplicating it', async () => {
    const session = makeSession()
    await repository.save(session)

    await repository.save({ ...session, text: 'updated text' })

    const all = await repository.getAll()
    expect(all).toHaveLength(1)
    expect(all[0]?.text).toBe('updated text')
  })

  it('keeps every session when several are saved at once', async () => {
    // Each save rewrites the index. Without serialisation inside the
    // repository, overlapping saves would each read the same starting index
    // and write back their own version — losing all but the last from the
    // listing while the records themselves sat there unreferenced.
    await Promise.all(makeSeries(10).map((session) => repository.save(session)))

    const all = await repository.getAll()

    expect(all).toHaveLength(10)
    expect(all[0]?.id).toBe('session-9')
    expect(all[9]?.id).toBe('session-0')
  })

  it('deletes a session', async () => {
    const [first, second] = makeSeries(2)
    await repository.save(first as TypingSession)
    await repository.save(second as TypingSession)

    await repository.remove(sessionId('session-0'))

    await expect(repository.getById(sessionId('session-0'))).resolves.toBeNull()
    expect((await repository.getAll()).map((s) => s.id)).toEqual(['session-1'])
  })

  it('treats deleting an absent session as a no-op', async () => {
    await expect(repository.remove(sessionId('never-existed'))).resolves.toBeUndefined()
  })

  it('clears everything', async () => {
    await Promise.all(makeSeries(3).map((session) => repository.save(session)))

    await repository.clear()

    await expect(repository.getAll()).resolves.toEqual([])
    await expect(repository.getById(sessionId('session-0'))).resolves.toBeNull()
  })

  it('rejects rather than throwing, so a caller can attach a handler', () => {
    const broken = { ...makeSession(), text: '' } as unknown as TypingSession

    // A synchronous throw from a promise-returning method would escape any
    // `.catch()` the caller attached, which is exactly how the typing screen
    // keeps a storage failure from reaching the typist.
    const attempt = () => repository.save(broken).catch(() => 'handled')

    expect(attempt).not.toThrow()
    return expect(attempt()).resolves.toBe('handled')
  })

  it('refuses to save a malformed session', async () => {
    const broken = {
      ...makeSession(),
      metrics: { netWpm: 1 },
    } as unknown as TypingSession

    await expect(repository.save(broken)).rejects.toBeInstanceOf(InvalidSessionError)
  })

  it('survives a record that is not a session at all', async () => {
    const adapter = createAdapter()
    const repo = createSessionRepository(adapter)
    await repo.save(makeSession())
    // Something else wrote nonsense over the record.
    await adapter.write('session:session-1', { not: 'a session' })

    await expect(repo.getById(sessionId('session-1'))).resolves.toBeNull()
    await expect(repo.getAll()).resolves.toEqual([])
  })

  it('skips a corrupt record but still returns the good ones', async () => {
    const adapter = createAdapter()
    const repo = createSessionRepository(adapter)
    await Promise.all(makeSeries(3).map((session) => repo.save(session)))

    await adapter.write('session:session-1', { rubbish: true })

    const all = await repo.getAll()
    expect(all.map((session) => session.id)).toEqual(['session-2', 'session-0'])
  })

  it('rebuilds a corrupt index from the records instead of hiding them', async () => {
    // This test used to assert that a corrupt index made history read as empty
    // while the record sat untouched — the exact behaviour that let the next
    // save orphan it for good. Records are the history; the index is rebuilt.
    const adapter = createAdapter()
    const repo = createSessionRepository(adapter)
    await repo.save(makeSession())

    await adapter.write('session-index', 'not an array')

    expect((await repo.getAll()).map((session) => session.id)).toEqual(['session-1'])
    await expect(adapter.read('session-index')).resolves.toEqual([
      { id: 'session-1', completedAt: makeSession().completedAt },
    ])
  })

  it('drops index entries whose record has gone missing', async () => {
    const adapter = createAdapter()
    const repo = createSessionRepository(adapter)
    await Promise.all(makeSeries(2).map((session) => repo.save(session)))

    await adapter.remove('session:session-0')

    expect((await repo.getAll()).map((session) => session.id)).toEqual(['session-1'])
  })
})

describe('persistence failure', () => {
  /** A store that accepts reads and refuses every write. */
  const createFailingAdapter = (): StorageAdapter => {
    const inner = createMemoryAdapter()
    return {
      ...inner,
      write: () => Promise.reject(new Error('quota exceeded')),
    }
  }

  it('surfaces a write failure rather than pretending to have saved', async () => {
    const repository = createSessionRepository(createFailingAdapter())

    await expect(repository.save(makeSession())).rejects.toThrow('quota exceeded')
  })

  it('leaves reads working when writes fail', async () => {
    const repository = createSessionRepository(createFailingAdapter())

    await expect(repository.getAll()).resolves.toEqual([])
    await expect(repository.getById(sessionId('anything'))).resolves.toBeNull()
  })
})

describe('surviving a page refresh', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('reads back sessions written by a previous page load', async () => {
    const namespace = { namespace: 'typing-trainer', schemaVersion: 1 }

    // First visit.
    const first = createSessionRepository(
      withNamespace(createLocalStorageAdapter(), namespace),
    )
    await Promise.all(makeSeries(3).map((session) => first.save(session)))

    // A refresh: everything in memory is gone, storage is not.
    const second = createSessionRepository(
      withNamespace(createLocalStorageAdapter(), namespace),
    )

    const all = await second.getAll()
    expect(all).toHaveLength(3)
    expect(all.map((session) => session.id)).toEqual([
      'session-2',
      'session-1',
      'session-0',
    ])
    expect(all[0]?.metrics.netWpm).toBe(120)
  })

  it('keeps a deletion across a refresh', async () => {
    const namespace = { namespace: 'typing-trainer', schemaVersion: 1 }
    const first = createSessionRepository(
      withNamespace(createLocalStorageAdapter(), namespace),
    )
    await Promise.all(makeSeries(2).map((session) => first.save(session)))
    await first.remove(sessionId('session-0'))

    const second = createSessionRepository(
      withNamespace(createLocalStorageAdapter(), namespace),
    )

    expect((await second.getAll()).map((session) => session.id)).toEqual(['session-1'])
  })
})

describe('createTypingSession', () => {
  const result: SessionResult = {
    id: sessionId('from-engine'),
    // The engine's clock is page-relative, not wall clock.
    startedAt: timestamp(4_200),
    durationMs: milliseconds(7_500),
    target: { text: 'one two', sourceId: 'common-words' },
    keystrokes: [],
    metrics: {
      netWpm: wpm(90),
      rawWpm: wpm(95),
      accuracy: accuracy(0.9),
      totalCharacters: 7,
      typedCharacters: 8,
      correctCharacters: 7,
      incorrectCharacters: 0,
      correctedCharacters: 1,
      errorCount: 1,
    },
    status: 'completed',
  }

  it('carries the engine metrics across untouched', () => {
    const session = createTypingSession({
      result,
      context: DEFAULT_SESSION_CONTEXT,
      completedAt: timestamp(1_700_000_000_000),
    })

    expect(session.metrics).toBe(result.metrics)
  })

  it('dates the session by wall clock, not the engine clock', () => {
    const completedAt = timestamp(1_700_000_000_000)

    const session = createTypingSession({
      result,
      context: DEFAULT_SESSION_CONTEXT,
      completedAt,
    })

    expect(session.completedAt).toBe(completedAt)
    // Derived from completion and duration, so it is a real date too.
    expect(session.startedAt).toBe(1_700_000_000_000 - 7_500)
  })

  it('never produces a negative start time', () => {
    const session = createTypingSession({
      result,
      context: DEFAULT_SESSION_CONTEXT,
      completedAt: timestamp(100),
    })

    expect(session.startedAt).toBe(0)
  })

  it('records the text and its source', () => {
    const session = createTypingSession({
      result,
      context: DEFAULT_SESSION_CONTEXT,
      completedAt: timestamp(1_000),
    })

    expect(session.text).toBe('one two')
    expect(session.textSourceId).toBe('common-words')
  })

  it('produces a session that validates', () => {
    const session = createTypingSession({
      result,
      context: DEFAULT_SESSION_CONTEXT,
      completedAt: timestamp(1_000),
    })

    expect(parseTypingSession(session)).not.toBeNull()
  })
})

describe('parseTypingSession', () => {
  it('accepts a well-formed session', () => {
    expect(parseTypingSession(makeSession())).not.toBeNull()
  })

  it.each([
    ['null', null],
    ['a string', 'session'],
    ['an array', []],
    ['a number', 7],
  ])('rejects %s', (_label, value) => {
    expect(parseTypingSession(value)).toBeNull()
  })

  it.each([
    ['id', { id: '' }],
    ['text', { text: '' }],
    ['status', { status: 'running' }],
    ['completedAt', { completedAt: -1 }],
    ['durationMs', { durationMs: Number.NaN }],
    ['context', { context: { mode: 'nonsense' } }],
    ['metrics', { metrics: { netWpm: 1 } }],
  ])('rejects a session with a bad %s', (_field, patch) => {
    expect(parseTypingSession({ ...makeSession(), ...patch })).toBeNull()
  })

  it('rejects an accuracy above 1', () => {
    const session = makeSession()
    const broken = { ...session, metrics: { ...session.metrics, accuracy: 1.5 } }

    expect(parseTypingSession(broken)).toBeNull()
  })

  it('accepts a Hover Mode session and its focus records', () => {
    const session = makeSession()
    const hover = {
      ...session,
      context: {
        ...session.context,
        mode: 'hover',
        hover: {
          focuses: [
            { word: 'brown', wordIndex: 2, required: 6, successes: 6, failures: 1, completed: true, limitReached: false, focusMs: 5_400 },
          ],
        },
      },
    }

    expect(parseTypingSession(hover)).not.toBeNull()
    expect(parseTypingSession({ ...hover, context: { ...hover.context, hover: { focuses: [] } } })).not.toBeNull()
  })

  it.each([
    ['not an object', 'focus'],
    ['focuses missing', {}],
    ['a focus without its word', { focuses: [{ wordIndex: 0, required: 3, successes: 3, failures: 0, completed: true, limitReached: false, focusMs: 1 }] }],
    ['a negative count', { focuses: [{ word: 'fox', wordIndex: 0, required: 3, successes: -1, failures: 0, completed: true, limitReached: false, focusMs: 1 }] }],
    ['a completion that is not a boolean', { focuses: [{ word: 'fox', wordIndex: 0, required: 3, successes: 3, failures: 0, completed: 'yes', limitReached: false, focusMs: 1 }] }],
  ])('rejects a Hover Mode record with %s', (_label, record) => {
    const session = makeSession()

    expect(parseTypingSession({ ...session, context: { ...session.context, mode: 'hover', hover: record } })).toBeNull()
  })

  it('rejects an unknown keyboard layout', () => {
    const session = makeSession()
    const broken = {
      ...session,
      context: { ...session.context, keyboardLayout: 'azerty' },
    }

    expect(parseTypingSession(broken)).toBeNull()
  })
})

describe('SessionService', () => {
  const createService = () =>
    createSessionService(createSessionRepository(createMemoryAdapter()))

  it('exposes exactly the seven operations the UI needs', () => {
    // `count` was added so the history page can say how many tests exist when
    // it lists only the most recent, instead of calling a page of fifty the
    // whole history.
    expect(Object.keys(createService()).sort()).toEqual([
      'clear',
      'count',
      'getAll',
      'getById',
      'getRecent',
      'remove',
      'save',
    ])
  })

  it('saves and reads back through the service', async () => {
    const service = createService()
    const session = makeSession()

    await service.save(session)

    await expect(service.getById(session.id)).resolves.toEqual(session)
    await expect(service.getAll()).resolves.toEqual([session])
  })

  it('applies a default limit when none is given', async () => {
    const repository = createSessionRepository(createMemoryAdapter())
    const getRecent = vi.spyOn(repository, 'getRecent')
    const service = createSessionService(repository)

    await service.getRecent()

    expect(getRecent).toHaveBeenCalledWith(DEFAULT_RECENT_LIMIT)
  })

  it('passes an explicit limit straight through', async () => {
    const repository = createSessionRepository(createMemoryAdapter())
    const getRecent = vi.spyOn(repository, 'getRecent')
    const service = createSessionService(repository)

    await service.getRecent(5)

    expect(getRecent).toHaveBeenCalledWith(5)
  })

  it('clears through the service', async () => {
    const service = createService()
    await service.save(makeSession())

    await service.clear()

    await expect(service.getAll()).resolves.toEqual([])
  })
})

describe.each(adapters)('index recovery over %s', (_name, createAdapter) => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  /** Writes records directly, the way they would sit after an index was lost. */
  const writeRecords = async (adapter: StorageAdapter, sessions: readonly TypingSession[]) => {
    await Promise.all(sessions.map((session) => adapter.write(`session:${session.id}`, session)))
  }

  it('rebuilds a missing index from the records present, newest first', async () => {
    const adapter = createAdapter()
    await writeRecords(adapter, makeSeries(3))
    const repo = createSessionRepository(adapter)

    expect((await repo.getAll()).map((s) => s.id)).toEqual(['session-2', 'session-1', 'session-0'])
  })

  it('rebuilds an index that is present but not a list', async () => {
    const adapter = createAdapter()
    await writeRecords(adapter, makeSeries(2))
    await adapter.write('session-index', { broken: true })

    const repo = createSessionRepository(adapter)
    expect(await repo.getAll()).toHaveLength(2)
  })

  it('keeps valid entries and recovers the rest when an index is partly damaged', async () => {
    const adapter = createAdapter()
    await writeRecords(adapter, makeSeries(3))
    await adapter.write('session-index', [
      { id: 'session-2', completedAt: 3_000 },
      'garbage',
      { id: 42 },
    ])

    const repo = createSessionRepository(adapter)
    expect((await repo.getAll()).map((s) => s.id)).toEqual(['session-2', 'session-1', 'session-0'])
  })

  it('puts back records a valid index has lost track of', async () => {
    const adapter = createAdapter()
    const repo = createSessionRepository(adapter)
    await Promise.all(makeSeries(2).map((s) => repo.save(s)))
    // A third record exists on disk that the index never heard of.
    await writeRecords(adapter, [makeSession({ id: sessionId('orphan'), completedAt: timestamp(9_000) })])

    expect((await repo.getAll()).map((s) => s.id)).toEqual(['orphan', 'session-1', 'session-0'])
  })

  it('ignores malformed records rather than guessing at them', async () => {
    const adapter = createAdapter()
    await writeRecords(adapter, makeSeries(2))
    await adapter.write('session:broken', { id: 'broken', metrics: 'nonsense' })
    await adapter.write('session-index', 'not an array')

    const repo = createSessionRepository(adapter)
    expect((await repo.getAll()).map((s) => s.id)).toEqual(['session-1', 'session-0'])
    expect(JSON.stringify(await adapter.read('session-index'))).not.toContain('broken')
  })

  it('never lets a save after corruption orphan the existing history', async () => {
    // The audit's scenario exactly: a corrupt index, then one more test saved.
    // Before recovery, that save wrote an index of one and stranded the rest.
    const adapter = createAdapter()
    const repo = createSessionRepository(adapter)
    await Promise.all(makeSeries(3).map((s) => repo.save(s)))

    await adapter.write('session-index', 'this is not an array')
    await repo.save(makeSession({ id: sessionId('new'), completedAt: timestamp(10_000) }))

    expect((await repo.getAll()).map((s) => s.id)).toEqual(['new', 'session-2', 'session-1', 'session-0'])
  })

  it('writes nothing when the index already matches the records', async () => {
    const adapter = createAdapter()
    const repo = createSessionRepository(adapter)
    await Promise.all(makeSeries(2).map((s) => repo.save(s)))

    const write = vi.spyOn(adapter, 'write')
    await repo.getAll()
    await repo.getRecent(1)

    expect(write).not.toHaveBeenCalled()
  })

  it('still removes a recovered record when deleted', async () => {
    const adapter = createAdapter()
    await writeRecords(adapter, makeSeries(2))
    const repo = createSessionRepository(adapter)

    await repo.remove(sessionId('session-0'))

    expect((await repo.getAll()).map((s) => s.id)).toEqual(['session-1'])
  })
})

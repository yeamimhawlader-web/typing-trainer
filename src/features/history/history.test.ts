import { beforeEach, describe, expect, it } from 'vitest'

import { createMemoryAdapter } from '@core/persistence'
import {
  createSessionRepository,
  createSessionService,
  DEFAULT_SESSION_CONTEXT,
  type SessionService,
  type TypingSession,
} from '@core/sessions'
import { accuracy, milliseconds, sessionId, timestamp, wpm } from '@core/types'

import {
  formatAccuracy,
  formatDuration,
  formatMode,
  formatWpm,
} from '@features/results'
import { createHistoryStore } from './state/history.store.ts'

const makeSession = (index: number): TypingSession => ({
  id: sessionId(`session-${index}`),
  startedAt: timestamp(1_000 + index * 1_000),
  completedAt: timestamp(2_000 + index * 1_000),
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
})

describe('history store', () => {
  let service: SessionService

  beforeEach(() => {
    service = createSessionService(createSessionRepository(createMemoryAdapter()))
  })

  it('starts empty and idle', () => {
    const store = createHistoryStore(service)

    expect(store.getState().sessions).toEqual([])
    expect(store.getState().status).toBe('idle')
  })

  it('loads saved sessions, newest first', async () => {
    await Promise.all([0, 1, 2].map((index) => service.save(makeSession(index))))
    const store = createHistoryStore(service)

    await store.getState().load()

    expect(store.getState().status).toBe('ready')
    expect(store.getState().sessions.map((session) => session.id)).toEqual([
      'session-2',
      'session-1',
      'session-0',
    ])
  })

  it('reports ready with nothing in it when there is no history', async () => {
    const store = createHistoryStore(service)

    await store.getState().load()

    expect(store.getState().status).toBe('ready')
    expect(store.getState().sessions).toEqual([])
  })

  it('deletes a session and keeps the rest', async () => {
    await Promise.all([0, 1, 2].map((index) => service.save(makeSession(index))))
    const store = createHistoryStore(service)
    await store.getState().load()

    await store.getState().remove(sessionId('session-1'))

    expect(store.getState().sessions.map((session) => session.id)).toEqual([
      'session-2',
      'session-0',
    ])
    await expect(service.getById(sessionId('session-1'))).resolves.toBeNull()
  })

  it('clears the whole history', async () => {
    await Promise.all([0, 1].map((index) => service.save(makeSession(index))))
    const store = createHistoryStore(service)
    await store.getState().load()

    await store.getState().clear()

    expect(store.getState().sessions).toEqual([])
    await expect(service.getAll()).resolves.toEqual([])
  })

  it('reports a failure to load rather than showing an empty history', async () => {
    const broken: SessionService = {
      ...service,
      getRecent: () => Promise.reject(new Error('storage unavailable')),
    }
    const store = createHistoryStore(broken)

    await store.getState().load()

    // 'failed' and 'ready with nothing' look identical to a user otherwise,
    // and one of them is a lie.
    expect(store.getState().status).toBe('failed')
  })

  it('puts a session back when deleting it fails', async () => {
    await service.save(makeSession(0))
    const broken: SessionService = {
      ...service,
      remove: () => Promise.reject(new Error('storage unavailable')),
    }
    const store = createHistoryStore(broken)
    await store.getState().load()

    await store.getState().remove(sessionId('session-0'))

    expect(store.getState().sessions.map((session) => session.id)).toEqual([
      'session-0',
    ])
  })
})

describe('history formatting', () => {
  it('writes short durations in seconds', () => {
    expect(formatDuration(7_400)).toBe('7s')
    expect(formatDuration(59_000)).toBe('59s')
  })

  it('writes longer durations as minutes and seconds', () => {
    expect(formatDuration(60_000)).toBe('1:00')
    expect(formatDuration(95_000)).toBe('1:35')
    expect(formatDuration(605_000)).toBe('10:05')
  })

  it('never shows a negative duration', () => {
    expect(formatDuration(-500)).toBe('0s')
  })

  it('rounds speed and accuracy for display', () => {
    expect(formatWpm(119.6)).toBe('120')
    expect(formatAccuracy(0.974)).toBe('97%')
    expect(formatAccuracy(1)).toBe('100%')
  })

  it('labels the mode', () => {
    expect(formatMode(makeSession(0))).toBe('Words')
  })
})

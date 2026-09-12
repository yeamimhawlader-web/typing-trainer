/**
 * Deletion tests.
 *
 * The audit found the session detail page removing a session record while
 * leaving its keystroke detail in storage — still readable, still indexed.
 * These tests check the storage itself afterwards, not just what a service
 * reports, because a leak is by definition something no screen shows.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { createTypingEngine } from '@core/engine'
import { createMemoryAdapter, type StorageAdapter } from '@core/persistence'
import {
  createSessionServiceOver,
  createTypingSession,
  DEFAULT_SESSION_CONTEXT,
  type SessionService,
  type TypingSession,
} from '@core/sessions'
import { createTelemetryServiceOver, type TelemetryService } from '@core/telemetry'
import { sessionId, timestamp } from '@core/types'

import { createHistoryDeletion, type HistoryDeletion } from './deletion.ts'

let storage: StorageAdapter
let sessions: SessionService
let telemetry: TelemetryService
let deletion: HistoryDeletion

beforeEach(() => {
  storage = createMemoryAdapter()
  sessions = createSessionServiceOver(storage)
  telemetry = createTelemetryServiceOver(storage)
  deletion = createHistoryDeletion(sessions, telemetry)
})

/** Types a short test for real and stores it with its telemetry. */
const record = async (completedAt: number, withTelemetry = true): Promise<TypingSession> => {
  const engine = createTypingEngine()
  engine.start({ text: 'hello world', sourceId: 'test' }, timestamp(0))
  Array.from('hello world').forEach((key, index) => engine.input(key, timestamp((index + 1) * 90)))

  const result = engine.toResult()!
  const session = createTypingSession({
    result,
    context: DEFAULT_SESSION_CONTEXT,
    completedAt: timestamp(completedAt),
  })

  await sessions.save(session)
  if (withTelemetry) await telemetry.save(session.id, telemetry.capture(result))
  return session
}

const keysFor = async (id: string) =>
  (await storage.keys()).filter((key) => key.includes(id))

describe('deleting one session', () => {
  it('removes the record, its telemetry, and both index entries', async () => {
    const keep = await record(1_000)
    const gone = await record(2_000)

    await deletion.deleteSession(gone.id)

    // Nothing named after the deleted session is left anywhere in storage.
    expect(await keysFor(gone.id)).toEqual([])
    expect(JSON.stringify(await storage.read('session-index'))).not.toContain(gone.id)
    expect(JSON.stringify(await storage.read('telemetry-index'))).not.toContain(gone.id)

    // The other session is untouched.
    expect((await sessions.getAll()).map((s) => s.id)).toEqual([keep.id])
    expect(await telemetry.getStored(keep.id)).not.toBeNull()
  })

  it('deletes a session that never had telemetry', async () => {
    const session = await record(1_000, false)

    await deletion.deleteSession(session.id)

    expect(await sessions.getAll()).toEqual([])
  })

  it('treats an id that does not exist as nothing to do', async () => {
    const deleted = await deletion.deleteSession(sessionId('never-saved'))

    expect(deleted.sessions).toEqual([])
    expect(deleted.telemetry).toEqual([])
  })

  it('can be undone, restoring the record and the telemetry byte for byte', async () => {
    const session = await record(1_000)
    const storedBefore = await telemetry.getStored(session.id)

    const deleted = await deletion.deleteSession(session.id)
    await deletion.restore(deleted)

    expect(await sessions.getById(session.id)).toEqual(session)
    expect(await telemetry.getStored(session.id)).toEqual(storedBefore)
  })
})

describe('clearing all history', () => {
  it('removes every session and every telemetry blob, orphans included', async () => {
    await record(1_000)
    await record(2_000)
    // Telemetry with no session pointing at it — the audit's leaked detail.
    await telemetry.save(sessionId('leaked'), { version: 1, keystrokes: [[0, 0, 'h']] })

    await deletion.clearAll()

    const remaining = (await storage.keys()).filter(
      (key) => key.startsWith('session') || key.startsWith('telemetry'),
    )
    expect(remaining).toEqual([])
  })

  it('can be undone, putting every session and its telemetry back', async () => {
    const first = await record(1_000)
    const second = await record(2_000)

    const deleted = await deletion.clearAll()
    expect(deleted.sessions).toHaveLength(2)

    await deletion.restore(deleted)

    expect((await sessions.getAll()).map((s) => s.id)).toEqual([second.id, first.id])
    expect(await telemetry.getStored(first.id)).not.toBeNull()
    expect(await telemetry.getStored(second.id)).not.toBeNull()
  })
})

/**
 * Which sessions the cross-session analysis is allowed to look at.
 *
 * The ranking itself is covered in `@core/telemetry`. The question here is what
 * gets fed to it, and specifically that drills do not — their text is built to
 * be lopsided, so a handful of them would supply most of the observations for
 * whatever was drilled and the ranking would end up describing the drills
 * rather than the typing that prompted them.
 */

import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { createTypingEngine } from '@core/engine'
import { createMemoryAdapter, type StorageAdapter } from '@core/persistence'
import {
  createSessionServiceOver,
  createTypingSession,
  DEFAULT_SESSION_CONTEXT,
  type SessionContext,
  type SessionService,
  type TypingSession,
} from '@core/sessions'
import { createTimeRange } from '@core/statistics'
import { createTelemetryServiceOver, type TelemetryService } from '@core/telemetry'
import { timestamp } from '@core/types'

import { usePersistentSequences } from './hooks/usePersistentSequences.ts'

let storage: StorageAdapter
let sessions: SessionService
let telemetry: TelemetryService

beforeEach(() => {
  storage = createMemoryAdapter()
  sessions = createSessionServiceOver(storage)
  telemetry = createTelemetryServiceOver(storage)
})

/** Records a session, timing every "in" at `targetMs` and everything else at 80. */
const record = async (
  text: string,
  targetMs: number,
  context: SessionContext,
): Promise<TypingSession> => {
  const engine = createTypingEngine()
  engine.start({ text, sourceId: 'test' }, timestamp(0))

  const characters = Array.from(text)
  let at = 0
  characters.forEach((key, index) => {
    const pair = index === 0 ? '' : `${characters[index - 1] as string}${key}`
    at += index === 0 ? 0 : pair === 'in' ? targetMs : 80
    engine.input(key, timestamp(at))
  })

  const result = engine.toResult()
  const session = createTypingSession({
    result: result!,
    context,
    completedAt: timestamp(Date.now()),
  })

  await sessions.save(session)
  await telemetry.save(session.id, telemetry.capture(result!))
  return session
}

const PRACTICE = DEFAULT_SESSION_CONTEXT
const DRILL: SessionContext = {
  ...DEFAULT_SESSION_CONTEXT,
  mode: 'drill',
  targetSequence: 'in',
}

const analyse = async (all: readonly TypingSession[]) => {
  const range = createTimeRange('allTime', Date.now())
  const { result } = renderHook(() => usePersistentSequences(all, range, telemetry))

  await waitFor(() => {
    expect(result.current).not.toBeNull()
  })

  return result.current!
}

describe('what the cross-session analysis looks at', () => {
  it('counts ordinary practice sessions', async () => {
    const text = 'in find into stop'
    const all = [
      await record(text, 200, PRACTICE),
      await record(text, 200, PRACTICE),
      await record(text, 200, PRACTICE),
      await record(text, 200, PRACTICE),
    ]

    const report = await analyse(all)

    expect(report.sessionsWithTelemetry).toBe(4)
  })

  it('leaves drills out entirely', async () => {
    const text = 'in find into stop'
    const all = [
      await record(text, 200, PRACTICE),
      await record(text, 200, PRACTICE),
      await record(text, 50, DRILL),
      await record(text, 50, DRILL),
      await record(text, 50, DRILL),
    ]

    const report = await analyse(all)

    // Five sessions in history, two of them ordinary. Letting the three drills
    // in would treble the evidence for "in" with text that was built to
    // contain it, and drag its median towards drill performance.
    expect(report.sessionsAnalysed).toBe(2)
    expect(report.sessionsWithTelemetry).toBe(2)
  })

  it('finds nothing when every session was a drill', async () => {
    const text = 'in find into stop'
    const all = [
      await record(text, 50, DRILL),
      await record(text, 50, DRILL),
      await record(text, 50, DRILL),
      await record(text, 50, DRILL),
    ]

    const report = await analyse(all)

    // "Not enough history" is the honest answer here: there is no record of
    // ordinary typing to rank, however much drilling has been done.
    expect(report.sessionsAnalysed).toBe(0)
    expect(report.hasEnoughHistory).toBe(false)
    expect(report.candidates).toEqual([])
  })
})

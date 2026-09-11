/**
 * Turning an engine result into a storable session.
 *
 * The engine measures; this adds the two things it cannot know — when the test
 * happened in real time, and how it was configured — and nothing else. Metrics
 * are carried across untouched, so there is no second place where speed or
 * accuracy is worked out.
 */

import { timestamp, type SessionResult, type Timestamp } from '@core/types'

import type { SessionContext, TypingSession } from './types.ts'

export interface CreateSessionOptions {
  readonly result: SessionResult
  readonly context: SessionContext
  /**
   * Wall-clock time the test finished, in epoch milliseconds. Passed in rather
   * than read from `Date.now()` here, for the same reason the engine takes its
   * timestamps as arguments: it makes the result of this function testable.
   */
  readonly completedAt: Timestamp
}

export const createTypingSession = ({
  result,
  context,
  completedAt,
}: CreateSessionOptions): TypingSession => ({
  id: result.id,
  // The engine's own `startedAt` is on the page-load clock, so it is rebuilt
  // here from wall-clock completion minus the measured duration.
  startedAt: timestamp(Math.max(0, completedAt - result.durationMs)),
  completedAt,
  durationMs: result.durationMs,
  text: result.target.text,
  textSourceId: result.target.sourceId,
  context,
  metrics: result.metrics,
  status: result.status,
})

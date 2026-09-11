/**
 * Loads keystroke detail for the sessions in range and analyses it.
 *
 * Runs when the statistics page loads or its range changes — never while
 * typing. The typing screen does not import this, and nothing here is on the
 * keystroke path: reading thirty sessions' telemetry costs a few milliseconds
 * once, on a screen the typist is not typing on.
 *
 * Returns null until the analysis is done, which is also what a caller gets
 * when there is no telemetry at all. The component treats both the same way,
 * because to a reader they are the same: nothing to show yet.
 */

import { useEffect, useMemo, useState } from 'react'

import type { TypingSession } from '@core/sessions'
import { filterSessionsByRange, isUsableSession, type TimeRange } from '@core/statistics'
import {
  analysePersistentSequences,
  MAX_SESSIONS_ANALYSED,
  telemetryService as defaultTelemetryService,
  type PersistentSequenceReport,
  type TelemetryService,
  type TelemetrySessionRef,
} from '@core/telemetry'

/**
 * The analysis, kept with the exact session set it was computed from.
 *
 * Pairing them is what lets the hook decide during render whether the result in
 * hand is still the right answer, rather than clearing it from an effect — and
 * it means changing the range shows nothing rather than briefly showing the
 * previous range's sequences as though they were the new one's.
 */
interface Analysed {
  readonly refs: readonly TelemetrySessionRef[]
  readonly report: PersistentSequenceReport
}

export const usePersistentSequences = (
  sessions: readonly TypingSession[],
  range: TimeRange,
  telemetry: TelemetryService = defaultTelemetryService,
): PersistentSequenceReport | null => {
  const [analysed, setAnalysed] = useState<Analysed | null>(null)

  /**
   * The most recent sessions in range, newest first.
   *
   * Capped rather than unbounded: telemetry is retained for fifty sessions, and
   * decoding every one of them to draw one small section would make the page
   * slower the longer someone practises — the wrong way round.
   */
  const refs = useMemo<readonly TelemetrySessionRef[]>(
    () =>
      filterSessionsByRange(sessions, range)
        .filter(isUsableSession)
        .toSorted((a, b) => b.completedAt - a.completedAt)
        .slice(0, MAX_SESSIONS_ANALYSED)
        .map(({ id, text }) => ({ id, text })),
    [sessions, range],
  )

  useEffect(() => {
    if (refs.length === 0) return undefined

    let active = true

    telemetry
      .getMany(refs)
      .then((entries) => {
        if (active) setAnalysed({ refs, report: analysePersistentSequences(entries) })
      })
      .catch((error: unknown) => {
        // Losing this section is a nuisance; it is not a reason to break a page
        // whose actual subject is speed and accuracy. Leaving the state alone
        // is enough — the guard below already declines to show a stale answer.
        console.warn('[statistics] failed to analyse keystroke detail', error)
      })

    return () => {
      active = false
    }
  }, [refs, telemetry])

  return analysed !== null && analysed.refs === refs ? analysed.report : null
}

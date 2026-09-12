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
/**
 * The report for no sessions at all.
 *
 * Pure and constant, so it can be returned during render without state. It
 * matters because a typist who has only ever done drills has sessions in
 * history but none this analysis may look at — and the section explaining
 * that it needs more ordinary typing is far more use than one that silently
 * disappears.
 */
const NOTHING_TO_ANALYSE = analysePersistentSequences([])

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
        // Drills are excluded. Their text is built to be lopsided — a quarter
        // of its characters are one sequence — so a few of them would supply
        // most of the observations for whatever was drilled and the ranking
        // would end up describing the drills rather than the typing. The
        // figures above do count them, which is a different question: a drill
        // is real typing, and how fast you typed it is a fair thing to record.
        .filter((session) => session.context.mode !== 'drill')
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

  if (refs.length === 0) return NOTHING_TO_ANALYSE

  return analysed !== null && analysed.refs === refs ? analysed.report : null
}

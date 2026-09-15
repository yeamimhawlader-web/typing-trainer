/**
 * Everything a typing screen needs, composed once.
 *
 * The classic screen and GG.Typing present the same test differently. They do
 * not get to run it differently: both take their session, text provider, drill
 * context and drill comparison from here, so a practice test or a drill is the
 * same test — same engine, metrics, telemetry and stored record — whichever
 * screen it was typed on.
 */

import { useMemo } from 'react'

import { DEFAULT_SESSION_CONTEXT, type SessionContext, type SessionService } from '@core/sessions'
import {
  compareToBaseline,
  type DrillComparison,
  type DrillOutcome,
  type SequenceReport,
  type TelemetryService,
  type TypicalRange,
} from '@core/telemetry'
import { createCommonWordsProvider, type TextProvider } from '@core/text'

import {
  useTypingSession,
  type TypingSessionController,
  type WordCountPreference,
} from './useTypingSession.ts'

/** What makes a test a drill rather than ordinary practice. */
export interface DrillSettings {
  readonly sequence: string
  /**
   * The typist's median for this sequence *before* the drill, or null when
   * there is no earlier record. Captured by the caller when the page loads,
   * not recomputed afterwards — once the drill is saved it would be part of
   * its own baseline, and the comparison would be against itself.
   */
  readonly baselineMs: number | null
  /**
   * Where this sequence usually falls in ordinary tests, captured alongside the
   * baseline and for the same reason. Absent or null when there is too little
   * history to say.
   */
  readonly typicalRangeMs?: TypicalRange | null
}

export interface TypingScreenOptions {
  /** Injectable for tests; defaults to the built-in word provider. */
  readonly provider?: TextProvider | undefined
  /** Injectable for tests; defaults to the application's session service. */
  readonly service?: SessionService | undefined
  /** Injectable for tests; defaults to the application's telemetry service. */
  readonly telemetry?: TelemetryService | undefined
  /** Present only when the screen is a targeted drill. */
  readonly drill?: DrillSettings | null | undefined
  /** The remembered practice length, for ordinary practice. */
  readonly wordCountPreference?: WordCountPreference | undefined
}

export interface TypingScreen extends TypingSessionController {
  readonly provider: TextProvider
  /** The drilled sequence, or null for ordinary practice. */
  readonly drillSequence: string | null
  /**
   * Slowest transitions to show with the result. Null for a drill: its text was
   * built to be lopsided, so ranking it would report the drill's design back as
   * though it were a measurement of the typist.
   */
  readonly resultSequences: SequenceReport | null
  /** The drill's outcome against its baseline, once a drill has finished. */
  readonly drillResult: { readonly outcome: DrillOutcome; readonly comparison: DrillComparison } | null
}

export const useTypingScreen = ({
  provider,
  service,
  telemetry,
  drill = null,
  wordCountPreference,
}: TypingScreenOptions = {}): TypingScreen => {
  // One provider for the life of the screen. Swapping in quotes or pasted text
  // later is a change here and nowhere else.
  const fallbackProvider = useMemo(() => createCommonWordsProvider(), [])
  const activeProvider = provider ?? fallbackProvider

  /**
   * Depends on the sequence rather than the `drill` object, so a caller that
   * builds it inline does not hand over a new context on every render.
   */
  const sequence = drill?.sequence ?? null
  const context = useMemo<SessionContext>(
    () =>
      sequence === null
        ? DEFAULT_SESSION_CONTEXT
        : { ...DEFAULT_SESSION_CONTEXT, mode: 'drill', targetSequence: sequence },
    [sequence],
  )

  const session = useTypingSession(activeProvider, service, telemetry, context, wordCountPreference)

  const baselineMs = drill?.baselineMs ?? null
  const typicalRangeMs = drill?.typicalRangeMs ?? null
  const { drillOutcome } = session
  const drillResult = useMemo(
    () =>
      sequence !== null && drillOutcome !== null
        ? { outcome: drillOutcome, comparison: compareToBaseline(drillOutcome, baselineMs, typicalRangeMs) }
        : null,
    [baselineMs, drillOutcome, sequence, typicalRangeMs],
  )

  return {
    ...session,
    provider: activeProvider,
    drillSequence: sequence,
    resultSequences: sequence === null ? session.sequences : null,
    drillResult,
  }
}

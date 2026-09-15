/**
 * Everything a drill needs before it can be typed, for either typing screen.
 *
 * ## Why the baseline is captured before anything is typed
 *
 * A drill is a session like any other, so the moment it is saved it becomes
 * part of the history the baseline is computed from. Reading the baseline
 * afterwards would compare the drill against a figure that already included
 * it. It is read once, on load, and held.
 *
 * ## Why earlier drills do not count towards the baseline
 *
 * Drill text is built to be lopsided — a quarter of its characters are the
 * target. Letting previous drills into the baseline would mean the thing a
 * drill is compared against drifts towards drill performance after a few
 * repetitions, and the comparison would quietly become drill-against-drill.
 * The baseline is ordinary typing, so only ordinary sessions contribute —
 * Hover Mode sessions are left out for the same reason.
 *
 * The classic drill page and the GG.Typing drill page both take their drill
 * from here, so a drill is the same drill — same words, same baseline — on
 * either.
 */

import { useEffect, useMemo, useState } from 'react'

import { isTrainingMode, type SessionService } from '@core/sessions'
import {
  findSequenceBaseline,
  MAX_SESSIONS_ANALYSED,
  type TelemetryService,
  type TypicalRange,
} from '@core/telemetry'
import { createDrill, createDrillProvider, isDrillableSequence, type DrillProvider } from '@core/text'
import type { DrillSettings } from '@features/typing'

export type DrillUnavailableReason = 'not-a-pair' | 'no-words'

/** What to say when there is no drill, the same on every screen. */
export const drillUnavailableText = (reason: DrillUnavailableReason, sequence: string): string =>
  reason === 'no-words'
    ? `No word in the practice text contains “${sequence}”, so there is nothing to build a drill from. Inventing words would train a movement you would never actually make.`
    : 'A drill is built around exactly two characters, and this is not that.'

export type DrillSetup =
  | { readonly status: 'unavailable'; readonly reason: DrillUnavailableReason }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly provider: DrillProvider; readonly drill: DrillSettings }

type BaselineState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready'
      readonly medianMs: number | null
      readonly typicalRangeMs: TypicalRange | null
    }

export const useDrillSetup = (
  sequence: string,
  service: SessionService,
  telemetry: TelemetryService,
): DrillSetup => {
  /**
   * Generated once per sequence. Restarting re-types the same words, which is
   * what makes doing a drill twice a comparison rather than two unrelated
   * pieces of text.
   */
  const plan = useMemo(
    () => (isDrillableSequence(sequence) ? createDrill({ sequence }) : null),
    [sequence],
  )

  const provider = useMemo(() => (plan === null ? null : createDrillProvider(plan)), [plan])

  const [baseline, setBaseline] = useState<BaselineState>({ status: 'loading' })

  useEffect(() => {
    if (plan === null) return undefined

    let active = true

    service
      .getAll()
      .then(async (all) => {
        // Ordinary sessions only — see the note at the top of this file.
        const ordinary = all
          .filter((session) => !isTrainingMode(session.context.mode))
          .slice(0, MAX_SESSIONS_ANALYSED)

        const entries = await telemetry.getMany(
          ordinary.map(({ id, text }) => ({ id, text })),
        )

        if (!active) return
        const found = findSequenceBaseline(entries, sequence)
        setBaseline({
          status: 'ready',
          medianMs: found?.medianMs ?? null,
          typicalRangeMs: found?.typicalRangeMs ?? null,
        })
      })
      .catch((error: unknown) => {
        // No baseline is a state the result screen already knows how to show;
        // it is not a reason to refuse the drill.
        console.warn('[drill] failed to read a baseline', error)
        if (active) setBaseline({ status: 'ready', medianMs: null, typicalRangeMs: null })
      })

    return () => {
      active = false
    }
  }, [plan, sequence, service, telemetry])

  const drill = useMemo<DrillSettings | null>(
    () =>
      baseline.status === 'ready'
        ? { sequence, baselineMs: baseline.medianMs, typicalRangeMs: baseline.typicalRangeMs }
        : null,
    [baseline, sequence],
  )

  if (plan === null || provider === null) {
    return { status: 'unavailable', reason: isDrillableSequence(sequence) ? 'no-words' : 'not-a-pair' }
  }

  // Held until the baseline is known, so a drill can never be typed against a
  // baseline that has not loaded and then be reported as having none.
  if (drill === null) return { status: 'loading' }

  return { status: 'ready', provider, drill }
}

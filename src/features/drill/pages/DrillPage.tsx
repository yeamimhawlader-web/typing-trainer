/**
 * A drill for one character transition.
 *
 * The first thing in this application that acts on an analysis rather than
 * reporting one. The cross-session analysis says `in` is consistently slower
 * than this typist's own baseline; this page turns that into forty words to
 * type, and then says what happened.
 *
 * It is deliberately thin. The typing screen is the same component practice
 * uses, with the same engine, metrics, telemetry and persistence — all this
 * page does is choose the text, capture the baseline, and hand both over.
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
 * The baseline is ordinary typing, so only ordinary sessions contribute.
 */

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'

import { ROUTES } from '@app/routes.ts'
import { sessionService, type SessionService } from '@core/sessions'
import {
  findSequenceBaseline,
  MAX_SESSIONS_ANALYSED,
  telemetryService as defaultTelemetryService,
  type TelemetryService,
  type TypicalRange,
} from '@core/telemetry'
import { createDrill, createDrillProvider, isDrillableSequence } from '@core/text'
import { TypingTest } from '@features/typing'
import { useDocumentTitle } from '@shared/lib'
import { ButtonLink, Page } from '@shared/ui'

import styles from './DrillPage.module.css'

export interface DrillPageProps {
  /** Injectable for tests; defaults to the application's session service. */
  readonly service?: SessionService
  /** Injectable for tests; defaults to the application's telemetry service. */
  readonly telemetry?: TelemetryService
}

type BaselineState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready'
      readonly medianMs: number | null
      readonly typicalRangeMs: TypicalRange | null
    }

export const DrillPage = ({
  service = sessionService,
  telemetry = defaultTelemetryService,
}: DrillPageProps = {}) => {
  const { sequence: raw } = useParams<{ sequence: string }>()
  const sequence = raw ?? ''

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
          .filter((session) => session.context.mode !== 'drill')
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

  // Set here, above the early returns, for all three states. React runs a
  // parent's effects after its children's, so this is the title that stands
  // even where a Page below sets one too.
  useDocumentTitle(
    plan === null
      ? 'No drill for that sequence'
      : baseline.status === 'loading'
        ? 'Drill'
        : `Drill: ${sequence}`,
  )

  if (plan === null || provider === null) {
    return (
      <Page title="No drill for that sequence">
        <p className={styles.missing}>
          {isDrillableSequence(sequence)
            ? `No word in the practice text contains “${sequence}”, so there is nothing to
               build a drill from. Inventing words would train a movement you would never
               actually make.`
            : 'A drill is built around exactly two characters, and this is not that.'}
        </p>
        <div className={styles.actions}>
          <ButtonLink to={ROUTES.statistics} variant="secondary">
            Back to statistics
          </ButtonLink>
          <ButtonLink to={ROUTES.practice} variant="ghost">
            Go to practice
          </ButtonLink>
        </div>
      </Page>
    )
  }

  // Held until the baseline is known, so a drill can never be typed against a
  // baseline that has not loaded and then be reported as having none.
  if (baseline.status === 'loading') {
    return (
      <Page title="Drill">
        <p className={styles.missing}>Loading…</p>
      </Page>
    )
  }

  return (
    <div className={styles.page}>
      <h1 className="visually-hidden">Drill: {sequence}</h1>
      <TypingTest
        provider={provider}
        service={service}
        telemetry={telemetry}
        drill={{
          sequence,
          baselineMs: baseline.medianMs,
          typicalRangeMs: baseline.typicalRangeMs,
        }}
      />
    </div>
  )
}

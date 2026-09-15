/**
 * A drill for one character transition, on the classic typing screen.
 *
 * The first thing in this application that acts on an analysis rather than
 * reporting one. The cross-session analysis says `in` is consistently slower
 * than this typist's own baseline; this page turns that into forty words to
 * type, and then says what happened.
 *
 * It is deliberately thin. The drill — its words and the baseline captured
 * before anything is typed — comes from `useDrillSetup`, which the GG.Typing
 * drill page uses too; the typing screen is the same component practice uses,
 * with the same engine, metrics, telemetry and persistence.
 */

import { useParams } from 'react-router'

import { ROUTES } from '@app/routes.ts'
import { sessionService, type SessionService } from '@core/sessions'
import { telemetryService as defaultTelemetryService, type TelemetryService } from '@core/telemetry'
import { TypingTest } from '@features/typing'
import { useDocumentTitle } from '@shared/lib'
import { ButtonLink, Page } from '@shared/ui'

import { drillUnavailableText, useDrillSetup } from '../hooks/useDrillSetup.ts'

import styles from './DrillPage.module.css'

export interface DrillPageProps {
  /** Injectable for tests; defaults to the application's session service. */
  readonly service?: SessionService
  /** Injectable for tests; defaults to the application's telemetry service. */
  readonly telemetry?: TelemetryService
}

export const DrillPage = ({
  service = sessionService,
  telemetry = defaultTelemetryService,
}: DrillPageProps = {}) => {
  const { sequence: raw } = useParams<{ sequence: string }>()
  const sequence = raw ?? ''
  const setup = useDrillSetup(sequence, service, telemetry)

  // Set here, above the early returns, for all three states. React runs a
  // parent's effects after its children's, so this is the title that stands
  // even where a Page below sets one too.
  useDocumentTitle(
    setup.status === 'unavailable'
      ? 'No drill for that sequence'
      : setup.status === 'loading'
        ? 'Drill'
        : `Drill: ${sequence}`,
  )

  if (setup.status === 'unavailable') {
    return (
      <Page title="No drill for that sequence">
        <p className={styles.missing}>{drillUnavailableText(setup.reason, sequence)}</p>
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

  if (setup.status === 'loading') {
    return (
      <Page title="Drill">
        <p className={styles.missing}>Loading…</p>
      </Page>
    )
  }

  return (
    <div className={styles.page}>
      <h1 className="visually-hidden">Drill: {sequence}</h1>
      <TypingTest provider={setup.provider} service={service} telemetry={telemetry} drill={setup.drill} />
    </div>
  )
}

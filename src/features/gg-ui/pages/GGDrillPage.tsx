/**
 * A drill for one character transition, on the GG.Typing screen.
 *
 * The drill itself — its words, and the baseline read before anything is typed
 * — comes from `useDrillSetup`, the same as on the classic drill page, so a
 * drill is the same drill on either. The typing is the same session practice
 * uses, recorded as a drill: its own telemetry, its own comparison, and kept
 * out of the ordinary analysis the way every drill is.
 */

import { useParams } from 'react-router'

import { PRACTICE_PATH, ROUTES } from '@app/routes.ts'
import { sessionService, type SessionService } from '@core/sessions'
import { telemetryService as defaultTelemetryService, type TelemetryService } from '@core/telemetry'
import { drillUnavailableText, useDrillSetup } from '@features/drill'
import { ButtonLink } from '@shared/ui'

import { useGGDocumentTitle } from '../layout/useGGDocumentTitle.ts'
import { GGTypingScreen } from '../screen/GGTypingScreen.tsx'

import styles from './GGDrillPage.module.css'

export interface GGDrillPageProps {
  /** Injectable for tests; defaults to the application's session service. */
  readonly service?: SessionService
  /** Injectable for tests; defaults to the application's telemetry service. */
  readonly telemetry?: TelemetryService
}

export const GGDrillPage = ({
  service = sessionService,
  telemetry = defaultTelemetryService,
}: GGDrillPageProps = {}) => {
  const { sequence: raw } = useParams<{ sequence: string }>()
  const sequence = raw ?? ''
  const setup = useDrillSetup(sequence, service, telemetry)

  // Above the early returns, for all three states, as on the classic drill page.
  useGGDocumentTitle(
    setup.status === 'unavailable'
      ? 'No drill for that sequence'
      : setup.status === 'loading'
        ? 'Drill'
        : `Drill: ${sequence}`,
  )

  if (setup.status === 'unavailable') {
    return (
      <section className={styles.notice}>
        <h1 className={styles.title}>No drill for that sequence</h1>
        <p className={styles.text}>{drillUnavailableText(setup.reason, sequence)}</p>
        <div className={styles.actions}>
          <ButtonLink to={ROUTES.statistics} variant="secondary">
            Back to statistics
          </ButtonLink>
          <ButtonLink to={PRACTICE_PATH} variant="ghost">
            Go to practice
          </ButtonLink>
        </div>
      </section>
    )
  }

  if (setup.status === 'loading') {
    return (
      <section className={styles.notice}>
        <h1 className="visually-hidden">Drill: {sequence}</h1>
        <p className={styles.text}>Loading…</p>
      </section>
    )
  }

  return (
    <GGTypingScreen
      heading={`Drill: ${sequence}`}
      provider={setup.provider}
      service={service}
      telemetry={telemetry}
      drill={setup.drill}
    />
  )
}

/**
 * One stored session, in full.
 *
 * Reached from the history list. Everything on it comes from the record that
 * was saved — this page performs a lookup and a render, and computes nothing.
 *
 * A session that is not there is an ordinary outcome rather than an error: the
 * id may be mistyped, the record may have been deleted in another tab, or it
 * may have been written by an older build and no longer parse. All three land
 * in the same place, because all three mean the same thing to the reader.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { ROUTES } from '@app/routes.ts'
import { sessionService, type SessionService, type TypingSession } from '@core/sessions'
import {
  analyseSlowSequences,
  telemetryService as defaultTelemetryService,
  type SequenceReport,
  type TelemetryService,
} from '@core/telemetry'
import { sessionId as toSessionId } from '@core/types'
import { Button, ButtonLink, Page } from '@shared/ui'

import { SessionSummary } from '../components/SessionSummary.tsx'

import styles from './SessionDetailPage.module.css'

type LookupState =
  | { readonly status: 'loading' }
  | { readonly status: 'found'; readonly session: TypingSession }
  | { readonly status: 'missing' }

export interface SessionDetailPageProps {
  /** Injectable for tests; defaults to the application's session service. */
  readonly service?: SessionService
  /** Injectable for tests; defaults to the application's telemetry service. */
  readonly telemetry?: TelemetryService
}

export const SessionDetailPage = ({
  service = sessionService,
  telemetry = defaultTelemetryService,
}: SessionDetailPageProps = {}) => {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  // An absent id is knowable before any lookup, so it is the starting state
  // rather than something an effect sets on the way past. The route always
  // supplies one; this is the defensive branch.
  /**
   * Null for a session recorded before telemetry existed, or one whose
   * keystroke detail has aged out of the retention window. Both are ordinary.
   */
  const [sequences, setSequences] = useState<SequenceReport | null>(null)

  const [state, setState] = useState<LookupState>(() =>
    sessionId === undefined || sessionId.length === 0
      ? { status: 'missing' }
      : { status: 'loading' },
  )

  useEffect(() => {
    if (sessionId === undefined || sessionId.length === 0) return

    let active = true

    service
      .getById(toSessionId(sessionId))
      .then((session) => {
        if (!active) return

        if (session === null) {
          setState({ status: 'missing' })
          return
        }

        setState({ status: 'found', session })

        // Absent for a session recorded before telemetry existed, or one whose
        // keystroke detail has aged out. Both are ordinary, and the section
        // simply does not appear.
        telemetry
          .getBySessionId(session.id, session.text)
          .then((captured) => {
            if (!active || captured === null) return
            setSequences(analyseSlowSequences(captured))
          })
          .catch((error: unknown) => {
            console.warn('[results] failed to read telemetry', error)
          })
      })
      .catch((error: unknown) => {
        // Storage being unreadable looks the same to the reader as the record
        // not being there, and neither is a reason to show a broken page.
        console.warn('[results] failed to read a session', error)
        if (active) setState({ status: 'missing' })
      })

    // Guards against a result arriving after the reader has navigated away.
    return () => {
      active = false
    }
  }, [sessionId, service, telemetry])

  const handleDelete = useCallback(() => {
    if (state.status !== 'found') return

    // Removed and left immediately: staying on the page of something that no
    // longer exists would only show the "missing" state a moment later.
    void service
      .remove(state.session.id)
      .catch((error: unknown) => {
        console.warn('[results] failed to delete a session', error)
      })
      .finally(() => {
        void navigate(ROUTES.history)
      })
  }, [state, navigate, service])

  if (state.status === 'loading') {
    return (
      <Page title="Session">
        <p className={styles.missing}>Loading…</p>
      </Page>
    )
  }

  if (state.status === 'missing') {
    return (
      <Page title="Session not found">
        <p className={styles.missing}>
          This session is not in your history. It may have been deleted, or the link may
          be out of date.
        </p>
        <div className={styles.actions}>
          <ButtonLink to={ROUTES.history} variant="secondary">
            Back to history
          </ButtonLink>
          <ButtonLink to={ROUTES.practice} variant="ghost">
            Go to practice
          </ButtonLink>
        </div>
      </Page>
    )
  }

  const { session } = state

  return (
    <Page title="Session">
      <SessionSummary session={session} label="Session result" sequences={sequences} />

      <div>
        <span className={styles.textLabel}>Text</span>
        <p className={styles.text}>{session.text}</p>
      </div>

      <div className={styles.actions}>
        <ButtonLink to={ROUTES.practice} variant="primary">
          Go to practice
        </ButtonLink>
        <ButtonLink to={ROUTES.history} variant="secondary">
          View history
        </ButtonLink>
        <span className={styles.spacer} />
        <Button variant="ghost" className={styles.danger} onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </Page>
  )
}

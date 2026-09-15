/**
 * What a typist sees the moment a test ends.
 *
 * The session it renders is the same object that went to storage — not a second
 * reading of the engine — so what is on screen here and what appears later in
 * history are the same numbers by construction rather than by coincidence.
 */

import { ROUTES, sessionDetailPath } from '@app/routes.ts'
import type { TypingSession } from '@core/sessions'
import type { DrillComparison, DrillOutcome, SequenceReport } from '@core/telemetry'
import { SessionSummary } from '@features/results'
import { Button, ButtonLink } from '@shared/ui'

import type { SaveState } from '../hooks/useTypingSession.ts'
import { DrillResult } from './DrillResult.tsx'
import { HoverResult } from './HoverResult.tsx'

import styles from './TestResult.module.css'

export interface TestResultProps {
  readonly session: TypingSession
  readonly saveState: SaveState
  readonly onTryAgain: () => void
  readonly sequences: SequenceReport | null
  /** Present only when the finished test was a targeted drill. */
  readonly drill?: { readonly outcome: DrillOutcome; readonly comparison: DrillComparison } | null
  /** Where "Back to practice" leads after a drill. The classic practice page by default. */
  readonly practicePath?: string
}

export const TestResult = ({
  session,
  saveState,
  onTryAgain,
  sequences,
  drill = null,
  practicePath = ROUTES.practice,
}: TestResultProps) => (
  <div className={styles.panel}>
    <SessionSummary session={session} sequences={sequences} />

    {drill !== null && (
      <DrillResult outcome={drill.outcome} comparison={drill.comparison} />
    )}

    {/* From the saved record, so it is the same account history keeps. */}
    {session.context.hover !== undefined && <HoverResult record={session.context.hover} />}

    <div className={styles.actions}>
      <Button
        variant="primary"
        onClick={(event) => {
          // Hands focus back so the next keystroke types instead of
          // re-triggering this button.
          event.currentTarget.blur()
          onTryAgain()
        }}
      >
        Try again
      </Button>

      {/* Only offered once the record exists — a link to a session that was
          never stored would lead to a "not found" page. */}
      {saveState === 'saved' && (
        <ButtonLink to={sessionDetailPath(session.id)} variant="secondary">
          View details
        </ButtonLink>
      )}

      {drill !== null && (
        <ButtonLink to={practicePath} variant="secondary">
          Back to practice
        </ButtonLink>
      )}

      <ButtonLink to={ROUTES.history} variant="ghost">
        View history
      </ButtonLink>

      {saveState === 'failed' ? (
        <span className={styles.warning}>This test could not be saved.</span>
      ) : (
        <span className={styles.shortcut}>
          <kbd className={styles.key}>Enter</kbd> for a new test
        </span>
      )}
    </div>
  </div>
)

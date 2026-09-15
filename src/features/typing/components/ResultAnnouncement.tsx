/**
 * Tells a screen reader the test is over, and how it went.
 *
 * The result panel appears silently, and the live statistics are deliberately
 * `aria-live="off"` — announcing speed on every keystroke would drown the
 * typing out. So without this a screen-reader user finishes a test and hears
 * nothing.
 *
 * The region is always in the page and empty while typing, because a live
 * region is only reliably announced when content changes inside one that
 * already existed; one that arrives together with its text is often skipped.
 * It says only the headline — the full result is on the page to read.
 */

import type { TypingSession } from '@core/sessions'
import { formatAccuracy, formatWpm } from '@features/results'

import type { SaveState } from '../hooks/useTypingSession.ts'

export interface ResultAnnouncementProps {
  readonly session: TypingSession | null
  readonly saveState: SaveState
}

export const ResultAnnouncement = ({ session, saveState }: ResultAnnouncementProps) => (
  <p role="status" className="visually-hidden">
    {session === null
      ? ''
      : `Test complete: ${formatWpm(session.metrics.netWpm)} words per minute, ${formatAccuracy(session.metrics.accuracy)} accuracy.${saveState === 'failed' ? ' This test could not be saved.' : ''}`}
  </p>
)

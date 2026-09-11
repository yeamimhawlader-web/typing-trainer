/**
 * Results — public entry point.
 *
 * The one place a result is presented. The typing screen and the history table
 * both import from here rather than formatting a session themselves, which is
 * what keeps a duration or a percentage written the same way on every screen.
 *
 * Cross-feature imports go through this barrel and no deeper.
 */

export { SessionSummary } from './components/SessionSummary.tsx'
export type { SessionSummaryProps } from './components/SessionSummary.tsx'

export { SessionDetailPage } from './pages/SessionDetailPage.tsx'

export {
  formatAccuracy,
  formatCompletedAt,
  formatCount,
  formatDuration,
  formatMode,
  formatSource,
  formatWpm,
  toIsoString,
} from './format.ts'

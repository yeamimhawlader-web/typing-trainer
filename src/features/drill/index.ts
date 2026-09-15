/**
 * Targeted drills — public entry point.
 *
 * The drill itself (`useDrillSetup`: its words, and the baseline captured before
 * it is typed) and the classic page that shows it. The typing is
 * `@features/typing`, the text comes from `@core/text`, and the measurement from
 * `@core/telemetry`; this feature only joins them up.
 */

export { DrillPage } from './pages/DrillPage.tsx'
export { drillUnavailableText, useDrillSetup } from './hooks/useDrillSetup.ts'
export type { DrillSetup, DrillUnavailableReason } from './hooks/useDrillSetup.ts'

/**
 * Statistics — public entry point.
 *
 * The page and its charts. Every figure it shows is computed in
 * `@core/statistics`; this feature only arranges and formats them.
 */

export { StatisticsPage } from './pages/StatisticsPage.tsx'
export { PersistentSequences } from './components/PersistentSequences.tsx'
export { usePersistentSequences } from './hooks/usePersistentSequences.ts'

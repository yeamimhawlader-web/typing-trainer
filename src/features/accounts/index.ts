/**
 * Accounts in the interface — public entry point.
 *
 * Reading who is signed in, and the three moments a browser is brought level
 * with the account. The account itself, and what syncing means, are
 * `@core/accounts`.
 */

export { nameOf, useAccount } from './useAccount.ts'
export { useAccountSync, useSyncAfterSave } from './useSync.ts'
export type { SyncTriggers } from './useSync.ts'
export { AccountPanel } from './components/AccountPanel.tsx'
export { movedInWords } from './sync-words.ts'
export type { AccountPanelProps } from './components/AccountPanel.tsx'

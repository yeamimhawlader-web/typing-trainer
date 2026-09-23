/**
 * When a browser and an account are brought level.
 *
 * Three moments, chosen so that the typist never waits and never has to ask:
 *
 * - signing in, and arriving with a session already kept from last time;
 * - coming back to the tab, which is when another browser's work is most
 *   likely to have arrived;
 * - finishing a test, so what was just typed is on the account before the
 *   page is closed.
 *
 * Every one of them is the same idempotent round, and a round already running
 * absorbs the others, so there is no coordination to get wrong. None of it
 * blocks typing: the syncing is started and left to itself, and a failure is
 * a warning in the console and a line on the account page, never an
 * interruption.
 */

import { useEffect } from 'react'

import { accountService, syncService, type AccountService, type SyncService } from '@core/accounts'

export interface SyncTriggers {
  readonly accounts?: AccountService
  readonly sync?: SyncService
}

/**
 * Mounted once, by the shell. Syncs on sign-in and whenever the tab is looked
 * at again.
 */
export const useAccountSync = ({ accounts = accountService, sync = syncService }: SyncTriggers = {}): void => {
  useEffect(() => {
    if (!accounts.available) return undefined

    const syncIfSignedIn = (): void => {
      if (accounts.state().status === 'signed-in') void sync.syncNow()
    }

    syncIfSignedIn()
    const stopWatchingAccount = accounts.subscribe((state) => {
      if (state.status === 'signed-in') void sync.syncNow()
    })

    const onVisible = (): void => {
      if (document.visibilityState === 'visible') syncIfSignedIn()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      stopWatchingAccount()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [accounts, sync])
}

/**
 * A test has just been saved, so the account should have it too.
 *
 * Takes the saved session's id rather than a flag: it changes exactly once per
 * saved test, which is exactly how often this should run.
 */
export const useSyncAfterSave = (savedId: string | null, { sync = syncService }: SyncTriggers = {}): void => {
  useEffect(() => {
    if (savedId !== null) void sync.syncNow()
  }, [savedId, sync])
}

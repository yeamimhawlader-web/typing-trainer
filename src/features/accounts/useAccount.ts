/**
 * Who is signed in, for a component.
 *
 * The account service keeps one state object and hands out the same reference
 * until something changes, which is exactly what `useSyncExternalStore` wants:
 * no copy of the state in React, and no render when nothing moved.
 */

import { useCallback, useSyncExternalStore } from 'react'

import { accountService, type AccountService, type AccountState } from '@core/accounts'

export const useAccount = (service: AccountService = accountService): AccountState => {
  const subscribe = useCallback((listener: () => void) => service.subscribe(listener), [service])
  const snapshot = useCallback(() => service.state(), [service])
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

/** What to call a signed-in typist: their name, their email, or neither. */
export const nameOf = (state: AccountState): string =>
  state.status === 'signed-in' ? (state.account.name ?? state.account.email ?? 'your account') : ''

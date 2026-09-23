/**
 * Accounts — public entry point.
 *
 * An account is an addition to a local application, never a gate in front of
 * it. With one, a typist's history and their own texts are the same in every
 * browser they sign in to; without one — and there is none configured unless a
 * Supabase project is given to the build — everything works as it always has,
 * kept in the browser and sent nowhere.
 *
 * Everything here is created once, at module load, from the configuration.
 * Where there is none, the same shapes exist and answer `unavailable`, so no
 * page has to ask whether accounts are switched on before it can render.
 */

import { env } from '@config'
import { storage } from '@core/persistence'

import { createAccountClient, createAccountService, createUnavailableAccountService } from './service.ts'
import { createSyncService } from './sync.ts'
import type { AccountService, SyncResult, SyncService } from './types.ts'

export type { Account, AccountService, AccountState, SyncResult, SyncService } from './types.ts'
export { NOTHING_SYNCED } from './types.ts'
export { accountOf, createAccountClient, createAccountService, createUnavailableAccountService } from './service.ts'
export { createSyncService, SESSIONS_TABLE, TEXTS_TABLE } from './sync.ts'
export type { SyncOptions } from './sync.ts'

/** Nothing to sync to: every round resolves as "nobody is signed in". */
const noSync: SyncService = {
  syncNow: () => Promise.resolve<SyncResult | null>(null),
  syncing: () => false,
  subscribe: () => () => undefined,
}

const configured = env.accounts

/*
 * One client for the application, and with it the one fetch of the library
 * behind it. Made here, where the configuration is read, so a build without a
 * project never loads a byte of it.
 */
const client = configured === null ? null : createAccountClient(configured)

/** The application's account, and the copy it keeps. */
export const accountService: AccountService =
  client === null ? createUnavailableAccountService() : createAccountService(client)

export const syncService: SyncService =
  client === null ? noSync : createSyncService({ client, accounts: accountService, storage })

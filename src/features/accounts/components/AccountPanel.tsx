/**
 * The account, once someone is signed in: who they are, what that changes, and
 * the way out.
 *
 * It says plainly what is kept where, because an account on a local
 * application is an offer, not a requirement, and the offer is only worth
 * taking if it is clear. Syncing runs by itself; the button is here for the
 * moment someone wants to watch it happen before closing a laptop.
 */

import { useEffect, useState } from 'react'

import { syncService as defaultSync, type Account, type SyncResult, type SyncService } from '@core/accounts'
import { Button, ConfirmAction } from '@shared/ui'

import { movedInWords } from '../sync-words.ts'

import styles from './AccountPanel.module.css'

export interface AccountPanelProps {
  readonly account: Account
  readonly onSignOut: () => void
  /** Injectable for tests; defaults to the application's own. */
  readonly sync?: SyncService
}

type Progress =
  | { readonly status: 'idle' }
  | { readonly status: 'syncing' }
  | { readonly status: 'done'; readonly result: SyncResult }
  | { readonly status: 'failed' }

export const AccountPanel = ({ account, onSignOut, sync = defaultSync }: AccountPanelProps) => {
  const [progress, setProgress] = useState<Progress>(() => (sync.syncing() ? { status: 'syncing' } : { status: 'idle' }))

  useEffect(
    () =>
      sync.subscribe((result, error) => {
        setProgress(error !== null || result === null ? { status: 'failed' } : { status: 'done', result })
      }),
    [sync],
  )

  const syncNow = (): void => {
    setProgress({ status: 'syncing' })
    void sync.syncNow()
  }

  return (
    <section className={styles.panel} aria-labelledby="account-heading">
      <h1 className={styles.title} id="account-heading">
        Your account
      </h1>

      <div className={styles.who}>
        {account.pictureUrl !== null && (
          <img className={styles.picture} src={account.pictureUrl} alt="" width={48} height={48} />
        )}
        <div>
          <p className={styles.name}>{account.name ?? 'Signed in'}</p>
          {account.email !== null && <p className={styles.email}>{account.email}</p>}
        </div>
      </div>

      <p className={styles.text}>
        Your test history and your own texts are kept with this account, and are the
        same in every browser you sign in to. Settings and the keystroke detail behind
        the statistics stay on the machine you typed them on.
      </p>

      <div className={styles.actions}>
        <Button variant="secondary" onClick={syncNow} disabled={progress.status === 'syncing'}>
          {progress.status === 'syncing' ? 'Syncing…' : 'Sync now'}
        </Button>

        <ConfirmAction
          label="Sign out"
          prompt="Sign out of this browser?"
          confirmLabel="Sign out"
          onConfirm={onSignOut}
        />
      </div>

      <p className={styles.status} role="status">
        {progress.status === 'done' && movedInWords(progress.result)}
        {progress.status === 'failed' &&
          'That did not get through. Nothing was lost — everything is still in this browser, and it will try again.'}
      </p>

      <p className={styles.text}>
        Signing out leaves everything in this browser exactly as it is. Nothing is
        deleted here, or there.
      </p>
    </section>
  )
}

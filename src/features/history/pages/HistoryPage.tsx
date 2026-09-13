/**
 * Session history.
 *
 * Deliberately a table of facts, not a dashboard. Date, speed, accuracy,
 * duration, mode — the things you would actually scan down a column to compare.
 * Trends, charts and personal bests are analytics, and they are not this.
 */

import { useEffect } from 'react'
import { Link } from 'react-router'

import { ROUTES, sessionDetailPath } from '@app/routes.ts'
import {
  formatAccuracy,
  formatCompletedAt,
  formatDuration,
  formatMode,
  formatWpm,
  toIsoString,
} from '@features/results'
import { ConfirmAction, Page } from '@shared/ui'

import { useHistoryStore } from '../state/history.store.ts'

import styles from './HistoryPage.module.css'

/**
 * Says what was just deleted and offers to put it back.
 *
 * Screen readers hear it through a status region that is always present.
 */
const UndoNotice = () => {
  const lastDeleted = useHistoryStore((state) => state.lastDeleted)
  const undo = useHistoryStore((state) => state.undo)
  const dismiss = useHistoryStore((state) => state.dismissUndo)

  const count = lastDeleted?.sessions.length ?? 0

  const message = count > 0 ? `Deleted ${count} ${count === 1 ? 'test' : 'tests'}.` : ''

  return (
    <>
      {/* The announcer stays in the tree while empty: a live region that only
          appears at the moment it has something to say is often not read. */}
      <p role="status" className="visually-hidden">
        {message}
      </p>
      {count > 0 && (
        <p className={styles.notice}>
          {/* Hidden from assistive technology because the status region just
              before it already says this; otherwise browsing the page reads
              the message twice. The buttons stay, right after the status. */}
          <span aria-hidden>{message}</span>
          <button type="button" className={styles.noticeAction} onClick={() => void undo()}>
            Undo
          </button>
          <button type="button" className={styles.noticeAction} onClick={dismiss}>
            Dismiss
          </button>
        </p>
      )}
    </>
  )
}

export const HistoryPage = () => {
  const sessions = useHistoryStore((state) => state.sessions)
  const total = useHistoryStore((state) => state.total)
  const status = useHistoryStore((state) => state.status)
  const load = useHistoryStore((state) => state.load)
  const remove = useHistoryStore((state) => state.remove)
  const clear = useHistoryStore((state) => state.clear)

  useEffect(() => {
    void load()
  }, [load])

  if (status === 'failed') {
    return (
      <Page title="History">
        <p className={styles.empty}>
          Your history could not be read. It may be unavailable in this browser.
        </p>
      </Page>
    )
  }

  if (status !== 'ready') {
    return (
      <Page title="History">
        <p className={styles.empty}>Loading…</p>
      </Page>
    )
  }

  if (sessions.length === 0) {
    return (
      <Page title="History">
        <UndoNotice />
        <p className={styles.empty}>
          No tests recorded yet. <Link to={ROUTES.practice}>Take one</Link> and it will
          appear here.
        </p>
      </Page>
    )
  }

  return (
    <Page title="History">
      <UndoNotice />

      <div className={styles.header}>
        {/* The list shows the most recent tests; the count says so rather than
            calling a page of fifty the whole history. */}
        <span className={styles.count}>
          {total > sessions.length
            ? `Latest ${sessions.length} of ${total} tests`
            : `${total} ${total === 1 ? 'test' : 'tests'}`}
        </span>
        <ConfirmAction
          label="Clear history"
          prompt={`Delete all ${total} ${total === 1 ? 'test' : 'tests'}?`}
          confirmLabel="Delete all"
          triggerClassName={styles.clear}
          onConfirm={() => void clear()}
        />
      </div>

      <div className={styles.scroll}>
        <table className={styles.table}>
          <caption className="visually-hidden">
            Completed typing tests, newest first
          </caption>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col" className={styles.numeric}>
                WPM
              </th>
              <th scope="col" className={styles.numeric}>
                Accuracy
              </th>
              <th scope="col" className={styles.numeric}>
                Duration
              </th>
              <th scope="col">Mode</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td>
                  {/* The date doubles as the way in to the full result, so the
                      list stays a list rather than growing a column of
                      buttons. */}
                  <Link to={sessionDetailPath(session.id)} className={styles.rowLink}>
                    <time dateTime={toIsoString(session)}>
                      {formatCompletedAt(session)}
                    </time>
                  </Link>
                </td>
                <td className={`${styles.numeric} ${styles.wpm}`}>
                  {formatWpm(session.metrics.netWpm)}
                </td>
                <td className={styles.numeric}>
                  {formatAccuracy(session.metrics.accuracy)}
                </td>
                <td className={styles.numeric}>{formatDuration(session.durationMs)}</td>
                <td>{formatMode(session)}</td>
                <td className={styles.actions}>
                  <ConfirmAction
                    label="Delete"
                    triggerLabel={`Delete the test from ${formatCompletedAt(session)}`}
                    prompt="Delete this test?"
                    confirmLabel="Delete"
                    triggerClassName={styles.rowAction}
                    onConfirm={() => void remove(session.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  )
}

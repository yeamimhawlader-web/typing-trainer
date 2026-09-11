/**
 * Session history.
 *
 * Deliberately a table of facts, not a dashboard. Date, speed, accuracy,
 * duration, mode — the things you would actually scan down a column to compare.
 * Trends, charts and personal bests are analytics, and they are not this.
 */

import { useEffect } from 'react'
import { Link } from 'react-router'

import { ROUTES } from '@app/routes.ts'
import { Button, Page } from '@shared/ui'

import {
  formatAccuracy,
  formatCompletedAt,
  formatDuration,
  formatMode,
  formatWpm,
  toIsoString,
} from '../format.ts'
import { useHistoryStore } from '../state/history.store.ts'

import styles from './HistoryPage.module.css'

export const HistoryPage = () => {
  const sessions = useHistoryStore((state) => state.sessions)
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
        <p className={styles.empty}>
          No tests recorded yet. <Link to={ROUTES.practice}>Take one</Link> and it will
          appear here.
        </p>
      </Page>
    )
  }

  return (
    <Page title="History">
      <div className={styles.header}>
        <span className={styles.count}>
          {sessions.length} {sessions.length === 1 ? 'test' : 'tests'}
        </span>
        <Button
          variant="ghost"
          onClick={(event) => {
            event.currentTarget.blur()
            void clear()
          }}
        >
          Clear history
        </Button>
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
                  <time dateTime={toIsoString(session)}>
                    {formatCompletedAt(session)}
                  </time>
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
                  <button
                    type="button"
                    className={styles.rowAction}
                    aria-label={`Delete the test from ${formatCompletedAt(session)}`}
                    onClick={(event) => {
                      event.currentTarget.blur()
                      void remove(session.id)
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  )
}

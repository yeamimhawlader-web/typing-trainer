/**
 * Golden Nuggets: the words Hover Mode let go before they cleared.
 *
 * A quiet list, most recently seen first. Each word says how often it has got
 * away, in how many tests, how many mistakes it has cost, when it last came up
 * and how that went. No ranking, no score and nothing to fix today: it is a place
 * to see which words keep costing speed.
 *
 * Only reads. Records are written by Hover Mode as each focus ends.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { ROUTES } from '@app/routes.ts'
import { goldenNuggetService, testsOf, type GoldenNugget, type GoldenNuggetService } from '@core/nuggets'
import { HOVER_DIFFICULTY_DETAILS } from '@features/ggtyping'

import { useGGDocumentTitle } from '../layout/useGGDocumentTitle.ts'

import styles from './GGGoldenNuggetsPage.module.css'

export interface GGGoldenNuggetsPageProps {
  /** Injectable for tests; defaults to the application's Golden Nuggets. */
  readonly service?: GoldenNuggetService
}

type Loaded =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly nuggets: readonly GoldenNugget[] }

const times = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

const formatDay = (epochMs: number): string =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(epochMs))

export const GGGoldenNuggetsPage = ({ service = goldenNuggetService }: GGGoldenNuggetsPageProps = {}) => {
  useGGDocumentTitle('Golden Nuggets')
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })

  useEffect(() => {
    let active = true
    service
      .getAll()
      .then((nuggets) => {
        if (active) setLoaded({ status: 'ready', nuggets })
      })
      .catch((error: unknown) => {
        console.warn('[golden nuggets] failed to read', error)
        if (active) setLoaded({ status: 'failed' })
      })
    return () => {
      active = false
    }
  }, [service])

  return (
    <section className={styles.page} aria-labelledby="golden-nuggets-heading">
      <h1 className={styles.title} id="golden-nuggets-heading">
        Golden Nuggets
      </h1>
      {/* Reached from Hover Mode, not the top bar, so the way back is here. */}
      <p className={styles.intro}>
        Words that keep costing mistakes, and the ones{' '}
        <Link to={ROUTES.ggHover} className={styles.link}>
          Hover Mode
        </Link>{' '}
        let go of before they cleared. Most recent first: these are the words costing you speed.
      </p>

      {loaded.status === 'loading' && <p className={styles.empty}>Loading…</p>}

      {loaded.status === 'failed' && (
        <p className={styles.empty}>Golden Nuggets could not be read. They may be unavailable in this browser.</p>
      )}

      {loaded.status === 'ready' && loaded.nuggets.length === 0 && (
        <p className={styles.empty}>
          None yet. When a word is still giving you trouble at the end of its repetitions in Hover Mode, it is kept
          here.
        </p>
      )}

      {loaded.status === 'ready' && loaded.nuggets.length > 0 && (
        <ul className={styles.list}>
          {loaded.nuggets.map((nugget) => (
            <li key={nugget.id} className={styles.item}>
              <h2 className={styles.word}>{nugget.word}</h2>
              <p className={styles.facts}>
                {/* What the word has cost, then how often, then where it got away. */}
                <span>{times(nugget.mistakes, 'mistake', 'mistakes')}</span>
                <span>Met in {times(testsOf(nugget), 'test', 'tests')}</span>
                {nugget.timesUnresolved > 0 && (
                  <span>Let go {times(nugget.timesUnresolved, 'time', 'times')}</span>
                )}
                {nugget.hoverSessions > 0 && (
                  <span>{times(nugget.hoverSessions, 'Hover session', 'Hover sessions')}</span>
                )}
              </p>
              <p className={styles.last}>
                <span>
                  Last struggled <time dateTime={new Date(nugget.lastSeenAt).toISOString()}>{formatDay(nugget.lastSeenAt)}</time>
                </span>
                {nugget.lastDifficulty !== null && (
                  <span>Last difficulty: {HOVER_DIFFICULTY_DETAILS[nugget.lastDifficulty].label}</span>
                )}
                <span>{nugget.lastOutcome === 'cleared' ? 'Cleared last time' : 'Still unresolved'}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

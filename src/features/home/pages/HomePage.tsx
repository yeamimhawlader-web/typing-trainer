/**
 * The front page: the name and a way in, through a letter (HomeHero), then
 * every way to practise, then the way in again.
 *
 * The ways to practise are a list (src/components/ui/interactive-list-preview.tsx)
 * that shows a picture of each as it is hovered or focused, and leads into it
 * when pressed. Its links are ordinary anchors, so the component knows nothing
 * of the router; a press on one is handed to the router here, so going in is a
 * page change inside the application rather than a fresh load of it.
 *
 * Three ways of moving through it, and no two the same in a row: a camera
 * carried by the scroll, a page that arrives a line at a time, a list that
 * answers the pointer. It ends on the one action rather than trailing off into
 * a note, because the last thing on a page is the thing that is remembered.
 */

import type { MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import InteractiveListPreview from '@/components/ui/interactive-list-preview.tsx'
import { PRACTICE_PATH } from '@app/routes.ts'
import { appConfig } from '@config'
import { useDocumentTitle } from '@shared/lib'

import { HomeHero } from './HomeHero.tsx'
import { WAYS_TO_PRACTISE } from './ways-to-practise.ts'
import styles from './HomePage.module.css'

export const HomePage = () => {
  useDocumentTitle(appConfig.appName)
  const navigate = useNavigate()

  // A plain press on one of the list's links goes through the router. Anything
  // else — a new tab, a modified click — is left to the browser.
  const goInside = (event: MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const href = (event.target as Element).closest('a')?.getAttribute('href')
    if (href === null || href === undefined || !href.startsWith('/')) return
    event.preventDefault()
    void navigate(href)
  }

  return (
    <div className={styles.page}>
      <HomeHero />

      <section className={styles.ways} aria-labelledby="ways-to-practise">
        <h2 id="ways-to-practise" className={styles.waysTitle}>
          Ways to practise
        </h2>
        <p className={styles.waysLede}>Point at one to see what it is.</p>
        <div onClick={goInside} className={styles.list}>
          <InteractiveListPreview items={WAYS_TO_PRACTISE} imageSize={0.95} />
        </div>
      </section>

      <section className={styles.end} aria-labelledby="start-now">
        <h2 id="start-now" className={styles.endTitle}>
          The first test is fifteen words.
        </h2>
        <p className={styles.endText}>
          Nothing to set up: the words are already on the screen, and typing the first
          one starts the clock. What you type stays in this browser unless you sign in
          to carry it to another.
        </p>
        <Link to={PRACTICE_PATH} className={styles.endStart}>
          Start typing <span aria-hidden="true">→</span>
        </Link>
      </section>
    </div>
  )
}

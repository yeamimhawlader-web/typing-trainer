/**
 * The front page: the name, a way in, and every way to practise.
 *
 * The ways to practise are a list (src/components/ui/interactive-list-preview.tsx)
 * that shows a picture of each as it is hovered or focused, and leads into it
 * when pressed. Its links are ordinary anchors, so the component knows nothing
 * of the router; a press on one is handed to the router here, so going in is a
 * page change inside the application rather than a fresh load of it.
 */

import type { MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import InteractiveListPreview from '@/components/ui/interactive-list-preview.tsx'
import { PRACTICE_PATH } from '@app/routes.ts'
import { appConfig } from '@config'
import { Page } from '@shared/ui'

import { WAYS_TO_PRACTISE } from './ways-to-practise.ts'
import styles from './HomePage.module.css'

export const HomePage = () => {
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
    <Page
      title={appConfig.appName}
      description="A practice environment built for deliberate, daily work on speed and accuracy."
    >
      <div className={styles.actions}>
        <Link to={PRACTICE_PATH} className={styles.cta}>
          Start practising
        </Link>
      </div>

      <section className={styles.ways} aria-labelledby="ways-to-practise">
        <h2 id="ways-to-practise" className={styles.waysTitle}>
          Ways to practise
        </h2>
        <div onClick={goInside}>
          <InteractiveListPreview items={WAYS_TO_PRACTISE} imageSize={0.62} />
        </div>
      </section>

      <p className={styles.note}>
        Start typing to begin — no button to press first. Results are saved in this
        browser only; nothing is sent anywhere.
      </p>
    </Page>
  )
}

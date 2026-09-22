/**
 * Names the tab for a screen in the typing shell: "Typing Test · Hover Typing".
 *
 * The same rule as the application's `useDocumentTitle` — the page's own name
 * first, and nothing restored on unmount, because every route sets its own —
 * and the same name: the shell is the application, to the typist.
 */

import { useEffect } from 'react'

import { appConfig } from '@config'

export const GG_TITLE_SUFFIX = appConfig.appName

export const useGGDocumentTitle = (title: string): void => {
  useEffect(() => {
    document.title = `${title} · ${GG_TITLE_SUFFIX}`
  }, [title])
}

/**
 * Names the tab for a GG.Typing screen: "Typing Test · GG.Typing".
 *
 * The same rule as the application's `useDocumentTitle` — the page's own name
 * first, and nothing restored on unmount, because every route sets its own —
 * with the shell's name in place of the application's.
 */

import { useEffect } from 'react'

export const GG_TITLE_SUFFIX = 'GG.Typing'

export const useGGDocumentTitle = (title: string): void => {
  useEffect(() => {
    document.title = `${title} · ${GG_TITLE_SUFFIX}`
  }, [title])
}

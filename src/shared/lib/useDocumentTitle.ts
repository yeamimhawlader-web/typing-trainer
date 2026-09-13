/**
 * Names the browser tab after the page on screen.
 *
 * Every page used to share the one title from `index.html`, so a screen reader
 * announced "Typing Trainer" on every navigation and a row of tabs could not be
 * told apart. A single-page app has to set it itself.
 *
 * The page's own name comes first, because that is the part that differs
 * between tabs and the part read out first.
 *
 * It does not put the old title back on unmount. That looks tidier and is
 * wrong as soon as one titled component replaces another inside a titled page:
 * the inner one's cleanup runs last and restores a title from before either
 * existed. Every route sets its own title instead — `Page` does it for most —
 * so there is never anything to restore.
 */

import { useEffect } from 'react'

import { appConfig } from '@config'

export const documentTitleFor = (title: string): string =>
  title === appConfig.appName ? title : `${title} · ${appConfig.appName}`

export const useDocumentTitle = (title: string): void => {
  useEffect(() => {
    document.title = documentTitleFor(title)
  }, [title])
}

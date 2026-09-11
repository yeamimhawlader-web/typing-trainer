/**
 * Loads persisted preferences once, then keeps the document in sync with them.
 *
 * The DOM write lives here rather than in the store because the store is plain
 * TypeScript with no knowledge of a document — that is what makes it testable
 * in isolation. This hook is the single place where preference state becomes a
 * visible change to the page.
 */

import { useEffect } from 'react'

import { settingsStore, useSettingsStore } from '../state/settings.store.ts'

export const useSettingsBootstrap = (): void => {
  const theme = useSettingsStore((state) => state.preferences.theme)

  useEffect(() => {
    void settingsStore.getState().hydrate()
  }, [])

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme
  }, [theme])
}

/**
 * Loads persisted preferences once, then keeps the document in sync with them.
 *
 * The DOM write lives here rather than in the store because the store is plain
 * TypeScript with no knowledge of a document — that is what makes it testable
 * in isolation. This hook is the single place where preference state becomes a
 * visible change to the page.
 */

import { useEffect, useLayoutEffect } from 'react'

import { themeById } from '@features/gg-ui/themes/themes.ts'

import { settingsStore, useSettingsStore } from '../state/settings.store.ts'

export const useSettingsBootstrap = (): void => {
  const theme = useSettingsStore((state) => state.preferences.theme)

  useEffect(() => {
    void settingsStore.getState().hydrate()
  }, [])

  // A layout effect, so the theme is on the page before the first paint rather
  // than one frame after it. The classic pages have a dark and a light palette;
  // they follow the scheme of whichever GG.Typing theme is chosen, which the
  // GG.Typing screens then apply in full.
  useLayoutEffect(() => {
    document.documentElement.dataset['theme'] = themeById(theme).scheme
  }, [theme])
}

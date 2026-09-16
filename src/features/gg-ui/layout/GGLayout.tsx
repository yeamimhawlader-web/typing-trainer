/**
 * The GG.Typing shell around its routes: top bar, the routed page, and the
 * theme panel.
 *
 * ## The theme is a preference
 *
 * The chosen theme is the settings store's `theme` — the same preference the
 * settings page writes and the classic pages follow by scheme — so it is read
 * from and saved to one place, and survives a reload. This layout only puts it
 * on the page. It waits for settings to load, so the first frame is already in
 * the stored theme rather than the default one switching to it.
 *
 * ## Sound
 *
 * The shell owns one sound engine for everything inside it, switched on and off
 * by the preference. Nothing is heard — and no audio context exists — until it
 * is switched on.
 *
 * ## Hover Mode's selector
 *
 * Ordinary practice and Hover Mode are separate pages, each with its own mode
 * selector. The shell keeps what the selector was doing between them, so the
 * one on the new page unfolds or folds on from where the old one was.
 *
 * ## Shared pages inside the shell
 *
 * The result panel, session summary and drill comparison are the application's
 * own components, not GG copies. They are drawn in the classic tokens, so the
 * shell maps those tokens onto the GG theme's (see GGLayout.module.css), and
 * they take on the theme without a line of their own changing.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router'

import { useSettingsStore } from '@features/settings/state/settings.store.ts'
import { createSoundEngine, soundChoiceFromStored, SoundContext } from '@features/sound'

import { createUnfoldMemory, UnfoldMemoryContext } from '../components/Unfold/unfold-memory.ts'
import { ThemePanel } from '../components/ThemePanel/ThemePanel.tsx'
import { TopBar } from '../components/TopBar/TopBar.tsx'
import { applyTheme, removeTheme } from '../themes/apply-theme.ts'
import { DEFAULT_THEME_ID, themeById, themeIdFromStored, type GGThemeId } from '../themes/themes.ts'

import '../styles/gg-foundation.css'
import styles from './GGLayout.module.css'

export const GGLayout = () => {
  const ready = useSettingsStore((state) => state.status === 'ready')
  const themeId = useSettingsStore((state) => themeIdFromStored(state.preferences.theme) ?? DEFAULT_THEME_ID)
  const setTheme = useSettingsStore((state) => state.setTheme)

  const [themesOpen, setThemesOpen] = useState(false)
  // Hover Mode's selector, remembered across the pages it appears on.
  const [unfoldMemory] = useState(createUnfoldMemory)

  // One sound engine for the shell. It opens no audio context until sound is
  // switched on, and gives the device back when the shell goes away.
  const soundChoice = useSettingsStore((state) => state.preferences.sound)
  const [sound] = useState(createSoundEngine)
  useEffect(() => {
    sound.choose(soundChoiceFromStored(soundChoice) ?? 'off')
  }, [sound, soundChoice])
  useEffect(() => () => sound.close(), [sound])
  const themesButton = useRef<HTMLButtonElement>(null)

  // Before paint, so the first frame is already in the theme, and a switch
  // lands on the next frame whole.
  useLayoutEffect(() => {
    if (ready) applyTheme(themeById(themeId))
  }, [ready, themeId])

  useEffect(() => () => removeTheme(), [])

  const selectTheme = useCallback(
    (id: GGThemeId) => {
      void setTheme(id)
    },
    [setTheme],
  )

  const closeThemes = useCallback(() => {
    setThemesOpen(false)
  }, [])

  // Focus goes back to the button that opened the panel once the shell is no
  // longer inert — which is only true after the render that closed it.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (wasOpen.current && !themesOpen) themesButton.current?.focus({ preventScroll: true })
    wasOpen.current = themesOpen
  }, [themesOpen])

  // Settings are read as the application loads and are ready before the first
  // render in practice; this is not a state anyone sees.
  if (!ready) return null

  return (
    <SoundContext value={sound}>
      <UnfoldMemoryContext value={unfoldMemory}>
      <div className={styles.app}>
        <div inert={themesOpen}>
          <TopBar themesOpen={themesOpen} onOpenThemes={() => setThemesOpen(true)} themesButtonRef={themesButton} />

          <main className={styles.main}>
            <Outlet />
          </main>
        </div>

          <ThemePanel open={themesOpen} activeThemeId={themeId} onSelect={selectTheme} onClose={closeThemes} />
        </div>
      </UnfoldMemoryContext>
    </SoundContext>
  )
}

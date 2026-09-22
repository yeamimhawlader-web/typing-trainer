/**
 * The shell around every page: top bar, the routed page, and the theme panel.
 *
 * One shell for the whole application — the front page, the typing screens,
 * history, statistics and settings — so the chrome, the theme and the glass are
 * the same wherever anyone is. The pages that predate it are drawn in the
 * application's classic tokens, which this shell maps onto the theme (below),
 * so they arrive themed without a line of their own changing.
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
 * ## The branch trees
 *
 * Ordinary practice, Hover Mode and the Syllable Trainer are separate pages,
 * each with its own toolbar. The shell keeps which branch tree is open — Hover
 * Mode's difficulties or the sound packs, never both — and what each was doing,
 * so the selector on the new page unfolds or folds on from where the old one
 * was.
 *
 * ## Focus while typing
 *
 * The shell's element says whether a test is under way (see typing-focus.ts),
 * so the chrome everywhere in it — the top bar, the toolbar, the hints — can
 * step back while the words stay forward. The typing screen reports it.
 *
 * ## Shared pages inside the shell
 *
 * The result panel, session summary and drill comparison are the application's
 * own components, not GG copies. They are drawn in the classic tokens, so the
 * shell maps those tokens onto the GG theme's (see GGLayout.module.css), and
 * they take on the theme without a line of their own changing.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router'

import { useSettingsStore } from '@features/settings/state/settings.store.ts'
import { createSoundEngine, soundChoiceFromStored, SoundContext } from '@features/sound'

import { BranchTreesContext, createBranchTrees } from '../components/Unfold/branch-trees.ts'
import { UnfoldMemoryContext } from '../components/Unfold/unfold-memory.ts'
import { ThemePanel } from '../components/ThemePanel/ThemePanel.tsx'
import { TopBar } from '../components/TopBar/TopBar.tsx'
import { applyTheme, removeTheme } from '../themes/apply-theme.ts'
import { createTypingFocus, TypingFocusContext } from './typing-focus.ts'
import { DEFAULT_THEME_ID, themeById, themeIdFromStored, type GGThemeId } from '../themes/themes.ts'

import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'
// Declared here, fetched only when used: a browser downloads a face the first
// time text is set in it.
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/lora/wght.css'
import '@fontsource-variable/roboto-slab/wght.css'
import '../styles/gg-foundation.css'
import styles from './GGLayout.module.css'

const MAIN_ID = 'main-content'

/**
 * A new page starts at the top.
 *
 * Every page is inside this one shell, so moving between them never reloads
 * the document and the browser keeps the position the last page was left at.
 * Following a link from the foot of the front page would open a typing screen
 * already scrolled past the words.
 *
 * Going back is left alone: the position the browser restores there is the one
 * the typist wants, which is the whole point of going back.
 *
 * The document's own scroll is moved rather than the window's, because that is
 * what the shell scrolls, and it is written before paint so no one sees the
 * page at the old position first.
 */
const useTopOfNewPage = (): void => {
  const { pathname } = useLocation()
  const navigation = useNavigationType()

  useLayoutEffect(
    () => {
      if (navigation === 'POP') return
      document.documentElement.scrollTop = 0
    },
    // The path is what this reacts to rather than something it reads: a new
    // page is a new path, and the same path twice is the same page.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
    [navigation, pathname],
  )
}

export const GGLayout = () => {
  useTopOfNewPage()
  const ready = useSettingsStore((state) => state.status === 'ready')
  const themeId = useSettingsStore((state) => themeIdFromStored(state.preferences.theme) ?? DEFAULT_THEME_ID)
  const setTheme = useSettingsStore((state) => state.setTheme)

  const [themesOpen, setThemesOpen] = useState(false)
  // The branch trees, and what each was doing, remembered across the pages they appear on.
  const [branchTrees] = useState(createBranchTrees)

  // One sound engine for the shell. It opens no audio context until sound is
  // switched on, and gives the device back when the shell goes away.
  const soundChoice = useSettingsStore((state) => state.preferences.sound)
  const soundVolume = useSettingsStore((state) => state.preferences.soundVolume)
  const [sound] = useState(createSoundEngine)
  useEffect(() => {
    sound.choose(soundChoiceFromStored(soundChoice) ?? 'off')
  }, [sound, soundChoice])
  useEffect(() => {
    sound.setVolume(soundVolume)
  }, [sound, soundVolume])
  useEffect(() => () => sound.close(), [sound])
  const themesButton = useRef<HTMLButtonElement>(null)
  const [typingFocus] = useState(createTypingFocus)
  // The shell's element carries the state, from the moment it is on the page;
  // nothing steps back once it has gone.
  const attachApp = useCallback(
    (element: HTMLDivElement | null) => {
      if (element === null) typingFocus.typing(false)
      typingFocus.attach(element)
    },
    [typingFocus],
  )

  // Before paint, so the first frame is already in the theme, and a switch
  // lands on the next frame whole.
  useLayoutEffect(() => {
    if (ready) applyTheme(themeById(themeId))
  }, [ready, themeId])

  useLayoutEffect(() => () => removeTheme(), [])

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
      <BranchTreesContext value={branchTrees}>
      <UnfoldMemoryContext value={branchTrees.memoryOf('hover')}>
      <TypingFocusContext value={typingFocus}>
      <div ref={attachApp} className={styles.app}>
        <div inert={themesOpen}>
          {/* First in the tab order, hidden until focused, so a keyboard user can
              pass the bar's links on every page. Focus is moved by hand rather
              than by following the fragment, which the router would read as a
              navigation. */}
          <a
            href={`#${MAIN_ID}`}
            className={styles.skipLink}
            onClick={(event) => {
              event.preventDefault()
              document.getElementById(MAIN_ID)?.focus()
            }}
          >
            Skip to content
          </a>

          <TopBar themesOpen={themesOpen} onOpenThemes={() => setThemesOpen(true)} themesButtonRef={themesButton} />

          <main id={MAIN_ID} tabIndex={-1} className={styles.main}>
            <Outlet />
          </main>
        </div>

          <ThemePanel open={themesOpen} activeThemeId={themeId} onSelect={selectTheme} onClose={closeThemes} />
        </div>
      </TypingFocusContext>
      </UnfoldMemoryContext>
      </BranchTreesContext>
    </SoundContext>
  )
}

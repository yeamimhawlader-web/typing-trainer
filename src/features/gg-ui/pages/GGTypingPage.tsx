/**
 * GG.Typing — the typing test screen.
 *
 * One screen, no scroll on a desktop: top bar, control row, toolbar, word
 * stream, input. The upper part of the viewport holds all of it and the rest is
 * left empty on purpose.
 *
 * The UI shell only. Typing runs through a stub source, and the controls change
 * shell state; wiring both to the engine, persistence and statistics is the next
 * pass.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { ControlRow } from '../components/ControlRow/ControlRow.tsx'
import { InputField } from '../components/InputField/InputField.tsx'
import { ThemePanel } from '../components/ThemePanel/ThemePanel.tsx'
import { Toolbar } from '../components/Toolbar/Toolbar.tsx'
import { TopBar } from '../components/TopBar/TopBar.tsx'
import { WordStream } from '../components/WordStream/WordStream.tsx'
import { useShellStore } from '../state/shell.store.ts'
import { stubWords } from '../stub-data.ts'
import { applyTheme, removeTheme } from '../themes/apply-theme.ts'
import { themeById } from '../themes/themes.ts'
import { createStubTypingSource, type TypingSource } from '../typing/typing-source.ts'

import '../styles/gg-foundation.css'
import styles from './GGTypingPage.module.css'

export interface GGTypingPageProps {
  /** Injectable for tests; defaults to the stub over the common-words list. */
  readonly createSource?: () => TypingSource
}

const defaultSource = (): TypingSource => createStubTypingSource(stubWords())

export const GGTypingPage = ({ createSource = defaultSource }: GGTypingPageProps = {}) => {
  const themeId = useShellStore((state) => state.themeId)
  const setTheme = useShellStore((state) => state.setTheme)
  const size = useShellStore((state) => state.size)

  const [source, setSource] = useState<TypingSource>(createSource)
  const [themesOpen, setThemesOpen] = useState(false)
  const themesButton = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const appliedOnce = useRef(false)

  // Before paint, so the first frame is already in the theme. Only later
  // changes cross-fade: the first one is a page load, not a switch.
  useLayoutEffect(() => {
    applyTheme(themeById(themeId), { fade: appliedOnce.current })
    appliedOnce.current = true
  }, [themeId])

  useEffect(() => () => removeTheme(), [])

  useEffect(() => {
    const previous = document.title
    document.title = 'Typing Test · GG.Typing'
    return () => {
      document.title = previous
    }
  }, [])

  // Ready to type on arrival.
  useEffect(() => {
    input.current?.focus({ preventScroll: true })
  }, [])

  const restart = useCallback(() => {
    setSource(createSource())
    input.current?.focus({ preventScroll: true })
  }, [createSource])

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

  return (
    <div className={styles.app}>
      <div className={styles.shell} inert={themesOpen}>
        <TopBar
          themesOpen={themesOpen}
          onOpenThemes={() => setThemesOpen(true)}
          themesButtonRef={themesButton}
        />

        <main className={styles.main}>
          <h1 className="visually-hidden">Typing test</h1>
          <ControlRow onRestart={restart} />
          <Toolbar />
          <div className={styles.stream}>
            <WordStream source={source} size={size} onActivate={() => input.current?.focus({ preventScroll: true })} />
          </div>
          <InputField ref={input} source={source} />
        </main>
      </div>

      <ThemePanel open={themesOpen} activeThemeId={themeId} onSelect={setTheme} onClose={closeThemes} />
    </div>
  )
}

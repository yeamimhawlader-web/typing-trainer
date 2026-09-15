/**
 * The theme panel. Glass #2 of 3.
 *
 * Slides in from the right edge. While it is open the rest of the shell is
 * inert — focus stays in the panel, and nothing behind it can be clicked or
 * tabbed to — so it behaves as a modal dialog without a trap written by hand.
 * Escape, the close button, or a click anywhere outside closes it, and focus
 * returns to the button that opened it.
 *
 * Themes are native radios in one group across both sections, so the arrow
 * keys move through all six and a screen reader announces the choice. Picking a
 * theme applies it immediately and leaves the panel open, so themes can be
 * compared one after another.
 */

import { useEffect, useRef, type CSSProperties } from 'react'

import { GG_THEMES, type GGTheme, type GGThemeId } from '../../themes/themes.ts'
import { IconCircle } from '../controls/controls.tsx'
import { MoonIcon, SunIcon } from '../icons.tsx'

import styles from './ThemePanel.module.css'

export interface ThemePanelProps {
  readonly open: boolean
  readonly activeThemeId: GGThemeId
  readonly onSelect: (themeId: GGThemeId) => void
  readonly onClose: () => void
}

const swatchStyle = (theme: GGTheme): CSSProperties =>
  ({
    '--swatch-bg': theme.colors.bg,
    '--swatch-accent': theme.colors.accent,
    '--swatch-fg': theme.colors.fg,
  }) as CSSProperties

const SECTIONS = [
  { scheme: 'light', title: 'Light', Icon: SunIcon },
  { scheme: 'dark', title: 'Dark', Icon: MoonIcon },
] as const

export const ThemePanel = ({ open, activeThemeId, onSelect, onClose }: ThemePanelProps) => {
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return undefined

    // Into the panel, on the theme already chosen.
    panel.current?.querySelector<HTMLInputElement>('input:checked')?.focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return (
    <div className={styles.layer} data-open={open} inert={!open}>
      {/* The outside, as a click target. Not a visual scrim: the panel's own
          glass is what separates it from the page. */}
      <div className={styles.outside} onMouseDown={onClose} aria-hidden="true" />

      <section ref={panel} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="gg-theme-title">
        <header className={styles.header}>
          <h2 id="gg-theme-title" className={styles.title}>
            Theme
          </h2>
          <IconCircle label="Close themes" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
              <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
            </svg>
          </IconCircle>
        </header>

        {SECTIONS.map(({ scheme, title, Icon }) => (
          <fieldset key={scheme} className={styles.section}>
            <legend className={styles.legend}>
              <Icon />
              <span>{title}</span>
            </legend>

            {GG_THEMES.filter((theme) => theme.scheme === scheme).map((theme) => (
              <label key={theme.id} className={styles.row}>
                <input
                  type="radio"
                  className={styles.nativeInput}
                  name="gg-theme"
                  value={theme.id}
                  checked={theme.id === activeThemeId}
                  onChange={() => onSelect(theme.id)}
                />
                <span className={styles.name}>{theme.name}</span>
                <span className={styles.swatch} style={swatchStyle(theme)} aria-hidden="true">
                  <span className={styles.dotBg} />
                  <span className={styles.dotAccent} />
                  <span className={styles.dotFg} />
                </span>
              </label>
            ))}
          </fieldset>
        ))}
      </section>
    </div>
  )
}

/**
 * The top bar: brand on the left, navigation and the theme palette on the right.
 *
 * Glass, like the rest of the chrome and never the typing text. It sits above the page
 * rather than on it, so it is sticky and the page runs underneath.
 *
 * Everything in it is real. History and statistics are the application's own
 * pages, reached from here rather than rebuilt inside the shell. There is no
 * user count, account or language menu: none of those exist, and the bar does
 * not pretend they do.
 */

import type { Ref } from 'react'
import { Link, NavLink } from 'react-router'

import { PRACTICE_PATH, ROUTES } from '@app/routes.ts'
import { cx } from '@shared/lib'

import { IconCircle } from '../controls/controls.tsx'
import { LogoGlyph, PaletteIcon } from '../icons.tsx'

import styles from './TopBar.module.css'

export interface TopBarProps {
  readonly themesOpen: boolean
  readonly onOpenThemes: () => void
  readonly themesButtonRef: Ref<HTMLButtonElement>
}

const NAV = [
  { to: PRACTICE_PATH, label: 'Typing Test', end: true },
  { to: ROUTES.history, label: 'History', end: false },
  { to: ROUTES.statistics, label: 'Statistics', end: false },
] as const

export const TopBar = ({ themesOpen, onOpenThemes, themesButtonRef }: TopBarProps) => (
  <header className={styles.bar}>
    <div className={styles.inner}>
      <Link to={PRACTICE_PATH} className={styles.brand} aria-label="GG.Typing">
        <span className={styles.mark} aria-hidden="true">
          <LogoGlyph />
        </span>
        <span className={styles.wordmark} aria-hidden="true">
          <span className={styles.gg}>GG</span>
          <span className={styles.rest}>.TYPING</span>
        </span>
      </Link>

      <nav className={styles.cluster} aria-label="Main">
        {NAV.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} className={cx(styles.navLink)}>
            {label}
          </NavLink>
        ))}

        <IconCircle
          ref={themesButtonRef}
          label="Themes"
          aria-haspopup="dialog"
          aria-expanded={themesOpen}
          onClick={onOpenThemes}
        >
          <PaletteIcon />
        </IconCircle>
      </nav>
    </div>
  </header>
)

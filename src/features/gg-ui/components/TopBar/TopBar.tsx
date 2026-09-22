/**
 * The top bar: brand on the left, navigation and the theme palette on the right.
 *
 * Glass, like the rest of the chrome and never the typing text. It sits above the page
 * rather than on it, so it is sticky and the page runs underneath.
 *
 * Everything in it is real. History and statistics are the application's own
 * pages, reached from here rather than rebuilt inside the shell. There is no
 * user count, account or language menu: none of those exist, and the bar does
 * not pretend they do. Sign in leads to the sign-in form as it will look —
 * which says, when it is used, that accounts are not switched on yet.
 *
 * The brand leads home, to the front page and its ways to practise; Typing
 * Test goes straight to the words. The theme button is the one thing in the bar
 * drawn to be found: a tinted pill with its name and the colours of the theme on
 * now, because changing how the page looks is the first thing people try.
 */

import type { Ref } from 'react'
import { Link, NavLink } from 'react-router'

import { PRACTICE_PATH, ROUTES } from '@app/routes.ts'
import { appConfig } from '@config'
import { cx } from '@shared/lib'

import { LogoGlyph, PaletteIcon, SignInIcon } from '../icons.tsx'

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
  <header className={styles.bar} data-recede="">
    <div className={styles.inner}>
      <Link to={ROUTES.home} className={styles.brand} aria-label={appConfig.appName}>
        <span className={styles.mark} aria-hidden="true">
          <LogoGlyph />
        </span>
        <span className={styles.wordmark} aria-hidden="true">
          <span className={styles.gg}>HOVER</span>
          <span className={styles.rest}> TYPING</span>
        </span>
      </Link>

      <nav className={styles.cluster} aria-label="Main">
        {NAV.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} className={cx(styles.navLink)}>
            {label}
          </NavLink>
        ))}

        <NavLink to={ROUTES.ggSignIn} className={cx(styles.navLink, styles.signIn)}>
          <SignInIcon className={styles.signInIcon} width={18} height={18} />
          <span className={styles.signInText}>Sign in</span>
        </NavLink>

        <button
          ref={themesButtonRef}
          type="button"
          className={styles.themes}
          aria-label="Themes"
          aria-haspopup="dialog"
          aria-expanded={themesOpen}
          onClick={onOpenThemes}
        >
          <PaletteIcon className={styles.themesIcon} />
          <span className={styles.themesText}>Themes</span>
          {/* The theme on now: page, accent and text. */}
          <span className={styles.themesSwatch} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </nav>
    </div>
  </header>
)

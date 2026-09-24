/**
 * The top bar: brand on the left, navigation and the theme palette on the right.
 *
 * Glass, like the rest of the chrome and never the typing text. It sits above the page
 * rather than on it, so it is sticky and the page runs underneath.
 *
 * Everything in it is real. History and statistics are the application's own
 * pages, reached from here rather than rebuilt inside the shell. There is no
 * user count or language menu: neither exists, and the bar does not pretend
 * they do. Sign in leads to the sign-in page — the form as it will look where
 * this build has no account service, and the way in through Google where it
 * has. Signed in, the same place is the account, and the bar says who by
 * name, because that is the one thing a typist checks a bar for.
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
import { accountService, type AccountService } from '@core/accounts'
import { useAccount } from '@features/accounts'
import { cx } from '@shared/lib'

import { PaletteIcon, SignInIcon } from '../icons.tsx'

import styles from './TopBar.module.css'

export interface TopBarProps {
  /** Injectable for tests; defaults to the application's account. */
  readonly accounts?: AccountService
  readonly themesOpen: boolean
  readonly onOpenThemes: () => void
  readonly themesButtonRef: Ref<HTMLButtonElement>
}

const NAV = [
  { to: PRACTICE_PATH, label: 'Typing Test', end: true },
  { to: ROUTES.history, label: 'History', end: false },
  { to: ROUTES.statistics, label: 'Statistics', end: false },
  { to: ROUTES.settings, label: 'Settings', end: false },
] as const

/** A name to fit a bar: the first of them, or the email's own name. */
const shortName = (name: string | null, email: string | null): string =>
  name?.trim().split(' ')[0] ?? email?.split('@')[0] ?? 'Account'

export const TopBar = ({ accounts = accountService, themesOpen, onOpenThemes, themesButtonRef }: TopBarProps) => {
  const account = useAccount(accounts)
  const signedIn = account.status === 'signed-in' ? account.account : null

  return (
    <header className={styles.bar} data-recede="">
      <div className={styles.inner}>
        <Link to={ROUTES.home} className={styles.brand} aria-label={appConfig.appName}>
          {/* The mark keeps its own ground across all eleven themes, the way
              an application's icon does; the wordmark beside it is themed. */}
          <img className={styles.mark} src="/logo-mark.png" alt="" width={36} height={36} />
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

          <NavLink
            to={ROUTES.ggSignIn}
            className={cx(styles.navLink, styles.signIn)}
            aria-label={signedIn === null ? undefined : 'Your account'}
          >
            {signedIn === null || signedIn.pictureUrl === null ? (
              <SignInIcon className={styles.signInIcon} width={18} height={18} />
            ) : (
              <img className={styles.picture} src={signedIn.pictureUrl} alt="" width={20} height={20} />
            )}
            <span className={styles.signInText}>
              {signedIn === null ? 'Sign in' : shortName(signedIn.name, signedIn.email)}
            </span>
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
}

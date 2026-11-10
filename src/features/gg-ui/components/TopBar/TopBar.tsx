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
 * Test goes straight to the words. The four pages sit in one pill of water
 * (src/components/ui/liquid-glass-navbar.tsx): a drop rests on the page you are
 * on and travels to the one you pick. On a page that is none of the four —
 * home, sign in — there is no drop. Each is a real link, named for a screen
 * reader and a pointer, and its name is written out where the bar has room.
 *
 * The water is still between interactions: its idle shimmer would spend a
 * frame every frame in a bar that is on screen while someone types.
 * The theme button is the one thing in the bar
 * drawn to be found: a tinted pill with its name and the colours of the theme on
 * now, because changing how the page looks is the first thing people try.
 */

import type { CSSProperties, Ref } from 'react'
import { ChartColumn, History, Keyboard, Settings } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'

import { LiquidNavbar, type LiquidNavItem } from '@/components/ui/liquid-glass-navbar.tsx'
import { PRACTICE_PATH, ROUTES } from '@app/routes.ts'
import { appConfig } from '@config'
import { accountService, type AccountService } from '@core/accounts'
import { useAccount } from '@features/accounts'
import { useSettingsStore } from '@features/settings/state/settings.store.ts'
import { cx } from '@shared/lib'

import { PaletteIcon, SignInIcon } from '../icons.tsx'
import { DEFAULT_THEME_ID, themeById, themeIdFromStored } from '../../themes/themes.ts'

import { Wordmark } from './Wordmark.tsx'

import styles from './TopBar.module.css'

export interface TopBarProps {
  /** Injectable for tests; defaults to the application's account. */
  readonly accounts?: AccountService
  readonly themesOpen: boolean
  readonly onOpenThemes: () => void
  readonly themesButtonRef: Ref<HTMLButtonElement>
}

const NAV = [
  { to: PRACTICE_PATH, label: 'Typing Test', icon: Keyboard, end: true },
  { to: ROUTES.history, label: 'History', icon: History, end: false },
  { to: ROUTES.statistics, label: 'Statistics', icon: ChartColumn, end: false },
  { to: ROUTES.settings, label: 'Settings', icon: Settings, end: false },
] as const

/** Each page as an item of the water nav, with the small scene its icon plays when picked. */
const NAV_ITEMS: LiquidNavItem[] = [
  { label: NAV[0].label, href: NAV[0].to, icon: <Keyboard size={20} aria-hidden="true" />, fx: 'pop' },
  { label: NAV[1].label, href: NAV[1].to, icon: <History size={20} aria-hidden="true" />, fx: 'spin' },
  { label: NAV[2].label, href: NAV[2].to, icon: <ChartColumn size={20} aria-hidden="true" />, fx: 'wave' },
  { label: NAV[3].label, href: NAV[3].to, icon: <Settings size={20} aria-hidden="true" />, fx: 'spin' },
]

/** The theme's own ink and accent, in place of the component's fixed navy and blue. */
const NAV_INK = {
  '--n-fg': 'var(--gg-fg)',
  '--n-fg-soft': 'var(--gg-muted)',
  '--n-focus': 'var(--gg-accent)',
} as CSSProperties

/** The page `pathname` is on, as NavLink would match it: exactly, or anywhere beneath. */
const pageIndex = (pathname: string): number | null => {
  const index = NAV.findIndex(
    ({ to, end }) => pathname === to || (!end && pathname.startsWith(`${to}/`)),
  )
  return index === -1 ? null : index
}

/** A name to fit a bar: the first of them, or the email's own name. */
const shortName = (name: string | null, email: string | null): string =>
  name?.trim().split(' ')[0] ?? email?.split('@')[0] ?? 'Account'

export const TopBar = ({
  accounts = accountService,
  themesOpen,
  onOpenThemes,
  themesButtonRef,
}: TopBarProps) => {
  const account = useAccount(accounts)
  const signedIn = account.status === 'signed-in' ? account.account : null
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const selected = pageIndex(pathname)
  const theme = useSettingsStore((state) =>
    themeById(themeIdFromStored(state.preferences.theme) ?? DEFAULT_THEME_ID),
  )

  return (
    <header className={styles.bar} data-recede="">
      <div className={styles.inner}>
        <Link to={ROUTES.home} className={styles.brand} aria-label={appConfig.appName}>
          {/* The bare Cursor H in the scheme's ink, and the wordmark in the
              brand's colours: the same logo on every theme. */}
          <span className={styles.mark} aria-hidden="true" />
          <Wordmark />
        </Link>

        <nav className={styles.cluster} aria-label="Main">
          <LiquidNavbar
            as="div"
            className={styles.pages}
            style={NAV_INK}
            items={NAV_ITEMS}
            active={selected ?? -1}
            tone={theme.scheme}
            accent={theme.colors.accent}
            ambient={false}
            onChange={(_index, item) => {
              if (item.href !== undefined) void navigate(item.href)
            }}
          />

          <NavLink
            to={ROUTES.ggSignIn}
            className={cx(styles.navLink, styles.signIn)}
            aria-label={signedIn === null ? undefined : 'Your account'}
          >
            {signedIn === null || signedIn.pictureUrl === null ? (
              <SignInIcon className={styles.signInIcon} width={18} height={18} />
            ) : (
              <img
                className={styles.picture}
                src={signedIn.pictureUrl}
                alt=""
                width={20}
                height={20}
              />
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

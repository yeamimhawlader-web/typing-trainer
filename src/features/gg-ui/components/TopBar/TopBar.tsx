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
 * Test goes straight to the words. The four pages are icons, and the one you
 * are on opens to show its name (src/components/ui/expandable-tabs.tsx): the
 * bar says where you are without spelling out everywhere you could go. Each
 * icon still carries its page's name for a screen reader and a pointer.
 *
 * The moving version is fetched on its own, after the page: framer-motion and
 * what comes with it more than doubled what every page loads first, for a bar
 * that only moves when a page is changed. Until it arrives — a moment — the
 * same icons are drawn still, as plain links, at the place the moving version
 * comes to rest, so the swap does not show.
 * The theme button is the one thing in the bar
 * drawn to be found: a tinted pill with its name and the colours of the theme on
 * now, because changing how the page looks is the first thing people try.
 */

import { lazy, Suspense, type Ref } from 'react'
import { ChartColumn, History, Keyboard, Settings } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'

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
  { to: PRACTICE_PATH, label: 'Typing Test', icon: Keyboard, end: true },
  { to: ROUTES.history, label: 'History', icon: History, end: false },
  { to: ROUTES.statistics, label: 'Statistics', icon: ChartColumn, end: false },
  { to: ROUTES.settings, label: 'Settings', icon: Settings, end: false },
] as const

const NAV_TABS = NAV.map(({ to, label, icon }) => ({ title: label, icon, href: to }))

/** The page `pathname` is on, as NavLink would match it: exactly, or anywhere beneath. */
const pageIndex = (pathname: string): number | null => {
  const index = NAV.findIndex(
    ({ to, end }) => pathname === to || (!end && pathname.startsWith(`${to}/`)),
  )
  return index === -1 ? null : index
}

/** The tabs at rest, as plain links: what shows until the moving ones arrive, or if they never do. */
const StillTabs = ({ selected }: { readonly selected: number | null }) => (
  <div className="flex flex-wrap items-center gap-1">
    {NAV.map(({ to, label, icon: Icon, end }, index) => (
      <NavLink
        key={to}
        to={to}
        end={end}
        aria-label={label}
        title={label}
        className={
          index === selected
            ? 'relative flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm font-medium text-foreground'
            : 'relative flex items-center rounded-xl px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground'
        }
      >
        <Icon size={20} aria-hidden="true" />
        {index === selected && (
          <span className="overflow-hidden whitespace-nowrap" aria-hidden="true">
            {label}
          </span>
        )}
      </NavLink>
    ))}
  </div>
)

// Asked for as this module loads, so it is on its way while the page renders.
// A fetch that fails — offline, or a deploy that replaced the file — leaves the
// still tabs in place for good, rather than the bar without its pages.
const loadTabs = import('@/components/ui/expandable-tabs.tsx').then(
  (module) => module.ExpandableTabs,
  () =>
    ({ selected }: { readonly selected?: number | null }) => (
      <StillTabs selected={selected ?? null} />
    ),
)
const ExpandableTabs = lazy(() =>
  loadTabs.then((component) => ({ default: component })),
)

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

  return (
    <header className={styles.bar} data-recede="">
      <div className={styles.inner}>
        <Link to={ROUTES.home} className={styles.brand} aria-label={appConfig.appName}>
          {/* The mark keeps its own ground across all eleven themes, the way
              an application's icon does; the wordmark beside it is themed. */}
          <img
            className={styles.mark}
            src="/logo-mark.png"
            alt=""
            width={36}
            height={36}
          />
          <span className={styles.wordmark} aria-hidden="true">
            <span className={styles.gg}>HOVER</span>
            <span className={styles.rest}> TYPING</span>
          </span>
        </Link>

        <nav className={styles.cluster} aria-label="Main">
          <Suspense fallback={<StillTabs selected={selected} />}>
            <ExpandableTabs
              tabs={NAV_TABS}
              selected={selected}
              onChange={(index) => {
                const page = index === null ? undefined : NAV[index]
                if (page !== undefined) void navigate(page.to)
              }}
              className="gap-1 border-0 bg-transparent p-0 shadow-none"
              activeColor="text-foreground"
            />
          </Suspense>

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

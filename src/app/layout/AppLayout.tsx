/**
 * The application shell: persistent chrome plus the routed outlet.
 *
 * Layout only. It holds no session state and knows nothing about typing.
 */

import { NavLink, Outlet } from 'react-router'

import { ROUTES } from '@app/routes.ts'
import { appConfig } from '@config'
import { cx } from '@shared/lib'

import styles from './AppLayout.module.css'

const NAV_ITEMS: ReadonlyArray<{ readonly to: string; readonly label: string }> = [
  { to: ROUTES.practice, label: 'Practice' },
  { to: ROUTES.history, label: 'History' },
  { to: ROUTES.statistics, label: 'Statistics' },
  { to: ROUTES.settings, label: 'Settings' },
]

const MAIN_ID = 'main-content'

export const AppLayout = () => (
  <div className={styles.shell}>
    {/* First in the tab order, hidden until focused, so a keyboard user can
        pass the five header links on every page. Focus is moved by hand
        rather than by following the fragment: following it would put
        `#main-content` in the address bar, and the router treats that as a
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

    <header className={styles.header}>
      <NavLink to={ROUTES.home} className={cx(styles.brand)}>
        {appConfig.appName}
      </NavLink>

      <nav className={styles.nav} aria-label="Primary">
        {NAV_ITEMS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cx(styles.navLink, isActive && styles.navLinkActive)
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>

    {/* Focusable only from script, so the skip link has somewhere to land. */}
    <main id={MAIN_ID} className={styles.main} tabIndex={-1}>
      <Outlet />
    </main>
  </div>
)

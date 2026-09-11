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
  { to: ROUTES.settings, label: 'Settings' },
]

export const AppLayout = () => (
  <div className={styles.shell}>
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

    <main className={styles.main}>
      <Outlet />
    </main>
  </div>
)

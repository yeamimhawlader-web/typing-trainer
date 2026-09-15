/**
 * The top bar: brand on the left, a quiet cluster on the right.
 *
 * Glass, and one of only three glass surfaces in the UI. It sits above the page
 * rather than on it, so it is sticky and the page runs underneath.
 */

import type { Ref } from 'react'
import { Link } from 'react-router'

import { ROUTES } from '@app/routes.ts'

import { STUB_ACCOUNT, STUB_LIVE_USERS } from '../../stub-data.ts'
import { IconCircle } from '../controls/controls.tsx'
import { GlobeIcon, LogoGlyph, PaletteIcon, UsersIcon } from '../icons.tsx'

import styles from './TopBar.module.css'

export interface TopBarProps {
  readonly themesOpen: boolean
  readonly onOpenThemes: () => void
  readonly themesButtonRef: Ref<HTMLButtonElement>
}

const formatCount = new Intl.NumberFormat('en')

export const TopBar = ({ themesOpen, onOpenThemes, themesButtonRef }: TopBarProps) => (
  <header className={styles.bar}>
    <div className={styles.inner}>
      <Link to={ROUTES.gg} className={styles.brand} aria-label="GG.Typing">
        <span className={styles.mark} aria-hidden="true">
          <LogoGlyph />
        </span>
        <span className={styles.wordmark} aria-hidden="true">
          <span className={styles.gg}>GG</span>
          <span className={styles.rest}>.TYPING</span>
        </span>
      </Link>

      <nav className={styles.cluster} aria-label="Main">
        <p className={styles.live}>
          <span className={styles.pulse} aria-hidden="true" />
          <UsersIcon width={18} height={18} />
          <span className={styles.count}>{formatCount.format(STUB_LIVE_USERS)}</span>
          <span className={styles.liveLabel}>users</span>
        </p>

        <Link to={ROUTES.gg} className={styles.navLink} aria-current="page">
          Typing Test
        </Link>

        <IconCircle
          ref={themesButtonRef}
          label="Themes"
          aria-haspopup="dialog"
          aria-expanded={themesOpen}
          onClick={onOpenThemes}
        >
          <PaletteIcon />
        </IconCircle>

        <IconCircle label="Language">
          <GlobeIcon />
        </IconCircle>

        <button type="button" className={styles.account} aria-label={`Account: ${STUB_ACCOUNT.username}, level ${STUB_ACCOUNT.level}`}>
          <span className={styles.avatar} aria-hidden="true">
            {STUB_ACCOUNT.username.slice(0, 1).toUpperCase()}
          </span>
          <span className={styles.username} aria-hidden="true">
            {STUB_ACCOUNT.username}
          </span>
          <span className={styles.level} aria-hidden="true">
            {STUB_ACCOUNT.level}
          </span>
        </button>
      </nav>
    </div>
  </header>
)

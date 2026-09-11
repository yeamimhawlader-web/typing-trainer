import { Link } from 'react-router'

import { ROUTES } from '@app/routes.ts'
import { Page } from '@shared/ui'

import styles from './HomePage.module.css'

export const HomePage = () => (
  <Page
    title="Typing Trainer"
    description="A practice environment built for deliberate, daily work on speed and accuracy."
  >
    <div className={styles.actions}>
      <Link to={ROUTES.practice} className={styles.cta}>
        Start practising
      </Link>
    </div>

    <p className={styles.note}>
      Foundation build. The architecture, design tokens, configuration and persistence
      layers are in place; the typing engine is the next piece to land.
    </p>
  </Page>
)

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
      {/* Reads "Start practising" once the typing surface exists. Promising a
          session the app cannot yet run would just be a lie on the button. */}
      <Link to={ROUTES.practice} className={styles.cta}>
        Open the practice page
      </Link>
    </div>

    <p className={styles.note}>
      The typing engine is built and tested. The typing surface that renders it is the
      next piece to land, so practice sessions cannot be run yet.
    </p>
  </Page>
)

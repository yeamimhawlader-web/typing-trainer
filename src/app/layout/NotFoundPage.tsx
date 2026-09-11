import { Link } from 'react-router'

import { ROUTES } from '@app/routes.ts'
import { Page } from '@shared/ui'

export const NotFoundPage = () => (
  <Page title="Not found" description="That page does not exist.">
    <Link to={ROUTES.home}>Back to the start</Link>
  </Page>
)

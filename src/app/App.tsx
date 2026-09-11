/**
 * Composition root.
 *
 * Wires cross-cutting concerns and hands off to the router. Application logic
 * does not belong here; anything that grows past wiring belongs in a feature.
 */

import { RouterProvider } from 'react-router'

import { createAppRouter } from '@app/router.tsx'
import { useSettingsBootstrap } from '@features/settings/hooks/useSettingsBootstrap.ts'

const router = createAppRouter()

export const App = () => {
  useSettingsBootstrap()

  return <RouterProvider router={router} />
}

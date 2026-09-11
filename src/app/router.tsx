/**
 * Route configuration.
 *
 * The route array is exported separately from the browser router so tests can
 * mount the same tree in a memory router. Routes are declared here and nowhere
 * else; a feature never registers its own.
 *
 * Pages are imported eagerly. The bundle is small and this is a daily-use tool
 * where a lazy chunk boundary would trade a real first-interaction delay for a
 * saving that does not matter yet. Revisit when the bundle justifies it.
 */

import { createBrowserRouter, type RouteObject } from 'react-router'

import { AppLayout } from '@app/layout/AppLayout.tsx'
import { NotFoundPage } from '@app/layout/NotFoundPage.tsx'
import { ROUTES } from '@app/routes.ts'
import { HistoryPage } from '@features/history/pages/HistoryPage.tsx'
import { HomePage } from '@features/home/pages/HomePage.tsx'
import { PracticePage } from '@features/practice/pages/PracticePage.tsx'
import { SettingsPage } from '@features/settings/pages/SettingsPage.tsx'

export const routeConfig: RouteObject[] = [
  {
    path: ROUTES.home,
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: ROUTES.practice, element: <PracticePage /> },
      { path: ROUTES.history, element: <HistoryPage /> },
      { path: ROUTES.settings, element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const createAppRouter = () => createBrowserRouter(routeConfig)

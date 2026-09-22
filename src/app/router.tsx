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
import { DrillPage } from '@features/drill'
import {
  GGDrillPage,
  GGGoldenNuggetsPage,
  GGHoverPage,
  GGLayout,
  GGNuggetPracticePage,
  GGPracticePage,
  GGSignInPage,
  GGSyllablePage,
} from '@features/gg-ui'
import { HistoryPage } from '@features/history/pages/HistoryPage.tsx'
import { historyStore } from '@features/history/state/history.store.ts'
import { HomePage } from '@features/home/pages/HomePage.tsx'
import { SessionDetailPage } from '@features/results'
import { StatisticsPage } from '@features/statistics'
import { PracticePage } from '@features/practice/pages/PracticePage.tsx'
import { SettingsPage } from '@features/settings/pages/SettingsPage.tsx'

export const routeConfig: RouteObject[] = [
  // GG.Typing: the primary typing screens, in a shell of their own. Every link
  // to practice or to a drill leads here. The classic practice and drill
  // routes below stay, over the same session, until GG.Typing replaces them.
  {
    path: ROUTES.gg,
    element: <GGLayout />,
    children: [
      { index: true, element: <GGPracticePage /> },
      { path: ROUTES.ggHover, element: <GGHoverPage /> },
      { path: ROUTES.ggHoverNuggets, element: <GGNuggetPracticePage /> },
      { path: ROUTES.ggSyllables, element: <GGSyllablePage /> },
      { path: ROUTES.ggNuggets, element: <GGGoldenNuggetsPage /> },
      { path: ROUTES.ggDrill, element: <GGDrillPage /> },
      { path: ROUTES.ggSignIn, element: <GGSignInPage /> },
    ],
  },
  {
    path: ROUTES.home,
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: ROUTES.practice, element: <PracticePage /> },
      { path: ROUTES.history, element: <HistoryPage /> },
      {
        path: ROUTES.sessionDetail,
        // Wired here rather than imported by the page: the history feature already
        // depends on results, and deleting through the history store is what makes
        // a deletion from this page undoable on the history page.
        element: <SessionDetailPage deleteSession={(id) => historyStore.getState().remove(id)} />,
      },
      { path: ROUTES.statistics, element: <StatisticsPage /> },
      { path: ROUTES.settings, element: <SettingsPage /> },
      { path: ROUTES.drill, element: <DrillPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const createAppRouter = () => createBrowserRouter(routeConfig)

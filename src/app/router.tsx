/**
 * Route configuration.
 *
 * The route array is exported separately from the browser router so tests can
 * mount the same tree in a memory router. Routes are declared here and nowhere
 * else; a feature never registers its own.
 *
 * Every page is inside one shell (GGLayout): the same top bar, theme and glass
 * from the front page to the settings. The shell's route has no path of its
 * own, so moving between pages never replaces it — the theme is applied once,
 * and stays.
 *
 * Each page is fetched when it is first asked for (app/pages.tsx); the shell
 * around them is not.
 */

import { createBrowserRouter, type RouteObject } from 'react-router'

import { NotFoundPage } from '@app/layout/NotFoundPage.tsx'
import {
  DrillPage,
  GGDrillPage,
  GGGoldenNuggetsPage,
  GGHoverPage,
  GGNuggetPracticePage,
  GGPracticePage,
  GGSignInPage,
  GGSyllablePage,
  HistoryPage,
  HomePage,
  LibraryPage,
  LibraryPracticePage,
  PracticePage,
  SessionDetailPage,
  SettingsPage,
  StatisticsPage,
} from '@app/pages.tsx'
import { ROUTES } from '@app/routes.ts'
import { GGLayout } from '@features/gg-ui/layout/GGLayout.tsx'
import { historyStore } from '@features/history/state/history.store.ts'

export const routeConfig: RouteObject[] = [
  {
    element: <GGLayout />,
    children: [
      // The front page, and the typing screens every link to practice leads to.
      { path: ROUTES.home, element: <HomePage /> },
      { path: ROUTES.gg, element: <GGPracticePage /> },
      { path: ROUTES.ggHover, element: <GGHoverPage /> },
      { path: ROUTES.ggHoverNuggets, element: <GGNuggetPracticePage /> },
      { path: ROUTES.ggSyllables, element: <GGSyllablePage /> },
      { path: ROUTES.ggNuggets, element: <GGGoldenNuggetsPage /> },
      { path: ROUTES.ggDrill, element: <GGDrillPage /> },
      { path: ROUTES.ggSignIn, element: <GGSignInPage /> },
      // The typist's own texts, and typing one of them.
      { path: ROUTES.ggTexts, element: <LibraryPage /> },
      { path: ROUTES.ggText, element: <LibraryPracticePage /> },
      // The application's own pages. The classic practice and drill screens
      // stay, over the same session, until the typing screens replace them.
      { path: ROUTES.history, element: <HistoryPage /> },
      {
        path: ROUTES.sessionDetail,
        element: <SessionDetailPage deleteSession={(id) => historyStore.getState().remove(id)} />,
      },
      { path: ROUTES.statistics, element: <StatisticsPage /> },
      { path: ROUTES.settings, element: <SettingsPage /> },
      { path: ROUTES.practice, element: <PracticePage /> },
      { path: ROUTES.drill, element: <DrillPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const createAppRouter = () => createBrowserRouter(routeConfig)

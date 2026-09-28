/**
 * Every page, fetched when it is first asked for.
 *
 * Pages used to be imported eagerly, on the reasoning that the bundle was
 * small. It is not any more: measured, a cold load spent 250ms and 313ms of
 * blocked main thread parsing 707kB before it could draw, and every animation
 * on the page stutters through work like that. Arriving at the front page
 * meant parsing the statistics charts, the sign-in form, the syllable corpus
 * and every typing screen first.
 *
 * So each page is fetched when it is first asked for, and the shell around
 * them is not: the bar, the theme and the glass are what the first paint
 * needs. The imports below reach past the features' own entry points on
 * purpose, and this is the one file allowed to. A `lazy` import of a barrel
 * pulls everything that barrel names into one chunk, which is the opposite of
 * the point; naming the module directly is what puts each page in a chunk of
 * its own.
 */

/*
 * Every export here is a component, but each arrives through `lazy`, which the
 * fast-refresh rule cannot see through: it reads them as plain constants. A
 * route shell has nothing to refresh in any case — the page it loads does.
 */
/* oxlint-disable react/only-export-components */

import { lazy, type ComponentType } from 'react'

/** A page, from the named export the module already has. */
const page = (load: () => Promise<Record<string, unknown>>, name: string) =>
  lazy(async () => {
    // The modules export their own constants beside the component, so what
    // comes back is checked rather than assumed: a renamed export would
    // otherwise surface as an unreadable React error on the first navigation.
    const found = (await load())[name]
    if (typeof found !== 'function') throw new Error(`${name} is not a component its module exports`)
    return { default: found as ComponentType }
  })

export const HomePage = page(() => import('@features/home/pages/HomePage.tsx'), 'HomePage')
export const GGPracticePage = page(() => import('@features/gg-ui/pages/GGPracticePage.tsx'), 'GGPracticePage')
export const GGHoverPage = page(() => import('@features/gg-ui/pages/GGHoverPage.tsx'), 'GGHoverPage')
export const GGNuggetPracticePage = page(
  () => import('@features/gg-ui/pages/GGNuggetPracticePage.tsx'),
  'GGNuggetPracticePage',
)
export const GGSyllablePage = page(() => import('@features/gg-ui/pages/GGSyllablePage.tsx'), 'GGSyllablePage')
export const GGGoldenNuggetsPage = page(
  () => import('@features/gg-ui/pages/GGGoldenNuggetsPage.tsx'),
  'GGGoldenNuggetsPage',
)
export const GGDrillPage = page(() => import('@features/gg-ui/pages/GGDrillPage.tsx'), 'GGDrillPage')
export const GGSignInPage = page(() => import('@features/gg-ui/pages/GGSignInPage.tsx'), 'GGSignInPage')
export const LibraryPage = page(() => import('@features/library/pages/LibraryPage.tsx'), 'LibraryPage')
export const LibraryPracticePage = page(
  () => import('@features/library/pages/LibraryPracticePage.tsx'),
  'LibraryPracticePage',
)
export const HistoryPage = page(() => import('@features/history/pages/HistoryPage.tsx'), 'HistoryPage')
export const StatisticsPage = page(() => import('@features/statistics/pages/StatisticsPage.tsx'), 'StatisticsPage')
export const SettingsPage = page(() => import('@features/settings/pages/SettingsPage.tsx'), 'SettingsPage')
export const PracticePage = page(() => import('@features/practice/pages/PracticePage.tsx'), 'PracticePage')
export const DrillPage = page(() => import('@features/drill/pages/DrillPage.tsx'), 'DrillPage')

/*
 * The session detail page takes the deletion the history store performs, so it
 * is the one page wired here rather than importing what it needs: the history
 * feature already depends on results, and deleting through the store is what
 * makes a deletion from this page undoable on the history page.
 */
export const SessionDetailPage = lazy(async () => ({
  default: (await import('@features/results/pages/SessionDetailPage.tsx')).SessionDetailPage,
}))

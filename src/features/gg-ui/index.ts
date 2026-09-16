/**
 * GG.Typing UI — public entry point.
 *
 * The GG.Typing interface over the application's real typing session: a shell
 * (top bar, theme panel) around a typing screen (control row, toolbar, word
 * stream, input), with seven themes. It owns no typing, scoring, storage or
 * settings of its own — those are `@features/typing`, `@core/sessions`,
 * `@core/telemetry` and the settings store, the same ones the classic screens
 * use. The token plan and the decisions behind it are in TOKEN_PLAN.md beside
 * this file.
 */

export { GGLayout } from './layout/GGLayout.tsx'
export { GG_TITLE_SUFFIX, useGGDocumentTitle } from './layout/useGGDocumentTitle.ts'
export { GGDrillPage } from './pages/GGDrillPage.tsx'
export { GGGoldenNuggetsPage } from './pages/GGGoldenNuggetsPage.tsx'
export type { GGGoldenNuggetsPageProps } from './pages/GGGoldenNuggetsPage.tsx'
export { GGHoverPage } from './pages/GGHoverPage.tsx'
export type { GGHoverPageProps } from './pages/GGHoverPage.tsx'
export type { GGDrillPageProps } from './pages/GGDrillPage.tsx'
export { GGPracticePage } from './pages/GGPracticePage.tsx'
export { GGSyllablePage } from './pages/GGSyllablePage.tsx'
export type { GGSyllablePageProps } from './pages/GGSyllablePage.tsx'
export type { GGPracticePageProps } from './pages/GGPracticePage.tsx'
export { GGTypingScreen } from './screen/GGTypingScreen.tsx'
export type { GGTypingScreenProps } from './screen/GGTypingScreen.tsx'
export { DEFAULT_THEME_ID, GG_THEMES, themeById, themeIdFromStored } from './themes/themes.ts'
export type { GGTheme, GGThemeId } from './themes/themes.ts'

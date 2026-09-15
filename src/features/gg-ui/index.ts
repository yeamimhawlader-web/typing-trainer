/**
 * GG.Typing UI — public entry point.
 *
 * The UI shell for the GG.Typing redesign: top bar, control row, toolbar, word
 * stream, input and theme panel, with six themes. Typing runs through a stub
 * `TypingSource`; wiring it to `@core/engine` is the next pass. The token plan
 * and the decisions behind it are in TOKEN_PLAN.md beside this file.
 */

export { GGTypingPage } from './pages/GGTypingPage.tsx'
export type { GGTypingPageProps } from './pages/GGTypingPage.tsx'
export { createStubTypingSource } from './typing/typing-source.ts'
export type { CharacterMark, TypingSource } from './typing/typing-source.ts'
export { DEFAULT_THEME_ID, GG_THEMES, themeById } from './themes/themes.ts'
export type { GGTheme, GGThemeId } from './themes/themes.ts'

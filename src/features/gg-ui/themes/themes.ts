/**
 * GG.Typing themes — the only file in the GG UI with colour values.
 *
 * A theme is six base colours and a glass recipe. Everything else a component
 * uses — tints, hairlines, the glass fill, dimmed passed text — is derived from
 * these in `styles/gg-foundation.css` with `color-mix()`. So adding a theme is
 * adding one object to `GG_THEMES`, and no component ever reads a theme name.
 *
 * Every theme is held to a contrast floor by `themes.test.ts`; see
 * TOKEN_PLAN.md for the numbers and why each one applies.
 */

export type ThemeScheme = 'light' | 'dark'

export interface GGTheme {
  readonly id: string
  readonly name: string
  readonly scheme: ThemeScheme
  readonly colors: {
    /** The page. A true surface, never a tinted near-black standing in for one. */
    readonly bg: string
    /** Base of the glass materials: top bar, theme panel, input. */
    readonly surface: string
    /** Text, and the words still to type. */
    readonly fg: string
    /** Secondary text: labels, inactive controls, `.TYPING`. */
    readonly muted: string
    /** The one decorative colour: `GG`, active tints, the cursor, focus. */
    readonly accent: string
    /** The underline on an incorrect character. */
    readonly error: string
  }
  readonly glass: {
    /** `saturate()` inside the backdrop filter, in percent. */
    readonly saturate: number
    /** Border strength, as a percentage of `fg`. */
    readonly borderPercent: number
    /** The faint top edge that catches a fake light source, as white at this alpha. */
    readonly highlightAlpha: number
  }
}

const LIGHT_GLASS = { saturate: 180, borderPercent: 12, highlightAlpha: 0.18 } as const
// Dark glass drops the saturation, which only muddies near-black, and lifts the
// border so the edge is still legible against it.
const DARK_GLASS = { saturate: 120, borderPercent: 16, highlightAlpha: 0.06 } as const

export const GG_THEMES = [
  {
    id: 'default-light',
    name: 'Default (Light)',
    scheme: 'light',
    colors: {
      bg: '#fafafa',
      surface: '#ffffff',
      fg: '#18181b',
      muted: '#63636b',
      accent: '#2563eb',
      error: '#d92d20',
    },
    glass: LIGHT_GLASS,
  },
  {
    id: 'classic',
    name: 'Classic',
    scheme: 'light',
    colors: {
      bg: '#f2ede3',
      surface: '#faf7f0',
      fg: '#2a2622',
      muted: '#6b6359',
      accent: '#1f4e8c',
      error: '#b42318',
    },
    glass: LIGHT_GLASS,
  },
  {
    id: 'lemondrop',
    name: 'Lemondrop',
    scheme: 'light',
    colors: {
      bg: '#fff8d6',
      surface: '#fffcea',
      fg: '#2b260f',
      muted: '#6a6038',
      accent: '#8a5a00',
      error: '#c0262d',
    },
    glass: LIGHT_GLASS,
  },
  {
    id: 'default-dark',
    name: 'Default (Dark)',
    scheme: 'dark',
    colors: {
      bg: '#0a0a0b',
      surface: '#161618',
      fg: '#ececef',
      muted: '#94949c',
      accent: '#6cb4ff',
      error: '#ff6b6b',
    },
    glass: DARK_GLASS,
  },
  {
    id: 'glow',
    name: 'Glow',
    scheme: 'dark',
    colors: {
      bg: '#060607',
      surface: '#111113',
      fg: '#e4efe9',
      muted: '#83918a',
      accent: '#3dffa8',
      error: '#ff5d6c',
    },
    glass: DARK_GLASS,
  },
  {
    id: 'valentine',
    name: 'Valentine',
    scheme: 'dark',
    colors: {
      bg: '#0b0a0b',
      surface: '#171516',
      fg: '#f3e9ec',
      muted: '#a0929a',
      accent: '#ff7eb0',
      error: '#ff5a4e',
    },
    glass: DARK_GLASS,
  },
] as const satisfies readonly GGTheme[]

export type GGThemeId = (typeof GG_THEMES)[number]['id']

export const DEFAULT_THEME_ID: GGThemeId = 'default-dark'

/**
 * The theme a stored preference names, or null if it names none.
 *
 * Checked against this registry because the value came off disk. Versions
 * before GG.Typing stored `dark` or `light`; those carry over to the default
 * theme of the same scheme rather than being thrown away.
 */
export const themeIdFromStored = (value: unknown): GGThemeId | null => {
  if (value === 'dark') return DEFAULT_THEME_ID
  if (value === 'light') return 'default-light'
  return GG_THEMES.find((theme) => theme.id === value)?.id ?? null
}

export const themeById = (id: string): GGTheme =>
  GG_THEMES.find((theme) => theme.id === id) ??
  (GG_THEMES.find((theme) => theme.id === DEFAULT_THEME_ID) as GGTheme)

/**
 * The custom properties a theme writes to `:root`. Components never read these
 * names directly — they read the semantic tokens in gg-foundation.css, which are
 * built from them.
 */
export const themeProperties = (theme: GGTheme): Readonly<Record<string, string>> => ({
  '--gg-base-bg': theme.colors.bg,
  '--gg-base-surface': theme.colors.surface,
  '--gg-base-fg': theme.colors.fg,
  '--gg-base-muted': theme.colors.muted,
  '--gg-base-accent': theme.colors.accent,
  '--gg-base-error': theme.colors.error,
  '--gg-glass-saturate': `${theme.glass.saturate}%`,
  '--gg-glass-border-percent': `${theme.glass.borderPercent}%`,
  '--gg-glass-highlight-alpha': String(theme.glass.highlightAlpha),
  'color-scheme': theme.scheme,
})

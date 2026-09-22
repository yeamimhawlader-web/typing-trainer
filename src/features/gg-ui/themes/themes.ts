/**
 * GG.Typing themes — the only file in the GG UI with colour values.
 *
 * A theme is six base colours and a glass recipe. Everything else a component
 * uses — tints, hairlines, the glass material, dimmed passed text, the page's
 * light — is derived from these in `styles/gg-foundation.css` with `color-mix()`.
 * So adding a theme is adding one object to `GG_THEMES`, and no component ever
 * reads a theme name.
 *
 * Every theme is held to a contrast floor by `themes.test.ts`, on the page and
 * through its glass; see TOKEN_PLAN.md for the numbers and why each one applies.
 */

export type ThemeScheme = 'light' | 'dark'

/**
 * How a theme's glass is made. Numbers only: the colours come from the theme's
 * own surface, text and accent, so glass is always the same material as the
 * page it sits on.
 */
export interface GlassRecipe {
  /** Backdrop blur, in pixels. */
  readonly blur: number
  /** `saturate()` inside the backdrop filter, in percent. */
  readonly saturate: number
  /** How much of the surface colour the ordinary glass fill holds, in percent. */
  readonly fill: number
  /** The denser fill: the input, and a chosen branch. In percent. */
  readonly fillStrong: number
  /** Border strength, as a percentage of `fg`. */
  readonly borderPercent: number
  /** The bright edge and inner light that catch a fake light source, as white at this alpha. */
  readonly highlightAlpha: number
  /** Strength of the soft shadow under raised glass, in percent of the theme's shade. */
  readonly shadowPercent: number
  /** How much of the accent the glass reflects, in percent. */
  readonly tintPercent: number
  /** Strength of the barely-there light across the page, in percent. Zero for none. */
  readonly ambientPercent: number
}

export interface GGTheme {
  readonly id: string
  readonly name: string
  readonly scheme: ThemeScheme
  readonly colors: {
    /** The page. A true surface, never a tinted near-black standing in for one. */
    readonly bg: string
    /** Base of the glass materials: top bar, theme panel, input, Hover Mode's selector. */
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
  readonly glass: GlassRecipe
}

const LIGHT_GLASS: GlassRecipe = {
  blur: 20,
  saturate: 180,
  fill: 70,
  fillStrong: 85,
  borderPercent: 12,
  highlightAlpha: 0.18,
  shadowPercent: 10,
  tintPercent: 4,
  ambientPercent: 0,
}

// Dark glass drops the saturation, which only muddies near-black, and lifts the
// border so the edge is still legible against it. Its depth is its edge light:
// a shadow on near-black has nothing to fall on.
const DARK_GLASS: GlassRecipe = {
  blur: 20,
  saturate: 120,
  fill: 70,
  fillStrong: 85,
  borderPercent: 16,
  highlightAlpha: 0.07,
  shadowPercent: 60,
  tintPercent: 6,
  ambientPercent: 0,
}

// Milk glass: lighter than the page it sits on, so it reads as a pane of the
// same cream rather than a white card; a brighter inner light, a warmer
// reflection of the accent, and a faint light across the page behind it.
const MILK_GLASS: GlassRecipe = {
  blur: 18,
  saturate: 140,
  fill: 62,
  fillStrong: 84,
  borderPercent: 10,
  highlightAlpha: 0.6,
  shadowPercent: 9,
  tintPercent: 7,
  ambientPercent: 80,
}

export const GG_THEMES = [
  {
    id: 'classic-milk',
    name: 'Classic Milk',
    scheme: 'light',
    colors: {
      bg: '#f7f4ee',
      surface: '#fefcf8',
      fg: '#24221e',
      muted: '#6a655d',
      accent: '#86592f',
      error: '#b42318',
    },
    glass: MILK_GLASS,
  },
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
    // Pale sky and lavender, the look of a well-known typing test, with the
    // lavender taken dark enough to be read as text.
    id: 'lavender-sky',
    name: 'Lavender Sky',
    scheme: 'light',
    colors: {
      bg: '#e6f1f8',
      surface: '#f5fafd',
      fg: '#1d2430',
      muted: '#535d6c',
      accent: '#6a3fbf',
      error: '#c0262d',
    },
    glass: LIGHT_GLASS,
  },
  {
    id: 'mint',
    name: 'Mint',
    scheme: 'light',
    colors: {
      bg: '#eaf6ef',
      surface: '#f7fcf9',
      fg: '#15241c',
      muted: '#4d6157',
      accent: '#0b7650',
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
    // Arctic slate: a blue-grey page, frost-blue accent.
    id: 'nord',
    name: 'Nord',
    scheme: 'dark',
    colors: {
      bg: '#2e3440',
      surface: '#3b4252',
      fg: '#eceff4',
      muted: '#b4bcc9',
      accent: '#88c0d0',
      error: '#ff8a8a',
    },
    glass: DARK_GLASS,
  },
  {
    id: 'midnight',
    name: 'Midnight',
    scheme: 'dark',
    colors: {
      bg: '#0d0f1e',
      surface: '#171a2e',
      fg: '#e7e8f6',
      muted: '#9a9dbd',
      accent: '#a78bfa',
      error: '#ff6b81',
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

/**
 * The theme a fresh installation opens in, and the fallback for an id this build
 * does not know. A theme someone already chose is never replaced by it: the
 * default only fills a preference that was never saved.
 */
export const DEFAULT_THEME_ID: GGThemeId = 'classic-milk'

/**
 * The theme a stored preference names, or null if it names none.
 *
 * Checked against this registry because the value came off disk. Versions
 * before GG.Typing stored `dark` or `light`; those carry over to the default
 * theme of the same scheme rather than being thrown away.
 */
export const themeIdFromStored = (value: unknown): GGThemeId | null => {
  if (value === 'dark') return 'default-dark'
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
  // What shadows are made of: the text colour on a light page, the page itself
  // on a dark one, where a light shadow would read as a glow.
  '--gg-base-shade': theme.scheme === 'light' ? theme.colors.fg : theme.colors.bg,
  '--gg-glass-blur-size': `${theme.glass.blur}px`,
  '--gg-glass-saturate': `${theme.glass.saturate}%`,
  '--gg-glass-fill-percent': `${theme.glass.fill}%`,
  '--gg-glass-fill-strong-percent': `${theme.glass.fillStrong}%`,
  '--gg-glass-border-percent': `${theme.glass.borderPercent}%`,
  '--gg-glass-highlight-alpha': String(theme.glass.highlightAlpha),
  '--gg-glass-shadow-percent': `${theme.glass.shadowPercent}%`,
  '--gg-glass-tint-percent': `${theme.glass.tintPercent}%`,
  '--gg-ambient-percent': `${theme.glass.ambientPercent}%`,
  'color-scheme': theme.scheme,
})

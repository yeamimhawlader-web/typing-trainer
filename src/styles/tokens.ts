/**
 * Typed access to design tokens from TypeScript.
 *
 * IMPORTANT: this file mirrors token *names*, never token *values*. The values
 * live in tokens.css and only there. Duplicating them here would create two
 * sources of truth that drift apart silently.
 *
 * Use this when a token is needed somewhere CSS cannot reach — inline styles
 * driven by data, or (later) the canvas renderer for the typing surface, which
 * will resolve these through getComputedStyle.
 *
 * In ordinary component CSS, write `var(--color-char-correct)` directly.
 */

const cssVar = <T extends string>(name: T): `var(--${T})` => `var(--${name})`

export const color = {
  bgBase: cssVar('color-bg-base'),
  bgRaised: cssVar('color-bg-raised'),
  bgInset: cssVar('color-bg-inset'),
  bgHover: cssVar('color-bg-hover'),
  bgOverlay: cssVar('color-bg-overlay'),

  textPrimary: cssVar('color-text-primary'),
  textSecondary: cssVar('color-text-secondary'),
  textTertiary: cssVar('color-text-tertiary'),
  textOnAccent: cssVar('color-text-on-accent'),

  borderSubtle: cssVar('color-border-subtle'),
  borderDefault: cssVar('color-border-default'),
  borderStrong: cssVar('color-border-strong'),

  accentBase: cssVar('color-accent-base'),
  accentHover: cssVar('color-accent-hover'),
  accentActive: cssVar('color-accent-active'),
  accentSubtle: cssVar('color-accent-subtle'),

  statusSuccess: cssVar('color-status-success'),
  statusWarning: cssVar('color-status-warning'),
  statusDanger: cssVar('color-status-danger'),

  charPending: cssVar('color-char-pending'),
  charCorrect: cssVar('color-char-correct'),
  charIncorrect: cssVar('color-char-incorrect'),
  charIncorrectBg: cssVar('color-char-incorrect-bg'),
  charCorrected: cssVar('color-char-corrected'),
  caret: cssVar('color-caret'),
} as const

export const space = {
  0: cssVar('space-0'),
  1: cssVar('space-1'),
  2: cssVar('space-2'),
  3: cssVar('space-3'),
  4: cssVar('space-4'),
  5: cssVar('space-5'),
  6: cssVar('space-6'),
  8: cssVar('space-8'),
  10: cssVar('space-10'),
  12: cssVar('space-12'),
  16: cssVar('space-16'),
  20: cssVar('space-20'),
  24: cssVar('space-24'),
} as const

export const fontSize = {
  '2xs': cssVar('font-size-2xs'),
  xs: cssVar('font-size-xs'),
  sm: cssVar('font-size-sm'),
  md: cssVar('font-size-md'),
  lg: cssVar('font-size-lg'),
  xl: cssVar('font-size-xl'),
  '2xl': cssVar('font-size-2xl'),
  '3xl': cssVar('font-size-3xl'),
  '4xl': cssVar('font-size-4xl'),
  typing: cssVar('font-size-typing'),
} as const

export const radius = {
  none: cssVar('radius-none'),
  xs: cssVar('radius-xs'),
  sm: cssVar('radius-sm'),
  md: cssVar('radius-md'),
  lg: cssVar('radius-lg'),
  xl: cssVar('radius-xl'),
  full: cssVar('radius-full'),
} as const

export const shadow = {
  xs: cssVar('shadow-xs'),
  sm: cssVar('shadow-sm'),
  md: cssVar('shadow-md'),
  lg: cssVar('shadow-lg'),
  focusRing: cssVar('shadow-focus-ring'),
} as const

export const duration = {
  instant: cssVar('duration-instant'),
  fast: cssVar('duration-fast'),
  base: cssVar('duration-base'),
  slow: cssVar('duration-slow'),
} as const

export const easing = {
  standard: cssVar('ease-standard'),
  entrance: cssVar('ease-entrance'),
  exit: cssVar('ease-exit'),
} as const

export const zIndex = {
  base: cssVar('z-base'),
  sticky: cssVar('z-sticky'),
  overlay: cssVar('z-overlay'),
  modal: cssVar('z-modal'),
  toast: cssVar('z-toast'),
} as const

export const tokens = {
  color,
  space,
  fontSize,
  radius,
  shadow,
  duration,
  easing,
  zIndex,
} as const

export type ColorToken = keyof typeof color
export type SpaceToken = keyof typeof space
export type FontSizeToken = keyof typeof fontSize

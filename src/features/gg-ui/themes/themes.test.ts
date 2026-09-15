/**
 * Theme guard.
 *
 * Holds every theme to the contrast floors in TOKEN_PLAN.md. The other half of
 * the promise — that a theme is one object, named by no component — is checked
 * by src/styles/gg-ui-sources.test.ts, which reads source files and so runs
 * under Node.
 *
 * Contrast is computed the way the browser will draw it: passed characters are
 * `color-mix(in oklab, fg 62%, bg)`, and the words two lines ahead are the text
 * at 55% alpha composited over the background.
 */

import { describe, expect, it } from 'vitest'

import { DEFAULT_THEME_ID, GG_THEMES, themeById, themeProperties, type GGTheme } from './themes.ts'

type Rgb = readonly [number, number, number]

const hexToRgb = (hex: string): Rgb => {
  const value = Number.parseInt(hex.slice(1), 16)
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

const linear = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4

const encode = (channel: number): number =>
  channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055

const luminance = ([r, g, b]: Rgb): number =>
  0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)

const contrast = (a: Rgb, b: Rgb): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

const toOklab = (rgb: Rgb): Rgb => {
  const [r, g, b] = rgb.map(linear) as unknown as Rgb
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

const fromOklab = ([lightness, a, b]: Rgb): Rgb => {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clamp = (value: number) => Math.min(1, Math.max(0, encode(value)))
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

/** `color-mix(in oklab, a share, b)`. */
const mixOklab = (a: Rgb, b: Rgb, share: number): Rgb => {
  const [x, y] = [toOklab(a), toOklab(b)]
  return fromOklab([0, 1, 2].map((i) => (x[i] as number) * share + (y[i] as number) * (1 - share)) as unknown as Rgb)
}

/** A colour at `alpha` composited over a background, as opacity is. */
const over = (foreground: Rgb, background: Rgb, alpha: number): Rgb =>
  [0, 1, 2].map((i) => (foreground[i] as number) * alpha + (background[i] as number) * (1 - alpha)) as unknown as Rgb

const colours = (theme: GGTheme) => {
  const c = theme.colors
  return {
    bg: hexToRgb(c.bg),
    surface: hexToRgb(c.surface),
    fg: hexToRgb(c.fg),
    muted: hexToRgb(c.muted),
    accent: hexToRgb(c.accent),
    error: hexToRgb(c.error),
  }
}

describe('GG themes', () => {
  it('are the six the design names, three light and three dark', () => {
    const names = (scheme: string) => GG_THEMES.filter((theme) => theme.scheme === scheme).map((theme) => theme.name)

    expect(names('light')).toEqual(['Default (Light)', 'Classic', 'Lemondrop'])
    expect(names('dark')).toEqual(['Default (Dark)', 'Glow', 'Valentine'])
  })

  it('opens on Default (Dark), and falls back to it for an unknown id', () => {
    expect(DEFAULT_THEME_ID).toBe('default-dark')
    expect(themeById('no-such-theme').id).toBe('default-dark')
  })

  it('gives every theme a unique id and name', () => {
    expect(new Set(GG_THEMES.map((theme) => theme.id)).size).toBe(GG_THEMES.length)
    expect(new Set(GG_THEMES.map((theme) => theme.name)).size).toBe(GG_THEMES.length)
  })

  it('writes the same custom properties for every theme, so components can rely on them', () => {
    const keys = (theme: GGTheme) => Object.keys(themeProperties(theme)).sort()

    for (const theme of GG_THEMES) expect(keys(theme)).toEqual(keys(GG_THEMES[0]))
  })

  it('uses six-digit hex for every colour, so the checks below read them exactly', () => {
    for (const theme of GG_THEMES) {
      for (const value of Object.values(theme.colors)) expect(value).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  describe.each(GG_THEMES.map((theme) => [theme.name, theme] as const))('%s contrast', (_name, theme) => {
    const c = colours(theme)

    it('keeps text, secondary text and accent text at 4.5:1 on the page and on glass', () => {
      for (const surface of [c.bg, c.surface]) {
        expect(contrast(c.fg, surface)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(c.muted, surface)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(c.accent, surface)).toBeGreaterThanOrEqual(4.5)
      }
    })

    it('keeps the error underline at 3:1, the floor for a mark that carries meaning', () => {
      expect(contrast(c.error, c.bg)).toBeGreaterThanOrEqual(3)
    })

    it('keeps passed characters readable at 4.5:1', () => {
      expect(contrast(mixOklab(c.fg, c.bg, 0.62), c.bg)).toBeGreaterThanOrEqual(4.5)
    })

    it('keeps words two lines ahead at 3:1 when faded to 55%', () => {
      expect(contrast(over(c.fg, c.bg, 0.55), c.bg)).toBeGreaterThanOrEqual(3)
    })
  })
})

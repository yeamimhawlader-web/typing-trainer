/**
 * Design-token guard.
 *
 * Every colour in this application comes from a token — there is not a single
 * hex or `oklch()` literal in any component stylesheet, and a test below keeps
 * it that way. That is an unusually strong position to be in, and it is what
 * makes this file worth writing: because the tokens are the only source of
 * colour, checking the tokens checks the whole product.
 *
 * ## Why this exists
 *
 * Aesthetic work pushes in one direction. Contrast gets softer, greys get
 * closer together, and the person making the change is the last to notice,
 * because to them it looks better. The failure is silent, it is invisible in a
 * screenshot, and there is no error in the console.
 *
 * The evidence it had already happened here: `--color-status-warning` measured
 * **2.65:1** in the light theme while being used for 14px text, against a 4.5:1
 * bar. Nobody saw it because the application opens in dark mode. Meanwhile the
 * dark theme's caption colour sat at 4.23:1. Both were found by running these
 * numbers for the first time, not by looking.
 *
 * There were already two comments in `tokens.css` quoting measured ratios —
 * "2.76:1", "4.21:1" — from a hand calculation someone did once. Nothing kept
 * those true. Now something does, and the comments and the assertions agree.
 *
 * ## What is asserted, and at which level
 *
 * WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for large text (>=24px) and for
 * non-text things that are the only way to identify a control.
 *
 * Each pairing below is set at the level its **actual current usage** demands,
 * with the usage named. That matters: a bar copied from a specification without
 * looking at how the colour is used is either too strict, and gets deleted the
 * first time it is inconvenient, or too loose and catches nothing.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const tokensPath = fileURLToPath(new URL('./tokens.css', import.meta.url))
const srcPath = fileURLToPath(new URL('..', import.meta.url))
const css = readFileSync(tokensPath, 'utf8')

/* ------------------------------------------------------------------ *
 * Colour maths: OKLCH to WCAG relative luminance.
 *
 * Done here rather than with a library because it is forty lines of published
 * matrix arithmetic and a dependency that renders colour is a large thing to
 * take on for one test. The intermediate value WCAG wants — linear sRGB — is
 * also the one this produces on the way, so there is no gamma round trip.
 * ------------------------------------------------------------------ */

interface Oklch {
  readonly l: number
  readonly c: number
  readonly h: number
  readonly alpha: number
}

const parseOklch = (value: string): Oklch | null => {
  const match = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/i.exec(
    value,
  )
  if (match === null) return null

  return {
    l: Number(match[1]) / 100,
    c: Number(match[2]),
    h: Number(match[3]),
    alpha: match[4] === undefined ? 1 : Number(match[4]),
  }
}

type Rgb = readonly [number, number, number]

/** OKLCH to linear sRGB, clamped into gamut. */
const toLinearRgb = ({ l: lightness, c: chroma, h: hue }: Oklch): Rgb => {
  const radians = (hue * Math.PI) / 180
  const a = chroma * Math.cos(radians)
  const b = chroma * Math.sin(radians)

  const lCube = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mCube = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const sCube = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3

  const clamp = (value: number): number => Math.min(1, Math.max(0, value))

  return [
    clamp(4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube),
    clamp(-1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube),
    clamp(-0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube),
  ]
}

const relativeLuminance = ([r, g, b]: Rgb): number => 0.2126 * r + 0.7152 * g + 0.0722 * b

const contrastRatio = (a: Rgb, b: Rgb): number => {
  const [brighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  ) as [number, number]

  return (brighter + 0.05) / (darker + 0.05)
}

/** A translucent colour composited over what sits behind it. */
const composite = (colour: Rgb, alpha: number, backdrop: Rgb): Rgb =>
  [0, 1, 2].map(
    (index) => (colour[index] as number) * alpha + (backdrop[index] as number) * (1 - alpha),
  ) as unknown as Rgb

/* ------------------------------------------------------------------ *
 * Reading the stylesheet.
 * ------------------------------------------------------------------ */

const blockFor = (selector: string): string => {
  const selectorAt = css.indexOf(selector)
  if (selectorAt < 0) throw new Error(`selector not found: ${selector}`)

  const open = css.indexOf('{', selectorAt)
  let depth = 0

  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1
    else if (css[index] === '}') {
      depth -= 1
      if (depth === 0) return css.slice(open + 1, index)
    }
  }

  throw new Error(`unbalanced braces after ${selector}`)
}

const declarationsIn = (block: string): ReadonlyMap<string, string> => {
  const declarations = new Map<string, string>()
  // Comments are stripped first, so a commented-out declaration is not read as
  // a live one — this file quotes example values inside comments.
  const withoutComments = block.replace(/\/\*[\s\S]*?\*\//g, '')

  for (const match of withoutComments.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    declarations.set(match[1] as string, (match[2] as string).trim().replace(/\s+/g, ' '))
  }

  return declarations
}

const dark = declarationsIn(blockFor(':root {'))
const light = declarationsIn(blockFor(":root[data-theme='light']"))

type Theme = 'dark' | 'light'

/** Follows `var()` references down to a literal. Light falls back to dark. */
const resolve = (name: string, theme: Theme, seen = new Set<string>()): string => {
  if (seen.has(name)) throw new Error(`circular token reference at ${name}`)
  seen.add(name)

  const raw = theme === 'light' ? (light.get(name) ?? dark.get(name)) : dark.get(name)
  if (raw === undefined) throw new Error(`undefined token: ${name}`)

  const reference = /^var\((--[a-z0-9-]+)\)$/i.exec(raw)
  return reference === null ? raw : resolve(reference[1] as string, theme, seen)
}

/**
 * A token as linear sRGB.
 *
 * `backdrop` is what a translucent token sits on. Evaluating one without it
 * would report the contrast of a colour nobody ever sees.
 */
const colourOf = (name: string, theme: Theme, backdrop?: Rgb): Rgb => {
  const parsed = parseOklch(resolve(name, theme))
  if (parsed === null) throw new Error(`token is not an oklch colour: ${name}`)

  const rgb = toLinearRgb(parsed)
  if (parsed.alpha >= 1) return rgb

  if (backdrop === undefined) {
    throw new Error(`${name} is translucent and needs a backdrop to be measured`)
  }
  return composite(rgb, parsed.alpha, backdrop)
}

/* ------------------------------------------------------------------ *
 * The pairings.
 * ------------------------------------------------------------------ */

/** Normal text. */
const AA_TEXT = 4.5
/** Text at 24px and above, and controls identified by colour alone. */
const AA_LARGE = 3

interface Pairing {
  readonly foreground: string
  readonly background: string
  readonly minimum: number
  /** Where this actually appears, which is what justifies the level. */
  readonly usage: string
}

const PAIRINGS: readonly Pairing[] = [
  { foreground: '--color-text-primary', background: '--color-bg-base', minimum: AA_TEXT, usage: 'body copy' },
  { foreground: '--color-text-secondary', background: '--color-bg-base', minimum: AA_TEXT, usage: 'supporting copy' },
  { foreground: '--color-text-tertiary', background: '--color-bg-base', minimum: AA_TEXT, usage: 'captions and labels, 11-14px' },
  { foreground: '--color-text-primary', background: '--color-bg-raised', minimum: AA_TEXT, usage: 'body copy on a card' },
  { foreground: '--color-text-secondary', background: '--color-bg-raised', minimum: AA_TEXT, usage: 'supporting copy on a card' },
  { foreground: '--color-text-tertiary', background: '--color-bg-raised', minimum: AA_TEXT, usage: 'captions on a card' },
  { foreground: '--color-text-tertiary', background: '--color-bg-inset', minimum: AA_TEXT, usage: 'captions on an inset panel' },
  { foreground: '--color-text-primary', background: '--color-bg-inset', minimum: AA_TEXT, usage: 'the sequence chip on an inset ground' },
  { foreground: '--color-text-on-accent', background: '--color-accent-base', minimum: AA_TEXT, usage: 'primary button label' },
  { foreground: '--color-accent-base', background: '--color-bg-base', minimum: AA_TEXT, usage: 'links' },
  { foreground: '--color-status-warning', background: '--color-bg-base', minimum: AA_TEXT, usage: 'the unsaved-session warning, 14px' },
  { foreground: '--color-status-danger', background: '--color-bg-base', minimum: AA_TEXT, usage: 'destructive control labels' },
  { foreground: '--color-status-success', background: '--color-bg-base', minimum: AA_TEXT, usage: 'reserved for status text' },

  // The typing surface is 28px, so the large-text bar applies to its states.
  { foreground: '--color-char-pending', background: '--color-bg-base', minimum: AA_LARGE, usage: 'text not yet typed, 28px' },
  { foreground: '--color-char-correct', background: '--color-bg-base', minimum: AA_LARGE, usage: 'typed correctly, 28px' },
  { foreground: '--color-char-incorrect', background: '--color-bg-base', minimum: AA_LARGE, usage: 'mistyped, 28px' },
  { foreground: '--color-char-corrected', background: '--color-bg-base', minimum: AA_LARGE, usage: 'fixed after a mistake, 28px' },

  // The caret is the only thing showing where you are, so it must carry on its
  // own rather than being findable only by motion.
  { foreground: '--color-caret', background: '--color-bg-base', minimum: AA_LARGE, usage: 'the caret' },

  // Not against a background: the difference between two states of the same
  // text. If these converge, the typing surface stops being readable at speed
  // even though every individual colour still passes.
  { foreground: '--color-char-correct', background: '--color-char-pending', minimum: AA_LARGE, usage: 'typed against untyped' },
]

/**
 * Measured shortfalls, held where they are rather than fixed.
 *
 * A ratchet, not an endorsement. Each entry is a real number that is lower
 * than it should be, recorded so it cannot quietly get worse while the
 * decision about whether to change it is still open.
 *
 * The one entry here is worth understanding. A mistyped character and one not
 * yet typed differ by **1.01:1** in the light theme and 1.37:1 in the dark
 * one — which is to say they are the same lightness and differ only in hue.
 * Red against grey. Anyone with red-green colour blindness is relying on the
 * faint background tint behind the character, and peripheral vision, which is
 * what notices an error at 130 WPM, works mostly on lightness too.
 *
 * The colours are not changed to fix it, for two reasons. There is no standard
 * that demands a ratio between two text states, so any bar would be invented;
 * and the error colour is the most visually loaded decision on the typing
 * screen. Instead a mistyped character now also carries a bar along its bottom
 * edge (`.incorrect` in `TypingSurface.module.css`), so the difference no
 * longer rests on hue alone. The test at the end of this file keeps that bar
 * from being quietly removed.
 */
const KNOWN_GAPS: readonly (Pairing & { readonly measured: number })[] = [
  {
    foreground: '--color-char-incorrect',
    background: '--color-char-pending',
    minimum: AA_LARGE,
    measured: 1.37,
    usage: 'mistyped against untyped, dark',
  },
  {
    foreground: '--color-char-incorrect',
    background: '--color-char-pending',
    minimum: AA_LARGE,
    measured: 1.01,
    usage: 'mistyped against untyped, light',
  },
]

const THEMES: readonly Theme[] = ['dark', 'light']

describe('design tokens', () => {
  describe('contrast', () => {
    for (const theme of THEMES) {
      describe(theme, () => {
        for (const { foreground, background, minimum, usage } of PAIRINGS) {
          it(`${foreground} on ${background} carries ${usage}`, () => {
            const base = colourOf('--color-bg-base', theme)
            const ratio = contrastRatio(
              colourOf(foreground, theme, base),
              colourOf(background, theme, base),
            )

            expect(
              Number(ratio.toFixed(2)),
              `${foreground} on ${background} in the ${theme} theme is ${ratio.toFixed(2)}:1, below the ${minimum}:1 needed for ${usage}`,
            ).toBeGreaterThanOrEqual(minimum)
          })
        }
      })
    }
  })

  describe('known shortfalls do not get worse', () => {
    const measuredIn: Record<Theme, number> = { dark: 1.37, light: 1.01 }

    for (const theme of THEMES) {
      it(`holds the mistyped-against-untyped gap in the ${theme} theme`, () => {
        const base = colourOf('--color-bg-base', theme)
        const ratio = contrastRatio(
          colourOf('--color-char-incorrect', theme, base),
          colourOf('--color-char-pending', theme, base),
        )

        // Allowed to improve, never to slip. If this ever reaches 3:1 the
        // entry belongs in PAIRINGS and this block should lose it.
        expect(Number(ratio.toFixed(2))).toBeGreaterThanOrEqual(measuredIn[theme])
        expect(KNOWN_GAPS.some((gap) => gap.measured === measuredIn[theme])).toBe(true)
      })
    }
  })

  describe('themes stay in step', () => {
    const colourNames = (theme: ReadonlyMap<string, string>): readonly string[] =>
      [...theme.keys()].filter((name) => name.startsWith('--color-')).sort()

    it('remaps every colour the dark theme defines', () => {
      // The classic silent break: a token added to one theme and forgotten in
      // the other, which nobody sees until they switch.
      expect(colourNames(light)).toEqual(colourNames(dark))
    })

    it('resolves every colour token in both themes', () => {
      for (const theme of THEMES) {
        for (const name of colourNames(dark)) {
          expect(() => colourOf(name, theme, [0, 0, 0]), `${name} in ${theme}`).not.toThrow()
        }
      }
    })
  })

  describe('colour lives only in the token file', () => {
    const stylesheets = readdirSync(srcPath, { recursive: true, encoding: 'utf8' })
      .filter((entry) => entry.endsWith('.css'))
      .filter((entry) => !entry.endsWith('tokens.css'))

    it('finds no literal colours in component stylesheets', () => {
      const offenders: string[] = []

      for (const relative of stylesheets) {
        const contents = readFileSync(`${srcPath}/${relative}`, 'utf8').replace(
          /\/\*[\s\S]*?\*\//g,
          '',
        )

        for (const match of contents.matchAll(
          /(#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\()/gi,
        )) {
          offenders.push(`${relative}: ${match[0]}`)
        }
      }

      // Every assertion above is about tokens. They are only worth anything
      // while the tokens are the only place colour comes from.
      expect(offenders).toEqual([])
    })

    it('checked a realistic number of stylesheets', () => {
      // Guards the guard: a glob that silently matched nothing would make the
      // test above pass forever.
      expect(stylesheets.length).toBeGreaterThan(10)
    })
  })

  describe('a mistyped character is not marked by colour alone', () => {
    it('keeps the bar that separates it from an untyped one', () => {
      // See KNOWN_GAPS: the two states are the same lightness, so this shape is
      // what carries the difference for anyone who cannot rely on hue.
      const surface = readFileSync(
        `${srcPath}/features/typing/components/TypingSurface.module.css`,
        'utf8',
      ).replace(/\/\*[\s\S]*?\*\//g, '')
      const incorrect = /\.incorrect\s*\{([^}]*)\}/.exec(surface)?.[1] ?? ''

      expect(incorrect).toMatch(/box-shadow:\s*inset\s+0\s+-[\d.]+em\s+0\s+var\(--color-char-incorrect\)/)
    })
  })
})

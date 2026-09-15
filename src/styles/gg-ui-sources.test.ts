/**
 * GG.Typing UI source guard.
 *
 * The theme system promises that adding a theme is one object in
 * `features/gg-ui/themes/themes.ts`. That only stays true while nothing else in
 * the GG UI holds a colour or knows a theme by name, so both are checked here
 * against the source text. It lives beside the design-token guard because it is
 * the same kind of check and needs the same thing: files read from disk.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { restMs, springAt } from '../features/gg-ui/components/HoverSelector/spring.ts'
import { TOUCH_SPRING } from '../features/gg-ui/components/HoverSelector/unfold.motion.ts'
import { GG_THEMES } from '../features/gg-ui/themes/themes.ts'

const root = fileURLToPath(new URL('../features/gg-ui', import.meta.url))

const sources = readdirSync(root, { recursive: true, encoding: 'utf8' })
  .filter((file) => /\.(tsx?|css)$/.test(file))
  .filter((file) => !file.includes('.test.'))
  .filter((file) => !/themes[\\/]themes\.ts$/.test(file))
  .map((file) => ({
    file,
    // Comments may talk about colours and themes; code may not.
    contents: readFileSync(`${root}/${file}`, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''),
  }))

describe('GG.Typing UI sources', () => {
  it('checked a realistic number of files', () => {
    // Guards the guard: a path that matched nothing would pass forever.
    expect(sources.length).toBeGreaterThan(15)
  })

  it('hold no colour value outside the theme file', () => {
    const offenders = sources.flatMap(({ file, contents }) =>
      [...contents.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g)].map(
        (match) => `${file}: ${match[0]}`,
      ),
    )

    expect(offenders).toEqual([])
  })

  it('never name a theme, so adding one needs no component change', () => {
    const offenders = sources.flatMap(({ file, contents }) =>
      GG_THEMES.flatMap((theme) =>
        [theme.name, `'${theme.id}'`]
          .filter((needle) => contents.includes(needle))
          .map((needle) => `${file}: ${needle}`),
      ),
    )

    expect(offenders).toEqual([])
  })

  describe('glass', () => {
    const stylesheets = sources.filter(({ file }) => file.endsWith('.css'))
    const foundation = stylesheets.find(({ file }) => /gg-foundation\.css$/.test(file))
    const components = stylesheets.filter((sheet) => sheet !== foundation)

    it('is defined once, as tokens, in the foundation', () => {
      for (const token of [
        '--gg-glass-fill:',
        '--gg-glass-fill-strong:',
        '--gg-glass-border:',
        '--gg-glass-highlight:',
        '--gg-glass-shadow:',
        '--gg-glass-blur:',
        '--gg-glass-surface-tint:',
        '--gg-glass-active-tint:',
      ]) {
        expect(foundation?.contents).toContain(token)
      }
    })

    it('is only ever made from those tokens: no blur, backdrop or glass shadow written by hand', () => {
      const offenders = components.flatMap(({ file, contents }) => [
        ...[...contents.matchAll(/backdrop-filter:\s*([^;]+);/g)]
          .filter((match) => match[1]?.trim() !== 'var(--gg-glass-filter)')
          .map((match) => `${file}: ${match[0]}`),
        ...[...contents.matchAll(/blur\(/g)].map((match) => `${file}: ${match[0]}`),
      ])

      expect(offenders).toEqual([])
    })

    it('stays in the chrome: nothing in the word stream is glass', () => {
      const stream = components.filter(({ file }) => /WordStream|HoverFocus/.test(file))

      expect(stream.length).toBeGreaterThan(0)
      for (const { contents } of stream) expect(contents).not.toMatch(/--gg-glass-(fill|filter)/)
    })

    it('falls back to solid surface where transparency is unwanted', () => {
      expect(foundation?.contents).toMatch(/@media \(prefers-reduced-transparency: reduce\)[\s\S]*--gg-glass-filter: none/)
    })
  })

  describe('motion', () => {
    const stylesheets = sources.filter(({ file }) => file.endsWith('.css'))

    it('never transitions a colour, so a theme switch and a state change land on one frame', () => {
      const offenders = stylesheets.flatMap(({ file, contents }) =>
        [...contents.matchAll(/transition(?:-property)?:\s*([^;]+);/g)]
          .filter((match) => /(color|background|background-color|border-color|fill|stroke|box-shadow|filter)/.test(match[1] ?? ''))
          .map((match) => `${file}: ${match[0]}`),
      )

      expect(offenders).toEqual([])
    })

    it('has no theme cross-fade left to bring back', () => {
      const foundation = stylesheets.find(({ file }) => /gg-foundation\.css$/.test(file))

      expect(foundation?.contents).not.toContain('--gg-duration-theme')
      expect(foundation?.contents).toMatch(/data-gg-theme-switching[\s\S]*transition: none !important/)
    })

    it('draws --gg-ease-touch from the touch spring itself', () => {
      const foundation = stylesheets.find(({ file }) => /gg-foundation\.css$/.test(file))
      const curve = foundation?.contents.match(/--gg-ease-touch:\s*linear\(([^)]*)\)/)?.[1]
      const stops = (curve ?? '')
        .split(',')
        .map((stop) => stop.trim().split(/\s+/))
        .filter((parts) => parts.length === 2)
        .map(([value, at]) => ({ value: Number(value), at: Number.parseFloat(at ?? '') / 100 }))
      const duration = restMs(TOUCH_SPRING, { value: 0, velocity: 0 }, 1)

      expect(stops.length).toBeGreaterThan(8)
      for (const stop of stops) {
        expect(springAt(TOUCH_SPRING, { value: 0, velocity: 0 }, 1, stop.at * duration).value).toBeCloseTo(stop.value, 2)
      }
      expect(foundation?.contents).toContain(`--gg-duration-touch: ${duration}ms`)
    })
  })

  describe("Hover Mode's selector on a narrow screen", () => {
    const selector = sources.find(({ file }) => /HoverSelector\.module\.css$/.test(file))

    it('holds no fixed width a phone could not fit', () => {
      const widths = [...(selector?.contents ?? '').matchAll(/(?:^|[\s;{])(min-width|width):\s*(\d+(?:\.\d+)?)(px|rem)/gm)].map(
        (match) => Number(match[2]) * (match[3] === 'rem' ? 16 : 1),
      )

      expect(selector).toBeDefined()
      expect(Math.max(0, ...widths)).toBeLessThanOrEqual(40)
    })

    it('stacks its branches under the node at phone widths, letting their text shrink', () => {
      expect(selector?.contents).toMatch(/@media \(max-width: 720px\)[\s\S]*flex-direction: column/)
      expect(selector?.contents).toMatch(/\.branch \{[^}]*min-width: 0/)
      expect(selector?.contents).toMatch(/\.text \{[^}]*min-width: 0/)
    })
  })
})

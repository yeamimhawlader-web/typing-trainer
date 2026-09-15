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
})

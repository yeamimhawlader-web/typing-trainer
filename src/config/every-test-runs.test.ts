/**
 * Every test file in the repository is actually run by one of the projects.
 *
 * Vitest here is split into two projects — a DOM-free one for the engine and a
 * jsdom one for everything that needs a browser — and each lists the folders it
 * takes, by hand (`vite.config.ts`). A folder nobody remembered to add is the
 * worst kind of gap: the tests in it are written, they are committed, they look
 * exactly like tests that run, and they are never executed. Nothing fails,
 * because nothing happens.
 *
 * Written after `src/core/preferences` was added and appeared in neither list.
 * The test suite would have reported green on a file it had never opened.
 *
 * This checks the config as text rather than asking vitest, because asking
 * vitest from inside vitest only ever tells you about the files it already
 * decided to run — which is the very thing in doubt.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../..', import.meta.url))
const config = readFileSync(`${root}/vite.config.ts`, 'utf8')

/**
 * The quoted patterns inside every `include:` array in the config, keeping
 * only those that name test files.
 *
 * Crude on purpose: a parser for the config would be a second thing that can
 * disagree with it. The filter is not cosmetic — coverage carries an
 * `include:` of its own, `src/**` + `*.{ts,tsx}`, which matches every test
 * file there could ever be. Counting it made the whole of this pass no matter
 * what, which is how the first version of this file was written and why it is
 * checked below against a folder that is deliberately left out.
 */
const patterns = Array.from(config.matchAll(/include:\s*\[([^\]]*)\]/g))
  .flatMap((block) => Array.from((block[1] as string).matchAll(/'([^']+)'/g), (found) => found[1] as string))
  .filter((pattern) => /\.test\./.test(pattern))

/**
 * A glob as a regular expression, covering the three things these patterns
 * use: `**` for any depth, `*` within one name, and `{ts,tsx}` for a choice.
 */
const asRegExp = (pattern: string): RegExp => {
  // One pass, so nothing already rewritten is rewritten again. The order of
  // the alternatives is the whole of it: `**/` before `*`, and `{ts,tsx}`
  // before the escape that would otherwise take the braces one at a time.
  // An earlier version did it in several passes, parking `**/` on a NUL in
  // between -- which worked, and put a control character in a regular
  // expression, which the linter rightly objects to.
  const source = pattern.replace(/\*\*\/|\*|\{[^}]*\}|[.+^$()|[\]\\{}]/g, (token) => {
    if (token === '**/') return '(?:.*/)?'
    if (token === '*') return '[^/]*'
    if (token.startsWith('{')) return `(?:${token.slice(1, -1).split(',').join('|')})`
    return `\\${token}`
  })
  return new RegExp(`^${source}$`)
}

const matchers = patterns.map(asRegExp)

const testFiles = readdirSync(`${root}/src`, { recursive: true, encoding: 'utf8' })
  .map((file) => `src/${file.replaceAll('\\', '/')}`)
  .filter((file) => /\.test\.tsx?$/.test(file))

describe('the test projects', () => {
  it('found the config and the test files at all', () => {
    // Guards the guard: either list coming back empty would pass forever.
    expect(patterns.length).toBeGreaterThan(10)
    expect(testFiles.length).toBeGreaterThan(50)
    // And every pattern kept is a test pattern, not coverage's catch-all.
    expect(patterns.filter((pattern) => !pattern.includes('.test.'))).toEqual([])
  })

  it('would notice a folder that no project lists', () => {
    // The guard proving itself: a folder nobody has listed must come back as
    // an orphan. Written because the first version of this file counted
    // coverage's `src/**` among the patterns and could never fail.
    const matchesSomething = (file: string): boolean => matchers.some((matches) => matches.test(file))

    expect(matchesSomething('src/core/nuggets/merge.test.ts')).toBe(true)
    expect(matchesSomething('src/core/not-a-real-folder/whatever.test.ts')).toBe(false)
  })

  it('reads a glob the way the runner does', () => {
    const matches = asRegExp('src/core/nuggets/**/*.test.ts')
    expect(matches.test('src/core/nuggets/merge.test.ts')).toBe(true)
    expect(matches.test('src/core/nuggets/deep/down/merge.test.ts')).toBe(true)
    expect(matches.test('src/core/nuggets/merge.ts')).toBe(false)
    expect(matches.test('src/core/preferences/merge.test.ts')).toBe(false)

    const both = asRegExp('src/app/**/*.test.{ts,tsx}')
    expect(both.test('src/app/router.test.tsx')).toBe(true)
    expect(both.test('src/app/routes.test.ts')).toBe(true)
  })

  it('runs every test file there is', () => {
    const orphans = testFiles.filter((file) => !matchers.some((matches) => matches.test(file))).toSorted()

    // Named rather than counted: the fix is to add the folder to the right
    // project in vite.config.ts, and knowing which file it is saves the hunt.
    expect(orphans).toEqual([])
  })
})

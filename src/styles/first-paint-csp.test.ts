/**
 * The first-paint script, as the Content-Security-Policy sees it.
 *
 * vercel.json allows scripts from this site and nothing inline, except the one
 * first-paint script, allowed by its hash. A new dark theme changes the script
 * and so its hash; with the old hash still in vercel.json the browser would
 * refuse to run it, and the page would flash the wrong scheme while it loads.
 * Here because it reads a file from disk (see tsconfig.node.json).
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { firstPaintScript } from '../features/gg-ui/themes/first-paint.ts'

type VercelConfig = { headers: { headers: { key: string; value: string }[] }[] }

const vercel = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../vercel.json', import.meta.url)), 'utf8'),
) as VercelConfig

const scriptSrc = (): string[] => {
  const csp = vercel.headers
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === 'Content-Security-Policy')
  const directive = csp?.value
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('script-src '))
  return directive?.split(/\s+/) ?? []
}

describe('the Content-Security-Policy', () => {
  it('allows the first-paint script by its hash', () => {
    const hash = createHash('sha256')
      .update(firstPaintScript(), 'utf8')
      .digest('base64')
    expect(scriptSrc()).toContain(`'sha256-${hash}'`)
  })

  it('allows no other inline script', () => {
    expect(scriptSrc()).not.toContain("'unsafe-inline'")
    expect(scriptSrc()).not.toContain("'unsafe-eval'")
  })
})

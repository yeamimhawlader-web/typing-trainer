/**
 * Every environment variable the code reads is named in `.env.example`.
 *
 * Written after `VITE_SUPABASE_GOOGLE` went missing from it. The variable was
 * read in `env.ts`, was the difference between a Google button appearing and
 * not appearing, and was described at length in `docs/SUPABASE.md` -- but
 * `.env.example` is the file people copy, and it had never heard of it. So
 * anyone who set up Google by copying that file got everything right and no
 * button, with nothing anywhere to say which of the dozen steps they had
 * missed.
 *
 * A variable that is read but not documented is the worst kind of
 * configuration: it works on the machine of whoever added it, and is
 * invisible to everyone else. This reads the source rather than the docs,
 * because the source is what actually decides.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const src = fileURLToPath(new URL('..', import.meta.url))
const example = readFileSync(
  fileURLToPath(new URL('../../.env.example', import.meta.url)),
  'utf8',
)

/** Every `import.meta.env.VITE_…` in the application, by name. */
const read = new Set(
  readdirSync(src, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file) && !file.includes('.test.'))
    .flatMap((file) =>
      Array.from(
        readFileSync(`${src}/${file}`, 'utf8').matchAll(
          /import\.meta\.env\.(VITE_[A-Z0-9_]+)/g,
        ),
        (match) => match[1] as string,
      ),
    ),
)

describe('the environment this build reads', () => {
  it('found the variables at all', () => {
    // Guards the guard: a pattern that matched nothing would pass forever.
    expect(read.size).toBeGreaterThanOrEqual(4)
    expect(read).toContain('VITE_SUPABASE_URL')
  })

  it('is described, name by name, in .env.example', () => {
    // Commented out is documentation, not configuration: a variable nobody
    // has to set is still a variable someone has to know about.
    const missing = [...read].filter((name) => !example.includes(name)).toSorted()
    expect(missing).toEqual([])
  })
})

/**
 * Reading the two values that switch accounts on.
 *
 * Both are public by design: the key is meant to be in the page, and what it
 * may touch is decided by row-level security in the database, not by keeping
 * it secret. Absent, the application runs as it always has, with everything
 * kept in the browser.
 *
 * The key is accepted under either name Supabase has used for it. Projects
 * made now are given a *publishable* key (`sb_publishable_…`); older ones have
 * an *anon* key, which Supabase is retiring at the end of 2026. Whichever a
 * dashboard shows is the one someone will paste, and being wrong about the
 * name should not look like being wrong about the key.
 *
 * Its own file so the rules can be tested without a module that reads the
 * environment as it loads.
 */

export interface AccountsConfig {
  readonly url: string
  /** The publishable (or legacy anon) key, whichever was given. */
  readonly anonKey: string
}

const trimmed = (value: string | undefined): string => value?.trim() ?? ''

export const parseAccounts = (
  url: string | undefined,
  /** The key, under each name it may arrive by; the first one given wins. */
  ...keys: readonly (string | undefined)[]
): AccountsConfig | null => {
  const given = { url: trimmed(url), anonKey: keys.map(trimmed).find((key) => key !== '') ?? '' }
  if (given.url === '' && given.anonKey === '') return null

  // Half-configured is a deployment mistake, not a choice: say so at startup
  // rather than failing on the first sign-in, when the typist is watching.
  if (given.url === '' || given.anonKey === '') {
    throw new Error(
      'VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) must be set together, or not at all',
    )
  }
  if (!given.url.startsWith('https://')) {
    throw new Error(`VITE_SUPABASE_URL must be an https:// address, received "${given.url}"`)
  }
  return given
}

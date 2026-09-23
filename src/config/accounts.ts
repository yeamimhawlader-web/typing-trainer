/**
 * Reading the two values that switch accounts on.
 *
 * Both are public by design: the anon key is meant to be in the page, and what
 * it may touch is decided by row-level security in the database, not by
 * keeping it secret. Absent, the application runs as it always has, with
 * everything kept in the browser.
 *
 * Its own file so the rules can be tested without a module that reads the
 * environment at load.
 */

export interface AccountsConfig {
  readonly url: string
  readonly anonKey: string
}

export const parseAccounts = (
  url: string | undefined,
  anonKey: string | undefined,
): AccountsConfig | null => {
  const given = { url: url?.trim() ?? '', anonKey: anonKey?.trim() ?? '' }
  if (given.url === '' && given.anonKey === '') return null

  // Half-configured is a deployment mistake, not a choice: say so at startup
  // rather than failing on the first sign-in, when the typist is watching.
  if (given.url === '' || given.anonKey === '') {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set together, or not at all')
  }
  if (!given.url.startsWith('https://')) {
    throw new Error(`VITE_SUPABASE_URL must be an https:// address, received "${given.url}"`)
  }
  return given
}

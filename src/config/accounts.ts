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
 * Google is a third value, and off unless it says otherwise. Registering a
 * Google client is a separate job from making a project, and the link in the
 * email needs none of it; a project without one answers "provider is not
 * enabled" to anyone who presses the button, which on the only page that leads
 * to an account is a worse offer than no button.
 *
 * Its own file so the rules can be tested without a module that reads the
 * environment as it loads.
 */

export interface AccountsConfig {
  readonly url: string
  /** The publishable (or legacy anon) key, whichever was given. */
  readonly anonKey: string
  /**
   * Whether a Google client is registered for the project, which is a second
   * thing to switch on and not everyone does. Only then is Google offered: a
   * project without one answers "provider is not enabled", and a way in that
   * cannot work is worse on the sign-in page than no way in at all.
   */
  readonly google: boolean
}

export interface AccountsEnvironment {
  readonly url: string | undefined
  /** The key, under each name it may arrive by; the first one given wins. */
  readonly keys: readonly (string | undefined)[]
  /** `VITE_SUPABASE_GOOGLE`, in whatever words a deployment wrote it. */
  readonly google: string | undefined
}

const trimmed = (value: string | undefined): string => value?.trim() ?? ''

/** The words a deployment is likely to be given for yes. Anything else is no. */
const YES: readonly string[] = ['true', '1', 'on', 'yes']

const switchedOn = (value: string | undefined): boolean => YES.includes(trimmed(value).toLowerCase())

export const parseAccounts = (environment: AccountsEnvironment): AccountsConfig | null => {
  const given = {
    url: trimmed(environment.url),
    anonKey: environment.keys.map(trimmed).find((key) => key !== '') ?? '',
    google: switchedOn(environment.google),
  }
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

/**
 * Reading what happened out of the address a sign-in comes back to.
 *
 * Both ways in leave and come back: Google goes to Google and returns, and an
 * emailed link is opened somewhere else entirely. When either works there is
 * nothing to read here -- the client finds the session in the address itself
 * and the typist is simply signed in. When either *fails*, all that comes back
 * is the sign-in page with the reason in the query string, and until this
 * existed the page said nothing at all: a typist who pressed Cancel at Google,
 * or opened yesterday's link, landed on the same empty form they started on
 * and had no way to know whether it had even been tried.
 *
 * So the reason is read and said in words. Not Supabase's words: those are
 * written for whoever set the project up, and "Unsupported provider: provider
 * is not enabled" tells a typist nothing they can act on. Each known reason
 * gets a sentence that says what happened and what is still true -- which is
 * almost always "nothing was lost, your practice is in this browser".
 *
 * Pure, and takes the address as a string, so every case can be tested without
 * a browser.
 */

export interface SignInReturn {
  /** What to tell the typist. */
  readonly message: string
  /**
   * Whether the typist did this on purpose, by backing out at the provider.
   * Not a failure, and not worth an apology; the page uses it to choose its
   * tone rather than its wording.
   */
  readonly cancelled: boolean
}

/**
 * What came back, by the code the provider used.
 *
 * `error_code` is the precise one and is preferred; `error` is the broad
 * family and is the fallback. Supabase has sent both over the years, and a
 * project set up today may answer with either.
 */
const REASONS: Readonly<Record<string, string>> = {
  access_denied:
    'That sign-in was cancelled, so nothing changed. Your practice is here in this browser either way, and you can try again whenever you like.',
  otp_expired:
    'That link has expired — they are good for an hour. Ask for a fresh one and it will work. Nothing was lost.',
  provider_disabled:
    'That way in is not switched on for this site yet. The emailed link still works, and your practice is safe in this browser.',
  provider_email_needs_verification:
    'Google has not verified that address yet. Verify it with Google, or use the emailed link instead.',
  bad_oauth_state:
    'That sign-in took too long to come back, or came back to a different browser than it started in. Try it once more in this browser.',
  flow_state_expired:
    'That sign-in took too long to come back. Try it once more and it should go straight through.',
  flow_state_not_found:
    'That sign-in could not be matched to the one that started here. Try it once more in this browser.',
  signup_disabled:
    'New accounts are not being taken on this site at the moment. Nothing was lost.',
  validation_failed:
    'That way in is not set up for this site yet. The emailed link still works, and your practice is safe in this browser.',
  server_error:
    'Something went wrong at the sign-in service, not here. Nothing was sent anywhere and your practice is safe in this browser. It is worth trying again in a minute.',
}

/** Said when the address carries a reason nothing here recognises. */
const UNKNOWN =
  'That sign-in did not go through. Nothing was lost — your practice is here in this browser — and trying again, or the emailed link, should work.'

/** The names a reason arrives under, most precise first. */
const CODES = ['error_code', 'error'] as const

/**
 * The parameters, from the query string and from the fragment.
 *
 * Supabase puts them in the query for the flow this application uses, and in
 * the fragment for the older one. Reading both costs four lines and means a
 * project configured either way is understood.
 */
const parametersOf = (href: string): URLSearchParams | null => {
  let address: URL
  try {
    address = new URL(href)
  } catch {
    return null
  }
  const fragment = address.hash.startsWith('#') ? address.hash.slice(1) : address.hash
  const found = new URLSearchParams(address.search)
  // The query wins where both carry the same name; it is the one in use.
  for (const [name, value] of new URLSearchParams(fragment))
    if (!found.has(name)) found.append(name, value)
  return found
}

/** What the address says went wrong, or null when it says nothing went wrong. */
export const readSignInReturn = (href: string): SignInReturn | null => {
  const found = parametersOf(href)
  if (found === null) return null

  const code = CODES.map((name) => found.get(name)).find(
    (value) => value !== null && value !== '',
  )
  if (code === undefined || code === null) return null

  /*
   * Only a reason actually written above counts. A plain lookup would answer
   * for every name an object inherits -- `?error_code=toString` hands back a
   * function -- and a function given to React as text is a crash on the one
   * page a typist is trying to sign in from. The code comes out of an address,
   * so it is whatever anyone cares to put there.
   */
  const known = Object.hasOwn(REASONS, code) ? REASONS[code] : undefined
  return {
    message: typeof known === 'string' ? known : UNKNOWN,
    cancelled: code === 'access_denied',
  }
}

/**
 * The same address with the sign-in answer taken off it.
 *
 * So that the reason is said once. Left in place it would be read again on
 * every later render, survive a reload, and -- worst -- be there to confuse
 * the next person who opened the page from history.
 */
export const withoutSignInReturn = (href: string): string => {
  let address: URL
  try {
    address = new URL(href)
  } catch {
    return href
  }
  const names = ['error', 'error_code', 'error_description', 'error_uri', 'state']
  for (const name of names) address.searchParams.delete(name)

  const fragment = address.hash.startsWith('#') ? address.hash.slice(1) : address.hash
  const kept = new URLSearchParams(fragment)
  for (const name of names) kept.delete(name)
  const rest = kept.toString()
  address.hash = rest === '' ? '' : `#${rest}`

  return address.toString()
}

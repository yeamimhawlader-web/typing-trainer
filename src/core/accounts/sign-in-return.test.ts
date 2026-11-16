/**
 * What the sign-in page says when someone comes back without being signed in.
 *
 * Every case here is one a typist can reach in an afternoon: pressing Cancel
 * at Google, opening yesterday's email link, or trying a button on a site
 * where the provider was never switched on. Before this, all three landed on
 * the same empty form with nothing said.
 */

import { describe, expect, it } from 'vitest'

import { readSignInReturn, withoutSignInReturn } from './sign-in-return.ts'

const here = 'https://hover.test/gg/sign-in'

describe('reading what came back with a sign-in', () => {
  it('says nothing about an address carrying no failure', () => {
    expect(readSignInReturn(here)).toBeNull()
    // The successful case: a code to exchange, which the client handles and
    // this must keep quiet about.
    expect(readSignInReturn(`${here}?code=abc123`)).toBeNull()
  })

  it('treats backing out at the provider as a choice, not a fault', () => {
    const came = readSignInReturn(
      `${here}?error=access_denied&error_description=The+user+denied+the+request`,
    )

    expect(came?.cancelled).toBe(true)
    expect(came?.message).toMatch(/cancelled/i)
    // Said in every case, because it is the thing a typist actually wants to
    // know when a sign-in has just failed in front of them.
    expect(came?.message).toMatch(/this browser/i)
  })

  it('tells someone with an old email link to ask for a fresh one', () => {
    const came = readSignInReturn(`${here}?error=access_denied&error_code=otp_expired`)

    // The precise code wins over the broad family: both are here, and
    // "expired" is a far more useful thing to be told than "denied".
    expect(came?.message).toMatch(/expired/i)
    expect(came?.cancelled).toBe(false)
  })

  it('reads the fragment as well as the query', () => {
    const came = readSignInReturn(
      `${here}#error=server_error&error_description=whatever`,
    )

    expect(came?.message).toMatch(/sign-in service/i)
  })

  it('still says something useful about a reason it has never seen', () => {
    const came = readSignInReturn(`${here}?error=something_entirely_new`)

    expect(came?.message).toMatch(/did not go through/i)
    expect(came?.cancelled).toBe(false)
  })

  it('does not fall over on an address that is not one', () => {
    expect(readSignInReturn('not an address at all')).toBeNull()
  })

  /*
   * The code comes out of an address, so it is whatever anyone cares to put
   * there, and the table of reasons is an object -- which answers for every
   * name every object has. Asked for `toString`, a plain lookup hands back a
   * function, and a function handed to React as text is a crash on the one
   * page a typist is trying to sign in from. Only the reasons actually
   * written down count.
   */
  it('is not fooled by the names every object answers to', () => {
    for (const code of ['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__']) {
      const came = readSignInReturn(`${here}?error_code=${code}`)
      expect([code, typeof came?.message]).toEqual([code, 'string'])
      expect([code, came?.message]).toEqual([code, readSignInReturn(`${here}?error_code=unheard_of`)?.message])
    }
  })

  it('has a sentence for every reason it claims to know', () => {
    const known = [
      'access_denied',
      'otp_expired',
      'provider_disabled',
      'provider_email_needs_verification',
      'bad_oauth_state',
      'flow_state_expired',
      'flow_state_not_found',
      'signup_disabled',
      'validation_failed',
      'server_error',
    ]

    for (const code of known) {
      const came = readSignInReturn(`${here}?error_code=${code}`)
      // Each on its own, so a missing sentence is named rather than hidden.
      expect([code, came?.message]).not.toEqual([code, undefined])
      expect([code, came?.message]).not.toEqual([
        code,
        readSignInReturn(`${here}?error_code=unheard_of`)?.message,
      ])
    }
  })
})

describe('taking the answer off the address', () => {
  it('leaves the page itself, and nothing of the failure', () => {
    expect(
      withoutSignInReturn(`${here}?error=access_denied&error_description=no&state=xyz`),
    ).toBe(here)
  })

  it('clears a failure out of the fragment too', () => {
    expect(withoutSignInReturn(`${here}#error=server_error&error_code=x`)).toBe(here)
  })

  it('keeps anything else the address was carrying', () => {
    expect(withoutSignInReturn(`${here}?from=history&error=access_denied`)).toBe(
      `${here}?from=history`,
    )
  })

  it('leaves an address with nothing to take off exactly as it was', () => {
    expect(withoutSignInReturn(here)).toBe(here)
    expect(withoutSignInReturn('not an address at all')).toBe('not an address at all')
  })
})

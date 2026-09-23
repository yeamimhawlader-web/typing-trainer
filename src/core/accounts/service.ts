/**
 * Signing in, and knowing who is signed in.
 *
 * One Supabase client for the application, made only when a project is
 * configured. Where it is not — no keys, or a test — every part of this still
 * exists and answers `unavailable`, so nothing downstream has to ask whether
 * accounts are switched on before it can render.
 *
 * Only Google is offered. It is the one provider worth the setup for a typing
 * trainer, and an email and password would mean holding a password, which this
 * application has no business doing.
 *
 * The client is told to keep its session and to read one out of the address it
 * is redirected back to; that is the whole of the sign-in mechanism here.
 *
 * The library itself is fetched only where a project is configured, and only
 * then: it is around 60 kB compressed, which is a quarter of everything else
 * this application ships, and a build with no accounts must not pay for it.
 * So the client arrives as a promise, and everything here waits for it —
 * which costs nothing, since nothing can be signed in before it lands either.
 */

import type { SupabaseClient, User } from '@supabase/supabase-js'

import type { AccountsConfig } from '@config'

import type { Account, AccountService, AccountState } from './types.ts'

export const createAccountClient = async (config: AccountsConfig): Promise<SupabaseClient> => {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // The provider hands back a code rather than a token in the address bar,
      // which is the flow meant for a page with no server behind it.
      flowType: 'pkce',
    },
  })
}

/**
 * What Google tells us about the person, under whichever names it used.
 *
 * This is data from outside, so nothing is assumed: a missing name leaves a
 * null rather than a broken greeting, and anything that is not a string is
 * treated as missing.
 */
const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null)

export const accountOf = (user: User): Account => {
  const metadata: Record<string, unknown> = user.user_metadata
  return {
    id: user.id,
    email: text(user.email),
    name: text(metadata['full_name']) ?? text(metadata['name']),
    pictureUrl: text(metadata['avatar_url']) ?? text(metadata['picture']),
  }
}

/**
 * The state of a build with nothing to sign in to. One object, handed out
 * every time: React subscribes to this state and compares what it is given
 * with what it had, so a fresh object each call would be a change each call.
 */
const UNAVAILABLE: AccountState = { status: 'unavailable' }

/** The service for a build with no account service configured. */
export const createUnavailableAccountService = (): AccountService => ({
  available: false,
  state: () => UNAVAILABLE,
  subscribe: () => () => undefined,
  signInWithGoogle: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
})

export const createAccountService = (arriving: Promise<SupabaseClient>): AccountService => {
  let state: AccountState = { status: 'loading' }
  const listeners = new Set<(state: AccountState) => void>()

  const settle = (next: AccountState): void => {
    state = next
    for (const listener of listeners) listener(state)
  }

  /*
   * One subscription for the life of the application. It fires once with
   * whatever session was kept from last time — so this covers the first read
   * as well as every later change — and again on sign-in, sign-out and each
   * token refresh.
   */
  void arriving.then(
    (client) => {
      client.auth.onAuthStateChange((_event, session) => {
        settle(
          session === null
            ? { status: 'signed-out' }
            : { status: 'signed-in', account: accountOf(session.user) },
        )
      })
    },
    (error: unknown) => {
      // The library never arrived — offline on a cold load, most likely. There
      // is nothing to sign in to in this page's lifetime, and saying so is
      // more honest than an empty sign-in form that cannot work.
      console.warn('[accounts] the account service could not be loaded', error)
      settle({ status: 'unavailable' })
    },
  )

  return {
    available: true,
    state: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    signInWithGoogle: async (redirectTo) => {
      const client = await arriving
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      // A failure here means the redirect never started; there is no second
      // chance to report it once the page has left.
      if (error !== null) throw new Error(error.message)
    },

    signOut: async () => {
      const client = await arriving
      const { error } = await client.auth.signOut()
      if (error !== null) throw new Error(error.message)
      // signOut fires the subscription above, which settles the state.
    },
  }
}

/**
 * Who is signed in, if anyone.
 *
 * Accounts are an addition, never a gate: the application has always kept
 * everything in the browser and still does. Signing in adds a copy somewhere
 * else so the same history and the same texts are there in another browser.
 * Four states, and every one of them can type.
 */

export interface Account {
  /** The account's id in the authentication provider; the owner of every row. */
  readonly id: string
  readonly email: string | null
  readonly name: string | null
  readonly pictureUrl: string | null
}

export type AccountState =
  /** No account service is configured; this build keeps everything locally. */
  | { readonly status: 'unavailable' }
  /** Looking for a session kept from last time. */
  | { readonly status: 'loading' }
  | { readonly status: 'signed-out' }
  | { readonly status: 'signed-in'; readonly account: Account }

export interface AccountService {
  /** Whether there is anything to sign in to at all. */
  readonly available: boolean
  /** The state now, for a first render. */
  state(): AccountState
  /** Calls back with every change, and returns the way to stop listening. */
  subscribe(listener: (state: AccountState) => void): () => void
  /**
   * Sends a link to an address, which signs the typist in when it is followed.
   *
   * The way in that needs nothing set up beyond the project itself: no
   * provider to register, no console but Supabase's own. Rejects when the
   * link could not be sent, so the page can say why rather than claiming to
   * have sent one.
   */
  signInWithEmail(email: string, redirectTo: string): Promise<void>
  /**
   * Leaves for Google and comes back to `redirectTo`. Resolves only if the
   * redirect could not be started.
   */
  signInWithGoogle(redirectTo: string): Promise<void>
  signOut(): Promise<void>
}

/** What one round of syncing moved, in each direction. */
export interface SyncResult {
  readonly sessionsUp: number
  readonly sessionsDown: number
  readonly textsUp: number
  readonly textsDown: number
}

export const NOTHING_SYNCED: SyncResult = {
  sessionsUp: 0,
  sessionsDown: 0,
  textsUp: 0,
  textsDown: 0,
}

export interface SyncService {
  /**
   * Brings this browser and the account level with each other. Resolves with
   * what moved, or null when nobody is signed in — which is not a failure.
   *
   * Safe to call as often as is convenient: it compares ids before it moves
   * anything, and calling it while it is already running joins the round
   * already in flight rather than starting a second one.
   */
  syncNow(): Promise<SyncResult | null>
  /** True while a round is in flight, for saying so on screen. */
  syncing(): boolean
  /** Calls back whenever a round finishes, with what it moved. */
  subscribe(listener: (result: SyncResult | null, error: Error | null) => void): () => void
}

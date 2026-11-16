/**
 * Sign in: the sign-in form (src/components/ui/sign-in.tsx), inside the shell.
 *
 * Three pages in one, decided by whether this build has an account service and
 * who is signed in:
 *
 * - **Signed in.** The account, what it keeps, and the way out.
 * - **Accounts configured, signed out.** An address and a button that sends a
 *   link to it. That way in needs nothing registered anywhere: a Supabase
 *   project can send it the moment it exists, which is the difference between
 *   a setup someone finishes and one they put off. Google is kept beside it
 *   for anyone who has registered a client for it, and is not drawn at all
 *   where nobody has: Supabase answers that button with "provider is not
 *   enabled", and a dead end on the one page that leads to an account is a
 *   worse offer than no button (see AccountService.googleOffered). Neither
 *   holds a password, so the form has no password field at all.
 * - **No account service.** The form as it will look, saying so when used.
 *
 * Practice needs none of it. Sessions, Golden Nuggets, settings and your own
 * texts are kept in this browser either way; an account adds a copy of all four
 * elsewhere, so another browser signed in as you opens with them already there.
 * The keystroke detail behind the statistics is the one thing that does not go:
 * it is the largest thing stored and only the machine that recorded it reads it.
 *
 * The form's colours are the theme's (see src/styles/tailwind.css), and it
 * fills the page below the top bar rather than the whole window it was drawn
 * for.
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { SignInPage } from '@/components/ui/sign-in.tsx'
import { ROUTES } from '@app/routes.ts'
import {
  accountService,
  readSignInReturn,
  withoutSignInReturn,
  type AccountService,
} from '@core/accounts'
import { AccountPanel, useAccount } from '@features/accounts'

import { useGGDocumentTitle } from '../layout/useGGDocumentTitle.ts'

import styles from './GGSignInPage.module.css'

/** Keycaps, from Unsplash, served from here. See ways-to-practise.ts. */
export const SIGN_IN_HERO_IMAGE = '/photos/photo-1595225476474-87563907a212-1400.webp'

export const ACCOUNTS_NOT_YET =
  "Accounts aren't switched on yet, so nothing was sent anywhere. Your practice is saved in this browser in the meantime."

/** What the address was given for, said back with the address itself. */
const linkSent = (email: string): string =>
  `A link is on its way to ${email}. Open it on this browser and you are in. It is good for an hour.`

export const ADDRESS_NEEDED = 'An email address first, and the link goes to it.'

export interface GGSignInPageProps {
  /** Injectable for tests; defaults to the application's account. */
  readonly accounts?: AccountService
}

export const GGSignInPage = ({ accounts = accountService }: GGSignInPageProps = {}) => {
  const state = useAccount(accounts)
  useGGDocumentTitle(state.status === 'signed-in' ? 'Your account' : 'Sign in')
  /*
   * Read from the address at the first render rather than from an effect
   * afterwards, so a failed sign-in is explained on the frame the page
   * appears -- no empty form first, and no second render to replace it.
   */
  const [notice, setNotice] = useState<string | null>(
    () => readSignInReturn(window.location.href)?.message ?? null,
  )

  const say = useCallback((said: string) => {
    setNotice(said)
  }, [])

  /*
   * Both ways in leave this page and come back to it, and when either fails
   * the only thing that comes back is the reason, in the address. The sentence
   * itself is already on screen -- it was read above, during the first render.
   * What is left is to tidy up after it.
   *
   * A typist who cancelled at Google, or opened a link from yesterday, used to
   * land on the blank form they started from with nothing to say whether it
   * had been tried at all. Success needs none of this: the client finds the
   * session in the address itself and the account panel appears.
   */
  useEffect(() => {
    const came = readSignInReturn(window.location.href)
    if (came === null) return

    // Backing out at the provider is a choice, not a fault, and is not worth a
    // line in the console; anything else is worth having there.
    if (!came.cancelled)
      console.warn(
        '[accounts] the sign-in came back unfinished',
        window.location.search,
      )
    // Taken off the address, so the reason is said once: left there it would
    // survive a reload and greet whoever opened the page from history next.
    window.history.replaceState(null, '', withoutSignInReturn(window.location.href))
  }, [])

  /**
   * The form's password furniture, which only exists where there is nothing to
   * sign in to: with a project configured the form is passwordless and none of
   * it is rendered at all.
   */
  const notHere = useCallback(() => {
    say(ACCOUNTS_NOT_YET)
  }, [say])

  const comeBackTo = `${window.location.origin}${ROUTES.ggSignIn}`

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      // Left alone, a form with no action reloads this page with what was typed
      // in its address.
      event.preventDefault()
      if (!accounts.available) {
        notHere()
        return
      }

      const email = new FormData(event.currentTarget).get('email')
      const address = typeof email === 'string' ? email.trim() : ''
      if (address === '') {
        say(ADDRESS_NEEDED)
        return
      }

      accounts.signInWithEmail(address, comeBackTo).then(
        () => say(linkSent(address)),
        (error: unknown) => {
          console.warn('[accounts] the link could not be sent', error)
          say(
            'That link could not be sent. Supabase limits how many go out in an hour; nothing was lost, and your practice is safe in this browser.',
          )
        },
      )
    },
    [accounts, comeBackTo, notHere, say],
  )

  const google = useCallback(() => {
    if (!accounts.available) {
      say(ACCOUNTS_NOT_YET)
      return
    }
    // Back to this page, where the account panel is waiting.
    accounts.signInWithGoogle(comeBackTo).catch((error: unknown) => {
      console.warn('[accounts] sign-in could not start', error)
      say('Google could not be reached. Nothing was sent anywhere; your practice is safe in this browser.')
    })
  }, [accounts, comeBackTo, say])

  const signOut = useCallback(() => {
    accounts.signOut().catch((error: unknown) => {
      console.warn('[accounts] sign-out failed', error)
      say('Signing out did not get through. Everything is still in this browser.')
    })
  }, [accounts, say])

  return (
    <>
      {state.status === 'signed-in' ? (
        <AccountPanel account={state.account} onSignOut={signOut} />
      ) : (
        <SignInPage
          className="h-auto w-full min-h-[calc(100dvh-var(--gg-bar-height)-5rem)]"
          description={
            accounts.available
              ? 'A link to your inbox, and your practice follows you between browsers.'
              : 'Sign in to Hover Typing.'
          }
          passwordless={accounts.available}
          submitLabel={accounts.available ? 'Email me a link' : 'Sign In'}
          heroImageSrc={SIGN_IN_HERO_IMAGE}
          onSignIn={submit}
          /* No handler, no button: Google is drawn only where the project has
             registered a client for it (see AccountService.googleOffered). */
          onGoogleSignIn={accounts.googleOffered ? google : undefined}
          onResetPassword={notHere}
          onCreateAccount={notHere}
        />
      )}

      {/* Always on the page, so a screen reader hears the notice arrive. */}
      <div className={styles.live} role="status">
        {notice !== null && (
          <p className={styles.notice}>
            <span>{notice}</span>
            <button
              type="button"
              className={styles.dismiss}
              aria-label="Dismiss"
              onClick={() => setNotice(null)}
            >
              ×
            </button>
          </p>
        )}
      </div>
    </>
  )
}

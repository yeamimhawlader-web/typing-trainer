/**
 * Sign in: the sign-in form (src/components/ui/sign-in.tsx), inside the shell.
 *
 * Three pages in one, decided by whether this build has an account service and
 * who is signed in:
 *
 * - **Signed in.** The account, what it keeps, and the way out.
 * - **Accounts configured, signed out.** Google is the one way in and it is
 *   real: the button leaves for Google and comes back here. The email and
 *   password fields are the component's; they are not wired to anything,
 *   because a typing trainer has no business holding a password, and pressing
 *   them says so.
 * - **No account service.** The form as it will look, saying so when used.
 *
 * Practice needs none of it. Sessions, Golden Nuggets, settings and your own
 * texts are kept in this browser either way; an account adds a copy elsewhere
 * so another browser has them too.
 *
 * The form's colours are the theme's (see src/styles/tailwind.css), and it
 * fills the page below the top bar rather than the whole window it was drawn
 * for.
 */

import { useCallback, useState, type FormEvent } from 'react'

import { SignInPage } from '@/components/ui/sign-in.tsx'
import { ROUTES } from '@app/routes.ts'
import { accountService, type AccountService } from '@core/accounts'
import { AccountPanel, useAccount } from '@features/accounts'

import { useGGDocumentTitle } from '../layout/useGGDocumentTitle.ts'

import styles from './GGSignInPage.module.css'

/** Keycaps, from Unsplash. */
export const SIGN_IN_HERO_IMAGE =
  'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=1400&q=80'

export const ACCOUNTS_NOT_YET =
  "Accounts aren't switched on yet, so nothing was sent anywhere. Your practice is saved in this browser in the meantime."

export const PASSWORDS_NOT_HELD =
  'Signing in is through Google, above. This application holds no passwords of its own.'

export interface GGSignInPageProps {
  /** Injectable for tests; defaults to the application's account. */
  readonly accounts?: AccountService
}

export const GGSignInPage = ({ accounts = accountService }: GGSignInPageProps = {}) => {
  const state = useAccount(accounts)
  useGGDocumentTitle(state.status === 'signed-in' ? 'Your account' : 'Sign in')
  const [notice, setNotice] = useState<string | null>(null)

  const say = useCallback((said: string) => {
    setNotice(said)
  }, [])

  /** What every field and link on the form does: nothing, and says so. */
  const notHere = useCallback(() => {
    say(accounts.available ? PASSWORDS_NOT_HELD : ACCOUNTS_NOT_YET)
  }, [accounts.available, say])

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      // Left alone, a form with no action reloads this page with the email and
      // the password in its address.
      event.preventDefault()
      notHere()
    },
    [notHere],
  )

  const google = useCallback(() => {
    if (!accounts.available) {
      say(ACCOUNTS_NOT_YET)
      return
    }
    // Back to this page, where the account panel is waiting.
    accounts.signInWithGoogle(`${window.location.origin}${ROUTES.ggSignIn}`).catch((error: unknown) => {
      console.warn('[accounts] sign-in could not start', error)
      say('Google could not be reached. Nothing was sent anywhere; your practice is safe in this browser.')
    })
  }, [accounts, say])

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
              ? 'Sign in to Hover Typing, and your history follows you.'
              : 'Sign in to Hover Typing.'
          }
          heroImageSrc={SIGN_IN_HERO_IMAGE}
          onSignIn={submit}
          onGoogleSignIn={google}
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

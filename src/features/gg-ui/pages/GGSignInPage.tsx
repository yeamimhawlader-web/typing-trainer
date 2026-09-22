/**
 * Sign in: the sign-in form (src/components/ui/sign-in.tsx), inside the shell.
 *
 * There are no accounts yet — nothing to sign in to, and no server to send a
 * password to — so the form is here as it will look, and says so when it is
 * used rather than pretending: every action on it lands on the same notice.
 * The form is never submitted. Left to itself it would load this page again
 * with the email and the password in the address.
 *
 * Practice needs none of it. Sessions, Golden Nuggets and settings are kept in
 * this browser, for everyone, signed in or not.
 *
 * The form's colours are the theme's (see src/styles/tailwind.css), and it
 * fills the page below the top bar rather than the whole window it was drawn
 * for.
 */

import { useCallback, useState, type FormEvent } from 'react'

import { SignInPage } from '@/components/ui/sign-in.tsx'

import { useGGDocumentTitle } from '../layout/useGGDocumentTitle.ts'

import styles from './GGSignInPage.module.css'

/** Keycaps, from Unsplash. */
export const SIGN_IN_HERO_IMAGE =
  'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=1400&q=80'

export const ACCOUNTS_NOT_YET =
  "Accounts aren't switched on yet, so nothing was sent anywhere. Your practice is saved in this browser in the meantime."

export const GGSignInPage = () => {
  useGGDocumentTitle('Sign in')
  const [notice, setNotice] = useState<string | null>(null)

  const notYet = useCallback(() => {
    setNotice(ACCOUNTS_NOT_YET)
  }, [])

  const signIn = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      notYet()
    },
    [notYet],
  )

  return (
    <>
      <SignInPage
        className="h-auto w-full min-h-[calc(100dvh-var(--gg-bar-height)-5rem)]"
        description="Sign in to Hover Typing."
        heroImageSrc={SIGN_IN_HERO_IMAGE}
        onSignIn={signIn}
        onGoogleSignIn={notYet}
        onResetPassword={notYet}
        onCreateAccount={notYet}
      />

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

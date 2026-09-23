/**
 * The sign-in page in the real shell, end to end in jsdom: reached from the top
 * bar, a form that labels its fields, and — there being no accounts yet — a
 * page that sends nothing anywhere and says so.
 *
 * How it looks (the Tailwind component, the theme's colours on it, the image)
 * is judged in a browser; jsdom applies no stylesheets.
 */

import { act, render, screen, within } from '@testing-library/react'
import { useEffect } from 'react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ROUTES } from '@app/routes.ts'
import { DEFAULT_PREFERENCES } from '@config'
import type { Account, AccountService, AccountState, SyncResult, SyncService } from '@core/accounts'
import { settingsStore } from '@features/settings/state/settings.store.ts'

import { GGLayout } from './layout/GGLayout.tsx'
import { AccountPanel } from '@features/accounts'

import { TopBar } from './components/TopBar/TopBar.tsx'
import {
  ACCOUNTS_NOT_YET,
  GGSignInPage,
  PASSWORDS_NOT_HELD,
  SIGN_IN_HERO_IMAGE,
} from './pages/GGSignInPage.tsx'
import { removeTheme } from './themes/apply-theme.ts'

/** Where the router is, so a test can see a form that navigated. */
let location = ''
const Where = () => {
  const { pathname, search } = useLocation()
  useEffect(() => {
    location = `${pathname}${search}`
  }, [pathname, search])
  return null
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        <Route path={ROUTES.gg} element={<GGLayout />}>
          <Route index element={<p>Practice</p>} />
          <Route path={ROUTES.ggSignIn} element={<GGSignInPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  settingsStore.setState({ preferences: DEFAULT_PREFERENCES, status: 'ready' })
})

afterEach(() => {
  vi.restoreAllMocks()
  removeTheme()
})

describe('Sign in', () => {
  it('is reached from the top bar, which marks it as the page you are on', async () => {
    const user = userEvent.setup()
    renderAt(ROUTES.gg)

    const bar = screen.getByRole('navigation', { name: 'Main' })
    await user.click(within(bar).getByRole('link', { name: 'Sign in' }))

    expect(location).toBe(ROUTES.ggSignIn)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Welcome' }),
    ).toBeInTheDocument()
    expect(within(bar).getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(document.title).toBe('Sign in · Hover Typing')
  })

  it('labels its fields, so each can be found and filled by name', () => {
    renderAt(ROUTES.ggSignIn)

    expect(screen.getByLabelText('Email Address')).toHaveAttribute(
      'autocomplete',
      'email',
    )
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
    expect(
      screen.getByRole('checkbox', { name: 'Keep me signed in' }),
    ).not.toBeChecked()
  })

  it('shows and hides the password', async () => {
    const user = userEvent.setup()
    renderAt(ROUTES.ggSignIn)
    const password = screen.getByLabelText('Password')

    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password).toHaveAttribute('type', 'password')
  })

  it('sends nothing when signed in to — not to a server, not into the address — and says accounts are not on yet', async () => {
    const user = userEvent.setup()
    const fetch = vi.spyOn(globalThis, 'fetch')
    // jsdom does not submit forms, so whether the browser would is read off the
    // event, after the page has handled it.
    let submitted: boolean | null = null
    const onSubmit = (event: Event) => {
      submitted = !event.defaultPrevented
    }
    document.addEventListener('submit', onSubmit)
    renderAt(ROUTES.ggSignIn)

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    await user.type(screen.getByLabelText('Email Address'), 'typist@example.com')
    await user.type(screen.getByLabelText('Password'), 'hunter2')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    document.removeEventListener('submit', onSubmit)
    expect(submitted).toBe(false)
    expect(screen.getByRole('status')).toHaveTextContent(ACCOUNTS_NOT_YET)
    expect(fetch).not.toHaveBeenCalled()
    expect(location).toBe(ROUTES.ggSignIn)
  })

  it('answers every other way in the same, and the notice can be put away', async () => {
    const user = userEvent.setup()
    renderAt(ROUTES.ggSignIn)
    const status = screen.getByRole('status')
    const answered = async (way: HTMLElement) => {
      await user.click(way)
      expect(status).toHaveTextContent(ACCOUNTS_NOT_YET)
      await user.click(within(status).getByRole('button', { name: 'Dismiss' }))
      expect(status).toBeEmptyDOMElement()
    }

    await answered(screen.getByRole('button', { name: /Continue with Google/ }))
    await answered(screen.getByRole('link', { name: 'Reset password' }))
    await answered(screen.getByRole('link', { name: 'Create Account' }))
    expect(location).toBe(ROUTES.ggSignIn)
  })

  it('shows keycaps beside the form, and no testimonials: there is nobody to quote', () => {
    const { container } = renderAt(ROUTES.ggSignIn)

    const hero = [...container.querySelectorAll<HTMLElement>('[style]')].find(
      (element) => element.style.backgroundImage.includes(SIGN_IN_HERO_IMAGE),
    )
    expect(hero).toBeDefined()
    expect(container.querySelectorAll('img[alt="avatar"]')).toHaveLength(0)
  })
})

/*
 * With a Supabase project configured, the same page is the way in through
 * Google and, once someone is through it, their account. Nothing here reaches
 * a network: the account service is the seam, and these tests stand where the
 * application does — in front of it.
 */
describe('Sign in, with accounts switched on', () => {
  const ACCOUNT: Account = {
    id: 'account-1',
    email: 'typist@example.com',
    name: 'A Typist',
    pictureUrl: null,
  }

  /** An account service that answers, and records what was asked of it. */
  const fakeAccounts = (initial: AccountState) => {
    let state = initial
    const listeners = new Set<(state: AccountState) => void>()
    const asked: string[] = []

    const service: AccountService = {
      available: true,
      state: () => state,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      signInWithGoogle: (redirectTo) => {
        asked.push(`google:${redirectTo}`)
        return Promise.resolve()
      },
      signOut: () => {
        asked.push('signOut')
        return Promise.resolve()
      },
    }

    return {
      service,
      asked,
      settle: (next: AccountState) => {
        act(() => {
          state = next
          for (const listener of listeners) listener(state)
        })
      },
    }
  }

  const idleSync: SyncService = {
    syncNow: () => Promise.resolve(null),
    syncing: () => false,
    subscribe: () => () => undefined,
  }

  const renderSignIn = (accounts: AccountService) =>
    render(
      <MemoryRouter initialEntries={[ROUTES.ggSignIn]}>
        <Routes>
          <Route path={ROUTES.ggSignIn} element={<GGSignInPage accounts={accounts} />} />
        </Routes>
      </MemoryRouter>,
    )

  it('leaves for Google, and comes back to this page', async () => {
    const user = userEvent.setup()
    const accounts = fakeAccounts({ status: 'signed-out' })
    renderSignIn(accounts.service)

    await user.click(screen.getByRole('button', { name: /Continue with Google/ }))

    expect(accounts.asked).toEqual([`google:${window.location.origin}${ROUTES.ggSignIn}`])
  })

  it('holds no password of its own, and says which way in is the real one', async () => {
    const user = userEvent.setup()
    const accounts = fakeAccounts({ status: 'signed-out' })
    renderSignIn(accounts.service)

    await user.type(screen.getByLabelText('Email Address'), 'typist@example.com')
    await user.type(screen.getByLabelText('Password'), 'hunter2')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(screen.getByRole('status')).toHaveTextContent(PASSWORDS_NOT_HELD)
    expect(accounts.asked).toEqual([])
  })

  it('becomes the account the moment the session arrives, without a reload', () => {
    const accounts = fakeAccounts({ status: 'signed-out' })
    renderSignIn(accounts.service)

    accounts.settle({ status: 'signed-in', account: ACCOUNT })

    expect(screen.getByRole('heading', { level: 1, name: 'Your account' })).toBeInTheDocument()
    expect(screen.getByText('A Typist')).toBeInTheDocument()
    expect(screen.getByText('typist@example.com')).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    expect(document.title).toBe('Your account · Hover Typing')
  })

  it('asks before signing out, and says what signing out does not do', async () => {
    const user = userEvent.setup()
    const accounts = fakeAccounts({ status: 'signed-in', account: ACCOUNT })
    render(
      <MemoryRouter initialEntries={[ROUTES.ggSignIn]}>
        <Routes>
          <Route path={ROUTES.ggSignIn} element={<GGSignInPage accounts={accounts.service} />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(/Nothing is deleted here, or there/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(accounts.asked).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(accounts.asked).toEqual(['signOut'])
  })

  it('says who is signed in, in the bar, where "Sign in" was', () => {
    const accounts = fakeAccounts({ status: 'signed-in', account: { ...ACCOUNT, name: 'A Typist' } })
    render(
      <MemoryRouter>
        <TopBar
          accounts={accounts.service}
          themesOpen={false}
          onOpenThemes={() => undefined}
          themesButtonRef={null}
        />
      </MemoryRouter>,
    )

    const bar = screen.getByRole('navigation', { name: 'Main' })
    expect(within(bar).getByRole('link', { name: 'Your account' })).toHaveTextContent('A')
    expect(within(bar).queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
  })

  it('says nothing about syncing until a round finishes, then what it moved', async () => {
    const user = userEvent.setup()
    const accounts = fakeAccounts({ status: 'signed-in', account: ACCOUNT })
    let announce: (result: SyncResult | null, error: Error | null) => void = () => undefined
    const sync: SyncService = {
      ...idleSync,
      subscribe: (listener) => {
        announce = listener
        return () => undefined
      },
    }

    render(
      <MemoryRouter>
        <AccountPanel account={ACCOUNT} onSignOut={() => undefined} sync={sync} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('status')).toBeEmptyDOMElement()

    await user.click(screen.getByRole('button', { name: 'Sync now' }))
    expect(screen.getByRole('button', { name: 'Syncing…' })).toBeDisabled()

    act(() => {
      announce({ sessionsUp: 1, sessionsDown: 2, textsUp: 0, textsDown: 0 }, null)
    })
    expect(screen.getByRole('status')).toHaveTextContent('1 test sent, 2 tests brought back.')

    act(() => {
      announce(null, new Error('offline'))
    })
    expect(screen.getByRole('status')).toHaveTextContent('Nothing was lost')
    expect(accounts.asked).toEqual([])
  })
})

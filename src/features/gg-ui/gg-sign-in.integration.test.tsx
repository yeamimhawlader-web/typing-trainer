/**
 * The sign-in page in the real shell, end to end in jsdom: reached from the top
 * bar, a form that labels its fields, and — there being no accounts yet — a
 * page that sends nothing anywhere and says so.
 *
 * How it looks (the Tailwind component, the theme's colours on it, the image)
 * is judged in a browser; jsdom applies no stylesheets.
 */

import { render, screen, within } from '@testing-library/react'
import { useEffect } from 'react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ROUTES } from '@app/routes.ts'
import { DEFAULT_PREFERENCES } from '@config'
import { settingsStore } from '@features/settings/state/settings.store.ts'

import { GGLayout } from './layout/GGLayout.tsx'
import {
  ACCOUNTS_NOT_YET,
  GGSignInPage,
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

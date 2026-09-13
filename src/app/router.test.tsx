/**
 * Routing smoke test.
 *
 * Mounts the real route tree in a memory router, so a broken route, a bad
 * import or a crashing page fails here rather than in the browser.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { routeConfig } from './router.tsx'
import { ROUTES } from './routes.ts'

const renderAt = (path: string) => {
  const router = createMemoryRouter(routeConfig, { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

describe('application routes', () => {
  it('renders the home page at the root', async () => {
    renderAt(ROUTES.home)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Typing Trainer' }),
    ).toBeInTheDocument()
  })

  it('renders the practice page', async () => {
    renderAt(ROUTES.practice)

    // The heading is visually hidden: the typing text is the page, and a
    // visible title above it would compete with what the typist is reading.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Typing practice' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Typing test' })).toBeInTheDocument()
  })

  it('renders the settings page', async () => {
    renderAt(ROUTES.settings)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Settings' }),
    ).toBeInTheDocument()
  })

  it('renders a not-found page for an unknown path', async () => {
    renderAt('/no-such-page')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Not found' }),
    ).toBeInTheDocument()
  })

  it('keeps the primary navigation on every page', async () => {
    renderAt(ROUTES.practice)

    const nav = await screen.findByRole('navigation', { name: 'Primary' })
    expect(nav).toBeInTheDocument()
  })
})

describe('getting around by keyboard', () => {
  it('offers a way past the header as the first thing in the tab order', async () => {
    const user = userEvent.setup()
    renderAt(ROUTES.statistics)
    await screen.findByRole('heading', { level: 1, name: 'Statistics' })

    await user.tab()

    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus()
  })

  it('moves focus to the main content, so the next Tab is inside the page', async () => {
    const user = userEvent.setup()
    renderAt(ROUTES.statistics)
    await screen.findByRole('heading', { level: 1, name: 'Statistics' })

    await user.tab()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('main')).toHaveFocus()

    await user.tab()

    expect(screen.getByRole('navigation', { name: 'Primary' })).not.toContainElement(
      document.activeElement as HTMLElement,
    )
    expect(screen.getByRole('main')).toContainElement(document.activeElement as HTMLElement)
  })
})

describe('document titles', () => {
  it.each([
    [ROUTES.home, 'Typing Trainer'],
    [ROUTES.practice, 'Practice · Typing Trainer'],
    [ROUTES.history, 'History · Typing Trainer'],
    [ROUTES.statistics, 'Statistics · Typing Trainer'],
    [ROUTES.settings, 'Settings · Typing Trainer'],
    ['/no-such-page', 'Not found · Typing Trainer'],
    ['/drill/in', 'Drill: in · Typing Trainer'],
    ['/drill/zq', 'No drill for that sequence · Typing Trainer'],
  ])('names the tab after the page at %s', async (path, title) => {
    renderAt(path)

    await waitFor(() => {
      expect(document.title).toBe(title)
    })
  })

  it('changes the title when the page changes', async () => {
    const user = userEvent.setup()
    renderAt(ROUTES.statistics)
    await waitFor(() => {
      expect(document.title).toBe('Statistics · Typing Trainer')
    })

    await user.click(screen.getByRole('link', { name: 'History' }))

    await waitFor(() => {
      expect(document.title).toBe('History · Typing Trainer')
    })
  })
})

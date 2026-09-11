/**
 * Routing smoke test.
 *
 * Mounts the real route tree in a memory router, so a broken route, a bad
 * import or a crashing page fails here rather than in the browser.
 */

import { render, screen } from '@testing-library/react'
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

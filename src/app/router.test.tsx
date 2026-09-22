/**
 * Routing smoke test.
 *
 * Mounts the real route tree in a memory router, so a broken route, a bad
 * import or a crashing page fails here rather than in the browser.
 */

import { render, screen, waitFor, within } from '@testing-library/react'
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
      await screen.findByRole('heading', { level: 1, name: 'Hover Typing' }),
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

  it('renders GG.Typing practice at its own route, outside the application layout', async () => {
    renderAt(ROUTES.gg)

    expect(await screen.findByRole('region', { name: 'Words to type' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Typing test' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Hover Typing' })).toBeInTheDocument()
    // Its own top bar, not the application's navigation.
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
    expect(document.title).toBe('Typing Test · Hover Typing')
  })

  it('renders a GG.Typing drill beneath it', async () => {
    renderAt('/gg/drill/in')

    // The words appear once the drill's baseline has been read.
    expect(await screen.findByRole('region', { name: 'Words to type' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Drill: in' })).toBeInTheDocument()
    expect(screen.getByText('Drill: in', { selector: 'p' })).toBeInTheDocument()
  })

  it('keeps the classic practice screen at its own route', async () => {
    renderAt(ROUTES.practice)
    expect(await screen.findByRole('region', { name: 'Typing test' })).toBeInTheDocument()
  })

  it('keeps the classic drill screen at its own route', async () => {
    renderAt('/drill/in')
    expect(await screen.findByRole('region', { name: 'Typing test' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Drill: in' })).toBeInTheDocument()
  })

  it('leads every way into practice to GG.Typing', async () => {
    renderAt(ROUTES.history)

    const nav = await screen.findByRole('navigation', { name: 'Primary' })
    expect(within(nav).getByRole('link', { name: 'Practice' })).toHaveAttribute('href', '/gg')
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
    [ROUTES.home, 'Hover Typing'],
    [ROUTES.practice, 'Practice · Hover Typing'],
    [ROUTES.history, 'History · Hover Typing'],
    [ROUTES.statistics, 'Statistics · Hover Typing'],
    [ROUTES.settings, 'Settings · Hover Typing'],
    ['/no-such-page', 'Not found · Hover Typing'],
    ['/drill/in', 'Drill: in · Hover Typing'],
    ['/drill/zq', 'No drill for that sequence · Hover Typing'],
    [ROUTES.gg, 'Typing Test · Hover Typing'],
    ['/gg/drill/in', 'Drill: in · Hover Typing'],
    ['/gg/drill/zq', 'No drill for that sequence · Hover Typing'],
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
      expect(document.title).toBe('Statistics · Hover Typing')
    })

    await user.click(screen.getByRole('link', { name: 'History' }))

    await waitFor(() => {
      expect(document.title).toBe('History · Hover Typing')
    })
  })
})

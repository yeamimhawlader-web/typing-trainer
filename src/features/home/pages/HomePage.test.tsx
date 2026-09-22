/**
 * The front page's ways to practise: each one there, each leading where it says,
 * inside the application. How the list moves — the highlight, the picture
 * opening under the pointer — is judged in a browser; jsdom has no layout.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ROUTES } from '@app/routes.ts'

import { HomePage } from './HomePage.tsx'
import { WAYS_TO_PRACTISE } from './ways-to-practise.ts'

let location = ''
const Where = () => {
  const { pathname } = useLocation()
  useEffect(() => {
    location = pathname
  }, [pathname])
  return <p>Somewhere else</p>
}

const renderHome = () =>
  render(
    <MemoryRouter initialEntries={[ROUTES.home]}>
      <Routes>
        <Route path={ROUTES.home} element={<HomePage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

const ways = () => within(screen.getByRole('region', { name: 'Ways to practise' }))

describe('the front page', () => {
  it('lists every way to practise, each leading to its own page', () => {
    renderHome()

    const links = ways().getAllByRole('link')
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Typing Test', ROUTES.gg],
      ['Hover Mode', ROUTES.ggHover],
      ['Syllable Trainer', ROUTES.ggSyllables],
      ['Golden Nuggets', ROUTES.ggNuggets],
      ['History', ROUTES.history],
      ['Statistics', ROUTES.statistics],
    ])
  })

  it('goes into a way to practise inside the application, not by loading the page again', async () => {
    const user = userEvent.setup()
    renderHome()

    await user.click(ways().getByRole('link', { name: 'Hover Mode' }))

    expect(location).toBe(ROUTES.ggHover)
    expect(screen.getByText('Somewhere else')).toBeInTheDocument()
  })

  it('leaves a press meant for a new tab to the browser', () => {
    renderHome()
    const link = ways().getByRole('link', { name: 'Statistics' })

    // Not prevented: the browser opens it where it was asked to.
    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true)
    expect(screen.queryByText('Somewhere else')).not.toBeInTheDocument()
  })

  it('shows a real photograph for each, as decoration beside the words that name it', () => {
    renderHome()

    // Hidden until a row is hovered or focused, and then only one at a time.
    const images = ways().getAllByRole('presentation', { hidden: true })
    expect(images).toHaveLength(WAYS_TO_PRACTISE.length)
    for (const image of images) {
      expect(image).toHaveAttribute('alt', '')
      expect(image.getAttribute('src')).toMatch(
        /^https:\/\/images\.unsplash\.com\/photo-\d+-[0-9a-f]+\?/,
      )
    }
  })
})

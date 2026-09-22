/**
 * The typeface, the vocabulary and the theme button, over the real shell and
 * settings: each chosen as a typist chooses it, each doing what it says, each
 * remembered. How the typefaces look is judged in a browser; jsdom sets no type.
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ROUTES } from '@app/routes.ts'
import { DEFAULT_PREFERENCES } from '@config'
import { createGoldenNuggetService } from '@core/nuggets'
import { createMemoryAdapter } from '@core/persistence'
import { createSessionServiceOver } from '@core/sessions'
import { createTelemetryServiceOver } from '@core/telemetry'
import { ADVANCED_WORDS, COMMON_WORDS } from '@core/text'
import { settingsStore } from '@features/settings/state/settings.store.ts'

import { GGLayout } from './layout/GGLayout.tsx'
import { GGHoverPage } from './pages/GGHoverPage.tsx'
import { GGPracticePage } from './pages/GGPracticePage.tsx'
import { removeTheme } from './themes/apply-theme.ts'
import { GG_THEMES } from './themes/themes.ts'

const renderAt = (path: string) => {
  const adapter = createMemoryAdapter()
  const services = {
    service: createSessionServiceOver(adapter),
    telemetry: createTelemetryServiceOver(adapter),
    goldenNuggets: createGoldenNuggetService(createMemoryAdapter()),
  }
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.gg} element={<GGLayout />}>
          <Route index element={<GGPracticePage {...services} />} />
          <Route path={ROUTES.ggHover} element={<GGHoverPage {...services} />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const stream = () => screen.getByRole('region', { name: 'Words to type' })
const streamWords = () => (stream().textContent ?? '').trim().split(/\s+/)

beforeEach(() => {
  settingsStore.setState({
    preferences: { ...DEFAULT_PREFERENCES, practiceWordCount: 15 },
    status: 'ready',
  })
})

afterEach(() => {
  removeTheme()
})

describe('the typeface', () => {
  it('opens in the slab face, and sets the words in whichever of the four is chosen, remembered', async () => {
    const user = userEvent.setup()
    renderAt(ROUTES.gg)
    const faces = screen.getByRole('radiogroup', { name: 'Typeface' })

    expect(
      within(faces)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('aria-label')),
    ).toEqual(['Roboto Slab', 'Geist Mono', 'Inter', 'Lora'])
    expect(stream()).toHaveAttribute('data-font', 'slab')

    await user.click(within(faces).getByRole('radio', { name: 'Lora' }))

    expect(stream()).toHaveAttribute('data-font', 'serif')
    expect(settingsStore.getState().preferences.streamFont).toBe('serif')
  })
})

describe('the vocabulary', () => {
  it('draws the words from the wider vocabulary when Advanced is chosen, says so, and remembers it', async () => {
    const user = userEvent.setup()
    renderAt(ROUTES.gg)
    const normal = new Set(COMMON_WORDS)
    const advanced = new Set(ADVANCED_WORDS)

    expect(streamWords().every((word) => normal.has(word))).toBe(true)
    expect(screen.getByText('Common words')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /^Advanced/ }))

    await waitFor(() =>
      expect(streamWords().every((word) => advanced.has(word))).toBe(true),
    )
    expect(streamWords()).toHaveLength(15)
    expect(screen.getByText('Advanced words')).toBeInTheDocument()
    expect(settingsStore.getState().preferences.vocabulary).toBe('advanced')

    await user.click(screen.getByRole('radio', { name: /^Normal/ }))

    await waitFor(() =>
      expect(streamWords().every((word) => normal.has(word))).toBe(true),
    )
  })

  it('is ordinary practice’s: Hover Mode keeps its own words and offers no vocabulary', () => {
    settingsStore.setState({
      preferences: {
        ...DEFAULT_PREFERENCES,
        practiceWordCount: 15,
        vocabulary: 'advanced',
      },
      status: 'ready',
    })
    renderAt(ROUTES.ggHover)

    expect(
      screen.queryByRole('radiogroup', { name: 'Vocabulary' }),
    ).not.toBeInTheDocument()
    expect(streamWords().some((word) => new Set(ADVANCED_WORDS).has(word))).toBe(false)
  })
})

describe('the theme button', () => {
  it('is named, and opens every theme', async () => {
    const user = userEvent.setup()
    renderAt(ROUTES.gg)

    await user.click(screen.getByRole('button', { name: 'Themes' }))

    const panel = screen.getByRole('dialog', { name: 'Theme' })
    expect(within(panel).getAllByRole('radio')).toHaveLength(GG_THEMES.length)
    expect(
      within(panel).getByRole('radio', { name: 'Lavender Sky' }),
    ).toBeInTheDocument()
  })
})

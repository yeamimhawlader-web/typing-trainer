/**
 * Hover Mode through the GG.Typing screen, end to end in jsdom.
 *
 * Real shell, session, engines, Hover Mode controller, storage and settings;
 * storage in memory and the text predictable. Typing arrives as input events,
 * as it does from a keyboard. The rules and the motion have their own tests;
 * these check that the screen, the session and what gets saved agree with them.
 *
 * jsdom cannot animate, so every motion resolves at once here — which is also
 * exactly the reduced-motion path.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ROUTES } from '@app/routes.ts'
import { DEFAULT_PREFERENCES } from '@config'
import { createMemoryAdapter } from '@core/persistence'
import { createSessionServiceOver, type SessionService } from '@core/sessions'
import { createTelemetryServiceOver, type TelemetryService } from '@core/telemetry'
import type { TextProvider } from '@core/text'
import { settingsStore } from '@features/settings/state/settings.store.ts'

import { GGLayout } from './layout/GGLayout.tsx'
import { GGHoverPage } from './pages/GGHoverPage.tsx'
import { GGPracticePage } from './pages/GGPracticePage.tsx'
import { removeTheme } from './themes/apply-theme.ts'

const TEXT = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar'

const fixed = (text = TEXT): TextProvider => ({
  id: 'fixed',
  label: 'Fixed words',
  provide: () => ({ text, sourceId: 'fixed' }),
})

let sessions: SessionService
let telemetry: TelemetryService
let now = 10_000

beforeEach(() => {
  const adapter = createMemoryAdapter()
  sessions = createSessionServiceOver(adapter)
  telemetry = createTelemetryServiceOver(adapter)
  settingsStore.setState({ preferences: { ...DEFAULT_PREFERENCES, practiceWordCount: 15 }, status: 'ready' })
  now = 10_000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})

afterEach(() => {
  vi.restoreAllMocks()
  removeTheme()
})

const renderAt = (path: string, text = TEXT) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.gg} element={<GGLayout />}>
          <Route index element={<GGPracticePage provider={fixed(text)} service={sessions} telemetry={telemetry} />} />
          <Route path={ROUTES.ggHover} element={<GGHoverPage provider={fixed(text)} service={sessions} telemetry={telemetry} />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

const openHover = async (text = TEXT) => {
  renderAt(ROUTES.ggHover, text)
  await screen.findByRole('region', { name: 'Words to type' })
}

// --- Reading the screen ------------------------------------------------

const stream = () => screen.getByRole('region', { name: 'Words to type' })
const stateAt = (index: number) => stream().querySelector<HTMLElement>(`[data-i="${index}"]`)?.dataset.state
const wordElement = (index: number) => stream().querySelector<HTMLElement>(`[data-word="${index}"]`)
const layers = () => Array.from(stream().querySelectorAll<HTMLElement>('[data-focus-word]'))
const layer = () => {
  const [only, ...others] = layers()
  if (only === undefined || others.length > 0) throw new Error(`expected one focus layer, found ${layers().length}`)
  return only
}
const nodes = () => Array.from(layer().querySelectorAll<HTMLElement>('[data-filled]'))
const filled = () => nodes().filter((node) => node.dataset.filled === 'true').length
const attemptStates = () => Array.from(layer().querySelectorAll<HTMLElement>('[data-hover-state]')).map((letter) => letter.dataset.hoverState)
const field = () => screen.getByRole('textbox', { name: 'Type the words above' }) as HTMLTextAreaElement
const figure = (unit: string) =>
  Array.from(screen.getByRole('status', { name: 'Live statistics' }).children).find(
    (child) => child.lastElementChild?.textContent === unit,
  )?.firstElementChild?.textContent

// --- Typing -------------------------------------------------------------

const typeText = (text: string, gapMs = 100) => {
  act(() => {
    for (const character of Array.from(text)) {
      now += gapMs
      field().dispatchEvent(
        new InputEvent('beforeinput', { inputType: 'insertText', data: character, bubbles: true, cancelable: true }),
      )
    }
  })
}

const backspace = () => {
  act(() => {
    now += 100
    field().dispatchEvent(new InputEvent('beforeinput', { inputType: 'deleteContentBackward', bubbles: true, cancelable: true }))
  })
}

/** Lets a released layer's (instant, in jsdom) landing finish. */
const settle = () => act(async () => {})

describe('Hover Mode on the GG.Typing screen', () => {
  describe('finding it', () => {
    it('is offered beside ordinary practice, as its own page', async () => {
      renderAt(ROUTES.gg)
      await screen.findByRole('region', { name: 'Words to type' })
      const modes = screen.getByRole('navigation', { name: 'Mode' })

      expect(within(modes).getByRole('link', { name: /^Standard/ })).toHaveAttribute('aria-current', 'page')
      expect(within(modes).getByRole('link', { name: 'Hover Mode: Target mistakes and repeat them' })).toHaveAttribute(
        'href',
        ROUTES.ggHover,
      )

      await userEvent.setup().click(within(modes).getByRole('link', { name: /^Hover Mode/ }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Hover Mode' })).toBeInTheDocument()
      expect(within(screen.getByRole('navigation', { name: 'Mode' })).getByRole('link', { name: /^Hover Mode/ })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(screen.getByText('Target mistakes and repeat them', { selector: 'span' })).toBeInTheDocument()
      expect(document.title).toBe('Hover Mode · GG.Typing')
    })
  })

  describe('before any mistake', () => {
    it('types exactly like ordinary practice', async () => {
      await openHover()

      typeText('alpha bra')

      expect(layers()).toEqual([])
      expect([0, 1, 2, 3, 4, 5, 6].map(stateAt)).toEqual(['correct', 'correct', 'correct', 'correct', 'correct', 'correct', 'correct'])
      expect(figure('words')).toBe('1/15')
    })
  })

  describe('one mistake', () => {
    it('focuses the word at once, with three repetitions to come', async () => {
      await openHover()

      typeText('alpx')

      expect(layer()).toHaveAttribute('data-focus-word', 'alpha')
      expect(layer()).toHaveAttribute('data-stage', 'pending')
      expect(nodes()).toHaveLength(3)
      expect(filled()).toBe(0)
      // The typist is still on the word in the text.
      expect(stateAt(3)).toBe('incorrect')
      expect(screen.getByText(/Focused on “alpha”/)).toBeInTheDocument()
      expect(screen.getByText(/then type it again/)).toBeInTheDocument()
    })

    it('stands the layer in for the word once the typist leaves it', async () => {
      await openHover()

      typeText('alpxa ')

      expect(layer()).toHaveAttribute('data-stage', 'repeating')
      expect(wordElement(0)).toHaveStyle({ visibility: 'hidden' })
      expect(stream()).toHaveAttribute('data-hover', 'repeating')
      // The text has not moved on: its next word is untouched.
      expect(stateAt(6)).toBe('pending')
      expect(attemptStates()).toEqual(['pending', 'pending', 'pending', 'pending', 'pending', 'pending'])
      expect(screen.getByText(/until its dots are filled/)).toBeInTheDocument()
    })

    it('draws each repetition from its own engine, with its caret', async () => {
      await openHover()
      typeText('alpxa ')

      typeText('alz')

      expect(attemptStates().slice(0, 4)).toEqual(['correct', 'correct', 'incorrect', 'pending'])
      expect(layer().querySelector('[data-caret="true"]')?.textContent).toBe('h')
      // Nothing reached the text.
      expect(stateAt(6)).toBe('pending')
    })
  })

  describe('repetitions', () => {
    it('fills a node for each clean one and releases the word after three', async () => {
      await openHover()
      typeText('alpxa ')

      typeText('alpha ')
      expect(filled()).toBe(1)
      typeText('alpha ')
      expect(filled()).toBe(2)
      typeText('alpha ')
      await settle()

      expect(layers()).toEqual([])
      expect(wordElement(0)).not.toHaveStyle({ visibility: 'hidden' })
      expect(stream()).toHaveAttribute('data-hover', 'normal')
      // The mistake that started it is still marked in the text.
      expect(stateAt(3)).toBe('incorrect')
    })

    it('carries on with the text where it was left', async () => {
      await openHover()
      typeText('alpxa alpha alpha alpha ')
      await settle()

      typeText('bravo')

      expect([6, 7, 8, 9, 10].map(stateAt)).toEqual(['correct', 'correct', 'correct', 'correct', 'correct'])
      // Two words behind the cursor: the focused one and this one.
      expect(figure('words')).toBe('2/15')
    })

    it('adds three nodes for a repetition with a mistake, keeping the filled ones', async () => {
      await openHover()
      typeText('alpxa ')

      typeText('alpha ')
      typeText('alxha ')

      expect(nodes()).toHaveLength(6)
      expect(filled()).toBe(1)
      expect(screen.getByText(/A mistake in that one\. 5 clean repetitions to go\./)).toBeInTheDocument()

      typeText('alpha alpha alpha alpha ')
      expect(filled()).toBe(5)
      typeText('alpha ')
      await settle()
      expect(layers()).toEqual([])
    })

    it('counts a mistake put right with backspace as a repetition with a mistake', async () => {
      await openHover()
      typeText('alpxa ')

      typeText('alx')
      backspace()
      typeText('pha ')

      expect(nodes()).toHaveLength(6)
      expect(filled()).toBe(0)
    })

    it('keeps the requirement to twelve however many repetitions go wrong', async () => {
      await openHover()
      typeText('alpxa ')

      for (let repetition = 0; repetition < 6; repetition += 1) typeText('xlpha ')

      expect(nodes()).toHaveLength(12)
    })
  })

  describe('the end of a focus, and of a test', () => {
    it('clears Hover Mode on restart', async () => {
      await openHover()
      typeText('alpxa alp')

      await userEvent.setup().click(screen.getByRole('button', { name: 'Restart test' }))

      expect(layers()).toEqual([])
      expect(stream()).toHaveAttribute('data-hover', 'normal')
      typeText('alpha')
      expect([0, 1, 2, 3, 4].map(stateAt)).toEqual(['correct', 'correct', 'correct', 'correct', 'correct'])
    })

    it('clears Hover Mode on Tab while a word is being repeated', async () => {
      await openHover()
      typeText('alpxa alp')

      fireEvent.keyDown(field(), { key: 'Tab' })

      expect(layers()).toEqual([])
      expect(stateAt(0)).toBe('pending')
    })

    it('saves the test as Hover Mode, with each focus, its telemetry and a result that says what happened', async () => {
      await openHover('one two three')

      typeText('onx ')
      typeText('one one one ')
      await settle()
      typeText('two thrxe ')
      typeText('three three three ')
      await settle()

      await waitFor(async () => {
        expect(await sessions.getAll()).toHaveLength(1)
      })
      const [stored] = await sessions.getAll()
      expect(stored?.context.mode).toBe('hover')
      expect(stored?.text).toBe('one two three')
      expect(stored?.context.hover?.focuses).toEqual([
        expect.objectContaining({ word: 'one', wordIndex: 0, required: 3, successes: 3, failures: 0, completed: true }),
        expect.objectContaining({ word: 'three', wordIndex: 2, required: 3, successes: 3, failures: 0, completed: true }),
      ])
      await waitFor(async () => {
        expect(await telemetry.getStored(stored!.id)).not.toBeNull()
      })
      // The text pass only: 13 characters, 2 of them wrong, no repetitions.
      expect(stored?.metrics).toMatchObject({ totalCharacters: 13, typedCharacters: 13, errorCount: 2 })
      expect(figure('wpm')).toBe(String(Math.round(stored?.metrics.netWpm ?? -1)))

      const result = screen.getByRole('region', { name: 'Hover Mode' })
      const rows = within(result).getAllByRole('row').slice(1)
      expect(rows.map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))).toEqual([
        ['one', '3', '0', '3', expect.stringMatching(/ s$/)],
        ['three', '3', '0', '3', expect.stringMatching(/ s$/)],
      ])
      expect(result).toHaveTextContent('2 words focused')
    })

    it('holds the end of the text open for a focused last word', async () => {
      await openHover('one two')

      typeText('one twx')

      expect(await sessions.getAll()).toHaveLength(0)
      expect(layer()).toHaveAttribute('data-stage', 'repeating')

      typeText('two two two ')
      await settle()

      await waitFor(async () => {
        expect(await sessions.getAll()).toHaveLength(1)
      })
    })

    it('says so plainly when nothing needed a focus', async () => {
      await openHover('one two')

      typeText('one two')

      const result = await screen.findByRole('region', { name: 'Hover Mode' })
      expect(result).toHaveTextContent('No word needed a focus: nothing was mistyped.')
      const [stored] = await sessions.getAll()
      expect(stored?.context.hover).toEqual({ focuses: [] })
    })
  })

  describe('without motion', () => {
    it('keeps every state and all the information, moving nothing', async () => {
      const originalMatchMedia = window.matchMedia
      const animate = vi.fn()
      window.matchMedia = ((query: string) => ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      })) as unknown as typeof window.matchMedia
      const originalAnimate = HTMLElement.prototype.animate
      HTMLElement.prototype.animate = animate as unknown as typeof HTMLElement.prototype.animate
      try {
        await openHover()

        typeText('alpxa ')
        expect(layer()).toHaveAttribute('data-stage', 'repeating')
        typeText('alpha alxha ')
        expect(nodes()).toHaveLength(6)
        expect(filled()).toBe(1)

        expect(animate).not.toHaveBeenCalled()
      } finally {
        window.matchMedia = originalMatchMedia
        HTMLElement.prototype.animate = originalAnimate
      }
    })
  })

  describe('ordinary practice', () => {
    it('has no Hover Mode in it', async () => {
      renderAt(ROUTES.gg)
      await screen.findByRole('region', { name: 'Words to type' })

      typeText('alpxa bravo')

      expect(layers()).toEqual([])
      expect(stateAt(6)).toBe('correct')
      expect(stream()).not.toHaveAttribute('data-hover')
    })
  })
})

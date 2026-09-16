/**
 * Hover Mode through the GG.Typing screen, end to end in jsdom, at each
 * difficulty, with Golden Nuggets.
 *
 * Real shell, session, engines, Hover Mode controller, storage, settings and
 * Golden Nuggets; storage in memory and the text predictable. Typing arrives as
 * input events, as it does from a keyboard. The rules, the merge of Golden
 * Nuggets and the motion have their own tests; these check that the screen, the
 * session and what gets saved agree with them.
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
import { createMemoryAdapter, type StorageAdapter } from '@core/persistence'
import { createGoldenNuggetService, type GoldenNuggetService } from '@core/nuggets'
import { createSessionServiceOver, type SessionService } from '@core/sessions'
import { createTelemetryServiceOver, type TelemetryService } from '@core/telemetry'
import type { TextProvider } from '@core/text'
import type { HoverDifficulty } from '@core/types'
import { settingsStore } from '@features/settings/state/settings.store.ts'

import { GGLayout } from './layout/GGLayout.tsx'
import { GGGoldenNuggetsPage } from './pages/GGGoldenNuggetsPage.tsx'
import { GGHoverPage } from './pages/GGHoverPage.tsx'
import { GGPracticePage } from './pages/GGPracticePage.tsx'
import { removeTheme } from './themes/apply-theme.ts'

const TEXT = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar'

const fixed = (text = TEXT): TextProvider => ({
  id: 'fixed',
  label: 'Fixed words',
  provide: () => ({ text, sourceId: 'fixed' }),
})

let adapter: StorageAdapter
let sessions: SessionService
let telemetry: TelemetryService
let nuggets: GoldenNuggetService
let now = 10_000

const preferDifficulty = (hoverDifficulty: HoverDifficulty) => {
  settingsStore.setState({
    preferences: { ...DEFAULT_PREFERENCES, practiceWordCount: 15, hoverDifficulty },
    status: 'ready',
  })
}

beforeEach(() => {
  adapter = createMemoryAdapter()
  sessions = createSessionServiceOver(adapter)
  telemetry = createTelemetryServiceOver(adapter)
  nuggets = createGoldenNuggetService(adapter)
  preferDifficulty('standard')
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
          <Route
            path={ROUTES.ggHover}
            element={
              <GGHoverPage provider={fixed(text)} service={sessions} telemetry={telemetry} goldenNuggets={nuggets} />
            }
          />
          <Route path={ROUTES.ggNuggets} element={<GGGoldenNuggetsPage service={nuggets} />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

const openHover = async (difficulty: HoverDifficulty = 'standard', text = TEXT) => {
  preferDifficulty(difficulty)
  const rendered = renderAt(ROUTES.ggHover, text)
  await screen.findByRole('region', { name: 'Words to type' })
  return rendered
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
const nodes = () => Array.from(layer().querySelectorAll<HTMLElement>('[data-node]')).map((node) => node.dataset.node)
const attemptStates = () =>
  Array.from(layer().querySelectorAll<HTMLElement>('[data-hover-state]')).map((letter) => letter.dataset.hoverState)
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

/** Lets a released layer's (instant, in jsdom) landing, and any write, finish. */
const settle = () => act(async () => {})

const storedNuggets = async () => (await createGoldenNuggetService(adapter).getAll()).map(({ word, timesUnresolved, hoverSessions }) => ({ word, timesUnresolved, hoverSessions }))

describe('Hover Mode on the GG.Typing screen', () => {
  describe('finding it', () => {
    it('is offered beside ordinary practice, as its own page', async () => {
      renderAt(ROUTES.gg)
      await screen.findByRole('region', { name: 'Words to type' })
      const modes = screen.getByRole('navigation', { name: 'Mode' })

      expect(within(modes).getByRole('link', { name: /^Standard/ })).toHaveAttribute('aria-current', 'page')
      expect(screen.queryByRole('radiogroup', { name: 'Hover difficulty' })).not.toBeInTheDocument()

      await userEvent.setup().click(within(modes).getByRole('link', { name: /^Hover Mode/ }))

      expect(await screen.findByRole('heading', { level: 1, name: 'Hover Mode' })).toBeInTheDocument()
      expect(screen.getByText('Target mistakes and repeat them', { selector: 'span' })).toBeInTheDocument()
      expect(document.title).toBe('Hover Mode · GG.Typing')
    })

    it('leads to Golden Nuggets from Hover Mode only, not from ordinary practice or the top bar', async () => {
      const practice = renderAt(ROUTES.gg)
      await screen.findByRole('region', { name: 'Words to type' })
      expect(screen.queryByRole('link', { name: 'Golden Nuggets' })).not.toBeInTheDocument()
      practice.unmount()

      await openHover('standard')
      const links = screen.getAllByRole('link', { name: 'Golden Nuggets' })
      expect(links).toHaveLength(1)
      expect(links[0]).toHaveAttribute('href', ROUTES.ggNuggets)
      expect(within(screen.getByRole('navigation', { name: 'Main' })).queryByRole('link', { name: 'Golden Nuggets' })).not.toBeInTheDocument()
    })

    it('offers its three difficulties, opening on the one last chosen', async () => {
      await openHover('all-in')
      const difficulties = screen.getByRole('radiogroup', { name: 'Hover difficulty' })

      expect(within(difficulties).getAllByRole('radio').map((radio) => radio.getAttribute('aria-label'))).toEqual([
        'Standard: One 3-repetition cycle',
        'All In: Two 3-repetition cycles',
        'Tired: Repeat until cleared, up to the safety limit',
      ])
      expect(within(difficulties).getByRole('radio', { name: /^All In/ })).toBeChecked()
    })

    it('starts a new test at a newly chosen difficulty, and remembers it', async () => {
      await openHover('standard')
      typeText('alpxa ')
      expect(nodes()).toHaveLength(3)

      await userEvent.setup().click(screen.getByRole('radio', { name: /^Tired/ }))

      expect(layers()).toEqual([])
      expect(settingsStore.getState().preferences.hoverDifficulty).toBe('tired')
      typeText('alpxa alxha ')
      expect(nodes()).toHaveLength(6)
    })
  })

  describe('before any mistake', () => {
    it('types exactly like ordinary practice', async () => {
      await openHover('tired')

      typeText('alpha bra')

      expect(layers()).toEqual([])
      expect([0, 1, 2, 3, 4, 5, 6].map(stateAt)).toEqual(['correct', 'correct', 'correct', 'correct', 'correct', 'correct', 'correct'])
      expect(figure('words')).toBe('1/15')
    })
  })

  describe('one mistake', () => {
    it('focuses the word at once', async () => {
      await openHover()

      typeText('alpx')

      expect(layer()).toHaveAttribute('data-focus-word', 'alpha')
      expect(layer()).toHaveAttribute('data-stage', 'pending')
      expect(nodes()).toEqual(['open', 'open', 'open'])
      expect(stateAt(3)).toBe('incorrect')
      expect(screen.getByText(/Focused on “alpha”\. Finish it, then type it 3 times\./)).toBeInTheDocument()
      expect(screen.getByText(/then type it again/)).toBeInTheDocument()
    })

    it('stands the layer in for the word once the typist leaves it', async () => {
      await openHover()

      typeText('alpxa ')

      expect(layer()).toHaveAttribute('data-stage', 'repeating')
      expect(wordElement(0)).toHaveStyle({ visibility: 'hidden' })
      expect(stream()).toHaveAttribute('data-hover', 'repeating')
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
      expect(stateAt(6)).toBe('pending')
    })
  })

  describe('Standard', () => {
    it('releases the word after three clean repetitions, cleared and not kept', async () => {
      await openHover('standard')
      typeText('alpxa ')

      typeText('alpha ')
      typeText('alpha ')
      expect(nodes()).toEqual(['clean', 'clean', 'open'])
      typeText('alpha ')
      await settle()

      expect(layers()).toEqual([])
      expect(wordElement(0)).not.toHaveStyle({ visibility: 'hidden' })
      expect(stream()).toHaveAttribute('data-hover', 'normal')
      // The mistake that started it is still marked in the text.
      expect(stateAt(3)).toBe('incorrect')
      expect(await storedNuggets()).toEqual([])
    })

    it('releases after three repetitions even with a mistake in one, and keeps the word in Golden Nuggets', async () => {
      await openHover('standard')
      typeText('alpxa ')

      typeText('alpha alxha ')
      expect(nodes()).toEqual(['clean', 'missed', 'open'])
      typeText('alpha ')
      await settle()

      expect(layers()).toEqual([])
      expect(screen.getByText(/Moving on from “alpha”\. It is kept in Golden Nuggets\./)).toBeInTheDocument()
      await waitFor(async () => {
        expect(await storedNuggets()).toEqual([{ word: 'alpha', timesUnresolved: 1, hoverSessions: 1 }])
      })

      // No second cycle: the next keys are the text's.
      typeText('bravo')
      expect([6, 7, 8, 9, 10].map(stateAt)).toEqual(['correct', 'correct', 'correct', 'correct', 'correct'])
      expect(figure('words')).toBe('2/15')
    })
  })

  describe('All In', () => {
    it('shows two cycles of three, runs the second after a clean first, and releases after six', async () => {
      await openHover('all-in')
      typeText('alpxa ')
      expect(nodes()).toHaveLength(6)
      expect(layer().querySelectorAll('[data-node]')[3]?.className).toMatch(/groupStart/)

      typeText('alpha alpha alpha ')
      expect(layer()).toHaveAttribute('data-stage', 'repeating')
      expect(nodes()).toEqual(['clean', 'clean', 'clean', 'open', 'open', 'open'])
      expect(screen.getByText(/First cycle done\. 3 repetitions to go\./)).toBeInTheDocument()

      typeText('alpha alpha alpha ')
      await settle()

      expect(layers()).toEqual([])
      expect(await storedNuggets()).toEqual([])
    })

    it('keeps a word with a mistake in its second cycle, and runs no third', async () => {
      await openHover('all-in')
      typeText('alpxa ')

      typeText('alpha alpha alpha alpha alxha alpha ')
      await settle()

      expect(layers()).toEqual([])
      await waitFor(async () => {
        expect(await storedNuggets()).toEqual([{ word: 'alpha', timesUnresolved: 1, hoverSessions: 1 }])
      })
      typeText('b')
      expect(stateAt(6)).toBe('correct')
    })
  })

  describe('Tired', () => {
    it('adds three to the row for a repetition with a mistake, keeping the clean ones', async () => {
      await openHover('tired')
      typeText('alpxa ')

      typeText('alpha ')
      typeText('alxha ')

      expect(nodes()).toEqual(['clean', 'open', 'open', 'open', 'open', 'open'])
      expect(screen.getByText(/That one had a mistake\. 5 clean repetitions to go\./)).toBeInTheDocument()

      typeText('alpha alpha alpha alpha ')
      expect(nodes().filter((node) => node === 'clean')).toHaveLength(5)
      typeText('alpha ')
      await settle()
      expect(layers()).toEqual([])
      expect(await storedNuggets()).toEqual([])
    })

    it('counts a mistake put right with backspace as a repetition with a mistake', async () => {
      await openHover('tired')
      typeText('alpxa ')

      typeText('alx')
      backspace()
      typeText('pha ')

      expect(nodes()).toEqual(['open', 'open', 'open', 'open', 'open', 'open'])
    })

    it('never asks for more than ten, and keeps a word that reached the ceiling', async () => {
      await openHover('tired')
      typeText('alpxa ')

      for (let repetition = 0; repetition < 6; repetition += 1) typeText('xlpha ')
      expect(nodes()).toHaveLength(10)

      for (let repetition = 0; repetition < 10; repetition += 1) typeText('alpha ')
      await settle()

      expect(layers()).toEqual([])
      await waitFor(async () => {
        expect(await storedNuggets()).toEqual([{ word: 'alpha', timesUnresolved: 1, hoverSessions: 1 }])
      })
    })
  })

  describe('the end of a focus, and of a test', () => {
    it('clears Hover Mode on restart, keeping nothing in Golden Nuggets', async () => {
      await openHover('tired')
      typeText('alpxa xlpha alp')

      await userEvent.setup().click(screen.getByRole('button', { name: 'Restart test' }))
      await settle()

      expect(layers()).toEqual([])
      expect(stream()).toHaveAttribute('data-hover', 'normal')
      expect(await storedNuggets()).toEqual([])
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

    it('saves the test with its difficulty, each focus and its telemetry, and shows what happened', async () => {
      await openHover('standard', 'one two three')

      typeText('onx ')
      typeText('one one one ')
      await settle()
      typeText('two thrxe ')
      typeText('three thrxe three ')
      await settle()

      await waitFor(async () => {
        expect(await sessions.getAll()).toHaveLength(1)
      })
      const [stored] = await sessions.getAll()
      expect(stored?.context.mode).toBe('hover')
      expect(stored?.text).toBe('one two three')
      expect(stored?.context.hover?.difficulty).toBe('standard')
      expect(stored?.context.hover?.focuses).toEqual([
        expect.objectContaining({ word: 'one', cycles: 1, attempts: 3, successes: 3, failures: 0, cleared: true, goldenNugget: false }),
        expect.objectContaining({ word: 'three', cycles: 1, attempts: 3, successes: 2, failures: 1, mistakes: 2, cleared: false, goldenNugget: true }),
      ])
      await waitFor(async () => {
        expect(await telemetry.getStored(stored!.id)).not.toBeNull()
      })
      // The text pass only: 13 characters, 2 of them wrong, no repetitions.
      expect(stored?.metrics).toMatchObject({ totalCharacters: 13, typedCharacters: 13, errorCount: 2 })
      expect(figure('wpm')).toBe(String(Math.round(stored?.metrics.netWpm ?? -1)))

      const result = screen.getByRole('region', { name: 'Hover Mode' })
      expect(result).toHaveTextContent('Difficulty Standard')
      const rows = within(result).getAllByRole('row').slice(1)
      expect(rows.map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))).toEqual([
        ['one', '1', '3 of 3', '0', 'Yes', '—', expect.stringMatching(/ s$/)],
        ['three', '1', '2 of 3', '1', 'Not yet', 'Kept', expect.stringMatching(/ s$/)],
      ])
      expect(within(result).getByRole('link', { name: 'Golden Nuggets' })).toHaveAttribute('href', ROUTES.ggNuggets)
    })

    it('holds the end of the text open for a focused last word', async () => {
      await openHover('standard', 'one two')

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
      await openHover('all-in', 'one two')

      typeText('one two')

      const result = await screen.findByRole('region', { name: 'Hover Mode' })
      expect(result).toHaveTextContent('No word needed a focus: nothing was mistyped.')
      const [stored] = await sessions.getAll()
      expect(stored?.context.hover).toEqual({ difficulty: 'all-in', focuses: [] })
    })
  })

  describe('Golden Nuggets', () => {
    it('keeps several words as separate records, and one word as one record across tests', async () => {
      await openHover('standard', 'one two three')

      typeText('onx one onx one ')
      await settle()
      typeText('twx two twx two ')
      await settle()
      typeText('three')
      await screen.findByRole('region', { name: 'Hover Mode' })

      // A second test: "one" slips again.
      fireEvent.keyDown(field(), { key: 'Enter' })
      typeText('onx onx one one ')
      await settle()

      await waitFor(async () => {
        const all = await storedNuggets()
        expect(all.toSorted((a, b) => a.word.localeCompare(b.word))).toEqual([
          { word: 'one', timesUnresolved: 2, hoverSessions: 2 },
          { word: 'two', timesUnresolved: 1, hoverSessions: 1 },
        ])
      })
    })

    it('are still there after a reload, on their own page', async () => {
      const { unmount } = await openHover('standard', 'one two')
      typeText('onx one onx one ')
      await settle()
      await waitFor(async () => {
        expect(await storedNuggets()).toHaveLength(1)
      })

      // A reload: everything unmounted, and the page read by a new service over
      // the same storage.
      unmount()
      nuggets = createGoldenNuggetService(adapter)
      renderAt(ROUTES.ggNuggets)

      const item = await screen.findByRole('listitem')
      expect(within(item).getByRole('heading', { name: 'one' })).toBeInTheDocument()
      expect(item).toHaveTextContent('Failed 1 time')
      expect(item).toHaveTextContent('Seen in 1 Hover session')
      expect(item).toHaveTextContent('Last difficulty: Standard')
      expect(item).toHaveTextContent('Still unresolved last time')
      expect(document.title).toBe('Golden Nuggets · GG.Typing')
    })

    it('say how to get some when there are none', async () => {
      renderAt(ROUTES.ggNuggets)

      expect(await screen.findByText(/None yet/)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Hover Mode' })).toHaveAttribute('href', ROUTES.ggHover)
    })
  })

  describe('with sound on', () => {
    /** Web Audio, counted rather than heard: one oscillator is one voice. */
    const fakeAudio = () => {
      const built = { contexts: 0, oscillators: 0 }
      const param = () => ({
        value: 0,
        setValueAtTime: () => undefined,
        linearRampToValueAtTime: () => undefined,
        exponentialRampToValueAtTime: () => undefined,
      })
      const node = () => ({
        connect: () => undefined,
        gain: param(),
        frequency: param(),
        Q: param(),
        start: () => undefined,
        stop: () => undefined,
        type: '',
        buffer: null,
      })
      class Fake {
        state = 'running'
        currentTime = 0
        sampleRate = 48_000
        destination = node()
        constructor() {
          built.contexts += 1
        }
        createGain() {
          return node()
        }
        createOscillator() {
          built.oscillators += 1
          return node()
        }
        createBufferSource() {
          return node()
        }
        createBiquadFilter() {
          return node()
        }
        createBuffer(_channels: number, length: number) {
          return { duration: 0.2, getChannelData: () => new Float32Array(length) }
        }
        async resume() {}
        async close() {}
      }
      ;(window as unknown as { AudioContext: unknown }).AudioContext = Fake
      return built
    }

    afterEach(() => {
      delete (window as { AudioContext?: unknown }).AudioContext
    })

    it('sounds the keys of a repetition as well as the moments of the focus', async () => {
      const built = fakeAudio()
      await openHover('standard')
      // Switched on as the control row's toggle does, after the shell is up.
      act(() => {
        settingsStore.setState({
          preferences: { ...settingsStore.getState().preferences, soundEnabled: true },
          status: 'ready',
        })
      })

      typeText('alpxa ')
      const caught = built.oscillators
      expect(caught).toBeGreaterThan(0)

      // A repetition: six keys through Hover Mode's own engine, and the note for
      // the clean repetition on top of them.
      typeText('alpha ')

      expect(built.oscillators).toBeGreaterThan(caught + 6)
      expect(built.contexts).toBe(1)
    })

    it('stays silent when sound is off, however much is typed and repeated', async () => {
      const built = fakeAudio()
      await openHover('standard')

      typeText('alpxa ')
      typeText('alpha ')

      expect(built).toEqual({ contexts: 0, oscillators: 0 })
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
        await openHover('tired')

        typeText('alpxa ')
        expect(layer()).toHaveAttribute('data-stage', 'repeating')
        typeText('alpha alxha ')
        expect(nodes()).toEqual(['clean', 'open', 'open', 'open', 'open', 'open'])

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
      await settle()
      expect(await storedNuggets()).toEqual([])
    })
  })
})

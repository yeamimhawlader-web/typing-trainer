/**
 * The Syllable Trainer over the real application, end to end in jsdom.
 *
 * The shell, the typing session, the engine, session and telemetry storage and
 * the settings store are the real ones, with storage in memory and the text
 * fixed to words whose syllables are known. Each test types the way a typist
 * does — text arriving in the field — and asserts on what the stream draws and
 * what the application ends up holding. The syllable rules themselves are
 * tested in `@core/syllables`; nothing here repeats them.
 *
 * Layout and motion are judged in a browser; jsdom has neither.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ROUTES } from '@app/routes.ts'
import { DEFAULT_PREFERENCES } from '@config'
import { createMemoryAdapter, type StorageAdapter } from '@core/persistence'
import { createGoldenNuggetService, type GoldenNuggetService } from '@core/nuggets'
import { createSessionServiceOver, isTrainingMode, type SessionService } from '@core/sessions'
import { createTelemetryServiceOver, type TelemetryService } from '@core/telemetry'
import type { TextProvider } from '@core/text'
import { formatMode } from '@features/results/format.ts'
import { settingsStore } from '@features/settings/state/settings.store.ts'

import { GGLayout } from './layout/GGLayout.tsx'
import { GGPracticePage } from './pages/GGPracticePage.tsx'
import { GGSyllablePage } from './pages/GGSyllablePage.tsx'
import { removeTheme } from './themes/apply-theme.ts'

const WORDS = ['mountain', 'because', 'different']

const syllableProvider: TextProvider = {
  id: 'fixed-syllables',
  label: 'Fixed syllable words',
  provide: ({ wordCount }) => ({
    text: Array.from({ length: wordCount }, (_, index) => WORDS[index % WORDS.length]).join(' '),
    sourceId: 'fixed-syllables',
  }),
}

let adapter: StorageAdapter
let sessions: SessionService
let telemetry: TelemetryService
let nuggets: GoldenNuggetService
let now = 10_000

beforeEach(() => {
  adapter = createMemoryAdapter()
  sessions = createSessionServiceOver(adapter)
  telemetry = createTelemetryServiceOver(adapter)
  nuggets = createGoldenNuggetService(createMemoryAdapter())
  settingsStore.setState({ preferences: { ...DEFAULT_PREFERENCES, practiceWordCount: 15 }, status: 'ready' })
  now = 10_000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})

afterEach(() => {
  vi.restoreAllMocks()
  removeTheme()
})

const renderTrainer = async () => {
  render(
    <MemoryRouter initialEntries={[ROUTES.ggSyllables]}>
      <Routes>
        <Route path={ROUTES.gg} element={<GGLayout />}>
          <Route index element={<GGPracticePage service={sessions} telemetry={telemetry} goldenNuggets={nuggets} />} />
          <Route
            path={ROUTES.ggSyllables}
            element={
              <GGSyllablePage
                provider={syllableProvider}
                service={sessions}
                telemetry={telemetry}
                goldenNuggets={nuggets}
              />
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByRole('region', { name: 'Words to type' })
}

// --- Reading the screen ------------------------------------------------

const stream = () => screen.getByRole('region', { name: 'Words to type' })
const field = () => screen.getByRole('textbox', { name: 'Type the words above' }) as HTMLTextAreaElement
const wordAt = (index: number) => stream().querySelector<HTMLElement>(`[data-word="${index}"]`)
const resolutionOf = (index: number) => wordAt(index)?.querySelector<HTMLElement>('[data-resolution]')?.dataset.resolution
/** Each syllable of a word, as `text:state`. */
const syllablesOf = (index: number) =>
  Array.from(wordAt(index)?.querySelectorAll<HTMLElement>('[data-syllable]') ?? []).map(
    (syllable) => `${syllable.textContent}:${syllable.dataset.syllable}`,
  )

const typeText = (text: string, gapMs = 90) => {
  act(() => {
    for (const character of Array.from(text)) {
      now += gapMs
      field().dispatchEvent(
        new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: character }),
      )
    }
  })
}

const fullText = () => Array.from({ length: 15 }, (_, index) => WORDS[index % WORDS.length]).join(' ')

describe('the Syllable Trainer', () => {
  describe('the page', () => {
    it('says what it is: its title, what it trains, a demonstration and four short instructions', async () => {
      await renderTrainer()

      expect(screen.getByRole('heading', { level: 1, name: 'Syllable Trainer' })).toBeInTheDocument()
      expect(screen.getByText('Train long words as rhythm, not as one block.')).toBeInTheDocument()
      expect(screen.getByRole('figure', { name: /Watch the rhythm/ })).toBeInTheDocument()
      expect(
        within(screen.getByRole('list', { name: 'How to train' }))
          .getAllByRole('listitem')
          .map((item) => item.textContent?.replace(/^\d+/, '')),
      ).toEqual(['Chunk the word.', 'Type one syllable.', 'Pause.', 'Type the next.'])
    })

    it('is part of the High Speed Trainer, beside Hover Mode and apart from it', async () => {
      await renderTrainer()

      const trainer = screen.getByRole('group', { name: 'High Speed Trainer' })
      expect(within(trainer).getByRole('link', { name: /^Hover Mode/ })).not.toHaveAttribute('aria-current')
      expect(within(trainer).getByRole('link', { name: /^Syllable Trainer/ })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: /^Standard/ })).not.toHaveAttribute('aria-current')
    })

    it('plays the demonstration by itself, and stops it for good the moment typing starts', async () => {
      await renderTrainer()
      const stage = () => document.querySelector<HTMLElement>('[data-apart]')

      expect(stage()?.dataset.demoPhase).toBe('whole')

      typeText('m')

      expect(stage()?.dataset.demoPhase).toBe('diagram')
    })

    it('offers a number of words and no time, and leaves ordinary practice’s choice of time alone', async () => {
      settingsStore.setState({ preferences: { ...DEFAULT_PREFERENCES, practiceWordCount: 15, practiceMode: 'time' } })
      await renderTrainer()

      expect(screen.queryByRole('radiogroup', { name: 'Test length in time' })).not.toBeInTheDocument()
      const words = screen.getByRole('radiogroup', { name: 'Test length in words' })
      expect(within(words).getByRole('radio', { name: '15 words' })).toBeChecked()

      act(() => {
        fireEvent.click(within(words).getByRole('radio', { name: '60 words' }))
      })

      expect(stream().querySelectorAll('[data-word]')).toHaveLength(60)
      expect(settingsStore.getState().preferences.practiceMode).toBe('time')
      expect(settingsStore.getState().preferences.practiceWordCount).toBe(60)
    })
  })

  describe('the words, as syllables', () => {
    it('draws each word as its chunks, adding nothing that is typed: the text is the text', async () => {
      await renderTrainer()

      expect(stream().textContent).toBe(fullText())
      expect(stream().querySelectorAll('[data-i]')).toHaveLength(fullText().length)
      expect(syllablesOf(0)).toEqual(['moun:active', 'tain:pending'])
      expect(syllablesOf(2)).toEqual(['dif:pending', 'fer:pending', 'ent:pending'])
      expect(resolutionOf(0)).toBe('current')
      expect(resolutionOf(1)).toBe('ahead')
    })

    it('moves to the next syllable once one is typed correctly', async () => {
      await renderTrainer()

      typeText('moun')

      expect(syllablesOf(0)).toEqual(['moun:typed', 'tain:active'])
      expect(resolutionOf(0)).toBe('current')
    })

    it('marks a wrong key where it fell, moves on without blocking, and never resolves the word as right', async () => {
      await renderTrainer()

      typeText('mxun')

      expect(stream().querySelector('[data-i="1"]')).toHaveAttribute('data-state', 'incorrect')
      expect(syllablesOf(0)).toEqual(['moun:typed', 'tain:active'])

      typeText('tain')

      expect(resolutionOf(0)).toBe('missed')
    })

    it('resolves a word typed right, and goes on to the next word with its first syllable in hand', async () => {
      await renderTrainer()

      typeText('mountain ')

      expect(resolutionOf(0)).toBe('resolved')
      expect(resolutionOf(1)).toBe('current')
      expect(syllablesOf(1)).toEqual(['be:active', 'cause:pending'])
    })

    it('never shows a word left part-way through as resolved', async () => {
      await renderTrainer()

      typeText('moun ')

      expect(resolutionOf(0)).toBe('missed')
      expect(resolutionOf(1)).toBe('current')
      expect(stream().querySelector('[data-i="4"]')).toHaveAttribute('data-state', 'incorrect')
    })
  })

  describe('the test', () => {
    it('is saved as the Syllable Trainer — a training mode, told apart from ordinary practice — with its telemetry', async () => {
      await renderTrainer()
      const text = fullText()

      typeText(text)

      await waitFor(async () => {
        expect(await sessions.getAll()).toHaveLength(1)
      })
      const [stored] = await sessions.getAll()
      expect(stored?.context.mode).toBe('syllable')
      expect(isTrainingMode(stored!.context.mode)).toBe(true)
      expect(formatMode(stored!)).toBe('Syllable Trainer')
      expect(stored?.textSourceId).toBe('fixed-syllables')
      expect(stored?.metrics.correctCharacters).toBe(text.length)
      expect(stored?.metrics.accuracy).toBe(1)

      await waitFor(async () => {
        const packed = await telemetry.getStored(stored!.id)
        // One keystroke per character typed: the syllables added none and hid none.
        expect(packed?.keystrokes).toHaveLength(text.length)
      })
    })

    it('touches storage not once while typing, and only when the test ends', async () => {
      await renderTrainer()
      const write = vi.spyOn(adapter, 'write')
      const setItem = vi.spyOn(Storage.prototype, 'setItem')
      const text = fullText()

      typeText(text.slice(0, -1))
      await act(async () => {
        await Promise.resolve()
      })

      expect(write).not.toHaveBeenCalled()
      expect(setItem).not.toHaveBeenCalled()

      typeText(text.slice(-1))

      await waitFor(() => {
        expect(write).toHaveBeenCalled()
      })
    })
  })

  describe('the rhythm, read afterwards', () => {
    /** Types the whole test: `withinMs` between keys of a syllable, `breakMs` at a syllable break. */
    const typeInRhythm = (withinMs: number, breakMs: number) => {
      // A break is the first letter of any syllable but a word's first.
      const breaks = new Set(
        Array.from(stream().querySelectorAll('[data-syllable]:not(:first-child)')).map((syllable) =>
          Number(syllable.querySelector<HTMLElement>('[data-i]')?.dataset.i),
        ),
      )
      Array.from(fullText()).forEach((character, index) => {
        act(() => {
          const around = character === ' ' || fullText()[index - 1] === ' '
          now += index === 0 ? 0 : around ? 160 : breaks.has(index) ? breakMs : withinMs
          field().dispatchEvent(
            new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: character }),
          )
        })
      })
    }

    it('shows, as the test ends, the typical gap inside a syllable and at a break, and what they say', async () => {
      await renderTrainer()

      typeInRhythm(80, 200)

      const card = await screen.findByRole('region', { name: 'Your rhythm' })
      expect(within(card).getByText('Inside a syllable').nextElementSibling).toHaveTextContent('80 ms')
      expect(within(card).getByText('At a break').nextElementSibling).toHaveTextContent('200 ms+120 ms')
      expect(card).toHaveTextContent('You breathe at the breaks')
    })

    it('says so plainly when the words were still typed as single blocks', async () => {
      await renderTrainer()

      typeInRhythm(90, 90)

      expect(await screen.findByRole('region', { name: 'Your rhythm' })).toHaveTextContent('still single blocks')
    })

    it('is gone when the next test starts', async () => {
      await renderTrainer()
      typeInRhythm(80, 200)
      await screen.findByRole('region', { name: 'Your rhythm' })

      act(() => {
        fireEvent.keyDown(field(), { key: 'Tab' })
      })

      expect(screen.queryByRole('region', { name: 'Your rhythm' })).not.toBeInTheDocument()
    })
  })
})

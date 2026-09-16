/**
 * The typist's instruments over the real application, end to end in jsdom: the
 * pace caret and its speeds, the chrome stepping back while typing, the Caps Lock
 * note, and Hover Mode over Golden Nuggets.
 *
 * The shell, the typing session, the engine, storage (in memory) and the
 * settings store are the real ones. Each test types the way a typist does and
 * asserts on what the page does. How any of it looks and moves is judged in a
 * browser; jsdom has no layout, so positions here are all zero and only which
 * character the pace is on is checked.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ROUTES } from '@app/routes.ts'
import { DEFAULT_PREFERENCES } from '@config'
import { createGoldenNuggetService, type GoldenNuggetService } from '@core/nuggets'
import { createMemoryAdapter } from '@core/persistence'
import { createSessionServiceOver, DEFAULT_SESSION_CONTEXT, type SessionService, type TypingSession } from '@core/sessions'
import { createTelemetryServiceOver, type TelemetryService } from '@core/telemetry'
import type { TextProvider } from '@core/text'
import { accuracy, milliseconds, sessionId, timestamp, wpm, type UserPreferences } from '@core/types'
import { settingsStore } from '@features/settings/state/settings.store.ts'

import { GGLayout } from './layout/GGLayout.tsx'
import { GGGoldenNuggetsPage } from './pages/GGGoldenNuggetsPage.tsx'
import { GGNuggetPracticePage } from './pages/GGNuggetPracticePage.tsx'
import { GGPracticePage } from './pages/GGPracticePage.tsx'
import { removeTheme } from './themes/apply-theme.ts'

const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']

const fixedWords: TextProvider = {
  id: 'fixed',
  label: 'Fixed words',
  provide: ({ wordCount }) => ({
    text: Array.from({ length: wordCount }, (_, index) => WORDS[index % WORDS.length]).join(' '),
    sourceId: 'fixed',
  }),
}

let sessions: SessionService
let telemetry: TelemetryService
let nuggets: GoldenNuggetService
let now = 10_000

const prefer = (patch: Partial<UserPreferences>) => {
  settingsStore.setState({ preferences: { ...DEFAULT_PREFERENCES, practiceWordCount: 15, ...patch }, status: 'ready' })
}

beforeEach(() => {
  const adapter = createMemoryAdapter()
  sessions = createSessionServiceOver(adapter)
  telemetry = createTelemetryServiceOver(adapter)
  nuggets = createGoldenNuggetService(createMemoryAdapter())
  prefer({})
  now = 10_000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  removeTheme()
})

/** An ordinary finished test at a speed, as history holds it. */
const pastTest = (netWpm: number, minutesAgo: number): TypingSession => ({
  id: sessionId(`past-${netWpm}-${minutesAgo}`),
  startedAt: timestamp(1_700_000_000_000 - minutesAgo * 60_000 - 30_000),
  completedAt: timestamp(1_700_000_000_000 - minutesAgo * 60_000),
  durationMs: milliseconds(30_000),
  text: 'alpha bravo charlie',
  textSourceId: 'common-words',
  context: DEFAULT_SESSION_CONTEXT,
  metrics: {
    netWpm: wpm(netWpm),
    rawWpm: wpm(netWpm + 4),
    accuracy: accuracy(0.97),
    totalCharacters: 19,
    typedCharacters: 120,
    correctCharacters: 116,
    incorrectCharacters: 4,
    correctedCharacters: 2,
    errorCount: 4,
  },
  status: 'completed',
})

/** History of ordinary tests at these speeds, one after another, most recent last. */
const history = (...speeds: readonly number[]) =>
  speeds.reduce<Promise<void>>(
    (saved, speed, index) => saved.then(() => sessions.save(pastTest(speed, speeds.length - index))),
    Promise.resolve(),
  )

const keepNugget = (word: string) =>
  nuggets.recordFocus({ reason: 'mistakes', word, language: 'en', cleared: false, mistakes: 5, at: 1_000, testId: 't' })

/** A seeded stand-in for Math.random, so dressed text is the same every run. */
const seedRandom = (seed: number) => {
  let state = seed
  vi.spyOn(Math, 'random').mockImplementation(() => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  })
}

const renderAt = async (path: string) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.gg} element={<GGLayout />}>
          <Route
            index
            element={<GGPracticePage provider={fixedWords} service={sessions} telemetry={telemetry} goldenNuggets={nuggets} />}
          />
          <Route
            path={ROUTES.ggHoverNuggets}
            element={<GGNuggetPracticePage goldenNuggets={nuggets} service={sessions} telemetry={telemetry} />}
          />
          <Route path={ROUTES.ggNuggets} element={<GGGoldenNuggetsPage service={nuggets} />} />
          {/* Ordinary practice on its own words, which punctuation and numbers dress. */}
          <Route
            path="/gg/plain"
            element={<GGPracticePage service={sessions} telemetry={telemetry} goldenNuggets={nuggets} />}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const stream = () => screen.getByRole('region', { name: 'Words to type' })
const field = () => screen.getByRole('textbox', { name: 'Type the words above' }) as HTMLTextAreaElement
const shell = () => document.querySelector<HTMLElement>('[data-typing]')
const caret = () => stream().querySelector<HTMLElement>('[data-pace]')

const typeText = (text: string, gapMs = 100) => {
  act(() => {
    for (const character of Array.from(text)) {
      now += gapMs
      field().dispatchEvent(
        new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: character }),
      )
    }
  })
}

const pressNode = (name: RegExp) => {
  const node = screen.getByRole('button', { name })
  act(() => {
    fireEvent.pointerDown(node)
    fireEvent.click(node, { detail: 1 })
  })
}

describe('the pace caret', () => {
  it('offers the typist their own speeds, read from history', async () => {
    await history(80, 100, 90, 140)
    await renderAt(ROUTES.gg)
    await screen.findByRole('region', { name: 'Words to type' })

    pressNode(/^Pace:/)

    const paces = await screen.findByRole('radiogroup', { name: 'Pace' })
    // Median of 80, 90, 100, 140 is 95; the fastest 140; the push 95 × 1.05, rounded: 100.
    await waitFor(() => {
      expect(within(paces).getByRole('radio', { name: /^Average: 95 wpm/ })).toBeEnabled()
    })
    expect(within(paces).getByRole('radio', { name: /^Push: 100 wpm/ })).toBeEnabled()
    expect(within(paces).getByRole('radio', { name: /^Best: 140 wpm/ })).toBeEnabled()
    expect(within(paces).getByRole('radio', { name: /^Off/ })).toBeChecked()
  })

  it('offers no speed until there is history to read one from, and says why', async () => {
    await renderAt(ROUTES.gg)
    await screen.findByRole('region', { name: 'Words to type' })

    pressNode(/^Pace:/)

    const paces = await screen.findByRole('radiogroup', { name: 'Pace' })
    await waitFor(() => {
      expect(within(paces).getByRole('radio', { name: 'Average: After a few tests' })).toBeDisabled()
    })
    expect(within(paces).getByRole('radio', { name: 'Best: After a few tests' })).toBeDisabled()
    expect(caret()).toBeNull()
  })

  it('is remembered when chosen, and the node says the speed kept', async () => {
    await history(60, 60, 60)
    await renderAt(ROUTES.gg)
    await screen.findByRole('region', { name: 'Words to type' })
    pressNode(/^Pace:/)
    const average = await screen.findByRole('radio', { name: /^Average: 60 wpm/ })
    await waitFor(() => expect(average).toBeEnabled())

    act(() => {
      fireEvent.click(average)
    })

    expect(settingsStore.getState().preferences.pace).toBe('average')
    expect(screen.getByRole('button', { name: 'Pace: Average, 60 words per minute' })).toBeInTheDocument()
    expect(caret()).not.toBeNull()
  })

  it('sets off with the first key and keeps the chosen speed: 60 words a minute is five characters a second', async () => {
    await history(60, 60, 60)
    prefer({ pace: 'average' })
    await renderAt(ROUTES.gg)
    await waitFor(() => expect(caret()).not.toBeNull())
    expect(caret()).toHaveAttribute('data-shown', 'false')

    typeText('a')
    expect(caret()).toHaveAttribute('data-shown', 'true')
    expect(caret()).toHaveAttribute('data-index', '0')

    await act(async () => {
      now += 1000
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })

    expect(caret()).toHaveAttribute('data-index', '5')
  })

  it('goes when the test ends', async () => {
    await history(60, 60, 60)
    prefer({ pace: 'best' })
    await renderAt(ROUTES.gg)
    await waitFor(() => expect(caret()).not.toBeNull())

    typeText(stream().textContent ?? '')

    expect(caret()).toHaveAttribute('data-shown', 'false')
  })
})

describe('punctuation and numbers', () => {
  const toggle = (name: RegExp) => screen.getByRole('checkbox', { name })

  it('are offered beside the length of an ordinary test, off to begin with', async () => {
    await renderAt('/gg/plain')
    await screen.findByRole('region', { name: 'Words to type' })

    const text = screen.getByRole('group', { name: 'Text' })
    expect(within(text).getByRole('checkbox', { name: /^Punctuation/ })).not.toBeChecked()
    expect(within(text).getByRole('checkbox', { name: /^Numbers/ })).not.toBeChecked()
    expect(stream().textContent).toMatch(/^[a-z ]+$/)
  })

  it('dress the words as sentences once punctuation is on, starting a new test on them, and remember it', async () => {
    seedRandom(11)
    prefer({ practiceWordCount: 60 })
    await renderAt('/gg/plain')
    await screen.findByRole('region', { name: 'Words to type' })

    act(() => {
      fireEvent.click(toggle(/^Punctuation/))
    })

    const text = stream().textContent ?? ''
    expect(text).toMatch(/^[A-Z]/)
    expect(text).toMatch(/[.?]$/)
    expect(text.split(' ')).toHaveLength(60)
    expect(settingsStore.getState().preferences.punctuation).toBe(true)
    expect(screen.getByText('Common words, with punctuation')).toBeInTheDocument()
  })

  it('put figures among the words once numbers are on', async () => {
    seedRandom(12)
    prefer({ practiceWordCount: 60 })
    await renderAt('/gg/plain')
    await screen.findByRole('region', { name: 'Words to type' })

    act(() => {
      fireEvent.click(toggle(/^Numbers/))
    })

    expect(stream().textContent).toMatch(/\d/)
    expect(settingsStore.getState().preferences.numbers).toBe(true)
  })

  it('are recorded with the test, so history says it was a harder one', async () => {
    seedRandom(13)
    prefer({ punctuation: true, numbers: true })
    await renderAt('/gg/plain')
    await screen.findByRole('region', { name: 'Words to type' })

    typeText(stream().textContent ?? '')

    await waitFor(async () => {
      expect(await sessions.getAll()).toHaveLength(1)
    })
    const [stored] = await sessions.getAll()
    expect(stored?.context.difficulty).toBe('punctuation-numbers')
  })

  it('are not offered where the text is not ordinary practice', async () => {
    await keepNugget('because')
    await renderAt(ROUTES.ggHoverNuggets)
    await screen.findByRole('region', { name: 'Words to type' })

    expect(screen.queryByRole('group', { name: 'Text' })).not.toBeInTheDocument()
  })
})

describe('focus while typing', () => {
  it('steps the chrome back from the first key, and brings it forward when the test ends', async () => {
    await renderAt(ROUTES.gg)
    await screen.findByRole('region', { name: 'Words to type' })
    expect(shell()).toHaveAttribute('data-typing', 'false')
    // The chrome is marked; the words, the field and the figures are not.
    expect(screen.getByRole('navigation', { name: 'Main' }).closest('header')).toHaveAttribute('data-recede')
    expect(stream().closest('[data-recede]')).toBeNull()
    expect(field().closest('[data-recede]')).toBeNull()
    expect(screen.getByRole('status', { name: 'Live statistics' }).closest('[data-recede]')).toBeNull()

    typeText('al')
    expect(shell()).toHaveAttribute('data-typing', 'true')

    typeText((stream().textContent ?? '').slice(2))
    expect(shell()).toHaveAttribute('data-typing', 'false')
  })

  it('comes forward when the mouse really moves, and steps back again with the next key', async () => {
    await renderAt(ROUTES.gg)
    await screen.findByRole('region', { name: 'Words to type' })
    typeText('al')

    const move = (x: number) => document.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: 10 }))
    act(() => {
      move(100)
      move(103)
    })
    // A nudge is not a request for the page.
    expect(shell()).toHaveAttribute('data-typing', 'true')

    act(() => {
      move(120)
    })
    expect(shell()).toHaveAttribute('data-typing', 'false')

    typeText('p')
    expect(shell()).toHaveAttribute('data-typing', 'true')
  })
})

describe('Caps Lock', () => {
  it('is noted in the field the moment it is on, and the note goes when it is off', async () => {
    await renderAt(ROUTES.gg)
    await screen.findByRole('region', { name: 'Words to type' })
    const note = () => within(field().parentElement as HTMLElement).getByRole('status')
    expect(note()).toHaveTextContent('')

    act(() => {
      fireEvent.keyDown(field(), { key: 'A', modifierCapsLock: true })
    })
    expect(note()).toHaveTextContent('Caps Lock is on')

    act(() => {
      fireEvent.keyUp(field(), { key: 'CapsLock', modifierCapsLock: false })
    })
    expect(note()).toHaveTextContent('')
  })
})

describe('Golden Nuggets practice', () => {
  const keep = (...words: string[]) =>
    words.reduce<Promise<unknown>>(
      (kept, word, index) =>
        kept.then(() =>
          nuggets.recordFocus({ reason: 'mistakes', word, language: 'en', cleared: false, mistakes: 5, at: 1_000 + index, testId: `t${index}` }),
        ),
      Promise.resolve(),
    )

  it('is offered from the Golden Nuggets page once there are words to practise', async () => {
    await keep('because')
    await renderAt(ROUTES.ggNuggets)

    expect(await screen.findByRole('link', { name: /Practise these in Hover Mode/ })).toHaveAttribute(
      'href',
      ROUTES.ggHoverNuggets,
    )
  })

  it('is Hover Mode over the nuggets: one in every other place of the text', async () => {
    await keep('because', 'separate', 'rhythm')
    await renderAt(ROUTES.ggHoverNuggets)
    await screen.findByRole('region', { name: 'Words to type' })

    const words = (stream().textContent ?? '').split(' ')
    expect(words.filter((_, position) => position % 2 === 0).every((word) => ['because', 'separate', 'rhythm'].includes(word))).toBe(
      true,
    )
    expect(screen.getByText('On your Golden Nuggets')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Hover Mode/ })).toHaveAttribute('aria-current', 'page')
  })

  it('is saved as Hover Mode, over Golden Nuggets', async () => {
    await keep('because')
    await renderAt(ROUTES.ggHoverNuggets)
    await screen.findByRole('region', { name: 'Words to type' })

    typeText(stream().textContent ?? '')

    await waitFor(async () => {
      expect(await sessions.getAll()).toHaveLength(1)
    })
    const [stored] = await sessions.getAll()
    expect(stored?.context.mode).toBe('hover')
    expect(stored?.textSourceId).toBe('golden-nuggets')
  })

  it('says where nuggets come from when there are none to practise', async () => {
    await renderAt(ROUTES.ggHoverNuggets)

    expect(await screen.findByText(/There are no Golden Nuggets to practise yet/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Words to type' })).not.toBeInTheDocument()
  })
})

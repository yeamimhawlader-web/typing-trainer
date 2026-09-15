/**
 * GG.Typing over the real application, end to end in jsdom.
 *
 * These are cross-layer tests, not unit tests: the shell, the typing session,
 * the engine, session and telemetry storage and the settings store are all the
 * real ones, with only storage swapped for memory and the text made
 * predictable. Each test drives GG.Typing the way a typist does — text arriving
 * in the field as input events — and asserts on what the rest of the
 * application ends up holding. The engine's rules, the metrics and the stores
 * have their own tests; nothing here repeats them.
 *
 * Layout and motion are judged in a browser; jsdom has neither.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ROUTES } from '@app/routes.ts'
import { DEFAULT_PREFERENCES } from '@config'
import { createMemoryAdapter, storage, type StorageAdapter } from '@core/persistence'
import { createSessionServiceOver, type SessionService } from '@core/sessions'
import { createTelemetryServiceOver, type TelemetryService } from '@core/telemetry'
import type { TextProvider, TextRequest } from '@core/text'
import { createSettingsStore, settingsStore } from '@features/settings/state/settings.store.ts'

import { GGLayout } from './layout/GGLayout.tsx'
import { GGDrillPage } from './pages/GGDrillPage.tsx'
import { GGPracticePage } from './pages/GGPracticePage.tsx'
import { removeTheme } from './themes/apply-theme.ts'

const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']

/** Text of exactly the requested length, and a record of every request. */
const wordsProvider = () => {
  const requests: TextRequest[] = []
  const provider: TextProvider = {
    id: 'fixed',
    label: 'Fixed words',
    provide: (request) => {
      requests.push(request)
      const text = Array.from({ length: request.wordCount }, (_, index) => WORDS[index % WORDS.length]).join(' ')
      return { text, sourceId: 'fixed' }
    },
  }
  return { provider, requests }
}

let adapter: StorageAdapter
let sessions: SessionService
let telemetry: TelemetryService
let now = 10_000

beforeEach(() => {
  adapter = createMemoryAdapter()
  sessions = createSessionServiceOver(adapter)
  telemetry = createTelemetryServiceOver(adapter)
  settingsStore.setState({ preferences: { ...DEFAULT_PREFERENCES, practiceWordCount: 15 }, status: 'ready' })
  // The session clock and every input event read this, so a test decides how
  // fast the typist is.
  now = 10_000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})

afterEach(() => {
  vi.restoreAllMocks()
  removeTheme()
})

const renderGG = (path: string = ROUTES.gg, provider?: TextProvider) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.gg} element={<GGLayout />}>
          <Route
            index
            element={
              <GGPracticePage
                {...(provider === undefined ? {} : { provider })}
                service={sessions}
                telemetry={telemetry}
              />
            }
          />
          <Route path={ROUTES.ggDrill} element={<GGDrillPage service={sessions} telemetry={telemetry} />} />
        </Route>
        <Route path={ROUTES.history} element={<p>History page</p>} />
        <Route path={ROUTES.settings} element={<p>Settings page</p>} />
      </Routes>
    </MemoryRouter>,
  )

// --- Reading the screen ------------------------------------------------

const stream = () => screen.getByRole('region', { name: 'Words to type' })
const streamText = () => stream().textContent ?? ''
const characters = () => Array.from(stream().querySelectorAll<HTMLElement>('[data-i]'))
const stateAt = (index: number) => characters()[index]?.dataset.state
const field = () => screen.getByRole('textbox', { name: 'Type the words above' }) as HTMLTextAreaElement
const figures = () => screen.getByRole('status', { name: 'Live statistics' })
const figure = (unit: string) => {
  const found = Array.from(figures().children).find((child) => child.lastElementChild?.textContent === unit)
  return found?.firstElementChild?.textContent
}

// --- Typing as input methods deliver it -------------------------------

const input = (init: InputEventInit) => {
  field().dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, ...init }))
}

/** Types each character `gapMs` after the one before. */
const typeText = (text: string, gapMs = 100) => {
  act(() => {
    for (const character of Array.from(text)) {
      now += gapMs
      input({ inputType: 'insertText', data: character })
    }
  })
}

const backspace = () => {
  act(() => {
    now += 100
    input({ inputType: 'deleteContentBackward' })
  })
}

const pressEnter = () => {
  act(() => {
    input({ inputType: 'insertLineBreak' })
  })
}

const firstTest = async (provider?: TextProvider) => {
  renderGG(ROUTES.gg, provider)
  await screen.findByRole('region', { name: 'Words to type' })
}

// --- The tests --------------------------------------------------------

describe('GG.Typing on the real typing session', () => {
  describe('the text', () => {
    it('is the text provider’s, at the remembered length', async () => {
      const { provider, requests } = wordsProvider()
      await firstTest(provider)

      expect(requests).toEqual([{ wordCount: 15 }])
      expect(streamText().split(' ')).toHaveLength(15)
      expect(streamText().startsWith('alpha bravo charlie')).toBe(true)
      expect(screen.getByText('Fixed words')).toBeInTheDocument()
    })

    it('comes from the common-words provider when nothing is injected', async () => {
      await firstTest()

      expect(screen.getByText('Common words')).toBeInTheDocument()
      expect(streamText().split(' ')).toHaveLength(15)
    })

    it('is ready to type without a click', async () => {
      await firstTest(wordsProvider().provider)

      expect(field()).toHaveFocus()
    })
  })

  describe('typing', () => {
    it('draws the engine’s state for each character as text arrives', async () => {
      await firstTest(wordsProvider().provider)

      typeText('alp')

      expect([0, 1, 2, 3].map(stateAt)).toEqual(['correct', 'correct', 'correct', 'pending'])
      expect(field().value).toBe('alp')
    })

    it('shows a mistake, a deletion and a correction as the engine records them', async () => {
      await firstTest(wordsProvider().provider)

      typeText('alpx')
      expect(stateAt(3)).toBe('incorrect')

      backspace()
      expect(stateAt(3)).toBe('pending')
      expect(field().value).toBe('alp')

      typeText('h')
      expect(stateAt(3)).toBe('corrected')
    })

    it('follows the engine’s own recovery rather than a key-per-step rule', async () => {
      await firstTest(wordsProvider().provider)

      // A space mid-word: the engine moves on to the next word, and the stream
      // and field follow it.
      typeText('al ')

      expect(stateAt(6)).toBe('pending')
      expect(field().value).toBe('')
      typeText('b')
      expect(stateAt(6)).toBe('correct')
    })

    it('takes several characters delivered at once, in order', async () => {
      await firstTest(wordsProvider().provider)

      act(() => {
        now += 100
        input({ inputType: 'insertText', data: 'alpha b' })
      })

      expect(stateAt(6)).toBe('correct')
      expect(field().value).toBe('b')
    })

    it('deletes the previous word on Ctrl+Backspace', async () => {
      await firstTest(wordsProvider().provider)
      typeText('alpha bra')

      act(() => {
        input({ inputType: 'deleteWordBackward' })
      })

      expect(stateAt(6)).toBe('pending')
      expect(stateAt(0)).toBe('correct')
      expect(field().value).toBe('')
    })

    it('refuses pasted text', async () => {
      await firstTest(wordsProvider().provider)

      act(() => {
        input({ inputType: 'insertFromPaste', data: 'alpha' })
      })

      expect(stateAt(0)).toBe('pending')
    })
  })

  describe('the live figures', () => {
    it('start from the engine’s idle values', async () => {
      await firstTest(wordsProvider().provider)

      expect(figure('wpm')).toBe('—')
      expect(figure('acc')).toBe('100%')
      expect(figure('time')).toBe('0s')
      expect(figure('words')).toBe('0/15')
    })

    it('move with the test: speed after the first second, accuracy on a mistake, words as they finish', async () => {
      await firstTest(wordsProvider().provider)

      typeText('alpha ', 250)
      expect(figure('wpm')).not.toBe('—')
      expect(figure('words')).toBe('1/15')

      const before = figure('acc')
      typeText('x')
      expect(before).toBe('100%')
      expect(figure('acc')).not.toBe('100%')
    })

    it('match the recorded result exactly at the end, with no cap on speed', async () => {
      const { provider } = wordsProvider()
      await firstTest(provider)
      const text = streamText()

      // 20 ms a character is far beyond anyone's speed: about 600 wpm.
      typeText(text, 20)

      await waitFor(async () => {
        expect(await sessions.getAll()).toHaveLength(1)
      })
      const [stored] = await sessions.getAll()
      expect(stored?.metrics.netWpm).toBeGreaterThan(150)
      expect(figure('wpm')).toBe(String(Math.round(stored?.metrics.netWpm ?? -1)))
      expect(figure('acc')).toBe(`${Math.round((stored?.metrics.accuracy ?? -1) * 100)}%`)
      expect(figure('words')).toBe('15/15')
    })
  })

  describe('finishing a test', () => {
    it('shows the application’s result panel, announces it, and clears the field', async () => {
      await firstTest(wordsProvider().provider)

      typeText(streamText())

      expect(await screen.findByRole('link', { name: 'View details' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
      expect(screen.getByText(/^Test complete: \d+ words per minute, 100% accuracy\.$/)).toBeInTheDocument()
      expect(field().value).toBe('')
      expect(field()).toHaveAttribute('placeholder', 'Press Enter for the next test')
    })

    it('stores the session, the same one the panel shows', async () => {
      await firstTest(wordsProvider().provider)
      const text = streamText()

      typeText(text)

      await waitFor(async () => {
        expect(await sessions.getAll()).toHaveLength(1)
      })
      const [stored] = await sessions.getAll()
      expect(stored?.status).toBe('completed')
      expect(stored?.textSourceId).toBe('fixed')
      expect(stored?.context.mode).not.toBe('drill')
      expect(stored?.metrics.correctCharacters).toBe(Array.from(text).length)
      expect(await screen.findByRole('link', { name: 'View details' })).toHaveAttribute(
        'href',
        `/history/${stored?.id ?? ''}`,
      )
    })

    it('stores the telemetry for it', async () => {
      await firstTest(wordsProvider().provider)

      typeText(streamText())

      await waitFor(async () => {
        const [stored] = await sessions.getAll()
        expect(stored).toBeDefined()
        expect(await telemetry.getStored(stored!.id)).not.toBeNull()
      })
    })

    it('ignores further typing once the test is over', async () => {
      await firstTest(wordsProvider().provider)
      typeText(streamText())
      await screen.findByRole('link', { name: 'View details' })

      typeText('abc')

      expect(field().value).toBe('')
      expect(await sessions.getAll()).toHaveLength(1)
    })
  })

  describe('restarting', () => {
    it('starts a new test from the restart button, back in the field', async () => {
      const { provider, requests } = wordsProvider()
      await firstTest(provider)
      typeText('alp')

      await userEvent.setup().click(screen.getByRole('button', { name: 'Restart test' }))

      expect(requests).toHaveLength(2)
      expect(characters().map((_, index) => stateAt(index)).every((state) => state === 'pending')).toBe(true)
      expect(field().value).toBe('')
      expect(field()).toHaveFocus()
      expect(await sessions.getAll()).toHaveLength(0)
    })

    it('restarts on Tab while typing, and leaves Tab alone before', async () => {
      const { provider, requests } = wordsProvider()
      await firstTest(provider)

      fireEvent.keyDown(field(), { key: 'Tab' })
      expect(requests).toHaveLength(1)

      typeText('al')
      fireEvent.keyDown(field(), { key: 'Tab' })

      expect(requests).toHaveLength(2)
      expect(stateAt(0)).toBe('pending')
    })

    it('starts the next test on Enter from the result', async () => {
      const { provider, requests } = wordsProvider()
      await firstTest(provider)
      typeText(streamText())
      await screen.findByRole('link', { name: 'View details' })

      pressEnter()

      expect(requests).toHaveLength(2)
      expect(screen.queryByRole('link', { name: 'View details' })).not.toBeInTheDocument()
      typeText('a')
      expect(stateAt(0)).toBe('correct')
    })

    it('starts the next test from the Enter key alone, when no line break follows it', async () => {
      const { provider, requests } = wordsProvider()
      await firstTest(provider)
      typeText(streamText())
      await screen.findByRole('link', { name: 'View details' })

      const handled = !fireEvent.keyDown(field(), { key: 'Enter' })

      expect(handled).toBe(true)
      expect(requests).toHaveLength(2)
      expect(screen.queryByRole('link', { name: 'View details' })).not.toBeInTheDocument()
    })

    it('does nothing on Enter in the middle of a test', async () => {
      const { provider, requests } = wordsProvider()
      await firstTest(provider)
      typeText('al')

      pressEnter()

      expect(requests).toHaveLength(1)
      expect(stateAt(1)).toBe('correct')
    })
  })

  describe('test length', () => {
    it('offers the supported lengths, loads a test of the one chosen, and remembers it', async () => {
      const { provider, requests } = wordsProvider()
      await firstTest(provider)
      const group = screen.getByRole('radiogroup', { name: 'Test length' })

      expect(within(group).getAllByRole('radio').map((radio) => radio.getAttribute('aria-label'))).toEqual([
        '15 words',
        '30 words',
        '60 words',
      ])
      expect(within(group).getByRole('radio', { name: '15 words' })).toBeChecked()

      await userEvent.setup().click(within(group).getByRole('radio', { name: '60 words' }))

      expect(requests.at(-1)).toEqual({ wordCount: 60 })
      expect(streamText().split(' ')).toHaveLength(60)
      expect(figure('words')).toBe('0/60')
      expect(field()).toHaveFocus()

      // Kept by the settings store the classic practice page reads, and on disk.
      expect(settingsStore.getState().preferences.practiceWordCount).toBe(60)
      await waitFor(async () => {
        const reloaded = createSettingsStore(storage)
        await reloaded.getState().hydrate()
        expect(reloaded.getState().preferences.practiceWordCount).toBe(60)
      })
    })
  })

  describe('text size', () => {
    it('is a stored preference applied to the stream', async () => {
      await firstTest(wordsProvider().provider)
      expect(stream()).toHaveAttribute('data-size', 'sm')

      await userEvent.setup().click(screen.getByRole('radio', { name: 'Large text' }))

      expect(stream()).toHaveAttribute('data-size', 'lg')
      await waitFor(async () => {
        const reloaded = createSettingsStore(storage)
        await reloaded.getState().hydrate()
        expect(reloaded.getState().preferences.textSize).toBe('lg')
      })
    })
  })

  describe('themes', () => {
    it('puts the stored theme on the page', async () => {
      settingsStore.setState({ preferences: { ...DEFAULT_PREFERENCES, theme: 'valentine' } })
      await firstTest(wordsProvider().provider)

      expect(document.documentElement.dataset.ggTheme).toBe('valentine')
      // The first frame is a page load, not a switch: no cross-fade.
      expect(document.documentElement).not.toHaveAttribute('data-gg-theme-fading')
    })

    it('saves a theme chosen in the panel, and opens in it after a reload', async () => {
      const user = userEvent.setup()
      const { provider } = wordsProvider()
      const first = renderGG(ROUTES.gg, provider)
      await screen.findByRole('region', { name: 'Words to type' })

      await user.click(screen.getByRole('button', { name: 'Themes' }))
      await user.click(within(screen.getByRole('dialog', { name: 'Theme' })).getByRole('radio', { name: 'Glow' }))

      expect(document.documentElement.dataset.ggTheme).toBe('glow')
      expect(settingsStore.getState().preferences.theme).toBe('glow')

      // A reload: a new store reads the preference back off storage, and the
      // shell renders from it.
      first.unmount()
      removeTheme()
      const reloaded = createSettingsStore(storage)
      await reloaded.getState().hydrate()
      expect(reloaded.getState().preferences.theme).toBe('glow')

      settingsStore.setState({ preferences: reloaded.getState().preferences, status: 'ready' })
      renderGG(ROUTES.gg, provider)
      await screen.findByRole('region', { name: 'Words to type' })
      expect(document.documentElement.dataset.ggTheme).toBe('glow')
    })

    it('takes the shell back off the page when leaving it', async () => {
      const user = userEvent.setup()
      await firstTest(wordsProvider().provider)
      expect(document.documentElement.dataset.ggTheme).toBeDefined()

      await user.click(screen.getByRole('link', { name: 'History' }))

      expect(await screen.findByText('History page')).toBeInTheDocument()
      expect(document.documentElement.dataset.ggTheme).toBeUndefined()
    })
  })

  describe('the GGTyping word jump', () => {
    const recordAnimations = () => {
      const animated: Element[] = []
      const original = HTMLElement.prototype.animate
      HTMLElement.prototype.animate = function animate(this: HTMLElement) {
        animated.push(this)
        return { playState: 'running', cancel: () => undefined, addEventListener: () => undefined } as unknown as Animation
      }
      return {
        animated,
        restore: () => {
          HTMLElement.prototype.animate = original
        },
      }
    }

    it('makes the word jump on the third mistake in a row, from the engine’s events', async () => {
      const recorder = recordAnimations()
      try {
        await firstTest(wordsProvider().provider)

        typeText('x')
        backspace()
        typeText('x')
        backspace()
        expect(recorder.animated).toEqual([])

        typeText('x')

        const alpha = stream().querySelector('[data-word="0"]')
        expect(recorder.animated).toEqual([alpha])
        expect(alpha?.textContent).toBe('alpha')
      } finally {
        recorder.restore()
      }
    })
  })

  describe('navigation', () => {
    it('reaches the application’s own history, statistics and settings', async () => {
      await firstTest(wordsProvider().provider)
      const nav = screen.getByRole('navigation', { name: 'Main' })

      expect(within(nav).getByRole('link', { name: 'Typing Test' })).toHaveAttribute('href', '/gg')
      expect(within(nav).getByRole('link', { name: 'History' })).toHaveAttribute('href', ROUTES.history)
      expect(within(nav).getByRole('link', { name: 'Statistics' })).toHaveAttribute('href', ROUTES.statistics)
      expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', ROUTES.settings)
    })
  })

  describe('nothing invented', () => {
    it('shows no placeholder identity, audience, language, mode or unwired control', async () => {
      await firstTest(wordsProvider().provider)
      const page = document.body.textContent ?? ''

      expect(page).not.toMatch(/guest|level|online|typing now|english|advanced|normal/i)
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
      for (const name of ['Mode', 'Presets', 'Feedback', 'View']) {
        expect(screen.queryByRole('group', { name })).not.toBeInTheDocument()
        expect(screen.queryByRole('radiogroup', { name })).not.toBeInTheDocument()
      }
      // Every control on the page is a link somewhere real or does something.
      const label = (button: HTMLElement) => button.getAttribute('aria-label')
      expect(within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('button').map(label)).toEqual(['Themes'])
      expect(within(screen.getByRole('main')).getAllByRole('button').map(label)).toEqual(['Restart test'])
    })
  })
})

describe('a GG.Typing drill', () => {
  const drillText = () => streamText()

  const openDrill = async (sequence: string) => {
    renderGG(`/gg/drill/${sequence}`)
    // The words appear once the drill's baseline has been read.
    await screen.findByRole('region', { name: 'Words to type' })
  }

  it('loads drill material on the real session, with no length to choose', async () => {
    await openDrill('in')

    const words = drillText().split(' ')
    expect(words.filter((word) => word.includes('in')).length).toBeGreaterThan(words.length / 3)
    expect(screen.getByText('Drill: in', { selector: 'p' })).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Test length' })).not.toBeInTheDocument()
    expect(document.title).toBe('Drill: in · GG.Typing')
  })

  it('records a drill for the sequence, with telemetry, and shows its comparison', async () => {
    await openDrill('in')

    typeText(drillText())

    expect(await screen.findByRole('heading', { name: /drill result/i })).toBeInTheDocument()
    await waitFor(async () => {
      expect(await sessions.getAll()).toHaveLength(1)
    })
    const [stored] = await sessions.getAll()
    expect(stored?.context.mode).toBe('drill')
    expect(stored?.context.targetSequence).toBe('in')
    expect(stored?.textSourceId).toBe('drill')
    await waitFor(async () => {
      expect(await telemetry.getStored(stored!.id)).not.toBeNull()
    })
    // A drill's text is lopsided by design, so it is not ranked as though it
    // described the typist.
    expect(screen.queryByRole('heading', { name: /slowest observed sequences/i })).not.toBeInTheDocument()
  })

  it('leads back to GG.Typing practice', async () => {
    await openDrill('in')
    typeText(drillText())
    await screen.findByRole('heading', { name: /drill result/i })

    expect(screen.getByRole('link', { name: /back to practice/i })).toHaveAttribute('href', '/gg')
  })

  it('declines a sequence there is nothing to build from, in the shell', async () => {
    renderGG('/gg/drill/zq')

    expect(await screen.findByRole('heading', { name: 'No drill for that sequence' })).toBeInTheDocument()
    expect(screen.getByText(/inventing words/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to practice' })).toHaveAttribute('href', '/gg')
    expect(screen.getByRole('link', { name: 'GG.Typing' })).toBeInTheDocument()
  })
})

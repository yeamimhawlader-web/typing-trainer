/**
 * Typing screen tests.
 *
 * These drive real keyboard events at `window`, the same path a typist takes,
 * and assert on what ends up on screen. The engine's own behaviour is covered
 * exhaustively in its unit tests; what is worth testing here is the wiring —
 * that keys reach the engine, that state reaches the pixels, and that the
 * keyboard-first interactions work without anything being clicked first.
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ROUTES } from '@app/routes.ts'
import { createMemoryAdapter } from '@core/persistence'
import {
  createSessionRepository,
  createSessionService,
  type SessionService,
} from '@core/sessions'
import {
  createTelemetryRepository,
  createTelemetryService,
  encodeTelemetry,
  type TelemetryService,
} from '@core/telemetry'

import { TypingTest, type TypingTestProps } from './TypingTest.tsx'

/** The screen links to history when a test finishes, so it needs a router. */
const renderTest = (props: TypingTestProps = {}) =>
  render(
    <MemoryRouter>
      <TypingTest {...props} />
    </MemoryRouter>,
  )

const surface = () => screen.getByRole('region', { name: 'Typing test' })

/**
 * The typing text itself, not the surrounding controls.
 *
 * Scoping matters: the stats read "0 wpm", and a bare span search across the
 * whole screen picks up that "0" as if it were the first character of the text.
 */
const textContainer = (): HTMLElement => {
  const element = surface().querySelector('[data-status]')
  if (!(element instanceof HTMLElement)) throw new Error('typing surface not found')
  return element
}

/** The rendered text, read back off the character spans. */
const renderedText = (): string => textContainer().textContent ?? ''

/** The first word of the current test, which is what tests type into. */
const firstWord = (): string => (renderedText().split(' ')[0] ?? '').trim()

const characterSpans = (): HTMLElement[] =>
  Array.from(textContainer().querySelectorAll('span:not([data-word])')).filter(
    // Excludes the zero-width span that carries the caret at the end, and the
    // word wrappers — a one-letter word's wrapper would otherwise look like a
    // character and shift every index after it.
    (element): element is HTMLElement =>
      element instanceof HTMLElement &&
      element.textContent !== null &&
      element.textContent.length === 1,
  )

const classesAt = (index: number): string => characterSpans()[index]?.className ?? ''

describe('typing screen', () => {
  it('shows practice text before anything is typed', () => {
    renderTest()

    expect(renderedText().length).toBeGreaterThan(0)
    expect(firstWord().length).toBeGreaterThan(0)
  })

  it('starts the test on the first keystroke, with nothing clicked first', async () => {
    const user = userEvent.setup()
    renderTest()

    expect(screen.getByText(/start typing to begin/i)).toBeInTheDocument()

    await user.keyboard(firstWord()[0] ?? 'a')

    expect(screen.queryByText(/start typing to begin/i)).not.toBeInTheDocument()
  })

  it('marks a correct character as correct', async () => {
    const user = userEvent.setup()
    renderTest()
    const expected = firstWord()[0] ?? 'a'

    await user.keyboard(expected)

    expect(classesAt(0)).toMatch(/correct/)
  })

  it('marks a wrong character as incorrect and keeps going', async () => {
    const user = userEvent.setup()
    renderTest()
    const wrong = firstWord()[0] === 'z' ? 'q' : 'z'

    await user.keyboard(wrong)

    expect(classesAt(0)).toMatch(/incorrect/)
  })

  it('moves the caret forward as characters are typed', async () => {
    const user = userEvent.setup()
    renderTest()

    expect(classesAt(0)).toMatch(/cursor/)

    await user.keyboard(firstWord()[0] ?? 'a')

    expect(classesAt(0)).not.toMatch(/cursor/)
    expect(classesAt(1)).toMatch(/cursor/)
  })

  it('steps back on backspace', async () => {
    const user = userEvent.setup()
    renderTest()

    await user.keyboard(firstWord().slice(0, 2))
    expect(classesAt(2)).toMatch(/cursor/)

    await user.keyboard('{Backspace}')

    expect(classesAt(1)).toMatch(/cursor/)
    expect(classesAt(1)).not.toMatch(/correct|incorrect/)
  })

  it('marks a character corrected after a mistake is fixed', async () => {
    const user = userEvent.setup()
    renderTest()
    const expected = firstWord()[0] ?? 'a'
    const wrong = expected === 'z' ? 'q' : 'z'

    await user.keyboard(wrong)
    await user.keyboard('{Backspace}')
    await user.keyboard(expected)

    expect(classesAt(0)).toMatch(/corrected/)
  })

  it('does nothing on backspace at the very start', async () => {
    const user = userEvent.setup()
    renderTest()

    await user.keyboard('{Backspace}')

    expect(classesAt(0)).toMatch(/cursor/)
    expect(screen.getByText(/start typing to begin/i)).toBeInTheDocument()
  })

  it('withholds live speed until it means something', async () => {
    const user = userEvent.setup()
    renderTest()
    const stats = screen.getByRole('status', { name: 'Live statistics' })

    expect(within(stats).getByText('—')).toBeInTheDocument()

    // Still withheld a few keystrokes in, where the figure would be inflated
    // by the first character having had no time to be typed in.
    await user.keyboard(firstWord().slice(0, 3))

    expect(within(stats).getByText('—')).toBeInTheDocument()
  })

  it('updates live speed and accuracy while typing', async () => {
    const user = userEvent.setup()
    renderTest()
    const word = firstWord()
    const wrong = word[0] === 'z' ? 'q' : 'z'

    await user.keyboard(wrong)
    await user.keyboard(word.slice(1))

    const stats = screen.getByRole('status', { name: 'Live statistics' })
    // One wrong character out of however many were typed: not a full score.
    expect(within(stats).getByText(/%/).textContent).not.toBe('100%')
  })

  it('restarts with fresh text on Tab', async () => {
    const user = userEvent.setup()
    renderTest()
    await user.keyboard(firstWord())
    expect(classesAt(0)).toMatch(/correct/)

    await user.keyboard('{Tab}')

    expect(classesAt(0)).not.toMatch(/correct|incorrect/)
    expect(classesAt(0)).toMatch(/cursor/)
    expect(screen.getByText(/start typing to begin/i)).toBeInTheDocument()
  })

  it('lets Tab move focus when there is no test to restart', async () => {
    const user = userEvent.setup()
    renderTest()

    await user.keyboard('{Tab}')

    // Swallowing Tab unconditionally would trap a keyboard user on this screen.
    expect(document.body).not.toBe(document.activeElement)
    expect(screen.getByText(/start typing to begin/i)).toBeInTheDocument()
  })

  it('still restarts on Tab once a test is under way', async () => {
    const user = userEvent.setup()
    renderTest()
    await user.keyboard(firstWord().slice(0, 3))

    await user.keyboard('{Tab}')

    expect(classesAt(0)).not.toMatch(/correct|incorrect/)
    expect(screen.getByText(/start typing to begin/i)).toBeInTheDocument()
  })

  it('restarts from the restart control', async () => {
    const user = userEvent.setup()
    renderTest()
    await user.keyboard(firstWord())

    await user.click(screen.getByRole('button', { name: 'restart' }))

    expect(classesAt(0)).not.toMatch(/correct|incorrect/)
  })

  it('changes the amount of text from the configuration control', async () => {
    const user = userEvent.setup()
    renderTest()
    const before = renderedText().trim().split(/\s+/u).length

    await user.click(screen.getByRole('button', { name: '60' }))

    const after = renderedText().trim().split(/\s+/u).length
    expect(after).toBe(60)
    expect(after).toBeGreaterThan(before)
  })

  it('reports the selected word count to assistive technology', async () => {
    const user = userEvent.setup()
    renderTest()

    await user.click(screen.getByRole('button', { name: '15' }))

    expect(screen.getByRole('button', { name: '15' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('completes the test when the whole text is typed', async () => {
    const user = userEvent.setup()
    renderTest()
    await user.click(screen.getByRole('button', { name: '15' }))

    await user.keyboard(renderedText())

    expect(
      await screen.findByRole('region', { name: 'Test result' }),
    ).toBeInTheDocument()
  })

  it('ignores stray keys after completion so the result survives', async () => {
    const user = userEvent.setup()
    renderTest()
    await user.click(screen.getByRole('button', { name: '15' }))
    await user.keyboard(renderedText())

    await user.keyboard('xxxx')

    expect(screen.getByRole('region', { name: 'Test result' })).toBeInTheDocument()
  })

  it('leaves browser shortcuts alone', async () => {
    const user = userEvent.setup()
    renderTest()

    await user.keyboard('{Control>}a{/Control}')

    expect(screen.getByText(/start typing to begin/i)).toBeInTheDocument()
    expect(classesAt(0)).not.toMatch(/correct|incorrect/)
  })

  it('tracks progress through the text', async () => {
    const user = userEvent.setup()
    renderTest()
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '0')

    await user.keyboard(firstWord())

    expect(Number(bar.getAttribute('aria-valuenow'))).toBeGreaterThan(0)
  })
})

describe('recording a finished test', () => {
  const createService = (): SessionService =>
    createSessionService(createSessionRepository(createMemoryAdapter()))

  /** Types the whole of the current test at 15 words. */
  const completeATest = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: '15' }))
    await user.keyboard(renderedText())
    expect(
      await screen.findByRole('region', { name: 'Test result' }),
    ).toBeInTheDocument()
  }

  it('records exactly one session per completed test', async () => {
    const user = userEvent.setup()
    const service = createService()
    renderTest({ service })

    await completeATest(user)

    await waitFor(async () => {
      expect(await service.getAll()).toHaveLength(1)
    })
  })

  it('records nothing until a test is actually finished', async () => {
    const user = userEvent.setup()
    const service = createService()
    renderTest({ service })

    await user.keyboard(firstWord())

    expect(await service.getAll()).toHaveLength(0)
  })

  it('records nothing when a test is abandoned and restarted', async () => {
    const user = userEvent.setup()
    const service = createService()
    renderTest({ service })

    await user.keyboard(firstWord())
    await user.keyboard('{Tab}')

    expect(await service.getAll()).toHaveLength(0)
  })

  it('records a second session for a second test', async () => {
    const user = userEvent.setup()
    const service = createService()
    renderTest({ service })

    await completeATest(user)
    await waitFor(async () => {
      expect(await service.getAll()).toHaveLength(1)
    })

    await user.keyboard('{Tab}')
    await completeATest(user)

    await waitFor(async () => {
      expect(await service.getAll()).toHaveLength(2)
    })
  })

  it('stores what was actually typed, not a second opinion of it', async () => {
    const user = userEvent.setup()
    const service = createService()
    renderTest({ service })
    await user.click(screen.getByRole('button', { name: '15' }))
    const text = renderedText()

    await user.keyboard(text)
    await screen.findByRole('region', { name: 'Test result' })

    await waitFor(async () => {
      const [session] = await service.getAll()
      expect(session?.text).toBe(text)
      expect(session?.status).toBe('completed')
      expect(session?.metrics.totalCharacters).toBe(text.length)
      expect(session?.metrics.correctCharacters).toBe(text.length)
      expect(session?.metrics.accuracy).toBe(1)
    })
  })

  it('dates the session by wall clock so history can show it', async () => {
    const user = userEvent.setup()
    const service = createService()
    const before = Date.now()
    renderTest({ service })

    await completeATest(user)

    await waitFor(async () => {
      const [session] = await service.getAll()
      expect(session?.completedAt).toBeGreaterThanOrEqual(before)
      expect(session?.completedAt).toBeLessThanOrEqual(Date.now())
    })
  })

  it('keeps the typist going when saving fails', async () => {
    const user = userEvent.setup()
    const failing: SessionService = {
      ...createService(),
      save: () => Promise.reject(new Error('quota exceeded')),
    }
    renderTest({ service: failing })

    await completeATest(user)

    // The result is still on screen, and the failure is admitted rather than
    // hidden behind a success message — on screen and to a screen reader.
    expect(
      await screen.findByText(/could not be saved/i, { selector: 'span' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/^Test complete:/)).toHaveTextContent(/could not be saved/i)
  })

  it('offers a way to the history once a test is saved', async () => {
    const user = userEvent.setup()
    renderTest({ service: createService() })

    await completeATest(user)

    expect(
      await screen.findByRole('link', { name: /view history/i }),
    ).toBeInTheDocument()
  })
})

describe('the results panel', () => {
  const createService = (): SessionService =>
    createSessionService(createSessionRepository(createMemoryAdapter()))

  const renderWithRoutes = (service: SessionService) =>
    render(
      <MemoryRouter initialEntries={[ROUTES.practice]}>
        <Routes>
          <Route path={ROUTES.practice} element={<TypingTest service={service} />} />
          <Route path={ROUTES.history} element={<div>History page</div>} />
          <Route path={ROUTES.sessionDetail} element={<div>Detail page</div>} />
        </Routes>
      </MemoryRouter>,
    )

  const complete = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: '15' }))
    await user.keyboard(renderedText())
    return screen.findByRole('region', { name: 'Test result' })
  }

  it('shows no result until a test is finished', () => {
    renderTest()

    expect(
      screen.queryByRole('region', { name: 'Test result' }),
    ).not.toBeInTheDocument()
  })

  it('shows exactly one result for one completed test', async () => {
    const user = userEvent.setup()
    const service = createService()
    renderWithRoutes(service)

    await complete(user)

    expect(screen.getAllByRole('region', { name: 'Test result' })).toHaveLength(1)
    await waitFor(async () => {
      expect(await service.getAll()).toHaveLength(1)
    })
  })

  it('shows the figures from the session that was stored', async () => {
    const user = userEvent.setup()
    const service = createService()
    renderWithRoutes(service)
    await complete(user)

    const [session] = await waitFor(async () => {
      const all = await service.getAll()
      expect(all).toHaveLength(1)
      return all
    })

    const result = screen.getByRole('region', { name: 'Test result' })
    // Read off the record rather than recomputed here: if the screen derived
    // its own figures, these would drift apart.
    //
    // `getAllByText` because a flawless test types every character correctly,
    // so net and raw speed are the same number and both are on screen.
    expect(
      within(result).getAllByText(String(Math.round(session!.metrics.netWpm))).length,
    ).toBeGreaterThan(0)
    expect(
      within(result).getByText(`${Math.round(session!.metrics.accuracy * 100)}%`),
    ).toBeInTheDocument()
    expect(
      within(result).getAllByText(String(session!.metrics.totalCharacters)).length,
    ).toBeGreaterThan(0)
  })

  it('clears the result when the next test starts', async () => {
    const user = userEvent.setup()
    renderWithRoutes(createService())
    await complete(user)

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(
      screen.queryByRole('region', { name: 'Test result' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/start typing to begin/i)).toBeInTheDocument()
  })

  it('starts the next test from the keyboard alone', async () => {
    const user = userEvent.setup()
    renderWithRoutes(createService())
    await complete(user)

    await user.keyboard('{Enter}')

    expect(
      screen.queryByRole('region', { name: 'Test result' }),
    ).not.toBeInTheDocument()
  })

  it('navigates from the result to the history', async () => {
    const user = userEvent.setup()
    renderWithRoutes(createService())
    await complete(user)

    await user.click(screen.getByRole('link', { name: /view history/i }))

    expect(await screen.findByText('History page')).toBeInTheDocument()
  })

  it('navigates from the result to the full session detail', async () => {
    const user = userEvent.setup()
    renderWithRoutes(createService())
    await complete(user)

    const details = await screen.findByRole('link', { name: /view details/i })
    await user.click(details)

    expect(await screen.findByText('Detail page')).toBeInTheDocument()
  })

  it('does not offer a detail link for a test that was never stored', async () => {
    const user = userEvent.setup()
    const failing: SessionService = {
      ...createService(),
      save: () => Promise.reject(new Error('quota exceeded')),
    }
    renderWithRoutes(failing)

    await complete(user)

    // A link to a record that does not exist would only lead to "not found".
    expect(
      screen.queryByRole('link', { name: /view details/i }),
    ).not.toBeInTheDocument()
    expect(
      await screen.findByText(/could not be saved/i, { selector: 'span' }),
    ).toBeInTheDocument()
  })

  it('announces the result to a screen reader, and clears it for the next test', async () => {
    const user = userEvent.setup()
    renderWithRoutes(createService())

    // Present and empty before anything happens: a live region that only
    // appears with its text is often not announced at all.
    const announcement = screen
      .getAllByRole('status')
      .find((region) => region.getAttribute('aria-live') !== 'off')
    expect(announcement).toBeDefined()
    expect(announcement).toBeEmptyDOMElement()

    await complete(user)

    expect(announcement).toHaveTextContent(
      /^Test complete: \d+ words per minute, \d+% accuracy\.$/,
    )

    await user.keyboard('{Enter}')

    expect(announcement).toBeInTheDocument()
    expect(announcement).toBeEmptyDOMElement()
  })

  it('leaves Tab free to reach the result controls', async () => {
    const user = userEvent.setup()
    renderWithRoutes(createService())
    await complete(user)

    await user.keyboard('{Tab}')

    // Tab must move focus here. Taking it to restart, as it does mid-test,
    // would leave every control on the results unreachable by keyboard.
    expect(screen.getByRole('region', { name: 'Test result' })).toBeInTheDocument()
    expect(document.activeElement).not.toBe(document.body)
  })

  it('lets Space operate a focused control instead of swallowing it', async () => {
    const user = userEvent.setup()
    renderWithRoutes(createService())
    await complete(user)

    screen.getByRole('button', { name: 'Try again' }).focus()
    await user.keyboard(' ')

    expect(
      screen.queryByRole('region', { name: 'Test result' }),
    ).not.toBeInTheDocument()
  })
})

describe('telemetry capture', () => {
  const createServices = () => {
    const service = createSessionService(createSessionRepository(createMemoryAdapter()))
    const telemetry = createTelemetryService(
      createTelemetryRepository(createMemoryAdapter()),
    )
    return { service, telemetry }
  }

  const complete = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: '15' }))
    await user.keyboard(renderedText())
    return screen.findByRole('region', { name: 'Test result' })
  }

  it('records keystroke detail for a completed test', async () => {
    const user = userEvent.setup()
    const { service, telemetry } = createServices()
    renderTest({ service, telemetry })
    // Read the text *after* choosing the length, or this compares against the
    // default test rather than the one that gets typed.
    await user.click(screen.getByRole('button', { name: '15' }))
    const text = renderedText()

    await user.keyboard(text)
    await screen.findByRole('region', { name: 'Test result' })

    await waitFor(async () => {
      const [session] = await service.getAll()
      const captured = await telemetry.getBySessionId(session!.id, session!.text)
      expect(captured).not.toBeNull()
      // One event per character of the text that was typed.
      expect(captured?.summary.characterKeystrokes).toBe(Array.from(text).length)
      expect(captured?.summary.backspaceCount).toBe(0)
    })
  })

  it('records corrections made while typing', async () => {
    const user = userEvent.setup()
    const { service, telemetry } = createServices()
    renderTest({ service, telemetry })
    await user.click(screen.getByRole('button', { name: '15' }))
    const text = renderedText()
    const wrong = text[0] === 'z' ? 'q' : 'z'

    await user.keyboard(wrong)
    await user.keyboard('{Backspace}')
    await user.keyboard(text)
    await screen.findByRole('region', { name: 'Test result' })

    await waitFor(async () => {
      const [session] = await service.getAll()
      const captured = await telemetry.getBySessionId(session!.id, session!.text)
      expect(captured?.summary.backspaceCount).toBe(1)
      expect(captured?.corrections[0]).toMatchObject({
        index: 0,
        typedKey: wrong,
        outcome: 'corrected',
      })
    })
  })

  it('stores nothing at all while typing', async () => {
    const user = userEvent.setup()
    const { service } = createServices()
    let writes = 0
    const counting: TelemetryService = {
      capture: (result) => encodeTelemetry(result.keystrokes),
      save: () => {
        writes += 1
        return Promise.resolve()
      },
      getBySessionId: () => Promise.resolve(null),
      getMany: () => Promise.resolve([]),
      getStored: () => Promise.resolve(null),
      remove: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    }
    renderTest({ service, telemetry: counting })
    await user.click(screen.getByRole('button', { name: '15' }))
    const text = renderedText()

    await user.keyboard(text.slice(0, -1))
    expect(writes).toBe(0) // nothing written across a whole test's worth of keys

    await user.keyboard(text.slice(-1))
    await screen.findByRole('region', { name: 'Test result' })

    await waitFor(() => {
      expect(writes).toBe(1) // exactly once, after the last character
    })
  })

  it('keeps the result when telemetry cannot be stored', async () => {
    const user = userEvent.setup()
    const { service } = createServices()
    const failing: TelemetryService = {
      capture: (result) => encodeTelemetry(result.keystrokes),
      save: () => Promise.reject(new Error('quota exceeded')),
      getBySessionId: () => Promise.resolve(null),
      getMany: () => Promise.resolve([]),
      getStored: () => Promise.resolve(null),
      remove: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    }
    renderTest({ service, telemetry: failing })

    await complete(user)

    // Losing keystroke detail must not cost the session itself.
    await waitFor(async () => {
      expect(await service.getAll()).toHaveLength(1)
    })
    expect(screen.queryByText(/could not be saved/i)).not.toBeInTheDocument()
  })
})

describe('deleting a word from the keyboard', () => {
  it('clears the word being typed on Ctrl+Backspace', async () => {
    const user = userEvent.setup()
    renderTest()

    const word = firstWord()
    await user.keyboard(word)
    expect(classesAt(0)).toMatch(/correct/)

    await user.keyboard('{Control>}{Backspace}{/Control}')

    // The whole word goes back to untyped, and the cursor with it.
    for (let index = 0; index < word.length; index += 1) {
      expect(classesAt(index)).not.toMatch(/correct|incorrect/)
    }
    expect(classesAt(0)).toMatch(/cursor/)
  })

  it('clears the word on Alt+Backspace too', async () => {
    const user = userEvent.setup()
    renderTest()

    const word = firstWord()
    await user.keyboard(word)

    await user.keyboard('{Alt>}{Backspace}{/Alt}')

    expect(classesAt(0)).not.toMatch(/correct|incorrect/)
    expect(classesAt(0)).toMatch(/cursor/)
  })

  it('takes the trailing space and the word before it together', async () => {
    const user = userEvent.setup()
    renderTest()

    const word = firstWord()
    await user.keyboard(`${word} `)

    await user.keyboard('{Control>}{Backspace}{/Control}')

    expect(classesAt(0)).not.toMatch(/correct|incorrect/)
    expect(classesAt(word.length)).not.toMatch(/correct|incorrect/)
  })

  it('leaves an earlier word alone', async () => {
    const user = userEvent.setup()
    renderTest()

    const [first = '', second = ''] = renderedText().split(' ')
    await user.keyboard(`${first} ${second.slice(0, 2)}`)

    await user.keyboard('{Control>}{Backspace}{/Control}')

    // The first word and its space survive; only the partial second word goes.
    expect(classesAt(0)).toMatch(/correct/)
    expect(classesAt(first.length - 1)).toMatch(/correct/)
    expect(classesAt(first.length + 1)).not.toMatch(/correct|incorrect/)
  })

  it('does nothing before anything has been typed', async () => {
    const user = userEvent.setup()
    renderTest()

    await user.keyboard('{Control>}{Backspace}{/Control}')

    // Still idle: a deletion must not start a test.
    expect(screen.getByText(/start typing to begin/i)).toBeInTheDocument()
  })

  it('leaves every other Ctrl chord to the browser', async () => {
    const user = userEvent.setup()
    renderTest()
    await user.keyboard(firstWord().slice(0, 2))

    const prevented: string[] = []
    const record = (event: KeyboardEvent) => {
      if (event.defaultPrevented) prevented.push(event.key)
    }
    window.addEventListener('keydown', record)

    // Reload, new tab, close tab, address bar, find, print, select all.
    await user.keyboard(
      '{Control>}r{/Control}{Control>}t{/Control}{Control>}w{/Control}' +
        '{Control>}l{/Control}{Control>}f{/Control}{Control>}p{/Control}' +
        '{Control>}a{/Control}',
    )

    window.removeEventListener('keydown', record)

    // Claiming these would break the browser on the one screen a typist lives
    // on. Only Backspace is taken with a modifier held.
    expect(prevented).toEqual([])
  })

  it('does not claim Cmd+Backspace, which means something else on a Mac', async () => {
    const user = userEvent.setup()
    renderTest()

    const word = firstWord()
    await user.keyboard(word)

    await user.keyboard('{Meta>}{Backspace}{/Meta}')

    // "Delete to start of line" would throw away the whole test, so it is left
    // unimplemented rather than quietly mapped onto something else.
    expect(classesAt(0)).toMatch(/correct/)
  })

  it('does not count the deletion as an accuracy attempt', async () => {
    const user = userEvent.setup()
    renderTest()

    const word = firstWord()
    await user.keyboard(word)
    await user.keyboard('{Control>}{Backspace}{/Control}')
    await user.keyboard(word)

    // Everything typed was correct, both times round.
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})

describe('recovering from a normal mistake', () => {
  const statesFrom = (start: number, length: number): string[] =>
    characterSpans()
      .slice(start, start + length)
      .map((span) => (span.className.match(/(correct|incorrect|corrected)/)?.[1] ?? 'pending'))

  it('keeps an extra letter from making the next word wrong', async () => {
    const user = userEvent.setup()
    renderTest()

    const [first = '', second = ''] = renderedText().split(' ')
    // One extra letter on the end of the first word, then the second word
    // typed correctly.
    await user.keyboard(`${first}x ${second}`)

    expect(statesFrom(first.length + 1, second.length).every((s) => s === 'correct')).toBe(true)
    expect(statesFrom(first.length, 1)).toEqual(['incorrect'])
  })

  it('keeps a dropped letter from making the next word wrong', async () => {
    const user = userEvent.setup()
    renderTest()

    const [first = '', second = ''] = renderedText().split(' ')
    // Drop the last letter of the first word.
    await user.keyboard(`${first.slice(0, -1)} ${second}`)

    expect(statesFrom(first.length + 1, second.length).every((s) => s === 'correct')).toBe(true)
  })

  it('does not start the test on a stray space', async () => {
    const user = userEvent.setup()
    renderTest()

    await user.keyboard(' ')

    expect(screen.getByText(/start typing to begin/i)).toBeInTheDocument()
  })
})

describe('starting a test', () => {
  it('starts on a first letter that happens to be "s"', async () => {
    // Guards a regression found while adding the stray-space rule: a whitespace
    // check that lost its backslash matched the letter s instead.
    const user = userEvent.setup()
    renderTest({
      provider: { id: 'fixed', label: 'Fixed', provide: () => ({ text: 'some text here', sourceId: 'fixed' }) },
    })

    await user.keyboard('s')

    expect(screen.queryByText(/start typing to begin/i)).not.toBeInTheDocument()
    expect(characterSpans()[0]?.className).toMatch(/correct/)
  })
})

describe('remembered practice length', () => {
  it('opens at the remembered length', () => {
    renderTest({ wordCountPreference: { initial: 60, remember: () => undefined } })

    expect(renderedText().split(' ')).toHaveLength(60)
    expect(screen.getByRole('button', { name: '60' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('reports a new choice so it can be remembered', async () => {
    const user = userEvent.setup()
    const remembered: number[] = []
    renderTest({ wordCountPreference: { initial: 30, remember: (count) => remembered.push(count) } })

    await user.click(screen.getByRole('button', { name: '15' }))

    expect(remembered).toEqual([15])
    expect(renderedText().split(' ')).toHaveLength(15)
  })
})

describe('GGTyping word jump on the typing screen', () => {
  const fixed = (text: string): NonNullable<TypingTestProps['provider']> => ({
    id: 'fixed',
    label: 'Fixed',
    provide: () => ({ text, sourceId: 'fixed' }),
  })

  const media = (reduce: boolean) =>
    ((query: string) => ({
      matches: reduce && query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia

  /** Records which elements were asked to animate, on the real screen. */
  const recordAnimations = (reduce: boolean) => {
    const animated: Element[] = []
    const original = { animate: HTMLElement.prototype.animate, matchMedia: window.matchMedia }

    window.matchMedia = media(reduce)
    HTMLElement.prototype.animate = function animate(this: HTMLElement) {
      animated.push(this)
      return {
        playState: 'running',
        cancel: () => undefined,
        addEventListener: () => undefined,
      } as unknown as Animation
    }

    return {
      animated,
      restore: () => {
        HTMLElement.prototype.animate = original.animate
        window.matchMedia = original.matchMedia
      },
    }
  }

  it('makes the mistyped word jump on the third mistake in a row, and not before', async () => {
    const recorder = recordAnimations(false)
    try {
      const user = userEvent.setup()
      renderTest({ provider: fixed('alpha bravo charlie') })

      await user.keyboard('x{Backspace}x{Backspace}')
      expect(recorder.animated).toEqual([])

      await user.keyboard('x')

      const alpha = textContainer().querySelector('[data-word="0"]')
      expect(recorder.animated).toEqual([alpha])
      // The word wraps its own letters and nothing else.
      expect(alpha?.textContent).toBe('alpha')
    } finally {
      recorder.restore()
    }
  })

  it('keeps the mistake on screen but does not move anything under reduced motion', async () => {
    const recorder = recordAnimations(true)
    try {
      const user = userEvent.setup()
      renderTest({ provider: fixed('alpha bravo charlie') })

      await user.keyboard('x{Backspace}x{Backspace}x')

      expect(recorder.animated).toEqual([])
      expect(classesAt(0)).toMatch(/incorrect/)
    } finally {
      recorder.restore()
    }
  })

  it('leaves the text, the caret and the line exactly as they were', async () => {
    const recorder = recordAnimations(false)
    try {
      const user = userEvent.setup()
      renderTest({ provider: fixed('alpha bravo charlie') })

      await user.keyboard('x{Backspace}x{Backspace}x')

      expect(recorder.animated).toHaveLength(1)
      expect(renderedText()).toBe('alpha bravo charlie')
      // The caret is where the engine put it, one past the mistake.
      expect(classesAt(1)).toMatch(/cursor/)
      // Spaces are not inside any word, so they never move with one.
      const spaces = Array.from(textContainer().querySelectorAll('[data-word] span')).filter(
        (element) => element.textContent === ' ',
      )
      expect(spaces).toEqual([])
    } finally {
      recorder.restore()
    }
  })
})

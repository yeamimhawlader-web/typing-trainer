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
  Array.from(textContainer().querySelectorAll('span')).filter(
    // Excludes the zero-width span that carries the caret at the end.
    (element) => element.textContent !== null && element.textContent.length === 1,
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
    const stats = screen.getByRole('status')

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

    const stats = screen.getByRole('status')
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
    // hidden behind a success message.
    expect(await screen.findByText(/could not be saved/i)).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
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
    expect(await screen.findByText(/could not be saved/i)).toBeInTheDocument()
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

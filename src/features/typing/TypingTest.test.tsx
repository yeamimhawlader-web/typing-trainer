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
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

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

    expect(await screen.findByText(/test complete/i)).toBeInTheDocument()
  })

  it('ignores stray keys after completion so the result survives', async () => {
    const user = userEvent.setup()
    renderTest()
    await user.click(screen.getByRole('button', { name: '15' }))
    await user.keyboard(renderedText())

    await user.keyboard('xxxx')

    expect(screen.getByText(/test complete/i)).toBeInTheDocument()
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
    expect(await screen.findByText(/test complete/i)).toBeInTheDocument()
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
    await screen.findByText(/test complete/i)

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

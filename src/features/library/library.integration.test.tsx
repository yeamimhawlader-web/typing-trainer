/**
 * Your own texts over the real application, end to end in jsdom.
 *
 * Cross-layer, not unit: the shell, the library, the typing session, the engine
 * and session storage are the real ones, with only storage swapped for memory.
 * Each test does what a typist does — paste something in, keep it, press
 * Practise, type — and asserts on what the application ends up holding. What
 * makes a pasted text typeable has its own tests in `@core/library`; nothing
 * here repeats them.
 *
 * The journeys that matter, and why each is here:
 *
 * - A quote pasted out of a document arrives with curly quotes and line breaks,
 *   and has to be typeable through to the end afterwards. This is the test that
 *   would have caught line breaks joining two words together.
 * - The prompt for an AI is worth nothing if it cannot be copied, and what
 *   comes back is a numbered list that has to become words.
 * - A passage is the test, so its length is not a choice; a word list is drawn
 *   at the length chosen, like ordinary practice.
 *
 * Layout and motion are judged in a browser; jsdom has neither.
 */

import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ROUTES, textPath } from '@app/routes.ts'
import { DEFAULT_PREFERENCES } from '@config'
import { createLibraryService, type LibraryService } from '@core/library'
import { createMemoryAdapter } from '@core/persistence'
import { createSessionServiceOver, type SessionService } from '@core/sessions'
import { createTelemetryServiceOver, type TelemetryService } from '@core/telemetry'
import { GGLayout } from '@features/gg-ui'
import { settingsStore } from '@features/settings/state/settings.store.ts'

import { LibraryPage } from './pages/LibraryPage.tsx'
import { LibraryPracticePage } from './pages/LibraryPracticePage.tsx'

let library: LibraryService
let sessions: SessionService
let telemetry: TelemetryService
let now = 10_000

beforeEach(() => {
  library = createLibraryService(createMemoryAdapter())
  sessions = createSessionServiceOver(createMemoryAdapter())
  telemetry = createTelemetryServiceOver(createMemoryAdapter())
  settingsStore.setState({ preferences: { ...DEFAULT_PREFERENCES, practiceWordCount: 15 }, status: 'ready' })
  now = 10_000
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})

// The shell takes its theme back off as it unmounts, which the automatic
// cleanup after each test does for us.
afterEach(() => {
  vi.restoreAllMocks()
})

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<GGLayout />}>
          <Route path={ROUTES.ggTexts} element={<LibraryPage library={library} />} />
          <Route
            path={ROUTES.ggText}
            element={<LibraryPracticePage library={library} service={sessions} telemetry={telemetry} />}
          />
          <Route path={ROUTES.gg} element={<p>Practice</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

// --- Reading the screen ------------------------------------------------

const stream = () => screen.getByRole('region', { name: 'Words to type' })
const field = () => screen.getByRole('textbox', { name: 'Type the words above' }) as HTMLTextAreaElement

/** Types each character `gapMs` after the one before, as an input method does. */
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

/** Keeps a text the way the page does, so a test can start from having one. */
const keep = async (user: ReturnType<typeof userEvent.setup>, title: string, body: string, kind = 'passage') => {
  if (kind !== 'passage') await user.click(screen.getByRole('radio', { name: 'Words, in random order' }))
  await user.type(screen.getByLabelText('Name it'), title)
  await user.type(screen.getByLabelText('The text'), body)
  await user.click(screen.getByRole('button', { name: 'Keep it' }))
}

// --- The tests --------------------------------------------------------

describe('keeping a text of your own', () => {
  it('takes a quote pasted out of a document, and shows it kept', async () => {
    const user = userEvent.setup()
    renderAt(ROUTES.ggTexts)

    await keep(user, 'Marcus', 'You have power over your mind.{enter}{enter}Not outside events.')

    const kept = await screen.findByRole('listitem')
    expect(within(kept).getByText('Marcus')).toBeInTheDocument()
    // Line breaks became spaces: the two sentences are still two sentences.
    expect(within(kept).getByText('You have power over your mind. Not outside events.')).toBeInTheDocument()
    expect((await library.getAll())[0]?.kind).toBe('passage')
  })

  it('says so when there is nothing in it to type, and keeps nothing', async () => {
    const user = userEvent.setup()
    renderAt(ROUTES.ggTexts)

    await keep(user, 'Too short', 'hi')

    expect(await screen.findByRole('status')).toHaveTextContent('too short to type')
    expect(await library.getAll()).toEqual([])
  })

  it('names a text after its own opening when it is given no name', async () => {
    const user = userEvent.setup()
    renderAt(ROUTES.ggTexts)

    await user.type(screen.getByLabelText('The text'), 'The only way out is through the work itself.')
    await user.click(screen.getByRole('button', { name: 'Keep it' }))

    expect(await screen.findByText('The only way out is through')).toBeInTheDocument()
  })

  it('edits one in place, rather than keeping a second copy', async () => {
    const user = userEvent.setup()
    renderAt(ROUTES.ggTexts)
    await keep(user, 'Goals', 'Run every morning without fail.')

    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('heading', { name: 'Editing “Goals”' })).toBeInTheDocument()

    const body = screen.getByLabelText('The text')
    await user.clear(body)
    await user.type(body, 'Run every morning, and read every night.')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(async () => {
      expect(await library.getAll()).toHaveLength(1)
    })
    expect((await library.getAll())[0]?.body).toBe('Run every morning, and read every night.')
  })

  it('asks before deleting one, and deletes it when told twice', async () => {
    const user = userEvent.setup()
    renderAt(ROUTES.ggTexts)
    await keep(user, 'Goals', 'Run every morning without fail.')

    await user.click(await screen.findByRole('button', { name: 'Delete Goals' }))
    expect(await library.getAll()).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(async () => {
      expect(await library.getAll()).toEqual([])
    })
  })
})

describe('the words you actually use', () => {
  it('hands the prompt to the clipboard, and says it did', async () => {
    const user = userEvent.setup()
    renderAt(ROUTES.ggTexts)

    await user.click(screen.getByRole('button', { name: 'Copy the prompt' }))

    // The clipboard is the one userEvent puts in place of jsdom's missing one.
    expect(await navigator.clipboard.readText()).toContain('words I use most often')
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('turns what the AI answered into a word list to practise', async () => {
    const user = userEvent.setup()
    renderAt(ROUTES.ggTexts)

    await user.type(
      screen.getByLabelText('Paste what it gives you'),
      '1. because{enter}2. through{enter}3. people{enter}4. because',
    )
    await user.click(screen.getByRole('button', { name: 'Keep as a word list' }))

    await waitFor(async () => {
      expect(await library.getAll()).toHaveLength(1)
    })
    const [stored] = await library.getAll()
    expect(stored?.kind).toBe('words')
    // Numbered, duplicated, one per line — three words to practise.
    expect(stored?.body).toBe('because through people')
    expect(screen.getByText('Words, in random order · 3 words')).toBeInTheDocument()
  })
})

describe('practising your own text', () => {
  it('types the passage exactly as it was kept, and saves the test', async () => {
    const user = userEvent.setup()
    const passage = 'You have power over your mind.'
    await library.save({ title: 'Marcus', body: passage, kind: 'passage' })
    renderAt(ROUTES.ggTexts)

    await user.click(await screen.findByRole('link', { name: 'Practise' }))
    await screen.findByRole('region', { name: 'Words to type' })

    expect(stream().textContent).toBe(passage)
    expect(screen.getByRole('link', { name: /Your texts/ })).toHaveAttribute('aria-current', 'page')

    typeText(passage)

    await waitFor(async () => {
      expect(await sessions.getAll()).toHaveLength(1)
    })
    const [session] = await sessions.getAll()
    expect(session?.text).toBe(passage)
    expect(session?.metrics.accuracy).toBe(1)
    // History can say where the words came from without keeping a copy of them.
    expect(session?.textSourceId).toBe('your-text')
  })

  it('offers no length for a passage: the text is the test', async () => {
    const saved = await library.save({ title: 'Marcus', body: 'You have power over your mind.', kind: 'passage' })
    renderAt(textPath(saved!.id))
    await screen.findByRole('region', { name: 'Words to type' })

    expect(screen.queryByRole('radiogroup', { name: 'Test length in words' })).not.toBeInTheDocument()
  })

  it('draws a word list at the length chosen, and never on the clock', async () => {
    const saved = await library.save({ title: 'My words', body: 'because through people', kind: 'words' })
    renderAt(textPath(saved!.id))
    await screen.findByRole('region', { name: 'Words to type' })

    // Fifteen words drawn from the three kept.
    expect(stream().textContent?.split(' ')).toHaveLength(15)
    expect(
      within(screen.getByRole('radiogroup', { name: 'Test length in words' })).getByRole('radio', { name: '15 words' }),
    ).toBeChecked()
    // No clock over your own words: a time would change nothing here.
    expect(screen.queryByRole('radiogroup', { name: 'Test length in time' })).not.toBeInTheDocument()
  })

  it('says so when the text is not there, rather than showing an empty screen', async () => {
    renderAt(textPath('gone'))

    expect(await screen.findByRole('heading', { name: 'That text is not here' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'your texts' })).toHaveAttribute('href', ROUTES.ggTexts)
  })
})

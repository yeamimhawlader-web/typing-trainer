/**
 * Results tests.
 *
 * The recurring assertion is that what is on screen matches what is *stored* —
 * not that it matches a second calculation done in the test. Every expected
 * value below is read off the session object, so a formula creeping back into
 * the UI would show up here as a mismatch.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { PRACTICE_PATH, ROUTES, sessionDetailPath } from '@app/routes.ts'
import { createMemoryAdapter } from '@core/persistence'
import {
  createSessionRepository,
  createSessionService,
  DEFAULT_SESSION_CONTEXT,
  sessionService,
  type SessionService,
  type TypingSession,
} from '@core/sessions'
import { telemetryService } from '@core/telemetry'
import { accuracy, milliseconds, sessionId, timestamp, wpm } from '@core/types'
import { HistoryPage } from '@features/history/pages/HistoryPage.tsx'
import { historyStore } from '@features/history/state/history.store.ts'

import { SessionSummary } from './components/SessionSummary.tsx'
import { SessionDetailPage } from './pages/SessionDetailPage.tsx'

const makeSession = (overrides: Partial<TypingSession> = {}): TypingSession => ({
  id: sessionId('session-under-test'),
  startedAt: timestamp(1_700_000_000_000),
  completedAt: timestamp(1_700_000_007_500),
  durationMs: milliseconds(7_500),
  text: 'the quick brown fox',
  textSourceId: 'common-words',
  context: DEFAULT_SESSION_CONTEXT,
  metrics: {
    netWpm: wpm(128.4),
    rawWpm: wpm(134.2),
    accuracy: accuracy(0.9642),
    totalCharacters: 19,
    typedCharacters: 28,
    correctCharacters: 18,
    incorrectCharacters: 1,
    correctedCharacters: 3,
    errorCount: 4,
  },
  status: 'completed',
  ...overrides,
})

const renderSummary = (session: TypingSession) =>
  render(
    <MemoryRouter>
      <SessionSummary session={session} />
    </MemoryRouter>,
  )

/**
 * Reads the value rendered under a detail label.
 *
 * Matches only <dt> elements: the composition legend repeats words like
 * "Correct" in plain spans, and those are decoration for the bar above them.
 */
const detailValue = (label: string): string => {
  const term = screen.getAllByText(label).find((element) => element.tagName === 'DT')
  return term?.parentElement?.querySelector('dd')?.textContent ?? ''
}

describe('session summary', () => {
  it('leads with speed as the primary figure', () => {
    const session = makeSession()
    renderSummary(session)

    const result = screen.getByRole('region', { name: 'Test result' })
    // 128.4 stored, rounded for display, with the unit alongside it.
    expect(within(result).getByText('128')).toBeInTheDocument()
    expect(within(result).getByText('wpm')).toBeInTheDocument()
  })

  it('shows accuracy and raw speed as the supporting figures', () => {
    renderSummary(makeSession())

    expect(screen.getByText('96%')).toBeInTheDocument()
    expect(screen.getByText('accuracy')).toBeInTheDocument()
    expect(screen.getByText('134')).toBeInTheDocument()
    expect(screen.getByText('raw wpm')).toBeInTheDocument()
  })

  it('shows every stored metric', () => {
    const session = makeSession()
    renderSummary(session)

    // 7 500 ms reads as 7s: rounded down, the same as the live timer showed.
    expect(detailValue('Duration')).toBe('7s')
    expect(detailValue('Characters')).toBe(String(session.metrics.totalCharacters))
    expect(detailValue('Correct')).toBe(String(session.metrics.correctCharacters))
    expect(detailValue('Incorrect')).toBe(String(session.metrics.incorrectCharacters))
    expect(detailValue('Corrected')).toBe(String(session.metrics.correctedCharacters))
    expect(detailValue('Errors')).toBe(String(session.metrics.errorCount))
    expect(detailValue('Mode')).toBe('Words')
    expect(detailValue('Source')).toBe('Common words')
    expect(detailValue('Completed')).not.toBe('')
  })

  it('displays exactly what is stored, without recalculating it', () => {
    // Deliberately inconsistent numbers: were the screen deriving accuracy from
    // the character counts, it could not show 50%.
    const session = makeSession({
      metrics: {
        ...makeSession().metrics,
        netWpm: wpm(77),
        accuracy: accuracy(0.5),
        correctCharacters: 19,
        incorrectCharacters: 0,
      },
    })

    renderSummary(session)

    expect(screen.getByText('77')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(detailValue('Correct')).toBe('19')
  })

  it('reads a flawless session as flawless', () => {
    const session = makeSession({
      metrics: {
        netWpm: wpm(140),
        rawWpm: wpm(140),
        accuracy: accuracy(1),
        totalCharacters: 19,
        typedCharacters: 19,
        correctCharacters: 19,
        incorrectCharacters: 0,
        correctedCharacters: 0,
        errorCount: 0,
      },
    })

    renderSummary(session)

    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(detailValue('Errors')).toBe('0')
    expect(detailValue('Incorrect')).toBe('0')
    expect(detailValue('Corrected')).toBe('0')
  })

  it('reads a heavily mistyped session honestly', () => {
    const session = makeSession({
      metrics: {
        netWpm: wpm(40),
        rawWpm: wpm(96),
        accuracy: accuracy(0.42),
        totalCharacters: 19,
        typedCharacters: 45,
        correctCharacters: 8,
        incorrectCharacters: 11,
        correctedCharacters: 2,
        errorCount: 26,
      },
    })

    renderSummary(session)

    expect(screen.getByText('42%')).toBeInTheDocument()
    expect(detailValue('Incorrect')).toBe('11')
    expect(detailValue('Errors')).toBe('26')
    // Raw speed well above net is the signature of a lot of typing gone wrong.
    expect(screen.getByText('96')).toBeInTheDocument()
  })

  it('describes the character composition for assistive technology', () => {
    const session = makeSession()
    renderSummary(session)

    // One meaning of "correct" everywhere: 18 includes the 3 corrected, and
    // the first-try and corrected parts are named rather than one being called
    // "correct" while the figure below says otherwise.
    expect(
      screen.getByRole('img', { name: '18 correct (15 first try, 3 corrected), 1 incorrect' }),
    ).toBeInTheDocument()
  })

  it('handles a session where nothing was typed correctly', () => {
    const session = makeSession({
      metrics: {
        ...makeSession().metrics,
        accuracy: accuracy(0),
        correctCharacters: 0,
        correctedCharacters: 0,
        incorrectCharacters: 19,
      },
    })

    renderSummary(session)

    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: '0 correct (0 first try, 0 corrected), 19 incorrect' }),
    ).toBeInTheDocument()
  })
})

/** Mounts the detail page at a given session id. */
const renderDetail = (id: string, service?: SessionService) =>
  render(
    <MemoryRouter initialEntries={[sessionDetailPath(id)]}>
      <Routes>
        <Route
          path={ROUTES.sessionDetail}
          element={
            <SessionDetailPage {...(service === undefined ? {} : { service })} />
          }
        />
        <Route path={ROUTES.history} element={<div>History page</div>} />
        <Route path={PRACTICE_PATH} element={<div>Practice page</div>} />
      </Routes>
    </MemoryRouter>,
  )

describe('session detail page', () => {
  beforeEach(async () => {
    await sessionService.clear()
  })

  it('shows a stored session in full', async () => {
    const session = makeSession()
    await sessionService.save(session)

    renderDetail(session.id)

    expect(
      await screen.findByRole('region', { name: 'Session result' }),
    ).toBeInTheDocument()
    expect(screen.getByText('128')).toBeInTheDocument()
    expect(screen.getByText('96%')).toBeInTheDocument()
    expect(screen.getByText(session.text)).toBeInTheDocument()
  })

  it('shows the same numbers the summary panel showed', async () => {
    const session = makeSession()
    await sessionService.save(session)

    renderDetail(session.id)
    await screen.findByRole('region', { name: 'Session result' })

    expect(detailValue('Correct')).toBe(String(session.metrics.correctCharacters))
    expect(detailValue('Errors')).toBe(String(session.metrics.errorCount))
    // 7 500 ms reads as 7s: rounded down, the same as the live timer showed.
    expect(detailValue('Duration')).toBe('7s')
  })

  it('says so when the session does not exist', async () => {
    renderDetail('never-saved')

    expect(await screen.findByText(/not in your history/i)).toBeInTheDocument()
    // And offers a way out rather than a dead end.
    expect(screen.getByRole('link', { name: /back to history/i })).toBeInTheDocument()
  })

  it('treats a malformed record as missing rather than crashing', async () => {
    // Corrupted at the storage layer, below the service, which is where a
    // record written by an older build would actually go wrong.
    const adapter = createMemoryAdapter()
    const service = createSessionService(createSessionRepository(adapter))
    const session = makeSession()
    await service.save(session)
    await adapter.write(`session:${session.id}`, { id: session.id, garbage: true })

    renderDetail(session.id, service)

    expect(await screen.findByText(/not in your history/i)).toBeInTheDocument()
  })

  it('survives storage that cannot be read at all', async () => {
    const service: SessionService = {
      ...createSessionService(createSessionRepository(createMemoryAdapter())),
      getById: () => Promise.reject(new Error('storage unavailable')),
    }

    renderDetail('anything', service)

    expect(await screen.findByText(/not in your history/i)).toBeInTheDocument()
  })

  it('handles a session deleted after the link was made', async () => {
    const session = makeSession()
    await sessionService.save(session)
    await sessionService.remove(session.id)

    renderDetail(session.id)

    expect(await screen.findByText(/not in your history/i)).toBeInTheDocument()
  })

  it('deletes a session after confirmation and returns to the history', async () => {
    const user = userEvent.setup()
    const session = makeSession()
    await sessionService.save(session)
    renderDetail(session.id)
    await screen.findByRole('region', { name: 'Session result' })

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const confirm = screen.getByRole('group', { name: 'Delete this test?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('History page')).toBeInTheDocument()
    await expect(sessionService.getById(session.id)).resolves.toBeNull()
  })

  it('does not delete on the first press', async () => {
    const user = userEvent.setup()
    const session = makeSession()
    await sessionService.save(session)
    renderDetail(session.id)
    await screen.findByRole('region', { name: 'Session result' })

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    // A question, not a deletion — and focus on the safe answer.
    expect(screen.getByRole('group', { name: 'Delete this test?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await expect(sessionService.getById(session.id)).resolves.not.toBeNull()
  })

  it('keeps the session when the deletion is cancelled', async () => {
    const user = userEvent.setup()
    const session = makeSession()
    await sessionService.save(session)
    renderDetail(session.id)
    await screen.findByRole('region', { name: 'Session result' })

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('group', { name: 'Delete this test?' })).not.toBeInTheDocument()
    // Focus goes back to where it came from.
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus()
    await expect(sessionService.getById(session.id)).resolves.not.toBeNull()
  })

  it('removes the keystroke detail too, leaving nothing behind', async () => {
    // The audit found this page deleting the record and leaving 788 bytes of
    // what was typed in storage, still readable and still indexed.
    const user = userEvent.setup()
    const session = makeSession()
    await sessionService.save(session)
    await telemetryService.save(session.id, { version: 1, keystrokes: [[0, 0, 'h'], [90, 1, 'e']] })
    renderDetail(session.id)
    await screen.findByRole('region', { name: 'Session result' })

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const confirm = screen.getByRole('group', { name: 'Delete this test?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await screen.findByText('History page')

    await expect(telemetryService.getStored(session.id)).resolves.toBeNull()
    const leftovers = Object.keys(window.localStorage).filter((key) => key.includes(session.id))
    expect(leftovers).toEqual([])
  })

  it('offers a way back to practice', async () => {
    const user = userEvent.setup()
    const session = makeSession()
    await sessionService.save(session)
    renderDetail(session.id)
    await screen.findByRole('region', { name: 'Session result' })

    await user.click(screen.getByRole('link', { name: /go to practice/i }))

    expect(await screen.findByText('Practice page')).toBeInTheDocument()
  })
})

describe('history to detail', () => {
  beforeEach(async () => {
    await sessionService.clear()
    historyStore.setState({ sessions: [], status: 'idle' })
  })

  it('opens a session from the history list', async () => {
    const user = userEvent.setup()
    const session = makeSession()
    await sessionService.save(session)

    render(
      <MemoryRouter initialEntries={[ROUTES.history]}>
        <Routes>
          <Route path={ROUTES.history} element={<HistoryPage />} />
          <Route path={ROUTES.sessionDetail} element={<SessionDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const row = await screen.findByRole('link', { name: /\d/ })
    await user.click(row)

    expect(
      await screen.findByRole('region', { name: 'Session result' }),
    ).toBeInTheDocument()
    expect(screen.getByText(session.text)).toBeInTheDocument()
  })
})

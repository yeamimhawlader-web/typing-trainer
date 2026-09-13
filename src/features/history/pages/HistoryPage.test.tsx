/**
 * History page tests: deleting asks first, and can be undone.
 *
 * The store's undo and the deletion service are covered where they live. What
 * is worth testing here is what a person meets: a Delete that does nothing on
 * its own, a Clear that names how much it will remove, an Undo that brings the
 * rows back, and a screen reader hearing each once.
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_SESSION_CONTEXT,
  sessionService,
  type TypingSession,
} from '@core/sessions'
import { accuracy, milliseconds, sessionId, timestamp, wpm } from '@core/types'

import { historyStore } from '../state/history.store.ts'
import { HistoryPage } from './HistoryPage.tsx'

const makeSession = (index: number): TypingSession => ({
  id: sessionId(`history-page-${index}`),
  startedAt: timestamp(1_700_000_000_000 + index * 60_000),
  completedAt: timestamp(1_700_000_010_000 + index * 60_000),
  durationMs: milliseconds(10_000),
  text: 'the quick brown fox',
  textSourceId: 'common-words',
  context: DEFAULT_SESSION_CONTEXT,
  metrics: {
    netWpm: wpm(100 + index),
    rawWpm: wpm(104 + index),
    accuracy: accuracy(0.97),
    totalCharacters: 19,
    typedCharacters: 20,
    correctCharacters: 19,
    incorrectCharacters: 0,
    correctedCharacters: 1,
    errorCount: 1,
  },
  status: 'completed',
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <HistoryPage />
    </MemoryRouter>,
  )

const rows = () => screen.getAllByRole('button', { name: /^delete the test from/i })

beforeEach(async () => {
  await sessionService.clear()
  historyStore.setState({ sessions: [], total: 0, status: 'idle', lastDeleted: null })
  for (const index of [1, 2, 3]) {
    // Sequential so the index is written in a known order.
    // eslint-disable-next-line no-await-in-loop
    await sessionService.save(makeSession(index))
  }
})

describe('history page', () => {
  it('deletes a row only once the question is confirmed, and can undo it', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(rows()).toHaveLength(3)
    })

    await user.click(rows()[0] as HTMLElement)
    const question = screen.getByRole('group', { name: 'Delete this test?' })
    expect(rows()).toHaveLength(2) // the first row's trigger became the question
    expect(await sessionService.count()).toBe(3)

    await user.click(within(question).getByRole('button', { name: 'Delete' }))

    await waitFor(async () => {
      expect(await sessionService.count()).toBe(2)
    })
    expect(screen.getByRole('status')).toHaveTextContent('Deleted 1 test.')

    await user.click(screen.getByRole('button', { name: 'Undo' }))

    await waitFor(async () => {
      expect(await sessionService.count()).toBe(3)
    })
    await waitFor(() => {
      expect(rows()).toHaveLength(3)
    })
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('names how much Clear history will remove before removing it, and can undo it', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(rows()).toHaveLength(3)
    })

    await user.click(screen.getByRole('button', { name: /clear history/i }))
    const question = screen.getByRole('group', { name: 'Delete all 3 tests?' })
    expect(await sessionService.count()).toBe(3)

    await user.click(within(question).getByRole('button', { name: 'Delete all' }))

    await waitFor(async () => {
      expect(await sessionService.count()).toBe(0)
    })
    expect(screen.getByRole('status')).toHaveTextContent('Deleted 3 tests.')

    await user.click(screen.getByRole('button', { name: 'Undo' }))

    await waitFor(async () => {
      expect(await sessionService.count()).toBe(3)
    })
  })

  it('says what was deleted once to a screen reader, not twice', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => {
      expect(rows()).toHaveLength(3)
    })

    await user.click(rows()[0] as HTMLElement)
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByRole('button', { name: 'Undo' })

    // The status region carries the message; the visible copy beside the
    // buttons is hidden from assistive technology so it is not read again.
    const exposed = screen
      .getAllByText('Deleted 1 test.')
      .filter((element) => element.closest('[aria-hidden="true"]') === null)
    expect(exposed).toEqual([screen.getByRole('status')])
  })
})

/**
 * Statistics page tests.
 *
 * The figures themselves are covered exhaustively in `@core/statistics`. What
 * matters here is that the page shows what is stored, admits when it has too
 * little to say, and moves between ranges — with expected values read off the
 * fixtures rather than restated as literals.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_SESSION_CONTEXT,
  sessionService,
  type TypingSession,
} from '@core/sessions'
import { accuracy, milliseconds, sessionId, timestamp, wpm } from '@core/types'

import { formatTotalTime } from './format.ts'
import { StatisticsPage } from './pages/StatisticsPage.tsx'

const DAY_MS = 24 * 60 * 60 * 1000

let counter = 0

const session = (fixture: {
  completedAt: number
  netWpm?: number
  rawWpm?: number
  accuracy?: number
  durationMs?: number
  errorCount?: number
  correctedCharacters?: number
  typedCharacters?: number
}): TypingSession => {
  counter += 1

  return {
    id: sessionId(`stats-session-${counter}`),
    startedAt: timestamp(Math.max(0, fixture.completedAt - 10_000)),
    completedAt: timestamp(fixture.completedAt),
    durationMs: milliseconds(fixture.durationMs ?? 10_000),
    text: 'the quick brown fox',
    textSourceId: 'common-words',
    context: DEFAULT_SESSION_CONTEXT,
    metrics: {
      netWpm: wpm(fixture.netWpm ?? 100),
      rawWpm: wpm(fixture.rawWpm ?? 110),
      accuracy: accuracy(fixture.accuracy ?? 0.95),
      totalCharacters: 19,
      typedCharacters: fixture.typedCharacters ?? 100,
      correctCharacters: 19,
      incorrectCharacters: 0,
      correctedCharacters: fixture.correctedCharacters ?? 2,
      errorCount: fixture.errorCount ?? 5,
    },
    status: 'completed',
  }
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <StatisticsPage />
    </MemoryRouter>,
  )

/**
 * The headline average.
 *
 * Queried through its unit label rather than by text: with a single session the
 * mean, median and best are the same number, so a bare text match is ambiguous.
 */
const heroValue = (): string =>
  screen.getByText('average wpm').parentElement?.querySelector('span')?.textContent ??
  ''

/** Reads a tile value by its label. */
const tileValue = (label: string): string => {
  const term = screen.getAllByText(label).find((element) => element.tagName === 'DT')
  return term?.parentElement?.querySelector('dd')?.textContent ?? ''
}

describe('statistics page', () => {
  beforeEach(async () => {
    await sessionService.clear()
  })

  it('invites a first test when nothing is recorded', async () => {
    renderPage()

    expect(await screen.findByText(/no tests recorded yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /take one/i })).toBeInTheDocument()
  })

  it('refuses to draw a trend from a single test', async () => {
    await sessionService.save(session({ completedAt: Date.now() - 1000, netWpm: 128 }))

    renderPage()

    expect(await screen.findByText(/one test in this range/i)).toBeInTheDocument()
    // The figure itself is still a fact worth showing.
    expect(heroValue()).toBe('128')
    expect(screen.queryByRole('img', { name: /speed across/i })).not.toBeInTheDocument()
  })

  it('reports no consistency from a single test', async () => {
    await sessionService.save(session({ completedAt: Date.now() - 1000 }))

    renderPage()
    await screen.findByText(/one test in this range/i)

    // A dash, not a zero: repeatability across one measurement is undefined.
    expect(tileValue('Consistency')).toBe('—')
  })

  it('summarises several tests', async () => {
    const now = Date.now()
    const sessions = [
      session({
        completedAt: now - 3 * DAY_MS,
        netWpm: 100,
        rawWpm: 110,
        accuracy: 0.9,
        durationMs: 10_000,
        errorCount: 8,
        typedCharacters: 80,
      }),
      session({
        completedAt: now - 2 * DAY_MS,
        netWpm: 120,
        rawWpm: 130,
        accuracy: 1,
        durationMs: 20_000,
        errorCount: 0,
        typedCharacters: 100,
      }),
      session({
        completedAt: now - 1 * DAY_MS,
        netWpm: 140,
        rawWpm: 150,
        accuracy: 0.95,
        durationMs: 30_000,
        errorCount: 4,
        typedCharacters: 120,
      }),
    ]
    await Promise.all(sessions.map((record) => sessionService.save(record)))

    renderPage()
    await screen.findByText('Tests')

    expect(tileValue('Tests')).toBe('3')
    expect(heroValue()).toBe('120') // mean of 100 120 140
    expect(tileValue('Median wpm')).toBe('120')
    expect(tileValue('Average raw wpm')).toBe('130') // mean of 110 130 150
    expect(tileValue('Best accuracy')).toBe('100%')
    expect(tileValue('Errors')).toBe('12') // 8 + 0 + 4
    expect(tileValue('Errors per test')).toBe('4.0')
    expect(tileValue('Characters typed')).toBe('300') // 80 + 100 + 120
    expect(tileValue('Typing time')).toBe(formatTotalTime(60_000))
  })

  it('draws a trend once there are several tests', async () => {
    const now = Date.now()
    await Promise.all(
      [
        session({ completedAt: now - 2 * DAY_MS, netWpm: 110 }),
        session({ completedAt: now - 1 * DAY_MS, netWpm: 130 }),
      ].map((record) => sessionService.save(record)),
    )

    renderPage()
    await screen.findByText('Tests')

    // The description carries the shape for anyone who cannot see it.
    expect(
      screen.getByRole('img', { name: /speed across 2 tests, from 110 to 130/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /accuracy across 2 tests/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /tests per day/i })).toBeInTheDocument()
  })

  it('offers the same numbers as a table, not only as a picture', async () => {
    const now = Date.now()
    await Promise.all(
      [
        session({ completedAt: now - 2 * DAY_MS, netWpm: 110 }),
        session({ completedAt: now - 1 * DAY_MS, netWpm: 130 }),
      ].map((record) => sessionService.save(record)),
    )

    renderPage()
    await screen.findByText('Tests')

    const speedTable = screen.getByRole('table', { name: 'Speed' })
    expect(within(speedTable).getByText('110 wpm')).toBeInTheDocument()
    expect(within(speedTable).getByText('130 wpm')).toBeInTheDocument()
  })

  it('narrows to today when asked', async () => {
    const now = Date.now()
    await Promise.all(
      [
        session({ completedAt: now - 3 * DAY_MS, netWpm: 100 }),
        session({ completedAt: now - 1000, netWpm: 160 }),
      ].map((record) => sessionService.save(record)),
    )

    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Tests')
    expect(tileValue('Tests')).toBe('2')

    await user.click(screen.getByRole('button', { name: 'Today' }))

    expect(tileValue('Tests')).toBe('1')
    expect(heroValue()).toBe('160')
  })

  it('widens to all time when asked', async () => {
    const now = Date.now()
    await Promise.all(
      [
        session({ completedAt: now - 300 * DAY_MS, netWpm: 60 }),
        session({ completedAt: now - 1000, netWpm: 140 }),
      ].map((record) => sessionService.save(record)),
    )

    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Tests')
    expect(tileValue('Tests')).toBe('1') // last 7 days by default

    await user.click(screen.getByRole('button', { name: 'All time' }))

    expect(tileValue('Tests')).toBe('2')
    expect(heroValue()).toBe('100') // mean of 60 and 140
  })

  it('says when a range is empty rather than showing zeroes', async () => {
    await sessionService.save(session({ completedAt: Date.now() - 300 * DAY_MS }))

    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('button', { name: 'Today' })

    await user.click(screen.getByRole('button', { name: 'Today' }))

    expect(screen.getByText(/no tests in this range/i)).toBeInTheDocument()
    // No invented averages.
    expect(screen.queryByText('Median wpm')).not.toBeInTheDocument()
  })

  it('marks the selected range for assistive technology', async () => {
    await sessionService.save(session({ completedAt: Date.now() - 1000 }))

    renderPage()
    await screen.findByRole('button', { name: 'Last 7 days' })

    expect(screen.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('does not alter the stored sessions it reports on', async () => {
    const now = Date.now()
    const stored = [
      session({ completedAt: now - 2 * DAY_MS, netWpm: 140 }),
      session({ completedAt: now - 1 * DAY_MS, netWpm: 100 }),
    ]
    await Promise.all(stored.map((record) => sessionService.save(record)))

    renderPage()
    await screen.findByText('Tests')

    // History is a record of what happened; statistics read it and leave it be.
    const after = await sessionService.getAll()
    expect(after.map((s) => s.metrics.netWpm).sort()).toEqual([100, 140])
    expect(after).toHaveLength(2)
  })
})

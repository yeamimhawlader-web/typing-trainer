/**
 * Drill page tests.
 *
 * Generation is covered in `@core/text` and measurement in `@core/telemetry`.
 * What matters here is the join: the right text loads, the session is recorded
 * as a drill for the right sequence, the ordinary metrics still work, and the
 * baseline the result is compared against was captured before anything was
 * typed.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { ROUTES } from '@app/routes.ts'
import { createTypingEngine } from '@core/engine'
import { createMemoryAdapter, type StorageAdapter } from '@core/persistence'
import {
  createSessionServiceOver,
  createTypingSession,
  DEFAULT_SESSION_CONTEXT,
  type SessionService,
} from '@core/sessions'
import { createTelemetryServiceOver, type TelemetryService } from '@core/telemetry'
import { timestamp } from '@core/types'

import { DrillPage } from './pages/DrillPage.tsx'

let storage: StorageAdapter
let sessions: SessionService
let telemetry: TelemetryService

beforeEach(() => {
  storage = createMemoryAdapter()
  sessions = createSessionServiceOver(storage)
  telemetry = createTelemetryServiceOver(storage)
})

const renderDrill = (sequence: string) =>
  render(
    <MemoryRouter initialEntries={[`/drill/${sequence}`]}>
      <Routes>
        <Route
          path={ROUTES.drill}
          element={<DrillPage service={sessions} telemetry={telemetry} />}
        />
      </Routes>
    </MemoryRouter>,
  )

const surface = (): HTMLElement => {
  const element = screen
    .getByRole('region', { name: 'Typing test' })
    .querySelector('[data-status]')
  if (!(element instanceof HTMLElement)) throw new Error('typing surface not found')
  return element
}

const drillText = (): string => surface().textContent ?? ''

/** Records an ordinary practice session in which `sequence` was typed slowly. */
const recordPractice = async (text: string, gapMs: number, slowPair: number) => {
  const engine = createTypingEngine()
  engine.start({ text, sourceId: 'common-words' }, timestamp(0))

  const characters = Array.from(text)
  let at = 0
  characters.forEach((key, index) => {
    const pair = index === 0 ? '' : `${characters[index - 1] as string}${key}`
    at += index === 0 ? 0 : pair === 'in' ? slowPair : gapMs
    engine.input(key, timestamp(at))
  })

  const result = engine.toResult()
  const session = createTypingSession({
    result: result!,
    context: DEFAULT_SESSION_CONTEXT,
    completedAt: timestamp(Date.now()),
  })

  await sessions.save(session)
  await telemetry.save(session.id, telemetry.capture(result!))
}

describe('drill page', () => {
  describe('choosing the material', () => {
    it('loads text built around the requested sequence', async () => {
      renderDrill('in')

      await screen.findByRole('region', { name: 'Typing test' })
      const words = drillText().split(' ')

      expect(words.length).toBeGreaterThan(20)
      // Most of the words carry the target; that is the whole point of it.
      expect(words.filter((word) => word.includes('in')).length).toBeGreaterThan(
        words.length / 3,
      )
    })

    it('uses several different words rather than repeating one', async () => {
      renderDrill('in')
      await screen.findByRole('region', { name: 'Typing test' })

      const carriers = drillText()
        .split(' ')
        .filter((word) => word.includes('in'))

      expect(new Set(carriers).size).toBeGreaterThan(4)
    })

    it('names the sequence instead of offering a length control', async () => {
      renderDrill('in')
      await screen.findByRole('region', { name: 'Typing test' })

      // A drill is fixed material; a 15/30/60 choice would either do nothing or
      // silently regenerate it.
      expect(screen.queryByRole('button', { name: '60' })).not.toBeInTheDocument()
      expect(screen.getByText('Drill')).toBeInTheDocument()
    })

    it('declines when no word contains the sequence', async () => {
      renderDrill('zq')

      expect(
        await screen.findByRole('heading', { name: /no drill for that sequence/i }),
      ).toBeInTheDocument()
      expect(screen.getByText(/inventing words/i)).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Typing test' })).not.toBeInTheDocument()
    })

    it('declines a sequence that is not two characters', async () => {
      renderDrill('ing')

      expect(
        await screen.findByRole('heading', { name: /no drill for that sequence/i }),
      ).toBeInTheDocument()
      expect(screen.getByText(/exactly two characters/i)).toBeInTheDocument()
    })
  })

  describe('a completed drill', () => {
    it('records the session as a drill for that sequence', async () => {
      const user = userEvent.setup({ delay: null })
      renderDrill('in')
      await screen.findByRole('region', { name: 'Typing test' })

      await user.keyboard(drillText())

      await waitFor(async () => {
        expect(await sessions.getAll()).toHaveLength(1)
      })

      const [stored] = await sessions.getAll()
      expect(stored?.context.mode).toBe('drill')
      expect(stored?.context.targetSequence).toBe('in')
      expect(stored?.textSourceId).toBe('drill')
    })

    it('still measures speed and accuracy the ordinary way', async () => {
      const user = userEvent.setup({ delay: null })
      renderDrill('in')
      await screen.findByRole('region', { name: 'Typing test' })

      const text = drillText()
      await user.keyboard(text)

      await waitFor(async () => {
        expect(await sessions.getAll()).toHaveLength(1)
      })

      const [stored] = await sessions.getAll()
      // Everything typed correctly, so the ordinary metrics say so — a drill is
      // a typing test, not a separate kind of measurement.
      expect(stored?.metrics.accuracy).toBe(1)
      expect(stored?.metrics.correctCharacters).toBe(text.length)
      expect(stored?.status).toBe('completed')
      expect(stored?.metrics.netWpm).toBeGreaterThan(0)
    })

    it('shows the drill result with its evidence', async () => {
      const user = userEvent.setup({ delay: null })
      renderDrill('in')
      await screen.findByRole('region', { name: 'Typing test' })

      const text = drillText()
      await user.keyboard(text)

      const heading = await screen.findByRole('heading', { name: /drill result/i })
      const section = heading.closest('section')

      expect(section).toHaveTextContent('in')
      expect(section).toHaveTextContent(/occurrences in this drill/i)
      expect(section).toHaveTextContent(/typed cleanly/i)
    })

    it('keeps the language neutral about what it means', async () => {
      const user = userEvent.setup({ delay: null })
      renderDrill('in')
      await screen.findByRole('region', { name: 'Typing test' })

      await user.keyboard(drillText())
      await screen.findByRole('heading', { name: /drill result/i })

      const page = document.body.textContent ?? ''
      expect(page).not.toMatch(/you fixed|weakness|mastered|improved your|well done/i)
    })

    it('does not rank the drill text as though it described the typist', async () => {
      const user = userEvent.setup({ delay: null })
      renderDrill('in')
      await screen.findByRole('region', { name: 'Typing test' })

      await user.keyboard(drillText())
      await screen.findByRole('heading', { name: /drill result/i })

      // The text was built to be lopsided, so its slowest sequences would be a
      // report of the drill's design rather than a measurement of anything.
      expect(
        screen.queryByRole('heading', { name: /slowest observed sequences/i }),
      ).not.toBeInTheDocument()
    })

    it('offers a way back to ordinary practice', async () => {
      const user = userEvent.setup({ delay: null })
      renderDrill('in')
      await screen.findByRole('region', { name: 'Typing test' })

      await user.keyboard(drillText())
      await screen.findByRole('heading', { name: /drill result/i })

      expect(screen.getByRole('link', { name: /back to practice/i })).toHaveAttribute(
        'href',
        ROUTES.practice,
      )
    })
  })

  describe('the baseline it compares against', () => {
    it('says so plainly when there is no earlier record', async () => {
      const user = userEvent.setup({ delay: null })
      renderDrill('in')
      await screen.findByRole('region', { name: 'Typing test' })

      await user.keyboard(drillText())
      await screen.findByRole('heading', { name: /drill result/i })

      expect(screen.getByText(/no earlier record of this transition/i)).toBeInTheDocument()
    })

    it('uses the typist’s earlier ordinary sessions', async () => {
      // Two practice sessions in which "in" ran at 200 ms against an 80 ms
      // background, so the baseline for "in" is 200.
      await recordPractice('in find into stop', 80, 200)
      await recordPractice('in find into stop', 80, 200)

      const user = userEvent.setup({ delay: null })
      renderDrill('in')
      await screen.findByRole('region', { name: 'Typing test' })

      await user.keyboard(drillText())
      const heading = await screen.findByRole('heading', { name: /drill result/i })

      expect(heading.closest('section')).toHaveTextContent('200 ms')
      expect(screen.getByText(/not proof of a lasting change/i)).toBeInTheDocument()
    })

    it('ignores earlier drills, which are not ordinary typing', async () => {
      await recordPractice('in find into stop', 80, 200)

      // A previous drill for the same sequence, typed much faster. Letting it
      // count would drag the baseline towards drill performance and turn the
      // comparison into drill-against-drill.
      const engine = createTypingEngine()
      const text = 'in find into stop'
      engine.start({ text, sourceId: 'drill' }, timestamp(0))
      Array.from(text).forEach((key, index) => {
        engine.input(key, timestamp((index + 1) * 50))
      })
      const result = engine.toResult()
      const previousDrill = createTypingSession({
        result: result!,
        context: { ...DEFAULT_SESSION_CONTEXT, mode: 'drill', targetSequence: 'in' },
        completedAt: timestamp(Date.now()),
      })
      await sessions.save(previousDrill)
      await telemetry.save(previousDrill.id, telemetry.capture(result!))

      const user = userEvent.setup({ delay: null })
      renderDrill('in')
      await screen.findByRole('region', { name: 'Typing test' })

      await user.keyboard(drillText())
      const heading = await screen.findByRole('heading', { name: /drill result/i })

      // Still 200 from the single practice session, not pulled down to 50.
      expect(heading.closest('section')).toHaveTextContent('200 ms')
    })
  })
})

/**
 * Drill result tests.
 *
 * The page-level drill tests type a real drill, which a test types so fast that
 * the result always lands below any range. This covers the other wordings
 * directly, and the arithmetic a reader will check by eye.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { compareToBaseline, type DrillOutcome } from '@core/telemetry'

import { DrillResult } from './DrillResult.tsx'

const outcome = (medianMs: number | null): DrillOutcome => ({
  sequence: 'in',
  targetOccurrences: 24,
  correctTransitions: 22,
  medianMs,
  sessionMedianMs: 90,
})

const renderResult = (
  medianMs: number | null,
  baselineMs: number | null,
  range: { lowMs: number; highMs: number } | null,
) =>
  render(
    <DrillResult
      outcome={outcome(medianMs)}
      comparison={compareToBaseline(outcome(medianMs), baselineMs, range)}
    />,
  )

describe('drill result', () => {
  it('calls a difference inside the usual range normal variation', () => {
    renderResult(121, 128, { lowMs: 110.4, highMs: 139.6 })

    // −7 ms looks like progress on its own; the range beside it says otherwise.
    expect(screen.getByText('−7 ms')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Your ordinary tests usually have this transition between 110 and 140 ms. This drill is inside that range, so the difference is within normal variation.',
      ),
    ).toBeInTheDocument()
  })

  it('says a drill above the range is above it, without calling it worse', () => {
    renderResult(150, 128, { lowMs: 110, highMs: 140 })

    expect(screen.getByText(/this drill is above that range\.$/i)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/worse|regress/i)
  })

  it('says nothing about a range it does not have', () => {
    renderResult(121, 128, null)

    expect(screen.queryByText(/usually have this transition/i)).not.toBeInTheDocument()
    // The existing caveat still applies.
    expect(screen.getByText(/not proof of a lasting change/i)).toBeInTheDocument()
  })

  it('says nothing about a range when the drill had no clean timing to place', () => {
    renderResult(null, 128, { lowMs: 110, highMs: 140 })

    expect(screen.queryByText(/usually have this transition/i)).not.toBeInTheDocument()
  })
})

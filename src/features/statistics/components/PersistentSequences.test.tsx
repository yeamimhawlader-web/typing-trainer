/**
 * Persistent-sequence section tests.
 *
 * The ranking itself is covered in `@core/telemetry`. What matters here is that
 * the section gives whichever of its three answers is actually true — too
 * little history, nothing stood out, or these sequences — and never dresses one
 * up as another. Getting that wrong is how a screen ends up implying a finding
 * it does not have.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  PERSISTENT_THRESHOLDS,
  type PersistentSequenceReport,
  type SequenceEvidence,
} from '@core/telemetry'

import { PersistentSequences } from './PersistentSequences.tsx'

const evidence = (over: Partial<SequenceEvidence> = {}): SequenceEvidence => ({
  sequence: 'th',
  medianMs: 118,
  deltaMs: 24,
  observations: 42,
  sessions: 11,
  slowerSessions: 9,
  slowSessionRatio: 9 / 11,
  spread: { p25: 104, median: 118, p75: 131, iqr: 27 },
  perSessionMedians: [104, 110, 118, 121, 131],
  ...over,
})

const report = (over: Partial<PersistentSequenceReport> = {}): PersistentSequenceReport => ({
  candidates: [],
  baselineMs: 94,
  sessionsAnalysed: 11,
  sessionsWithTelemetry: 11,
  totalObservations: 1_800,
  distinctSequences: 210,
  metEvidenceThreshold: 14,
  thresholds: PERSISTENT_THRESHOLDS,
  hasEnoughHistory: true,
  ...over,
})

describe('persistent sequences section', () => {
  it('shows nothing at all while the analysis is still loading', () => {
    const { container } = render(<PersistentSequences report={null} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('says plainly when there is not enough history, and how much is needed', () => {
    render(
      <PersistentSequences
        report={report({ hasEnoughHistory: false, sessionsWithTelemetry: 2 })}
      />,
    )

    expect(screen.getByText(/not enough history yet/i)).toBeInTheDocument()
    // Both halves of the comparison, so the reader knows how far off they are.
    expect(screen.getByText(/at least 4 tests/i)).toBeInTheDocument()
    expect(screen.getByText(/and has 2/i)).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('says nothing stood out rather than showing an empty ranking', () => {
    render(<PersistentSequences report={report({ candidates: [] })} />)

    expect(screen.getByText(/nothing stood out across 11 tests/i)).toBeInTheDocument()
    // The count of sequences it was able to judge — so "nothing" reads as a
    // result rather than as a failure to look.
    expect(screen.getByText(/14 sequences with enough data/i)).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('shows the evidence behind every sequence it ranks', () => {
    render(<PersistentSequences report={report({ candidates: [evidence()] })} />)

    const row = screen.getByRole('listitem')

    expect(row).toHaveTextContent('th')
    expect(row).toHaveTextContent('118 ms')
    expect(row).toHaveTextContent('+24 ms vs baseline')
    expect(row).toHaveTextContent('42 observations across 11 tests')
    expect(row).toHaveTextContent('slower in 9 of 11')
  })

  it('states a delta that reconciles with the baseline it shows', () => {
    render(<PersistentSequences report={report({ candidates: [evidence()] })} />)

    // 118 − 94 = 24. A reader who subtracts must get the number on screen.
    expect(screen.getByRole('listitem')).toHaveTextContent('118 ms')
    expect(screen.getByText(/your own 94 ms typical transition/i)).toBeInTheDocument()
  })

  it('never calls a sequence a weakness or suggests practising it', () => {
    const { container } = render(
      <PersistentSequences report={report({ candidates: [evidence()] })} />,
    )

    const text = container.textContent ?? ''
    expect(text).not.toMatch(/weak|practise these|train|drill|you should/i)
    // And it says out loud what kind of measure this is.
    expect(text).toMatch(/heuristic measures, not a diagnosis/i)
  })

  it('caps the list rather than printing everything that qualified', () => {
    const many = Array.from({ length: 9 }, (_, index) =>
      evidence({ sequence: `s${index}`, deltaMs: 30 - index }),
    )

    render(<PersistentSequences report={report({ candidates: many })} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('describes the thresholds that were actually applied', () => {
    render(
      <PersistentSequences
        report={report({
          candidates: [evidence()],
          thresholds: { minimumObservations: 30, minimumSessions: 6, minimumSlowSessionRatio: 0.8 },
        })}
      />,
    )

    expect(screen.getByText(/at least 30 observations across 6 tests/i)).toBeInTheDocument()
  })
})

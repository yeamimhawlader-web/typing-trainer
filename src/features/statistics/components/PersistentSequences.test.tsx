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
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import {
  PERSISTENT_THRESHOLDS,
  type PersistentSequenceReport,
  type SequenceEvidence,
} from '@core/telemetry'

import { PersistentSequences } from './PersistentSequences.tsx'

/** The rows carry a link to a drill, so the component needs a router. */
const renderSection = (report: PersistentSequenceReport | null) =>
  render(
    <MemoryRouter>
      <PersistentSequences report={report} />
    </MemoryRouter>,
  )

const evidence = (over: Partial<SequenceEvidence> = {}): SequenceEvidence => ({
  sequence: 'th',
  medianMs: 118,
  deltaMs: 24,
  observations: 42,
  sessions: 11,
  slowerSessions: 9,
  slowSessionRatio: 9 / 11,
  relativeDelta: 24 / 94,
  expectedByChance: 0.01,
  tier: 'strong',
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
    const { container } = renderSection(null)

    expect(container).toBeEmptyDOMElement()
  })

  it('says plainly when there is not enough history, and how much is needed', () => {
    renderSection(report({ hasEnoughHistory: false, sessionsWithTelemetry: 2 }))

    expect(screen.getByText(/not enough history yet/i)).toBeInTheDocument()
    // Both halves of the comparison, so the reader knows how far off they are.
    expect(screen.getByText(/at least 4 tests/i)).toBeInTheDocument()
    expect(screen.getByText(/and has 2/i)).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('says nothing stood out rather than showing an empty ranking', () => {
    renderSection(report({ candidates: [] }))

    expect(screen.getByText(/nothing stood out across 11 tests/i)).toBeInTheDocument()
    // The count of sequences it was able to judge — so "nothing" reads as a
    // result rather than as a failure to look.
    expect(screen.getByText(/14 sequences with enough data/i)).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('shows the evidence behind every sequence it ranks', () => {
    renderSection(report({ candidates: [evidence()] }))

    const row = screen.getByRole('listitem')

    expect(row).toHaveTextContent('th')
    expect(row).toHaveTextContent('118 ms')
    expect(row).toHaveTextContent('+24 ms vs baseline')
    expect(row).toHaveTextContent('42 observations across 11 tests')
    expect(row).toHaveTextContent('slower in 9 of 11')
  })

  it('states a delta that reconciles with the baseline it shows', () => {
    renderSection(report({ candidates: [evidence()] }))

    // 118 − 94 = 24. A reader who subtracts must get the number on screen.
    expect(screen.getByRole('listitem')).toHaveTextContent('118 ms')
    expect(screen.getByText(/your own 94 ms typical transition/i)).toBeInTheDocument()
  })

  it('never calls a sequence a weakness, even while offering to train it', () => {
    const { container } = renderSection(report({ candidates: [evidence()] }))

    const text = container.textContent ?? ''
    // The row now carries a Train action, which is deliberate. What must not
    // come with it is language claiming the sequence is a defect, or telling
    // the reader what they ought to do about it.
    expect(text).not.toMatch(/weak|you should|fix your|improve your/i)
    expect(text).toMatch(/heuristic measures, not a diagnosis/i)
  })

  it('offers Train for a sequence with strong evidence, named for that sequence', () => {
    renderSection(report({ candidates: [evidence()] }))

    expect(screen.getByRole('heading', { name: 'Strong evidence' })).toBeInTheDocument()
    // Named per row, so a list of them is not a column of identical "Train"
    // links to a screen reader.
    const train = screen.getByRole('link', { name: 'Train th' })
    expect(train).toHaveAttribute('href', '/gg/drill/th')
    expect(train).toHaveTextContent('Train')
  })

  it('offers no drill when there is nothing ranked', () => {
    renderSection(report({ candidates: [] }))

    expect(screen.queryByRole('link', { name: /train|drill/i })).not.toBeInTheDocument()
  })

  describe('a possible finding', () => {
    const possible = evidence({
      sequence: 'ce',
      medianMs: 105,
      deltaMs: 11,
      relativeDelta: 11 / 94,
      expectedByChance: 0.3,
      tier: 'possible',
    })

    it('is labelled as needing more tests', () => {
      renderSection(report({ candidates: [evidence(), possible] }))

      expect(
        screen.getByRole('heading', { name: 'Possible — needs more tests' }),
      ).toBeInTheDocument()
    })

    it('gets no Train button, only a quiet way into a drill', () => {
      renderSection(report({ candidates: [possible] }))

      expect(screen.queryByRole('link', { name: /^train/i })).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Try a drill for ce' })).toHaveAttribute(
        'href',
        '/gg/drill/ce',
      )
    })

    it('still shows its evidence, so the reader can judge it', () => {
      renderSection(report({ candidates: [possible] }))

      const row = screen.getByRole('listitem')
      expect(row).toHaveTextContent('105 ms')
      expect(row).toHaveTextContent('+11 ms vs baseline')
      expect(row).toHaveTextContent('slower in 9 of 11')
    })

    it('says outright when nothing has strong evidence', () => {
      renderSection(report({ candidates: [possible] }))

      expect(screen.getByText(/no sequence has strong evidence yet/i)).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Strong evidence' })).not.toBeInTheDocument()
    })

    it('keeps the two tiers in separate lists', () => {
      renderSection(report({ candidates: [evidence(), possible] }))

      const [strongList, possibleList] = screen.getAllByRole('list')
      expect(strongList).toHaveTextContent('th')
      expect(strongList).not.toHaveTextContent('ce')
      expect(possibleList).toHaveTextContent('ce')
    })
  })

  it('explains what each tier requires, including how many sequences were checked', () => {
    renderSection(report({ candidates: [evidence()] }))

    expect(screen.getByText(/at least 20% slower than your typical transition/i)).toBeInTheDocument()
    expect(screen.getByText(/allowing for the 14 sequences checked/i)).toBeInTheDocument()
    expect(screen.getByText(/may turn out to be noise/i)).toBeInTheDocument()
    // Evidence, never certainty.
    expect(document.body.textContent).not.toMatch(/proven|certain|significant|confiden/i)
  })

  it('caps the list rather than printing everything that qualified', () => {
    const many = Array.from({ length: 9 }, (_, index) =>
      evidence({ sequence: `s${index}`, deltaMs: 30 - index }),
    )

    renderSection(report({ candidates: many }))

    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('describes the thresholds that were actually applied', () => {
    renderSection(
      report({
        candidates: [evidence()],
        thresholds: {
          minimumObservations: 30,
          minimumSessions: 6,
          minimumSlowSessionRatio: 0.8,
        },
      }),
    )

    expect(screen.getByText(/at least 30 observations across 6 tests/i)).toBeInTheDocument()
  })
})

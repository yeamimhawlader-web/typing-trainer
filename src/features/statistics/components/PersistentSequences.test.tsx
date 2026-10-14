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

    // The gap itself, so the reader knows how far off they are: 4 needed, 2 had.
    expect(screen.getByText(/take 2 more tests and this will show which letter pairs slow you down/i)).toBeInTheDocument()
    expect(screen.getByText(/one test can't tell a habit from a one-off/i)).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('says nothing stood out rather than showing an empty ranking', () => {
    renderSection(report({ candidates: [] }))

    expect(screen.getByText(/no letter pair stands out across your 11 tests/i)).toBeInTheDocument()
    // The count of pairs it was able to judge — so "nothing" reads as a result
    // rather than as a failure to look.
    expect(screen.getByText(/we checked 14/i)).toBeInTheDocument()
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('shows the evidence behind every sequence it ranks', () => {
    renderSection(report({ candidates: [evidence()] }))

    const row = screen.getByRole('listitem')

    expect(row).toHaveTextContent('th')
    expect(row).toHaveTextContent('118 ms')
    expect(row).toHaveTextContent('+24 ms vs your usual')
    expect(row).toHaveTextContent('seen 42 times in 11 tests')
    expect(row).toHaveTextContent('slower in 9')
  })

  it('states a delta that reconciles with the baseline it shows', () => {
    renderSection(report({ candidates: [evidence()] }))

    // 118 − 94 = 24. A reader who subtracts must get the number on screen —
    // on screen, not behind "How is this worked out?".
    expect(screen.getByRole('listitem')).toHaveTextContent('118 ms')
    const usual = screen.getByText(/compared with your usual 94 ms between keys/i)
    expect(usual.closest('details')).toBeNull()
  })

  it('never calls a sequence a weakness, even while offering to train it', () => {
    const { container } = renderSection(report({ candidates: [evidence()] }))

    const text = container.textContent ?? ''
    // The row now carries a Train action, which is deliberate. What must not
    // come with it is language claiming the sequence is a defect, or telling
    // the reader what they ought to do about it.
    expect(text).not.toMatch(/weak|you should|fix your|improve your/i)
    // And it says what a slow pair might be instead of what it is.
    expect(text).toMatch(/a pair can be slow because it's awkward to reach/i)
  })

  it('offers Train for a sequence with strong evidence, named for that sequence', () => {
    renderSection(report({ candidates: [evidence()] }))

    expect(screen.getByRole('heading', { name: 'Clear pattern' })).toBeInTheDocument()
    // Named per row, so a list of them is not a column of identical "Train"
    // links to a screen reader.
    const train = screen.getByRole('link', { name: 'Train th' })
    expect(train).toHaveAttribute('href', '/gg/drill/th')
    expect(train).toHaveTextContent('Train')
  })

  it('offers no drill for a sequence no practice word contains, such as one punctuation or numbers made', () => {
    // A dressed test times "e," and "19" like any other pair, and a capital
    // makes "Th" a pair of its own; none of them is in a word a drill is drawn
    // from, so a link would only lead to "nothing to build a drill from".
    renderSection(
      report({
        candidates: [
          evidence({ sequence: 'e,' }),
          evidence({ sequence: 'Th' }),
          evidence({ sequence: '19', tier: 'possible' }),
        ],
      }),
    )

    expect(screen.getByText('e,')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /train|drill/i })).not.toBeInTheDocument()
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
        screen.getByRole('heading', { name: 'Maybe — needs more tests' }),
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
      expect(row).toHaveTextContent('+11 ms vs your usual')
      expect(row).toHaveTextContent('slower in 9')
    })

    it('says outright when nothing has strong evidence', () => {
      renderSection(report({ candidates: [possible] }))

      expect(screen.getByText(/nothing clear yet/i)).toBeInTheDocument()
      expect(screen.getByText(/normal ups and downs of 11 tests/i)).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Clear pattern' })).not.toBeInTheDocument()
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

    expect(screen.getByText(/at least 20% slower than your usual time between keys/i)).toBeInTheDocument()
    expect(screen.getByText(/allowing for the 14 pairs we checked/i)).toBeInTheDocument()
    expect(screen.getByText(/may turn out to be nothing/i)).toBeInTheDocument()
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

    expect(screen.getByText(/at least 30 times across 6 tests/i)).toBeInTheDocument()
  })

  it('keeps how it is worked out one press away rather than in the way', () => {
    renderSection(report({ candidates: [evidence()] }))

    const how = screen.getByText('How is this worked out?')
    const details = how.closest('details')

    expect(how.tagName).toBe('SUMMARY')
    expect(details).not.toBeNull()
    expect(details).not.toHaveAttribute('open')
    expect(details).toHaveTextContent(/at least 20% slower/i)
  })
})

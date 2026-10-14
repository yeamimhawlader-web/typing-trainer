/**
 * The keyboard heatmap's words: what it says about a key, aloud and in the
 * "Most missed" line, has to name the key rather than print a bare mark.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { KeyCost, KeyCostReport } from '@core/telemetry'

import { KeyboardHeatmap } from './KeyboardHeatmap.tsx'

const cost = (key: string, misses: number): KeyCost => ({
  key,
  attempts: 20,
  misses,
  accuracy: (20 - misses) / 20,
  medianMs: 180,
})

const report = (keys: readonly KeyCost[]): KeyCostReport => ({
  keys,
  worst: keys.filter((key) => key.misses > 0),
  keysSeen: keys.length,
  attempts: keys.length * 20,
})

describe('keyboard heatmap', () => {
  it('names the marks punctuation and numbers add, rather than printing them bare', () => {
    const keys = [cost('?', 4), cost('!', 3), cost(':', 2), cost('%', 1), cost("'", 1), cost('"', 1), cost('-', 1)]
    render(<KeyboardHeatmap report={report(keys)} />)

    for (const name of [
      'Question mark',
      'Exclamation mark',
      'Colon',
      'Percent sign',
      'Apostrophe',
      'Quotation mark',
      'Hyphen',
    ]) {
      expect(screen.getByRole('rowheader', { name })).toBeInTheDocument()
    }
    expect(screen.getByText(/Most missed:/)).toHaveTextContent('Most missed: Question mark 80%')
  })

  it('still names a letter by its capital', () => {
    render(<KeyboardHeatmap report={report([cost('q', 2)])} />)

    expect(screen.getByRole('rowheader', { name: 'Q' })).toBeInTheDocument()
  })
})

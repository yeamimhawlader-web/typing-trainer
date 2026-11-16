/**
 * The sticky note: shown at ten words, once per ten, and never during a test.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createTypingEngine } from '@core/engine'
import { createGoldenNuggetService, type GoldenNuggetService } from '@core/nuggets'
import { createMemoryAdapter } from '@core/persistence'
import { timestamp } from '@core/types'

import { NuggetNote } from './NuggetNote.tsx'

const keep = async (service: GoldenNuggetService, count: number, from = 0): Promise<void> => {
  for (let index = from; index < from + count; index += 1) {
    // oxlint-disable-next-line no-await-in-loop
    await service.recordFocus({
      reason: 'mistakes',
      word: `word${index}`,
      language: 'en',
      difficulty: 'standard',
      cleared: false,
      mistakes: 3,
      at: 1_000 + index,
      testId: `test-${index}`,
    })
  }
}

const show = (service: GoldenNuggetService, engine = createTypingEngine()) => {
  render(
    <MemoryRouter>
      <NuggetNote service={service} engine={engine} />
    </MemoryRouter>,
  )
  return engine
}

describe('the Golden Nuggets sticky note', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(cleanup)

  it('is not there with fewer than ten words', async () => {
    const service = createGoldenNuggetService(createMemoryAdapter())
    await keep(service, 9)
    show(service)

    await expect(screen.findByText(/Golden Nuggets!/u, undefined, { timeout: 300 })).rejects.toThrow()
  })

  it('appears at ten, with a way to practise them', async () => {
    const service = createGoldenNuggetService(createMemoryAdapter())
    await keep(service, 10)
    show(service)

    expect(await screen.findByText(/10 Golden Nuggets!/u)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Practise them' }).getAttribute('href')).toBe('/gg/hover/nuggets')
  })

  it('once put away, stays away until the next ten', async () => {
    const service = createGoldenNuggetService(createMemoryAdapter())
    await keep(service, 12)
    show(service)
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }))
    expect(screen.queryByText(/Golden Nuggets!/u)).toBeNull()

    cleanup()
    show(service)
    await expect(screen.findByText(/Golden Nuggets!/u, undefined, { timeout: 300 })).rejects.toThrow()

    cleanup()
    await keep(service, 8, 12)
    show(service)
    expect(await screen.findByText(/20 Golden Nuggets!/u)).toBeTruthy()
  })

  it('steps aside when a test starts', async () => {
    const service = createGoldenNuggetService(createMemoryAdapter())
    await keep(service, 10)
    const engine = show(service)
    await screen.findByText(/10 Golden Nuggets!/u)

    engine.start({ text: 'the quick', sourceId: 'test' }, timestamp(1_000))

    await waitFor(() => expect(screen.queryByText(/Golden Nuggets!/u)).toBeNull())
  })
})

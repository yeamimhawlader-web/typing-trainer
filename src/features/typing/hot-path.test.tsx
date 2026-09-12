/**
 * Hot-path regression guard.
 *
 * The rule this file defends has been a constraint since the typing screen was
 * built: **a keystroke must not re-render the screen**. One character changes
 * state and the caret moves, so a handful of components update and the other
 * two hundred are untouched. It was verified by hand in a browser and by
 * nothing else, which made it a rule people had to remember rather than one the
 * build enforces.
 *
 * ## How renders are counted
 *
 * `useEngineValue` is called *during render*, once per subscription. So the
 * number of times it is invoked is the number of subscribed components that
 * rendered — not an approximation of it. React calls the selector again on
 * every store change to decide whether a value moved, but that happens inside
 * the closure `useSyncExternalStore` holds, not through this hook, so it does
 * not inflate the count.
 *
 * ## What the assertions actually say
 *
 * The load-bearing property is **O(1) in the length of the text**, and that is
 * what is asserted: the same keystrokes into a text twenty times longer must
 * not cost more. An absolute ceiling is asserted too, so an outright regression
 * fails even without the comparison.
 *
 * Measured when this was written: **5 renders per keystroke** into a 59
 * character text and **4.125** into a 1,199 character one — flat across a
 * twentyfold difference, and 2 class changes in the DOM either way (the
 * character just typed, and the caret moving on).
 *
 * ## Why both a render count and a DOM count
 *
 * They catch different failures, which was confirmed rather than assumed. A
 * deliberate regression — the surface subscribing to the cursor for a smooth
 * caret, and passing the array through inline so the memo below it stops
 * holding — took the render count from 4.125 to **2,401 per keystroke**, and
 * the DOM count did not move at all. React had reconciled to identical
 * markup, so all of that work was invisible downstream: wasted React renders
 * show up only in the render count, and excessive restyling only in the DOM
 * count. Neither probe alone is enough.
 *
 * This is what catches the realistic ways the visual work ahead could break it:
 * dropping the `useMemo` that keeps `characters` stable, lifting per-keystroke
 * state into a parent, a selector returning a fresh object or array, or a
 * motion library wrapping every character span. All of them turn a constant
 * into something that grows with the text, and all of them are invisible in a
 * screenshot.
 */

import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EngineSnapshot, TypingEngine } from '@core/engine'
import type { TextProvider } from '@core/text'

import { TypingTest } from './TypingTest.tsx'

/** Hoisted so the module mock below can reach it; `vi.mock` runs first. */
const probe = vi.hoisted(() => ({ renders: 0 }))

vi.mock('./hooks/useEngineValue.ts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./hooks/useEngineValue.ts')>()

  return {
    useEngineValue: <T,>(
      engine: TypingEngine,
      select: (snapshot: EngineSnapshot) => T,
    ): T => {
      probe.renders += 1
      return actual.useEngineValue(engine, select)
    },
  }
})

const WORDS = ['about', 'these', 'other', 'which', 'there', 'their', 'would', 'could']

/** Text of an exact word count, so length is the only variable between runs. */
const textOf = (wordCount: number): string =>
  Array.from({ length: wordCount }, (_, index) => WORDS[index % WORDS.length]).join(' ')

const fixedProvider = (text: string): TextProvider => ({
  id: 'fixed',
  label: 'Fixed',
  provide: () => ({ text, sourceId: 'fixed' }),
})

interface Measurement {
  readonly characters: number
  readonly rendersPerKeystroke: number
  readonly classChangesPerKeystroke: number
}

/**
 * Types into a text and reports the per-keystroke cost.
 *
 * The first character is typed before measuring: it starts the test, which
 * legitimately changes status and re-renders the wrapper. What is under test is
 * the steady state, not the transition into it.
 */
const measure = async (text: string, keystrokes: number): Promise<Measurement> => {
  const user = userEvent.setup({ delay: null })
  const { container, unmount } = render(
    <MemoryRouter>
      <TypingTest provider={fixedProvider(text)} />
    </MemoryRouter>,
  )

  await user.keyboard(text.slice(0, 1))

  // Counted in the callback, not only drained at the end: the observer
  // delivers on a microtask and `await user.keyboard` yields, so by the time
  // the run finishes most records have already been handed over and a lone
  // `takeRecords` would report zero — which is exactly what it did, passing
  // this test vacuously until the numbers were printed.
  let classChanges = 0
  const observer = new MutationObserver((records) => {
    classChanges += records.length
  })
  observer.observe(container, {
    attributes: true,
    subtree: true,
    attributeFilter: ['class'],
  })

  probe.renders = 0
  await user.keyboard(text.slice(1, 1 + keystrokes))

  // Plus anything still queued when typing stopped.
  classChanges += observer.takeRecords().length
  observer.disconnect()

  const renders = probe.renders
  unmount()

  return {
    characters: text.length,
    rendersPerKeystroke: renders / keystrokes,
    classChangesPerKeystroke: classChanges / keystrokes,
  }
}

/**
 * Generous on purpose. The point is the difference between a constant and
 * something proportional to the text, not the exact constant — a number pinned
 * so tightly that ordinary refactoring trips it would get deleted rather than
 * fixed, and then this file would be worth nothing.
 */
const CEILING_PER_KEYSTROKE = 24

describe('typing hot path', () => {
  beforeEach(() => {
    probe.renders = 0
  })

  it('costs no more per keystroke in a long text than a short one', async () => {
    const short = await measure(textOf(10), 8)
    const long = await measure(textOf(200), 8)

    // Twenty times the text, and the same work per keystroke. This is the whole
    // performance strategy stated as an assertion.
    expect(long.characters).toBeGreaterThan(short.characters * 15)
    expect(long.rendersPerKeystroke).toBeLessThanOrEqual(short.rendersPerKeystroke)
  })

  it('re-renders a handful of components per keystroke, not the text', async () => {
    const long = await measure(textOf(200), 8)

    expect(long.rendersPerKeystroke).toBeLessThan(CEILING_PER_KEYSTROKE)
    // Stated against the text size as well, so the failure message says how far
    // out it went rather than just that a magic number was exceeded.
    expect(long.rendersPerKeystroke).toBeLessThan(long.characters / 10)
  })

  it('touches only a few elements in the DOM per keystroke', async () => {
    const long = await measure(textOf(200), 8)

    // React work is one cost; making the browser restyle a thousand spans is
    // another, and a screenshot hides both. A keystroke changes the character
    // just typed and moves the caret, so a small number of class changes.
    expect(long.classChangesPerKeystroke).toBeLessThan(CEILING_PER_KEYSTROKE)
  })

  it('does not grow the per-keystroke cost as the test progresses', async () => {
    const text = textOf(200)
    const user = userEvent.setup({ delay: null })
    render(
      <MemoryRouter>
        <TypingTest provider={fixedProvider(text)} />
      </MemoryRouter>,
    )

    await user.keyboard(text.slice(0, 1))

    probe.renders = 0
    await user.keyboard(text.slice(1, 11))
    const early = probe.renders

    await user.keyboard(text.slice(11, 61))

    probe.renders = 0
    await user.keyboard(text.slice(61, 71))
    const late = probe.renders

    // Sixty characters in, a keystroke must cost what it cost at the start.
    // Anything accumulating per-character subscriptions or growing a list would
    // show up here and nowhere else.
    expect(late).toBeLessThanOrEqual(early)
  })
})

/**
 * Hot-path regression guard for GG.Typing.
 *
 * The same rule as the classic screen's guard in
 * `features/typing/hot-path.test.tsx` — a keystroke must not re-render the
 * screen — plus the one GG.Typing adds: a keystroke must not read layout. The
 * block cursor and the line position are moved from positions measured up
 * front, so typing asks the browser for no geometry at all.
 *
 * Renders are counted the same way: `useEngineValue` runs during render, once
 * per subscription, so the number of calls is the number of subscribed
 * components that rendered. Layout reads are counted at the source, on
 * `getBoundingClientRect` and the offset and client measurements, for every
 * element.
 *
 * Measured when this was written, in jsdom: 1.25 renders per keystroke into a
 * 59-character text and into a 1,199-character one alike — the character typed,
 * plus the word count on a space — and no layout reads at all.
 */

import { act, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EngineSnapshot, TypingEngine } from '@core/engine'
import { createMemoryAdapter } from '@core/persistence'
import { createSessionServiceOver } from '@core/sessions'
import { createTelemetryServiceOver } from '@core/telemetry'
import type { TextProvider } from '@core/text'

import { GGTypingScreen } from './screen/GGTypingScreen.tsx'

const probe = vi.hoisted(() => ({ renders: 0 }))

vi.mock('@features/typing/hooks/useEngineValue.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@features/typing/hooks/useEngineValue.ts')>()
  return {
    useEngineValue: <T,>(engine: TypingEngine, select: (snapshot: EngineSnapshot) => T): T => {
      probe.renders += 1
      return actual.useEngineValue(engine, select)
    },
  }
})

const WORDS = ['about', 'these', 'other', 'which', 'there', 'their', 'would', 'could']

const textOf = (wordCount: number): string =>
  Array.from({ length: wordCount }, (_, index) => WORDS[index % WORDS.length]).join(' ')

const fixedProvider = (text: string): TextProvider => ({
  id: 'fixed',
  label: 'Fixed',
  provide: () => ({ text, sourceId: 'fixed' }),
})

let now = 0
const layoutReads = { count: 0 }

beforeEach(() => {
  now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)

  layoutReads.count = 0
  const original = Element.prototype.getBoundingClientRect
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function read(this: Element) {
    layoutReads.count += 1
    return original.call(this)
  })
  for (const property of ['offsetWidth', 'offsetHeight', 'offsetTop', 'offsetLeft'] as const) {
    vi.spyOn(HTMLElement.prototype, property, 'get').mockImplementation(() => {
      layoutReads.count += 1
      return 0
    })
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

const renderScreen = (text: string, mode: 'standard' | 'hover' = 'standard') => {
  const adapter = createMemoryAdapter()
  return render(
    <MemoryRouter>
      <GGTypingScreen
        heading="Typing test"
        mode={mode}
        provider={fixedProvider(text)}
        service={createSessionServiceOver(adapter)}
        telemetry={createTelemetryServiceOver(adapter)}
      />
    </MemoryRouter>,
  )
}

const typeInto = (field: HTMLTextAreaElement, text: string) => {
  act(() => {
    for (const character of Array.from(text)) {
      now += 120
      field.dispatchEvent(
        new InputEvent('beforeinput', { inputType: 'insertText', data: character, bubbles: true, cancelable: true }),
      )
    }
  })
}

interface Measurement {
  readonly characters: number
  readonly rendersPerKeystroke: number
  readonly layoutReadsPerKeystroke: number
  /** Reads while the screen loaded, so a probe that sees nothing fails. */
  readonly layoutReadsOnLoad: number
}

/** The first character starts the test and is typed before measuring. */
const measure = (text: string, keystrokes: number): Measurement => {
  const { getByRole, unmount } = renderScreen(text)
  const field = getByRole('textbox', { name: 'Type the words above' }) as HTMLTextAreaElement
  const layoutReadsOnLoad = layoutReads.count

  typeInto(field, text.slice(0, 1))

  probe.renders = 0
  layoutReads.count = 0
  typeInto(field, text.slice(1, 1 + keystrokes))
  const renders = probe.renders
  const reads = layoutReads.count
  unmount()

  return {
    characters: text.length,
    rendersPerKeystroke: renders / keystrokes,
    layoutReadsPerKeystroke: reads / keystrokes,
    layoutReadsOnLoad,
  }
}

/** Generous, as in the classic guard: a constant against something proportional. */
const CEILING_PER_KEYSTROKE = 24

describe('GG.Typing hot path', () => {
  it('costs no more per keystroke in a long text than a short one', () => {
    const short = measure(textOf(10), 12)
    const long = measure(textOf(200), 12)

    // Guards the guard: a probe that counted nothing would pass forever.
    expect(short.rendersPerKeystroke).toBeGreaterThan(0)
    expect(long.characters).toBeGreaterThan(short.characters * 15)
    expect(long.rendersPerKeystroke).toBeLessThanOrEqual(short.rendersPerKeystroke)
    expect(long.rendersPerKeystroke).toBeLessThan(CEILING_PER_KEYSTROKE)
  })

  it('reads no layout while typing', () => {
    const long = measure(textOf(200), 24)

    // Positions are measured once, when the text loads…
    expect(long.layoutReadsOnLoad).toBeGreaterThan(long.characters)
    // …and never again while it is typed.
    expect(long.layoutReadsPerKeystroke).toBe(0)
  })

  it('does not grow the per-keystroke cost as the test goes on', () => {
    const text = textOf(200)
    const { getByRole } = renderScreen(text)
    const field = getByRole('textbox', { name: 'Type the words above' }) as HTMLTextAreaElement
    typeInto(field, text.slice(0, 1))

    probe.renders = 0
    typeInto(field, text.slice(1, 31))
    const early = probe.renders

    typeInto(field, text.slice(31, 301))

    probe.renders = 0
    typeInto(field, text.slice(301, 331))
    const late = probe.renders

    expect(late).toBeLessThanOrEqual(early)
  })
})

describe('GG.Typing hot path in Hover Mode', () => {
  /** Renders and layout reads per keystroke over `keys`, typed after `before`. */
  const measureHover = (text: string, before: string, keys: string) => {
    const { getByRole, unmount } = renderScreen(text, 'hover')
    const field = getByRole('textbox', { name: 'Type the words above' }) as HTMLTextAreaElement
    // Hover Mode is on, its glass node and all, for everything measured below.
    expect(document.querySelector('[data-open="true"]')).not.toBeNull()
    typeInto(field, before)

    probe.renders = 0
    layoutReads.count = 0
    typeInto(field, keys)
    const result = {
      rendersPerKeystroke: probe.renders / keys.length,
      layoutReadsPerKeystroke: layoutReads.count / keys.length,
    }
    unmount()
    return result
  }

  it('costs no more per keystroke than ordinary practice while nothing is focused', () => {
    const text = textOf(200)
    const ordinary = measure(text, 24)
    const hover = measureHover(text, text.slice(0, 1), text.slice(1, 25))

    expect(hover.rendersPerKeystroke).toBeLessThanOrEqual(ordinary.rendersPerKeystroke)
    expect(hover.layoutReadsPerKeystroke).toBe(0)
  })

  it('keeps repetitions cheap and flat, whatever the length of the text', () => {
    // "about" mistyped, left, then repeated.
    const short = measureHover(textOf(10), 'abxut ', 'about about ')
    const long = measureHover(textOf(200), 'abxut ', 'about about ')

    expect(short.rendersPerKeystroke).toBeGreaterThan(0)
    expect(long.rendersPerKeystroke).toBeLessThanOrEqual(short.rendersPerKeystroke)
    expect(long.rendersPerKeystroke).toBeLessThan(CEILING_PER_KEYSTROKE)
  })

  it('reads no layout through a whole focus: the mistake, the repetitions and the release', () => {
    const text = textOf(200)
    const whole = measureHover(text, 'a', 'bxut about about about these')

    expect(whole.layoutReadsPerKeystroke).toBe(0)
  })
})

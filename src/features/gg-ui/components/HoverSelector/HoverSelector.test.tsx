/**
 * Hover Mode's selector: the node, its three branches, and how they unfold and
 * fold between the two mode pages.
 *
 * jsdom has no layout and no animations, so both are supplied: element boxes
 * from a small table, and an `animate` that records what it was asked to play.
 * The clock is `performance.now`, which the selector and the Web Animations API
 * share. What it looks like was reviewed in a real browser; these pin down
 * behaviour — what is on the page in each state, what plays from where, that a
 * turn-around starts from the current state, and that nothing waits on motion.
 */

import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ROUTES } from '@app/routes.ts'
import type { HoverDifficulty } from '@core/types'
import { HOVER_DIFFICULTY_OPTIONS } from '@features/ggtyping'
import { SoundContext, type SoundEngine } from '@features/sound'

import { trajectoryAt } from '../Unfold/spring.ts'
import { createUnfoldMemory, UnfoldMemoryContext, type UnfoldMemory } from '../Unfold/unfold-memory.ts'
import { rowPose, UNFOLD_MOTION } from '../Unfold/unfold.motion.ts'

import { HoverSelector } from './HoverSelector.tsx'

// --- A clock, boxes and animations ------------------------------------

let now = 10_000

interface Played {
  readonly element: Element
  readonly keyframes: Keyframe[]
  startTime: number | null
  cancelled: boolean
}

let played: Played[] = []

const ROW_HEIGHT = 71

const boxOf = (element: Element): DOMRect => {
  const box = (left: number, top: number, width: number, height: number) =>
    ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }) as DOMRect
  if (element instanceof HTMLElement && element.dataset.open !== undefined) return box(100, 0, 110, 30)
  if (element.parentElement?.dataset.phase !== undefined) return box(0, 30, 900, ROW_HEIGHT)
  return box(0, 0, 0, 0)
}

const BRANCH_LEFT: Readonly<Record<string, number>> = { standard: 0, 'all-in': 190, tired: 380 }

beforeEach(() => {
  now = 10_000
  played = []
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function measure(this: Element) {
    return boxOf(this)
  })
  const branch = (element: HTMLElement) => element.dataset.branch
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function left(this: HTMLElement) {
    return BRANCH_LEFT[branch(this) ?? ''] ?? 0
  })
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function top(this: HTMLElement) {
    return branch(this) === undefined ? 0 : 18
  })
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function width(this: HTMLElement) {
    return branch(this) === undefined ? 0 : 180
  })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function height(this: HTMLElement) {
    return branch(this) === undefined ? 0 : 53
  })
  Element.prototype.animate = function animate(this: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes | null) {
    const record: Played = { element: this, keyframes: keyframes as Keyframe[], startTime: null, cancelled: false }
    played.push(record)
    return {
      set startTime(value: number | null) {
        record.startTime = value
      },
      get startTime() {
        return record.startTime
      },
      cancel: () => {
        record.cancelled = true
      },
    } as unknown as Animation
  }
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  // @ts-expect-error jsdom has no animate of its own; the one above goes again.
  delete Element.prototype.animate
  delete (window as { matchMedia?: unknown }).matchMedia
})

// --- Rendering both mode pages ----------------------------------------

/** A sound engine that only remembers what it was asked to play. */
const recordingSound = () => {
  const voices: string[] = []
  const sound = {
    isEnabled: () => true,
    play: (voice: string) => voices.push(voice),
    close: () => undefined,
  } as unknown as SoundEngine
  return { sound, voices }
}

const renderModes = (path: string, memory: UnfoldMemory = createUnfoldMemory(), difficulty: HoverDifficulty = 'all-in') => {
  const onDifficultyChange = vi.fn()
  const { sound, voices } = recordingSound()
  const rendered = render(
    <SoundContext value={sound}>
    <UnfoldMemoryContext value={memory}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={ROUTES.gg} element={<HoverSelector mode="standard" difficulty={difficulty} />} />
          <Route
            path={ROUTES.ggHover}
            element={<HoverSelector mode="hover" difficulty={difficulty} onDifficultyChange={onDifficultyChange} />}
          />
        </Routes>
      </MemoryRouter>
    </UnfoldMemoryContext>
    </SoundContext>,
  )
  return { ...rendered, memory, onDifficultyChange, voices }
}

const node = () => screen.getByRole('link', { name: /^Hover Mode/ })
const standard = () => screen.getByRole('link', { name: /^Standard/ })
const row = () => document.querySelector<HTMLElement>('[data-phase]')
const rowFrames = () => played.filter((record) => record.element === row() && !record.cancelled)
const heightOf = (frame: Keyframe | undefined) => Number.parseFloat(String(frame?.height))

const pressNode = () => {
  act(() => {
    fireEvent.pointerDown(node())
    fireEvent.click(node(), { detail: 1 })
  })
}

const pressStandard = () => {
  act(() => {
    fireEvent.click(standard(), { detail: 1 })
  })
}

describe("Hover Mode's selector", () => {
  describe('at rest', () => {
    it('is folded in Hover Mode until it is asked for: the node is lit and says which difficulty is on', () => {
      renderModes(ROUTES.ggHover, createUnfoldMemory(), 'all-in')

      expect(screen.queryByRole('radiogroup', { name: 'Hover difficulty' })).not.toBeInTheDocument()
      expect(row()).toBeNull()
      expect(node()).toHaveAttribute('data-open', 'true')
      expect(node()).toHaveAttribute('aria-current', 'page')
      expect(node()).toHaveAttribute('aria-expanded', 'false')
      expect(node()).toHaveTextContent('All In')
      // Reached without pressing anything: nothing plays.
      expect(played).toEqual([])
    })

    it('is folded shut in ordinary practice, and says nothing about difficulties there', () => {
      renderModes(ROUTES.gg)

      expect(screen.queryByRole('radiogroup', { name: 'Hover difficulty' })).not.toBeInTheDocument()
      expect(row()).toBeNull()
      expect(node()).toHaveAttribute('data-open', 'false')
      expect(node()).not.toHaveAttribute('aria-current')
      expect(node()).not.toHaveTextContent('All In')
      expect(standard()).toHaveAttribute('aria-current', 'page')
    })

    it('says only what each difficulty is: its name, its description and its beads, nothing invented', () => {
      renderModes(ROUTES.ggHover)
      pressNode()

      const group = screen.getByRole('radiogroup', { name: 'Hover difficulty' })
      expect(group.textContent).toBe(HOVER_DIFFICULTY_OPTIONS.map((option) => `${option.label}${option.description}`).join(''))
      const beads = HOVER_DIFFICULTY_OPTIONS.map((option) =>
        group.querySelector(`[data-branch="${option.value}"] [aria-hidden="true"]:not([class*="light"])`),
      )
      expect(beads.every((element) => element !== null)).toBe(true)
    })
  })

  describe('opening', () => {
    it("unfolds out of the node when Hover Mode is entered, from folded to open, on the press's own clock", () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      renderModes(ROUTES.gg)

      pressNode()

      expect(row()).toHaveAttribute('data-phase', 'opening')
      const [frames] = rowFrames()
      expect(heightOf(frames?.keyframes[0])).toBe(0)
      expect(heightOf(frames?.keyframes.at(-1))).toBe(ROW_HEIGHT)
      expect(frames?.startTime).toBe(now)

      // The node gives under the press: its glass and its light.
      const scales = played.filter((record) => String(record.keyframes[1]?.transform).startsWith('scale('))
      expect(scales.length).toBeGreaterThan(0)

      // The branches start at the node, small and unseen.
      const tired = played.find((record) => (record.element as HTMLElement).dataset.branch === 'tired')
      expect(tired?.keyframes[0]?.opacity).toBe('0')
      expect(String(tired?.keyframes[0]?.transform)).toMatch(/^translate\(-\d/)

      act(() => {
        now += 1000
        vi.advanceTimersByTime(1000)
      })

      expect(row()).toHaveAttribute('data-phase', 'open')
      // (The press on the node is a few hand-set keyframes that simply finish; the unfolding is sampled per frame.)
      const unfolding = played.filter((record) => record.keyframes.length > 5)
      expect(unfolding.length).toBeGreaterThan(0)
      expect(unfolding.every((record) => record.cancelled)).toBe(true)
    })

    it('can be chosen from while it is still unfolding: nothing waits for the motion', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const { onDifficultyChange } = renderModes(ROUTES.gg)

      pressNode()
      expect(row()).toHaveAttribute('data-phase', 'opening')
      act(() => {
        fireEvent.click(screen.getByRole('radio', { name: /^Tired/ }))
      })

      expect(onDifficultyChange).toHaveBeenCalledWith('tired')
    })

    it('is opened and folded again by the node itself, in Hover Mode', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      renderModes(ROUTES.ggHover)

      pressNode()
      expect(row()).toHaveAttribute('data-phase', 'opening')
      expect(node()).toHaveAttribute('aria-expanded', 'true')

      act(() => {
        now += 1000
        vi.advanceTimersByTime(1000)
      })
      pressNode()

      expect(row()).toHaveAttribute('data-phase', 'closing')
      expect(node()).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('closing', () => {
    it('folds away as soon as a difficulty is chosen, so the branches never sit there', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const { onDifficultyChange } = renderModes(ROUTES.ggHover)
      pressNode()
      act(() => {
        now += 1000
        vi.advanceTimersByTime(1000)
      })

      act(() => {
        fireEvent.click(screen.getByRole('radio', { name: /^Tired/ }))
      })

      expect(onDifficultyChange).toHaveBeenCalledWith('tired')
      expect(row()).toHaveAttribute('data-phase', 'closing')
      const [frames] = rowFrames()
      expect(heightOf(frames?.keyframes[0])).toBe(ROW_HEIGHT)
      expect(heightOf(frames?.keyframes.at(-1))).toBe(0)

      act(() => {
        now += 1000
        vi.advanceTimersByTime(1000)
      })
      expect(row()).toBeNull()
    })

    it('folds back into the node when ordinary practice is chosen, hidden from use as it goes', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      renderModes(ROUTES.ggHover)
      pressNode()
      act(() => {
        now += 1000
        vi.advanceTimersByTime(1000)
      })

      pressStandard()

      const folding = row()
      expect(folding).toHaveAttribute('data-phase', 'closing')
      expect(folding).toHaveAttribute('inert')
      expect(folding).toHaveAttribute('aria-hidden', 'true')
      expect(screen.queryByRole('radiogroup', { name: 'Hover difficulty' })).not.toBeInTheDocument()
      // The page under it is already ordinary practice.
      expect(standard()).toHaveAttribute('aria-current', 'page')

      act(() => {
        now += 1000
        vi.advanceTimersByTime(1000)
      })

      expect(row()).toBeNull()
    })

    it('turns around from wherever it is: closing mid-opening, and reopening mid-closing', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const { memory } = renderModes(ROUTES.gg)

      pressNode()
      const opening = memory.trajectory()
      expect(opening?.to).toBe(1)

      now += 90
      pressStandard()
      const closing = memory.trajectory()
      const where = trajectoryAt(opening!, now)
      expect(closing?.from).toEqual(where)
      expect(where.value).toBeGreaterThan(0.1)
      expect(where.value).toBeLessThan(1)
      expect(heightOf(rowFrames()[0]?.keyframes[0])).toBeCloseTo(heightOf(rowPose(where.value, { rowHeight: ROW_HEIGHT, node: { x: 0, y: 0 }, branches: [] })), 1)

      now += 60
      pressNode()
      const reopening = memory.trajectory()
      expect(reopening?.from).toEqual(trajectoryAt(closing!, now))
      expect(row()).toHaveAttribute('data-phase', 'opening')
    })
  })

  describe('sound', () => {
    it('plays as the selector opens and folds, on the press rather than the animation', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const { voices } = renderModes(ROUTES.gg)

      pressNode()
      expect(voices).toEqual(['selectorOpen'])

      pressStandard()
      expect(voices).toEqual(['selectorOpen', 'selectorClose'])
    })

    it('plays open and closed as the node is pressed in Hover Mode', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const { voices } = renderModes(ROUTES.ggHover)

      pressNode()
      expect(voices).toEqual(['selectorOpen'])

      act(() => {
        now += 1000
        vi.advanceTimersByTime(1000)
      })
      pressNode()

      expect(voices).toEqual(['selectorOpen', 'selectorClose'])
    })

    it('still sounds with reduced motion, where there is no animation to go with it', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
      const { voices } = renderModes(ROUTES.gg)

      pressNode()

      expect(voices).toEqual(['selectorOpen'])
    })
  })

  it('does not animate a mode arrived at any other way: a reload, the back button, another page', () => {
    const memory = createUnfoldMemory()
    memory.pressed(now - UNFOLD_MOTION.continuityMs - 1, 'other')
    renderModes(ROUTES.ggHover, memory)

    expect(row()).toBeNull()
    expect(played).toEqual([])
  })

  it('moves nothing when reduced motion is asked for, and loses nothing', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
    renderModes(ROUTES.gg)

    pressNode()
    expect(row()).toHaveAttribute('data-phase', 'open')
    expect(screen.getAllByRole('radio')).toHaveLength(3)

    pressStandard()
    expect(row()).toBeNull()
    expect(played).toEqual([])
  })

  describe('from the keyboard', () => {
    it('is reached in order — Standard, then the node — and arrow keys choose once it is open', async () => {
      const user = userEvent.setup()
      const { onDifficultyChange } = renderModes(ROUTES.ggHover, createUnfoldMemory(), 'standard')

      await user.tab()
      expect(standard()).toHaveFocus()
      await user.tab()
      expect(node()).toHaveFocus()

      await user.keyboard('{Enter}')
      await user.tab()
      expect(screen.getByRole('radio', { name: /^Standard:/ })).toHaveFocus()

      await user.keyboard('{ArrowRight}')
      expect(onDifficultyChange).toHaveBeenLastCalledWith('all-in')
    })

    it('opens Hover Mode with Enter on the node, unfolding just as a click does', async () => {
      const user = userEvent.setup()
      renderModes(ROUTES.gg)

      await user.tab()
      await user.tab()
      expect(node()).toHaveFocus()
      await user.keyboard('{Enter}')

      expect(row()).toHaveAttribute('data-phase', 'opening')
      expect(screen.getByRole('radiogroup', { name: 'Hover difficulty' })).toBeInTheDocument()
    })
  })
})

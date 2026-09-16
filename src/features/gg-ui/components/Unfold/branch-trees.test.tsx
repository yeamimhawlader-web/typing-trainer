/**
 * The branch trees: Hover Mode's difficulties and the sound packs are one
 * control, and only one of its trees is ever open.
 *
 * The store is tested as the plain object it is; the interaction through the
 * real toolbar, with both selectors in it. jsdom has no layout and no
 * animations, so both are supplied — boxes from a small table, an `animate`
 * that records what it was asked to play — and the clock is `performance.now`,
 * which the selectors and the Web Animations API share. How it looks was
 * reviewed in a real browser; these pin down what is open, what is played from
 * where and when, and that no sequence of presses ever leaves two trees out.
 */

import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ROUTES } from '@app/routes.ts'
import { SoundContext, type SoundEngine } from '@features/sound'

import { Toolbar } from '../Toolbar/Toolbar.tsx'
import { BranchTreesContext, createBranchTrees, type BranchTrees } from './branch-trees.ts'
import { UNFOLD_MOTION } from './unfold.motion.ts'

// --- A clock, boxes and animations ------------------------------------

let now = 50_000

interface Played {
  readonly element: Element
  readonly keyframes: Keyframe[]
  startTime: number | null
  cancelled: boolean
}

let played: Played[] = []

const ROW_HEIGHT: Readonly<Record<string, number>> = { hover: 71, sound: 50, pace: 64 }
const NODE_LEFT: Readonly<Record<string, number>> = { hover: 120, pace: 780, sound: 900 }

const box = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }) as DOMRect

const boxOf = (element: Element): DOMRect => {
  if (!(element instanceof HTMLElement)) return box(0, 0, 0, 0)
  const tree = element.dataset.branchTree
  if (tree !== undefined && element.dataset.branchNode !== undefined) return box(NODE_LEFT[tree] ?? 0, 0, 110, 30)
  // A row and its inner share one place: the row beneath the toolbar.
  const row = element.dataset.phase !== undefined ? element : element.parentElement
  if (row?.dataset.phase !== undefined) return box(0, 40, 1000, ROW_HEIGHT[row.dataset.branchTree ?? ''] ?? 0)
  return box(0, 0, 0, 0)
}

beforeEach(() => {
  now = 50_000
  played = []
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function measure(this: Element) {
    return boxOf(this)
  })
  const isBranch = (element: HTMLElement) => element.dataset.branch !== undefined
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function left(this: HTMLElement) {
    return isBranch(this) ? 100 : 0
  })
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function top(this: HTMLElement) {
    return isBranch(this) ? 18 : 0
  })
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function width(this: HTMLElement) {
    return isBranch(this) ? 150 : 0
  })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function height(this: HTMLElement) {
    return isBranch(this) ? 44 : 0
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

// --- The toolbar, with both trees in it -------------------------------

const renderToolbar = (trees: BranchTrees = createBranchTrees()) => {
  const voices: string[] = []
  const sound = {
    isEnabled: () => true,
    play: (voice: string) => voices.push(voice),
    preview: () => undefined,
    close: () => undefined,
  } as unknown as SoundEngine
  const onHoverDifficultyChange = vi.fn()
  const onSoundChange = vi.fn()
  const onPaceChange = vi.fn()
  const toolbar = (
    <Toolbar
      mode="hover"
      hoverDifficulty="standard"
      onHoverDifficultyChange={onHoverDifficultyChange}
      size="sm"
      onSizeChange={() => undefined}
      shape={null}
      sound="thock"
      onSoundChange={onSoundChange}
      soundVolume={80}
      onSoundVolumeChange={() => undefined}
      pace="off"
      onPaceChange={onPaceChange}
      paceTargets={{ average: 92, best: 118, push: 97, from: 12 }}
      paceWpm={null}
    />
  )
  render(
    <SoundContext value={sound}>
      <BranchTreesContext value={trees}>
        <MemoryRouter initialEntries={[ROUTES.ggHover]}>
          <Routes>
            <Route path={ROUTES.ggHover} element={toolbar} />
          </Routes>
        </MemoryRouter>
      </BranchTreesContext>
    </SoundContext>,
  )
  return { trees, voices, onHoverDifficultyChange, onSoundChange, onPaceChange }
}

const hoverNode = () => screen.getByRole('link', { name: /^Hover Mode/ })
const soundNode = () => screen.getByRole('button', { name: /^Sound:/ })
const paceNode = () => screen.getByRole('button', { name: /^Pace:/ })
const rowOf = (tree: string) => document.querySelector<HTMLElement>(`[data-phase][data-branch-tree="${tree}"]`)
const phaseOf = (tree: string) => rowOf(tree)?.dataset.phase ?? 'closed'
const heightFrames = (tree: string) =>
  played.filter((record) => record.element === rowOf(tree) && !record.cancelled && record.keyframes[0]?.height !== undefined)
const heightOf = (frame: Keyframe | undefined) => Number.parseFloat(String(frame?.height))
/** The trees' own radio groups, not the toolbar's other settings. */
const treeGroups = () =>
  screen
    .queryAllByRole('radiogroup')
    .filter((group) => ['Hover difficulty', 'Sound', 'Pace'].includes(group.getAttribute('aria-label') ?? ''))

const press = (node: HTMLElement) => {
  act(() => {
    fireEvent.pointerDown(node)
    fireEvent.click(node, { detail: 1 })
  })
}

const settle = () => {
  act(() => {
    now += 1000
    vi.advanceTimersByTime(1000)
  })
}

/** What no moment may ever show: more than one tree out, or more than one to choose from. */
const expectAtMostOneOpen = () => {
  const expanded = [hoverNode(), paceNode(), soundNode()].filter((node) => node.getAttribute('aria-expanded') === 'true')
  const growing = ['hover', 'pace', 'sound'].filter((tree) => phaseOf(tree) === 'opening' || phaseOf(tree) === 'open')
  const choosable = treeGroups()
  expect(expanded.length).toBeLessThanOrEqual(1)
  expect(growing.length).toBeLessThanOrEqual(1)
  expect(choosable.length).toBeLessThanOrEqual(1)
}

describe('the branch trees', () => {
  describe('as a store', () => {
    it('holds one open tree: opening another is the first one closing', () => {
      const trees = createBranchTrees()

      trees.open('hover', 1)
      expect(trees.active()).toBe('hover')
      trees.open('sound', 2)
      expect(trees.active()).toBe('sound')
      trees.toggle('sound', 3)
      expect(trees.active()).toBeNull()
    })

    it('closes a tree only if it is the open one', () => {
      const trees = createBranchTrees()
      trees.open('sound', 1)

      trees.close('hover')
      expect(trees.active()).toBe('sound')
      expect(trees.closeAll()).toBe('sound')
      expect(trees.closeAll()).toBeNull()
    })

    it("keeps the handover — who took over from whom, when, and the old row as it was — for the new tree only", () => {
      const trees = createBranchTrees()
      trees.registerRow('hover', () => ({ top: 40, height: 71 }))
      trees.open('hover', 10)
      expect(trees.handoverTo('hover')).toBeNull()

      trees.open('sound', 20)

      expect(trees.handoverTo('sound')).toEqual({ from: 'hover', to: 'sound', at: 20, row: { top: 40, height: 71 } })
      expect(trees.handoverTo('hover')).toBeNull()
    })

    it('tells its listeners only when the open tree changes', () => {
      const trees = createBranchTrees()
      const listener = vi.fn()
      trees.subscribe(listener)

      trees.open('hover', 1)
      trees.open('hover', 2)
      trees.close('sound')

      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('remembers what each tree was doing for as long as it lives', () => {
      const trees = createBranchTrees()

      expect(trees.memoryOf('sound')).toBe(trees.memoryOf('sound'))
      expect(trees.memoryOf('sound')).not.toBe(trees.memoryOf('hover'))
    })
  })

  describe('in the toolbar', () => {
    it("opens Hover Mode's tree, and only it", () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      renderToolbar()

      press(hoverNode())

      expect(phaseOf('hover')).toBe('opening')
      expect(phaseOf('sound')).toBe('closed')
      expect(hoverNode()).toHaveAttribute('aria-expanded', 'true')
      expect(soundNode()).toHaveAttribute('aria-expanded', 'false')
      expect(screen.getByRole('radiogroup', { name: 'Hover difficulty' })).toBeInTheDocument()
    })

    it("opens the sound tree, and only it", () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      renderToolbar()

      press(soundNode())

      expect(phaseOf('sound')).toBe('opening')
      expect(phaseOf('hover')).toBe('closed')
      expect(soundNode()).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('radiogroup', { name: 'Sound' })).toBeInTheDocument()
    })

    it('hands over from Hover Mode to sound: Hover folds at once, sound grows a beat later from the room Hover took', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      renderToolbar()
      press(hoverNode())
      settle()
      const pressedAt = now

      press(soundNode())

      expect(phaseOf('hover')).toBe('closing')
      expect(phaseOf('sound')).toBe('opening')
      expect(hoverNode()).toHaveAttribute('aria-expanded', 'false')
      expect(soundNode()).toHaveAttribute('aria-expanded', 'true')
      // The folding tree is no longer a choice; the growing one already is.
      expect(rowOf('hover')).toHaveAttribute('inert')
      expect(treeGroups().map((group) => group.getAttribute('aria-label'))).toEqual(['Sound'])

      const [folding] = heightFrames('hover')
      expect(folding?.startTime).toBe(pressedAt)
      expect(heightOf(folding?.keyframes[0])).toBe(ROW_HEIGHT.hover)
      expect(heightOf(folding?.keyframes.at(-1))).toBe(0)

      const [growing] = heightFrames('sound')
      expect(growing?.startTime).toBe(pressedAt + UNFOLD_MOTION.handover.delayMs)
      expect(heightOf(growing?.keyframes[0])).toBe(ROW_HEIGHT.hover)
      expect(heightOf(growing?.keyframes.at(-1))).toBe(ROW_HEIGHT.sound)

      settle()
      expect(rowOf('hover')).toBeNull()
      expect(phaseOf('sound')).toBe('open')
    })

    it('hands over from sound to Hover Mode the same way round', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      renderToolbar()
      press(soundNode())
      settle()
      const pressedAt = now

      press(hoverNode())

      expect(phaseOf('sound')).toBe('closing')
      expect(phaseOf('hover')).toBe('opening')
      const [growing] = heightFrames('hover')
      expect(growing?.startTime).toBe(pressedAt + UNFOLD_MOTION.handover.delayMs)
      expect(heightOf(growing?.keyframes[0])).toBe(ROW_HEIGHT.sound)
      expect(heightOf(growing?.keyframes.at(-1))).toBe(ROW_HEIGHT.hover)
    })

    it('takes the third tree, Pace, into the same rule: it takes over from sound, and Hover Mode from it', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      renderToolbar()
      press(soundNode())
      settle()
      const pressedAt = now

      press(paceNode())

      expect(phaseOf('sound')).toBe('closing')
      expect(phaseOf('pace')).toBe('opening')
      const [growing] = heightFrames('pace')
      expect(growing?.startTime).toBe(pressedAt + UNFOLD_MOTION.handover.delayMs)
      expect(heightOf(growing?.keyframes[0])).toBe(ROW_HEIGHT.sound)
      expect(heightOf(growing?.keyframes.at(-1))).toBe(ROW_HEIGHT.pace)

      settle()
      press(hoverNode())
      expect(phaseOf('pace')).toBe('closing')
      expect(phaseOf('hover')).toBe('opening')
      expect(paceNode()).toHaveAttribute('aria-expanded', 'false')
    })

    it('opens from nothing, at once, when no tree was out to take over from', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      renderToolbar()
      const pressedAt = now

      press(soundNode())

      const [growing] = heightFrames('sound')
      expect(growing?.startTime).toBe(pressedAt)
      expect(heightOf(growing?.keyframes[0])).toBe(0)
    })

    it('folds a tree whose own node is pressed again', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      renderToolbar()

      press(soundNode())
      settle()
      press(soundNode())
      expect(phaseOf('sound')).toBe('closing')

      press(hoverNode())
      settle()
      press(hoverNode())
      expect(phaseOf('hover')).toBe('closing')
      expect(hoverNode()).toHaveAttribute('aria-expanded', 'false')
    })

    it('folds a tree as soon as one of its branches is chosen', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const { onHoverDifficultyChange, onSoundChange } = renderToolbar()

      press(hoverNode())
      settle()
      act(() => {
        fireEvent.click(screen.getByRole('radio', { name: /^Tired/ }))
      })
      expect(onHoverDifficultyChange).toHaveBeenCalledWith('tired')
      expect(phaseOf('hover')).toBe('closing')

      settle()
      press(soundNode())
      settle()
      act(() => {
        fireEvent.click(screen.getByRole('radio', { name: /^Cream/ }))
      })
      expect(onSoundChange).toHaveBeenCalledWith('cream')
      expect(phaseOf('sound')).toBe('closing')
    })

    it('folds when the branch already chosen is pressed again, without choosing it a second time', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const { onHoverDifficultyChange, onSoundChange } = renderToolbar()

      press(hoverNode())
      settle()
      act(() => {
        fireEvent.click(screen.getByRole('radio', { name: /^Standard:/ }))
      })
      expect(phaseOf('hover')).toBe('closing')
      expect(onHoverDifficultyChange).not.toHaveBeenCalled()

      settle()
      press(soundNode())
      settle()
      act(() => {
        fireEvent.click(screen.getByRole('radio', { name: /^Thock/ }))
      })
      expect(phaseOf('sound')).toBe('closing')
      expect(onSoundChange).not.toHaveBeenCalled()
    })

    it('folds on a press anywhere that is not part of a tree, and not on a press inside one', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const { voices } = renderToolbar()
      press(soundNode())
      settle()

      act(() => {
        fireEvent.pointerDown(screen.getByRole('slider'))
      })
      expect(phaseOf('sound')).toBe('open')

      act(() => {
        fireEvent.pointerDown(document.body)
      })
      expect(phaseOf('sound')).toBe('closing')
      expect(voices.at(-1)).toBe('selectorClose')
    })

    it('folds on Escape, bringing focus back to the node from the branches', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      renderToolbar()
      press(hoverNode())
      settle()
      screen.getByRole('radio', { name: /^All In/ }).focus()

      act(() => {
        fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
      })

      expect(phaseOf('hover')).toBe('closing')
      expect(hoverNode()).toHaveFocus()
    })

    it('with reduced motion, switches in one frame: the new tree open, the old one gone, nothing played', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
      renderToolbar()

      press(hoverNode())
      expect(phaseOf('hover')).toBe('open')

      press(soundNode())
      expect(rowOf('hover')).toBeNull()
      expect(phaseOf('sound')).toBe('open')
      expect(played.filter((record) => record.keyframes.length > 5)).toEqual([])
    })

    it('never has two trees out, whatever is pressed in whatever order, mid-motion or at rest', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      renderToolbar()
      // A fixed, awkward sequence: switches mid-flight, repeats, dismissals, choices.
      const moves = [
        'hover', 'sound', 'pace', 'sound', 'hover', 'wait', 'pace', 'elsewhere', 'hover', 'hover', 'sound',
        'wait', 'choose', 'pace', 'escape', 'sound', 'hover', 'pace', 'wait', 'hover', 'choose', 'pace', 'pace',
      ] as const
      for (const move of moves) {
        if (move === 'hover') press(hoverNode())
        else if (move === 'sound') press(soundNode())
        else if (move === 'pace') press(paceNode())
        else if (move === 'wait') settle()
        else if (move === 'elsewhere') act(() => void fireEvent.pointerDown(document.body))
        else if (move === 'escape') act(() => void fireEvent.keyDown(document.body, { key: 'Escape' }))
        else {
          const radio = treeGroups()[0]?.querySelector('input')
          if (radio !== null && radio !== undefined) act(() => void fireEvent.click(radio))
        }
        now += 40
        act(() => void vi.advanceTimersByTime(40))
        expectAtMostOneOpen()
      }
    })
  })
})

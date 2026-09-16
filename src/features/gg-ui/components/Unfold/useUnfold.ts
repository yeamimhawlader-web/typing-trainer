/**
 * Plays a selector's unfolding on the elements that make it.
 *
 * The Web Animations API throughout, as the word animations use it: every
 * animation is keyframes sampled from one spring trajectory (unfold.motion.ts),
 * started at the trajectory's own start time, so a selector that has just
 * mounted shows exactly the frame the previous one would have shown now. When
 * the spring comes to rest the animations are cancelled on the same commit
 * that settles the phase, and CSS draws the resting state they ended on.
 *
 * Layout is read when the selector opens or closes, or its size changes — to
 * know where the node and the branches are — and never while typing.
 *
 * Reduced motion is checked when a change starts. When it is on, nothing moves:
 * the selector is simply open or closed.
 *
 * A selector that belongs to the shell's branch trees (branch-trees.ts) tells
 * them how to measure its row, so a tree that takes over from it can grow from
 * the room it took, and reads from them whether it was itself opened by taking
 * over — in which case it starts a beat after the press, as the old tree folds.
 */

import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

import { prefersReducedMotion } from '@features/ggtyping'
import { useSound } from '@features/sound'

import type { BranchHandover, BranchTreeId, BranchTrees, RowBox } from './branch-trees.ts'
import { isAtRest, startTrajectory, trajectoryAt, type SpringState, type Trajectory } from './spring.ts'
import { createUnfoldMemory, UnfoldMemoryContext, type UnfoldMemory } from './unfold-memory.ts'
import {
  branchPose,
  buildPress,
  labelPose,
  lightPose,
  rowPose,
  sampleTrajectory,
  stemPaths,
  stemsPose,
  UNFOLD_MOTION,
  UNFOLD_SPRINGS,
  type Frame,
  type UnfoldGeometry,
} from './unfold.motion.ts'

export type UnfoldPhase = 'open' | 'opening' | 'closing' | 'closed'

/**
 * The elements the unfolding moves. The branches — and each one's label and
 * light — and the stems are found inside `list` and `stems`.
 */
export interface UnfoldRefs {
  /** The node itself — a link or a button — measured for where the branches come from. */
  readonly node: RefObject<HTMLElement | null>
  /** The node's glass, which gives under a press. */
  readonly nodeGlass: RefObject<HTMLSpanElement | null>
  /** The light that flexes across the node's glass under a press. */
  readonly nodeLight: RefObject<HTMLSpanElement | null>
  /** The row that makes room for the branches. */
  readonly row: RefObject<HTMLDivElement | null>
  /** The row's content, whose height is the room needed. */
  readonly inner: RefObject<HTMLDivElement | null>
  /** The group the stems are drawn in. */
  readonly stems: RefObject<SVGGElement | null>
  /** The branches' group. */
  readonly list: RefObject<HTMLDivElement | null>
}

/** A branch's moving parts, marked in the markup rather than referenced one by one. */
export const BRANCH_PART = { text: 'text', light: 'light' } as const

const AT_REST = 0.001

const canMove = (): boolean =>
  typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function' && !prefersReducedMotion()

const now = (): number => performance.now()

const rest = (value: number): SpringState => ({ value, velocity: 0 })

const branchesIn = (list: HTMLElement | null): HTMLElement[] =>
  list === null ? [] : Array.from(list.querySelectorAll<HTMLElement>('[data-branch]'))

const partOf = (branch: HTMLElement, part: string): HTMLElement | null =>
  branch.querySelector<HTMLElement>(`[data-part="${part}"]`)

interface Measured {
  readonly geometry: UnfoldGeometry
  /** Where the row starts on the page, to tell whether another tree's row was in the same place. */
  readonly top: number
}

/** Where the node and the branches are, in the row's coordinates. A layout read: never while typing. */
const measure = (refs: UnfoldRefs): Measured | null => {
  const node = refs.node.current
  const inner = refs.inner.current
  if (node === null || inner === null) return null
  const innerBox = inner.getBoundingClientRect()
  const nodeBox = node.getBoundingClientRect()
  return {
    top: innerBox.top,
    geometry: {
      rowHeight: innerBox.height,
      node: { x: nodeBox.left + nodeBox.width / 2 - innerBox.left, y: nodeBox.bottom - innerBox.top },
      branches: branchesIn(refs.list.current).map((branch) => ({
        left: branch.offsetLeft,
        top: branch.offsetTop,
        width: branch.offsetWidth,
        height: branch.offsetHeight,
      })),
    },
  }
}

/** How close two rows' tops must be to be the same place on the page, rather than stacked apart. */
const SAME_PLACE_PX = 2

const drawStems = (refs: UnfoldRefs, geometry: UnfoldGeometry): void => {
  const paths = stemPaths(geometry)
  refs.stems.current?.querySelectorAll('path').forEach((path, index) => {
    path.setAttribute('d', paths[index] ?? '')
  })
}

/** The node's press, on its own clock, replacing any press still playing. */
const playPress = (refs: UnfoldRefs, playing: Animation[], startedAt: number): void => {
  for (const animation of playing.splice(0)) animation.cancel()
  if (!canMove()) return
  const { glass, light } = buildPress()
  const options: KeyframeAnimationOptions = { duration: UNFOLD_MOTION.press.durationMs, easing: 'linear', fill: 'none' }
  for (const [element, frames] of [
    [refs.nodeGlass.current, glass],
    [refs.nodeLight.current, light],
  ] as const) {
    if (element === null) continue
    const animation = element.animate(frames, options)
    animation.startTime = startedAt
    playing.push(animation)
  }
}

interface MotionState {
  readonly phase: UnfoldPhase
  readonly trajectory: Trajectory
  /** The row this opening grows from: the one it took over from, or null to grow from nothing. */
  readonly fromRow: RowBox | null
}

const settled = (open: boolean, at: number): MotionState => ({
  phase: open ? 'open' : 'closed',
  trajectory: startTrajectory(UNFOLD_SPRINGS.open, rest(open ? 1 : 0), open ? 1 : 0, at),
  fromRow: null,
})

/**
 * Towards open or closed from wherever the remembered spring is at `at`.
 *
 * Opened in place of another tree just now, it waits the handover's beat — a
 * start time a little in the future, whose first frame the animations hold —
 * and grows from that tree's row. Not if it was itself still moving: a tree
 * turned around mid-flight carries straight on.
 */
const turning = (
  memory: UnfoldMemory,
  open: boolean,
  at: number,
  handover: BranchHandover | null = null,
): MotionState => {
  const target = open ? 1 : 0
  const remembered = memory.trajectory()
  const from = remembered === null ? rest(1 - target) : trajectoryAt(remembered, at)
  if (!canMove() || (Math.abs(from.value - target) < AT_REST && Math.abs(from.velocity) < AT_REST)) {
    return settled(open, at)
  }
  const takingOver =
    open &&
    handover !== null &&
    at - handover.at <= UNFOLD_MOTION.handover.windowMs &&
    Math.abs(from.value) < AT_REST &&
    Math.abs(from.velocity) < AT_REST
      ? handover
      : null
  const startAt = takingOver === null ? at : Math.max(at, takingOver.at + UNFOLD_MOTION.handover.delayMs)
  return {
    phase: open ? 'opening' : 'closing',
    trajectory: startTrajectory(open ? UNFOLD_SPRINGS.open : UNFOLD_SPRINGS.close, from, target, startAt),
    fromRow: takingOver?.row ?? null,
  }
}

/**
 * Where a selector should start: moving on from the state the memory holds if a
 * mode control was pressed a moment ago, or if what the memory holds is still
 * in flight — a tree that was folding as the page changed — and at rest
 * otherwise.
 */
const beginning = (
  memory: UnfoldMemory,
  open: boolean,
  at: number,
  handover: BranchHandover | null,
): MotionState => {
  const switchedAt = memory.switchedAt()
  const recent = switchedAt !== null && at - switchedAt <= UNFOLD_MOTION.continuityMs
  const remembered = memory.trajectory()
  const inFlight = remembered !== null && !isAtRest(remembered, at)
  return recent || inFlight ? turning(memory, open, at, handover) : settled(open, at)
}

export interface UnfoldOptions {
  /**
   * What this selector's motion is remembered in. The shell keeps one for each
   * tree, so the selector on a new page carries on from the old page's. Absent,
   * the shell's Hover Mode memory, or one of the selector's own.
   */
  readonly memory?: UnfoldMemory | undefined
  /** The branch trees this selector is one of, and its name among them. */
  readonly trees?: BranchTrees | undefined
  readonly tree?: BranchTreeId | undefined
}

export const useUnfold = (open: boolean, refs: UnfoldRefs, { memory: given, trees, tree }: UnfoldOptions = {}) => {
  const sound = useSound()
  const shared = useContext(UnfoldMemoryContext)
  const [ownMemory] = useState(createUnfoldMemory)
  const memory = given ?? shared ?? ownMemory
  const handoverTo = useCallback(
    (opening: boolean) => (opening && trees !== undefined && tree !== undefined ? trees.handoverTo(tree) : null),
    [tree, trees],
  )
  const [motion, setMotion] = useState<MotionState>(() => beginning(memory, open, now(), handoverTo(open)))

  // A change of mode without a new page: turn around from wherever it is.
  const shownOpen = useRef(open)
  useLayoutEffect(() => {
    if (shownOpen.current === open) return
    shownOpen.current = open
    setMotion(turning(memory, open, now(), handoverTo(open)))
  }, [handoverTo, memory, open])

  // How this tree's row is measured, for a tree that takes over from it.
  useEffect(() => {
    if (trees === undefined || tree === undefined) return undefined
    return trees.registerRow(tree, () => {
      const row = refs.row.current
      if (row === null) return null
      const box = row.getBoundingClientRect()
      return { top: box.top, height: box.height }
    })
  }, [refs, tree, trees])

  // The motion itself: remembered for the next selector, played, and settled.
  useLayoutEffect(() => {
    memory.remember(motion.trajectory)
    if (motion.phase === 'closed') return undefined

    const measured = measure(refs)
    if (measured !== null) drawStems(refs, measured.geometry)
    if (motion.phase === 'open' || measured === null) return undefined

    // Taking over in the same place: grow from the room the other tree took, so
    // the page under the toolbar moves once rather than closing and opening.
    const { fromRow } = motion
    const geometry: UnfoldGeometry =
      motion.phase === 'opening' && fromRow !== null && Math.abs(measured.top - fromRow.top) <= SAME_PLACE_PX
        ? { ...measured.geometry, fromHeight: fromRow.height }
        : measured.geometry

    const { trajectory, phase } = motion
    const running: Animation[] = []
    const play = (element: Element | null, pose: (x: number) => Frame) => {
      if (element === null || typeof element.animate !== 'function') return
      const animation = element.animate(sampleTrajectory(trajectory, pose), {
        duration: Math.max(trajectory.durationMs, 1),
        easing: 'linear',
        fill: 'both',
      })
      // On the trajectory's own clock, so a new page picks up mid-flight.
      animation.startTime = trajectory.startedAt
      running.push(animation)
    }

    play(refs.row.current, (x) => rowPose(x, geometry))
    play(refs.stems.current, (x) => stemsPose(x))
    branchesIn(refs.list.current).forEach((branch, index) => {
      play(branch, (x) => branchPose(x, index, geometry))
      play(partOf(branch, BRANCH_PART.text), (x) => labelPose(x, index, geometry))
      play(partOf(branch, BRANCH_PART.light), (x) => lightPose(x))
    })

    const timer = window.setTimeout(
      () => setMotion({ phase: phase === 'opening' ? 'open' : 'closed', trajectory, fromRow: null }),
      Math.max(0, trajectory.startedAt + trajectory.durationMs - now()),
    )

    return () => {
      window.clearTimeout(timer)
      for (const animation of running) animation.cancel()
    }
  }, [memory, motion, refs])

  // Stems follow the branches when the page is resized with the selector open.
  useEffect(() => {
    const inner = refs.inner.current
    if (motion.phase !== 'open' || inner === null || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => {
      const measured = measure(refs)
      if (measured !== null) drawStems(refs, measured.geometry)
    })
    observer.observe(inner)
    return () => observer.disconnect()
  }, [motion.phase, refs])

  const pressAnimations = useRef<Animation[]>([])

  // A press carried over from the page before: the node picks it up where it is.
  useLayoutEffect(() => {
    const playing = pressAnimations.current
    const pressedAt = memory.nodePressedAt()
    if (pressedAt !== null && now() - pressedAt < UNFOLD_MOTION.press.durationMs) playPress(refs, playing, pressedAt)
    return () => {
      for (const animation of playing.splice(0)) animation.cancel()
    }
  }, [memory, refs])

  /** A mode control was pressed: remember when, and give the node its press. */
  const press = useCallback(
    (control: 'node' | 'other') => {
      const at = now()
      memory.pressed(at, control)
      // On the press, not on the animation: the sound belongs to the gesture,
      // and it is the same with reduced motion, where nothing unfolds at all.
      if (control === 'node') sound?.play(open ? 'selectorClose' : 'selectorOpen')
      else if (open) sound?.play('selectorClose')
      if (control === 'node') playPress(refs, pressAnimations.current, at)
    },
    [memory, open, refs, sound],
  )

  return { phase: motion.phase, press }
}

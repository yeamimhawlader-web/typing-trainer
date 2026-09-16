/**
 * Hover Mode's selector unfolding — every number that shapes it, in one place.
 *
 * ## The idea
 *
 * The Hover Mode control is a small glass node. Entering Hover Mode presses it:
 * it gives a little, its glass flexes brighter, and three glass branches grow
 * out of it — Standard, All In, Tired — travelling from the node to their
 * places on thin stems, one just after another, their labels arriving last.
 * The chosen one lights from within. Leaving folds the same object back up:
 * the light goes first, the labels, then the branches draw back into the node
 * and the stems retract after them.
 *
 * ## One number drives it
 *
 * All of it is a function of one value, the unfolding, pulled by a spring from
 * 0 (folded into the node) to 1 (open) and back. Each piece reads its own
 * window of that value: the stems draw in its first half, each branch travels
 * across a window a little later than the one before, labels come in late, and
 * the light only at the end. Folding runs the same windows backwards, so the
 * order reverses by itself.
 *
 * Because it is one spring solved exactly (see spring.ts), the value and its
 * speed are known at every moment. Leaving while it is still opening starts the
 * fold from exactly where it is, moving as fast as it was; reopening does the
 * same. Nothing ever snaps to a start pose first.
 *
 * ## Why these springs
 *
 * Opening is slightly underdamped: fast away from the node (90% of the way in
 * about 160ms), settling 1.5% past its places and back, at rest by 500ms.
 * Folding is critically damped — an object closing does not bounce — and
 * heavier than opening: it takes longer to get most of the way home (90% at
 * about 185ms), so it reads as something set down under control rather than
 * snatched back, and is still at rest before the opening would be.
 *
 * ## One tree at a time
 *
 * Only one tree is ever open (see branch-trees.ts). Asking for another while
 * one is out is a handover: the open one starts folding at once, and the new
 * one starts growing a beat later, from the room the old one took. By the time
 * the new branches are visible the old ones have all but gone into their node,
 * so the two never read as open together, and the row under the toolbar
 * changes size once. A touch on a piece of glass uses a stiffer,
 * livelier spring for movements of a pixel or two, sampled into CSS as
 * `--gg-ease-touch`.
 *
 * ## Only transform and opacity
 *
 * Branches, labels, the light and the node move by transform and opacity, on
 * the compositor. The two exceptions are small and deliberate: the row's height,
 * so the text below makes room rather than being covered, and the stems' dash
 * offset. Both run only while the selector opens or closes, never while typing.
 */

import { springAt, type Spring, type Trajectory } from './spring.ts'

/**
 * One frame of a pose: CSS properties and, when sampled, its offset. The shape
 * `element.animate` takes, written out so this file needs no DOM types and can
 * be read by the stylesheet guard, which runs without them.
 */
export type Frame = { readonly offset?: number; readonly easing?: string } & Readonly<Record<string, string | number>>

export const UNFOLD_SPRINGS = {
  open: { frequency: 19, damping: 0.8 },
  close: { frequency: 21, damping: 1 },
} as const satisfies Record<string, Spring>

/** The spring `--gg-ease-touch` samples, for the record and its test. */
export const TOUCH_SPRING: Spring = { frequency: 26, damping: 0.72 }

export const UNFOLD_MOTION = {
  /** The row making room: fully open a little before the branches settle. */
  row: { start: 0, end: 0.86 },
  /** Stems draw out of the node first. */
  stems: { start: 0.02, end: 0.55 },
  /** Each branch's journey from the node to its place. */
  branch: {
    start: 0.06,
    end: 0.9,
    /** How much later each branch's window is than the one before. */
    stagger: 0.05,
    /** Size at the node: small, so it reads as coming out of it. */
    fromScale: 0.5,
    /** Opacity is complete this far into the journey. */
    visibleBy: 0.42,
    /**
     * How strongly the spring's own overshoot past 1 carries a branch past its
     * place. Each branch has arrived before the spring does, so only that
     * overshoot moves it on: 1.5% of the spring is about 2.4% of the journey,
     * two or three pixels.
     */
    overshootGain: 1.6,
  },
  /** Labels arrive once their branch is nearly in place, staggered a little less, so the last is in at 1. */
  label: { start: 0.45, end: 0.92, stagger: 0.04, slidePx: 6 },
  /** The chosen branch's inner light, last of all. */
  light: { start: 0.7, end: 1 },

  /** The press on the node: a give, a flex past rest, a settle. */
  press: {
    durationMs: 420,
    compressScale: 0.94,
    compressAt: 0.17,
    reboundScale: 1.02,
    reboundAt: 0.48,
    settleScale: 0.996,
    settleAt: 0.74,
    /** The glass brightening as it flexes, then easing back to a resting glow. */
    lightPeak: 0.95,
    lightPeakAt: 0.3,
  },

  /**
   * A handover from one tree to another: how long after the press the new tree
   * starts to grow — long enough for the old branches to be most of the way
   * back into their node — and how soon after the press a tree must be opened
   * to count as taking over rather than simply opening.
   */
  handover: { delayMs: 120, windowMs: 160 },

  /** A leftover state is continued if a selector mounts this soon after one left. */
  continuityMs: 600,
  /** Frame spacing for sampled keyframes. */
  frameMs: 1000 / 60,
} as const

export type UnfoldMotion = typeof UNFOLD_MOTION

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

/** Where `x` sits across [start, end], unclamped: past 1 is overshoot. */
export const across = (x: number, start: number, end: number): number => (x - start) / (end - start)

export const round = (value: number, places = 4): number => {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

// --- Geometry ------------------------------------------------------------

export interface Point {
  readonly x: number
  readonly y: number
}

export interface Box {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface UnfoldGeometry {
  /** The row's full height when open, in pixels. */
  readonly rowHeight: number
  /**
   * The height the row grows from: zero, or the room another tree's row took
   * in the same place, when this tree took over from it.
   */
  readonly fromHeight?: number
  /** The bottom centre of the node, in the row's coordinates. */
  readonly node: Point
  /** Each branch's box, untransformed, in the row's coordinates. */
  readonly branches: readonly Box[]
}

const centre = (box: Box): Point => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 })

/** Branches side by side share a top; stacked ones do not. */
export const isStacked = (branches: readonly Box[]): boolean =>
  branches.length > 1 && branches.some((box) => Math.abs(box.top - (branches[0] as Box).top) > 2)

/**
 * The stems from the node to each branch, as SVG path data.
 *
 * Side by side, every stem drops from the node's bottom centre to a rail
 * halfway down, runs along it, and turns down into the top of its branch, the
 * corners rounded; the three share the drop and the rail, so they read as one
 * object dividing. Stacked, the branches hang off one trunk: the stem drops
 * from the node, turns to the trunk's line, runs down it, and a short arm
 * turns into each branch's side.
 *
 * Shared stretches are drawn more than once, which is why the stem colour is
 * solid: overlapping, it looks the same.
 */
export const stemPaths = (geometry: UnfoldGeometry): readonly string[] => {
  const { node, branches } = geometry
  if (branches.length === 0) return []
  const n = (value: number) => round(value, 2)

  if (!isStacked(branches)) {
    const top = Math.min(...branches.map((box) => box.top))
    const rail = node.y + (top - node.y) / 2
    return branches.map((box) => {
      const x = box.left + box.width / 2
      const run = x - node.x
      if (Math.abs(run) < 1) return `M ${n(node.x)} ${n(node.y)} V ${n(box.top)}`
      const direction = Math.sign(run)
      const radius = Math.max(0, Math.min(6, (top - node.y) / 2 - 0.5, Math.abs(run) / 2))
      return [
        `M ${n(node.x)} ${n(node.y)}`,
        `V ${n(rail - radius)}`,
        `Q ${n(node.x)} ${n(rail)} ${n(node.x + direction * radius)} ${n(rail)}`,
        `H ${n(x - direction * radius)}`,
        `Q ${n(x)} ${n(rail)} ${n(x)} ${n(rail + radius)}`,
        `V ${n(box.top)}`,
      ].join(' ')
    })
  }

  const left = Math.min(...branches.map((box) => box.left))
  const trunk = Math.max(3, left - 13)
  const radius = 6
  const first = branches[0] as Box
  const turn = node.y + Math.max(radius * 2, Math.min(first.top - node.y, 14)) / 2
  const lastMiddle = centre(branches[branches.length - 1] as Box).y

  const trunkPath = [
    `M ${n(node.x)} ${n(node.y)}`,
    `V ${n(turn - radius)}`,
    `Q ${n(node.x)} ${n(turn)} ${n(node.x - radius)} ${n(turn)}`,
    `H ${n(trunk + radius)}`,
    `Q ${n(trunk)} ${n(turn)} ${n(trunk)} ${n(turn + radius)}`,
    `V ${n(lastMiddle - radius)}`,
  ].join(' ')
  const arms = branches.map((box) => {
    const middle = centre(box).y
    return `M ${n(trunk)} ${n(middle - radius)} Q ${n(trunk)} ${n(middle)} ${n(trunk + radius)} ${n(middle)} H ${n(box.left)}`
  })
  return [trunkPath, ...arms]
}

// --- Poses ---------------------------------------------------------------

/**
 * The row's height at `x`. It makes room, and never more than the room needed:
 * from nothing, or from the room a tree it took over from was taking.
 */
export const rowPose = (x: number, geometry: UnfoldGeometry, motion: UnfoldMotion = UNFOLD_MOTION): Frame => {
  const from = geometry.fromHeight ?? 0
  const made = clamp(across(x, motion.row.start, motion.row.end), 0, 1)
  return { height: `${round(from + (geometry.rowHeight - from) * made, 2)}px` }
}

export const stemsPose = (x: number, motion: UnfoldMotion = UNFOLD_MOTION): Frame => {
  const drawn = clamp(across(x, motion.stems.start, motion.stems.end), 0, 1)
  return { strokeDashoffset: String(round(1 - drawn)), opacity: String(round(clamp(drawn * 4, 0, 1))) }
}

/**
 * How far branch `index` is along its journey at `x`: 0 at the node, 1 in
 * place, and a little past only while the spring itself is past 1.
 */
export const branchProgress = (x: number, index: number, motion: UnfoldMotion = UNFOLD_MOTION): number => {
  const shift = index * motion.branch.stagger
  const journey = clamp(across(x, motion.branch.start + shift, motion.branch.end + shift), 0, 1)
  return journey + Math.max(0, x - 1) * motion.branch.overshootGain
}

export const branchPose = (
  x: number,
  index: number,
  geometry: UnfoldGeometry,
  motion: UnfoldMotion = UNFOLD_MOTION,
): Frame => {
  const box = geometry.branches[index]
  if (box === undefined) return {}
  const p = branchProgress(x, index, motion)
  const middle = centre(box)
  // From the node's bottom centre to the branch's own centre.
  const dx = (geometry.node.x - middle.x) * (1 - p)
  const dy = (geometry.node.y - middle.y) * (1 - p)
  const scale = motion.branch.fromScale + (1 - motion.branch.fromScale) * p
  return {
    transform: `translate(${round(dx, 2)}px, ${round(dy, 2)}px) scale(${round(scale)})`,
    opacity: String(round(clamp(p / motion.branch.visibleBy, 0, 1))),
  }
}

export const labelPose = (
  x: number,
  index: number,
  geometry: UnfoldGeometry,
  motion: UnfoldMotion = UNFOLD_MOTION,
): Frame => {
  const box = geometry.branches[index]
  if (box === undefined) return {}
  const shift = index * motion.label.stagger
  const q = clamp(across(x, motion.label.start + shift, motion.label.end + shift), 0, 1)
  // The label slides the way its branch travelled: out from the node.
  const direction = Math.sign(centre(box).x - geometry.node.x) || 1
  return {
    transform: `translateX(${round(-direction * motion.label.slidePx * (1 - q), 2)}px)`,
    opacity: String(round(q)),
  }
}

export const lightPose = (x: number, motion: UnfoldMotion = UNFOLD_MOTION): Frame => ({
  opacity: String(round(clamp(across(x, motion.light.start, motion.light.end), 0, 1))),
})

// --- Sampling ------------------------------------------------------------

/**
 * A trajectory as keyframes: the pose at every frame from its start until it
 * rests, played linearly so the spring's own curve is the only easing.
 */
export const sampleTrajectory = (
  trajectory: Trajectory,
  pose: (x: number) => Frame,
  frameMs: number = UNFOLD_MOTION.frameMs,
): Frame[] => {
  const duration = Math.max(trajectory.durationMs, frameMs)
  const count = Math.max(2, Math.ceil(duration / frameMs) + 1)
  return Array.from({ length: count }, (_, frame) => {
    const last = frame === count - 1
    const offset = last ? 1 : (frame * frameMs) / duration
    // The last frame is the target exactly, whatever the rest threshold left over.
    const x = last ? trajectory.to : springAt(trajectory.spring, trajectory.from, trajectory.to, offset * duration).value
    return { ...pose(x), offset: round(Math.min(1, offset), 5) }
  })
}

/** The press on the node, as keyframes for its glass and for its light. */
export const buildPress = (motion: UnfoldMotion = UNFOLD_MOTION) => {
  const { press } = motion
  return {
    glass: [
      { offset: 0, transform: 'scale(1)', easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
      { offset: press.compressAt, transform: `scale(${press.compressScale})`, easing: 'cubic-bezier(0.25, 0, 0.3, 1)' },
      { offset: press.reboundAt, transform: `scale(${press.reboundScale})`, easing: 'cubic-bezier(0.37, 0, 0.63, 1)' },
      { offset: press.settleAt, transform: `scale(${press.settleScale})`, easing: 'cubic-bezier(0.37, 0, 0.63, 1)' },
      { offset: 1, transform: 'scale(1)' },
    ] satisfies Frame[],
    light: [
      { offset: 0, opacity: '0', easing: 'cubic-bezier(0.2, 0, 0.2, 1)' },
      { offset: press.lightPeakAt, opacity: String(press.lightPeak), easing: 'cubic-bezier(0.37, 0, 0.63, 1)' },
      { offset: 1, opacity: '0' },
    ] satisfies Frame[],
  }
}

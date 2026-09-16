/**
 * The unfolding's arithmetic: the spring, the poses it drives, and the stems.
 *
 * No DOM. The browser review checked how it looks; these check the promises it
 * rests on — that it opens and closes within the brief's timings, never
 * overshoots more than a hair, ends exactly where CSS takes over, and turns
 * around mid-flight without a jump in position or speed.
 */

import { describe, expect, it } from 'vitest'

import { isAtRest, restMs, retarget, springAt, startTrajectory, trajectoryAt } from './spring.ts'
import {
  branchPose,
  branchProgress,
  isStacked,
  labelPose,
  lightPose,
  rowPose,
  sampleTrajectory,
  stemPaths,
  stemsPose,
  TOUCH_SPRING,
  UNFOLD_MOTION,
  UNFOLD_SPRINGS,
  type UnfoldGeometry,
} from './unfold.motion.ts'

const REST = { value: 0, velocity: 0 }
const OPEN = { value: 1, velocity: 0 }

const peak = (spring: typeof TOUCH_SPRING, to: number, from = REST) => {
  let highest = -Infinity
  for (let ms = 0; ms <= restMs(spring, from, to); ms += 1) highest = Math.max(highest, springAt(spring, from, to, ms).value)
  return highest
}

const timeTo = (spring: typeof TOUCH_SPRING, share: number) => {
  for (let ms = 0; ms < 2000; ms += 1) if (springAt(spring, REST, 1, ms).value >= share) return ms
  return Infinity
}

const numbers = (value: unknown) => String(value).match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []

describe('the spring', () => {
  it('starts exactly where and as fast as it was told', () => {
    const from = { value: 0.3, velocity: 2 }
    const state = springAt(UNFOLD_SPRINGS.open, from, 1, 0)

    expect(state.value).toBeCloseTo(0.3, 10)
    expect(state.velocity).toBeCloseTo(2, 10)
  })

  it('matches a stepped simulation of the same spring', () => {
    const { frequency: omega, damping: zeta } = UNFOLD_SPRINGS.open
    let x = 0
    let v = 0
    const dt = 0.0001
    for (let t = 0; t < 0.2; t += dt) {
      const a = -omega * omega * (x - 1) - 2 * zeta * omega * v
      v += a * dt
      x += v * dt
    }

    expect(springAt(UNFOLD_SPRINGS.open, REST, 1, 200).value).toBeCloseTo(x, 2)
  })

  it('opens fast and settles within the brief: most of the way in under 200ms, at rest in 300–500ms', () => {
    expect(timeTo(UNFOLD_SPRINGS.open, 0.9)).toBeLessThan(200)
    expect(restMs(UNFOLD_SPRINGS.open, REST, 1)).toBeGreaterThanOrEqual(300)
    expect(restMs(UNFOLD_SPRINGS.open, REST, 1)).toBeLessThanOrEqual(500)
  })

  it('overshoots opening by a hair, and never by much', () => {
    const overshoot = peak(UNFOLD_SPRINGS.open, 1) - 1

    expect(overshoot).toBeGreaterThan(0.005)
    expect(overshoot).toBeLessThan(0.03)
  })

  it('folds without a bounce, and at rest within 500ms', () => {
    expect(peak(UNFOLD_SPRINGS.close, 0, OPEN)).toBeLessThanOrEqual(1)
    let lowest = Infinity
    for (let ms = 0; ms < 600; ms += 1) lowest = Math.min(lowest, springAt(UNFOLD_SPRINGS.close, OPEN, 0, ms).value)
    expect(lowest).toBeGreaterThan(-0.001)
    expect(restMs(UNFOLD_SPRINGS.close, OPEN, 0)).toBeGreaterThanOrEqual(300)
    expect(restMs(UNFOLD_SPRINGS.close, OPEN, 0)).toBeLessThanOrEqual(500)
  })

  it('folds heavier than it opens: later to get most of the way, and never sooner at rest than it can be seen going', () => {
    const closingTo90 = (() => {
      for (let ms = 0; ms < 1000; ms += 1) if (springAt(UNFOLD_SPRINGS.close, OPEN, 0, ms).value <= 0.1) return ms
      return Infinity
    })()

    expect(UNFOLD_SPRINGS.close.damping).toBe(1)
    expect(closingTo90).toBeGreaterThan(timeTo(UNFOLD_SPRINGS.open, 0.9))
    expect(closingTo90).toBeLessThan(220)
  })

  it('hands over in one gesture: the new tree starts a beat after the old one starts folding, once most of it has gone', () => {
    const { delayMs, windowMs } = UNFOLD_MOTION.handover
    const folded = springAt(UNFOLD_SPRINGS.close, OPEN, 0, delayMs).value

    expect(delayMs).toBeGreaterThan(0)
    expect(delayMs).toBeLessThan(150)
    expect(windowMs).toBeGreaterThanOrEqual(delayMs)
    // By the time the new branches begin to move, the old ones are well on their way in.
    expect(folded).toBeLessThan(0.6)
  })

  it('makes room once when a tree takes over: from the room the old one took, never from nothing', () => {
    const geometry = { rowHeight: 60, fromHeight: 80, node: { x: 0, y: 0 }, branches: [] }

    expect(Number.parseFloat(String(rowPose(0, geometry).height))).toBe(80)
    expect(Number.parseFloat(String(rowPose(1, geometry).height))).toBe(60)
    expect(Number.parseFloat(String(rowPose(0, { rowHeight: 60, node: { x: 0, y: 0 }, branches: [] }).height))).toBe(0)
  })

  it('arrives exactly at its target once at rest', () => {
    const trajectory = startTrajectory(UNFOLD_SPRINGS.open, REST, 1, 1000)

    expect(isAtRest(trajectory, 1000 + trajectory.durationMs)).toBe(true)
    expect(trajectoryAt(trajectory, 1000 + trajectory.durationMs)).toEqual({ value: 1, velocity: 0 })
    expect(trajectoryAt(trajectory, 999)).toEqual({ value: 0, velocity: 0 })
  })

  it('turns around mid-flight from exactly where it is, at the speed it was going', () => {
    const opening = startTrajectory(UNFOLD_SPRINGS.open, REST, 1, 0)
    const closing = retarget(opening, 0, UNFOLD_SPRINGS.close, 120, 0)
    const there = trajectoryAt(opening, 120)

    expect(closing.from).toEqual(there)
    expect(there.value).toBeGreaterThan(0.3)
    expect(there.value).toBeLessThan(1)
    expect(there.velocity).toBeGreaterThan(0)
    // One millisecond either side of the turn: no jump in position.
    const before = trajectoryAt(opening, 119).value
    const after = trajectoryAt(closing, 121).value
    expect(Math.abs(after - before)).toBeLessThan(0.02)
  })

  it('starts at rest when nothing was moving', () => {
    const fresh = retarget(null, 1, UNFOLD_SPRINGS.open, 50, 0)

    expect(fresh.from).toEqual(REST)
    expect(fresh.startedAt).toBe(50)
  })

  it('is the spring --gg-ease-touch samples: lively, overshooting by under 5%, at rest within the touch duration', () => {
    const overshoot = peak(TOUCH_SPRING, 1) - 1

    expect(overshoot).toBeGreaterThan(0.02)
    expect(overshoot).toBeLessThan(0.05)
    expect(restMs(TOUCH_SPRING, REST, 1)).toBeLessThanOrEqual(440)
  })
})

const ROW: UnfoldGeometry = {
  rowHeight: 71,
  node: { x: 200, y: 0 },
  branches: [
    { left: 0, top: 18, width: 180, height: 53 },
    { left: 190, top: 18, width: 180, height: 53 },
    { left: 380, top: 18, width: 290, height: 53 },
  ],
}

const STACK: UnfoldGeometry = {
  rowHeight: 188,
  node: { x: 150, y: 0 },
  branches: [
    { left: 24, top: 14, width: 311, height: 53 },
    { left: 24, top: 75, width: 311, height: 53 },
    { left: 24, top: 136, width: 311, height: 53 },
  ],
}

describe('the poses', () => {
  it('folded, everything is inside the node: no room taken, no stems, branches small and invisible at the node', () => {
    expect(rowPose(0, ROW)).toEqual({ height: '0px' })
    expect(stemsPose(0)).toEqual({ strokeDashoffset: '1', opacity: '0' })
    ROW.branches.forEach((box, index) => {
      const pose = branchPose(0, index, ROW)
      const [dx, dy, scale] = numbers(pose.transform)
      expect(dx).toBeCloseTo(ROW.node.x - (box.left + box.width / 2), 1)
      expect(dy).toBeCloseTo(ROW.node.y - (box.top + box.height / 2), 1)
      expect(scale).toBe(UNFOLD_MOTION.branch.fromScale)
      expect(pose.opacity).toBe('0')
      expect(labelPose(0, index, ROW).opacity).toBe('0')
    })
    expect(lightPose(0).opacity).toBe('0')
  })

  it('open, everything is exactly at rest, which is where CSS takes over', () => {
    expect(rowPose(1, ROW)).toEqual({ height: '71px' })
    expect(stemsPose(1)).toEqual({ strokeDashoffset: '0', opacity: '1' })
    ROW.branches.forEach((_, index) => {
      expect(branchPose(1, index, ROW)).toEqual({ transform: 'translate(0px, 0px) scale(1)', opacity: '1' })
      expect(labelPose(1, index, ROW)).toEqual({ transform: 'translateX(0px)', opacity: '1' })
    })
    expect(lightPose(1).opacity).toBe('1')
  })

  it('brings the branches out one just after another, and folds them back in the reverse order', () => {
    const halfway = [0, 1, 2].map((index) => branchProgress(0.45, index))

    expect(halfway[0]).toBeGreaterThan(halfway[1] as number)
    expect(halfway[1]).toBeGreaterThan(halfway[2] as number)
    // The last to arrive is the first to leave: at 0.95 on the way back only it has moved.
    expect(branchProgress(0.95, 0)).toBe(1)
    expect(branchProgress(0.95, 2)).toBeLessThan(1)
  })

  it('carries a branch past its place only while the spring itself is past 1, and only by a few pixels', () => {
    const overshootAt = 1 + (peak(UNFOLD_SPRINGS.open, 1) - 1)
    const [dx, dy, scale] = numbers(branchPose(overshootAt, 2, ROW).transform)
    const travel = Math.hypot(ROW.node.x - 525, ROW.node.y - 44.5)

    expect(Math.hypot(dx as number, dy as number)).toBeLessThan(travel * 0.04)
    expect(scale).toBeLessThan(1.02)
    expect(branchProgress(0.999, 2)).toBeLessThanOrEqual(1)
  })

  it('never makes more room than the branches need', () => {
    expect(rowPose(1.02, ROW)).toEqual({ height: '71px' })
  })

  it('lights the chosen branch last on the way in, and first on the way out', () => {
    expect(lightPose(UNFOLD_MOTION.light.start).opacity).toBe('0')
    expect(Number(labelPose(UNFOLD_MOTION.light.start, 0, ROW).opacity)).toBeGreaterThan(0)
  })

  it('slides each label out from the node, the way its branch travelled', () => {
    const left = numbers(labelPose(0.6, 0, ROW).transform)[0] as number
    const right = numbers(labelPose(0.6, 2, ROW).transform)[0] as number

    expect(left).toBeGreaterThan(0)
    expect(right).toBeLessThan(0)
  })
})

describe('sampled keyframes', () => {
  it('run from the pose where the trajectory starts to its target, in order', () => {
    const trajectory = startTrajectory(UNFOLD_SPRINGS.close, { value: 0.6, velocity: 3 }, 0, 0)
    const frames = sampleTrajectory(trajectory, (x) => rowPose(x, ROW))

    expect(frames[0]).toEqual({ ...rowPose(0.6, ROW), offset: 0 })
    expect(frames.at(-1)).toEqual({ ...rowPose(0, ROW), offset: 1 })
    const offsets = frames.map((frame) => frame.offset as number)
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b))
    // About one frame per display frame, not hundreds.
    expect(frames.length).toBeLessThan(Math.ceil(trajectory.durationMs / UNFOLD_MOTION.frameMs) + 3)
  })
})

describe('the stems', () => {
  it('drop from the node to a rail and turn down into the top of each branch, side by side', () => {
    expect(isStacked(ROW.branches)).toBe(false)
    const paths = stemPaths(ROW)

    expect(paths).toHaveLength(3)
    paths.forEach((path, index) => {
      const box = ROW.branches[index]!
      expect(path.startsWith('M 200 0')).toBe(true)
      expect(path.endsWith(`V ${box.top}`)).toBe(true)
      // The rail is halfway between the node and the branches.
      expect(path).toContain(' 9 ')
    })
  })

  it('hang stacked branches off one trunk, with an arm into the side of each', () => {
    expect(isStacked(STACK.branches)).toBe(true)
    const [trunk, ...arms] = stemPaths(STACK)

    expect(trunk?.startsWith('M 150 0')).toBe(true)
    expect(arms).toHaveLength(3)
    arms.forEach((arm, index) => {
      expect(arm.endsWith(`H ${STACK.branches[index]!.left}`)).toBe(true)
    })
  })

  it('draw nothing when there is nothing to hang', () => {
    expect(stemPaths({ ...ROW, branches: [] })).toEqual([])
  })
})

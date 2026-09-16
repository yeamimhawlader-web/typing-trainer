/**
 * What Hover Mode's selector was doing, kept by the shell across page changes.
 *
 * Ordinary practice and Hover Mode are two routes, so choosing a mode replaces
 * the page and its selector with it. The unfolding must not notice: the
 * selector on the new page carries on from the exact state the old one left,
 * mid-flight or at rest. So the motion is not kept in the component. It lives
 * here, as the trajectory of one spring (which says where the selector is at
 * any moment), plus when a mode control was last pressed. The layout owns one
 * of these for as long as the shell is on screen.
 *
 * A selector that mounts without a recent press — a reload, the back button,
 * arriving from another page — starts at rest in its own state. Only a mode
 * change made on the selector itself is animated.
 */

import { createContext } from 'react'

import type { Trajectory } from './spring.ts'

export interface UnfoldMemory {
  /** The unfolding's current spring: 0 folded into the node, 1 open. */
  readonly trajectory: () => Trajectory | null
  /** When a mode control was last pressed, on the document's clock. */
  readonly switchedAt: () => number | null
  /** When the node itself was last pressed, so its give carries over too. */
  readonly nodePressedAt: () => number | null
  readonly remember: (trajectory: Trajectory) => void
  /** A mode control was pressed at `at`; `node` when it was the node itself. */
  readonly pressed: (at: number, control: 'node' | 'other') => void
}

export const createUnfoldMemory = (): UnfoldMemory => {
  let trajectory: Trajectory | null = null
  let switchedAt: number | null = null
  let nodePressedAt: number | null = null

  return {
    trajectory: () => trajectory,
    switchedAt: () => switchedAt,
    nodePressedAt: () => nodePressedAt,
    remember: (next) => {
      trajectory = next
    },
    pressed: (at, control) => {
      switchedAt = at
      if (control === 'node') nodePressedAt = at
    },
  }
}

export const UnfoldMemoryContext = createContext<UnfoldMemory | null>(null)

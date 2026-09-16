/**
 * Which branch tree is open: one answer, for every glass node on the page.
 *
 * Hover Mode's difficulties and the sound packs are two trees on one control,
 * not two menus. So what is open is not each selector's own state: it is a
 * single value held here, and a selector is open exactly when that value is
 * its name. Two trees open at once is not a state this can be in.
 *
 * ## Handing over
 *
 * Opening one tree while another is out is one gesture, not two. The tree that
 * was open starts folding at once; the new one starts growing a moment later,
 * from the room the old one took rather than from nothing, so the row under
 * the toolbar changes size once instead of closing and opening again. What the
 * old tree's row measured at that moment is kept here as the handover, for the
 * new tree to start from (see useUnfold.ts).
 *
 * The shell holds one of these for as long as it is on screen, so a tree that
 * opens as the page changes — Hover Mode, pressed from ordinary practice —
 * is still the open one on the page that arrives, and a tree folding as the
 * page changes carries on folding on the new one.
 */

import { createContext, useContext, useState, useSyncExternalStore } from 'react'

import { createUnfoldMemory, type UnfoldMemory } from './unfold-memory.ts'

export type BranchTreeId = 'hover' | 'sound' | 'pace'

/** Where a tree's row is on the page and how much room it takes, at one moment. */
export interface RowBox {
  readonly top: number
  readonly height: number
}

export interface BranchHandover {
  readonly from: BranchTreeId
  readonly to: BranchTreeId
  /** When the new tree was asked for, on the document's clock. */
  readonly at: number
  /** The old tree's row as it was then: null where it was not on the page. */
  readonly row: RowBox | null
}

export interface BranchTrees {
  /** The open tree, or null. */
  readonly active: () => BranchTreeId | null
  readonly subscribe: (listener: () => void) => () => void
  /** Opens `id`, folding whichever tree was open. */
  readonly open: (id: BranchTreeId, at: number) => void
  /** Folds `id`, if it is the open one. */
  readonly close: (id: BranchTreeId) => void
  readonly toggle: (id: BranchTreeId, at: number) => void
  /** Folds whatever is open. Returns what that was. */
  readonly closeAll: () => BranchTreeId | null
  /** The handover `id` was opened by, if it was opened in place of another tree. */
  readonly handoverTo: (id: BranchTreeId) => BranchHandover | null
  /** How to measure a tree's row when another tree takes over from it. */
  readonly registerRow: (id: BranchTreeId, measure: () => RowBox | null) => () => void
  /**
   * What a tree's unfolding was doing, kept for as long as these trees are, so
   * the tree on a new page carries on from where the old page's left it.
   */
  readonly memoryOf: (id: BranchTreeId) => UnfoldMemory
}

export const createBranchTrees = (): BranchTrees => {
  let active: BranchTreeId | null = null
  let handover: BranchHandover | null = null
  const listeners = new Set<() => void>()
  const rows = new Map<BranchTreeId, () => RowBox | null>()
  const memories = new Map<BranchTreeId, UnfoldMemory>()

  const set = (next: BranchTreeId | null): void => {
    if (next === active) return
    active = next
    for (const listener of listeners) listener()
  }

  const open = (id: BranchTreeId, at: number): void => {
    if (active === id) return
    // Read as the gesture happens, before anything re-renders: the old tree's
    // row is exactly as the typist saw it when they asked for the new one.
    handover = active === null ? null : { from: active, to: id, at, row: rows.get(active)?.() ?? null }
    set(id)
  }

  return {
    active: () => active,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    open,
    close: (id) => {
      if (active === id) set(null)
    },
    toggle: (id, at) => {
      if (active === id) set(null)
      else open(id, at)
    },
    closeAll: () => {
      const was = active
      set(null)
      return was
    },
    handoverTo: (id) => (handover !== null && handover.to === id ? handover : null),
    registerRow: (id, measure) => {
      rows.set(id, measure)
      return () => {
        if (rows.get(id) === measure) rows.delete(id)
      }
    },
    memoryOf: (id) => {
      const known = memories.get(id)
      if (known !== undefined) return known
      const memory = createUnfoldMemory()
      memories.set(id, memory)
      return memory
    },
  }
}

export const BranchTreesContext = createContext<BranchTrees | null>(null)

/**
 * The trees this component belongs to: the shell's, or — rendered on its own,
 * as in a test — a set of its own.
 */
export const useBranchTrees = (): BranchTrees => {
  const shared = useContext(BranchTreesContext)
  const [own] = useState(createBranchTrees)
  return shared ?? own
}

/** Whether `id` is the open tree, re-rendering only when that answer changes. */
export const useTreeOpen = (trees: BranchTrees, id: BranchTreeId): boolean =>
  useSyncExternalStore(
    trees.subscribe,
    () => trees.active() === id,
    () => false,
  )

/** Marks every part of a tree — its node and its row — so a press elsewhere can be told apart. */
export const BRANCH_TREE_ATTRIBUTE = 'data-branch-tree'

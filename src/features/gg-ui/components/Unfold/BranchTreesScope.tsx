/**
 * Where a set of branch trees is in use: it provides them, and folds whichever
 * is open when the typist is done with it.
 *
 * A tree folds when a choice is made in it or its node is pressed again, which
 * the selectors see to. Two more ways are the page's: a press anywhere that is
 * not part of a tree — the words, the field, another setting — and Escape, which
 * also brings focus back to the node if it was on the branches, so the keyboard
 * is never left on something that is folding away.
 *
 * Only an open tree is listened for, and only a pointer going down or a key:
 * nothing here runs on a keystroke that types.
 */

import { useEffect, useSyncExternalStore, type ReactNode } from 'react'

import { useSound } from '@features/sound'

import { BRANCH_TREE_ATTRIBUTE, BranchTreesContext, useBranchTrees } from './branch-trees.ts'

/** Marks the node of a tree, so focus can be returned to it. */
export const BRANCH_NODE_ATTRIBUTE = 'data-branch-node'

export const BranchTreesScope = ({ children }: { readonly children: ReactNode }) => {
  const trees = useBranchTrees()
  const sound = useSound()
  const active = useSyncExternalStore(trees.subscribe, trees.active, () => null)

  useEffect(() => {
    if (active === null) return undefined

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest(`[${BRANCH_TREE_ATTRIBUTE}]`) !== null) return
      if (trees.closeAll() !== null) sound?.play('selectorClose')
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || trees.active() !== active) return
      const focused = document.activeElement
      const onBranches =
        focused instanceof Element &&
        focused.closest(`[${BRANCH_TREE_ATTRIBUTE}="${active}"]`) !== null &&
        focused.closest(`[${BRANCH_NODE_ATTRIBUTE}]`) === null
      trees.close(active)
      sound?.play('selectorClose')
      if (onBranches) {
        document
          .querySelector<HTMLElement>(`[${BRANCH_TREE_ATTRIBUTE}="${active}"][${BRANCH_NODE_ATTRIBUTE}]`)
          ?.focus({ preventScroll: true })
      }
    }

    // Capture, so a press that a control stops from bubbling still counts as elsewhere.
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [active, sound, trees])

  return <BranchTreesContext value={trees}>{children}</BranchTreesContext>
}

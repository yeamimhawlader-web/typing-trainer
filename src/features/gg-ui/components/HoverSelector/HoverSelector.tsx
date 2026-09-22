/**
 * The mode selector: ordinary practice, and the High Speed Trainer — Hover Mode,
 * a small glass node that unfolds into its three difficulties, and the Syllable
 * Trainer beside it.
 *
 * Entering Hover Mode unfolds the node: three glass branches — Standard, All
 * In, Tired — hang from it on stems, and choosing one is choosing the
 * difficulty. Choosing folds them away again, so the branches never sit there
 * taking up the page; the node itself then says which difficulty is on. Pressing
 * the node in Hover Mode unfolds them again, and leaving folds them.
 *
 * Whether they are out is not this selector's to keep: it is the branch trees'
 * (Unfold/branch-trees.ts), which only ever have one tree open. Opening Hover
 * Mode's folds the sound selector's, and the other way round.
 *
 * The unfolding (see Unfold/unfold.motion.ts) carries on from wherever it is,
 * even though entering and leaving Hover Mode replaces the page underneath it.
 *
 * Each branch shows the difficulty's own name and description, the same words
 * the result and Golden Nuggets use, and one to three beads for how persistent
 * it is.
 *
 * The Syllable Trainer has nothing to choose, so it is a node without branches:
 * a different mechanism, on a page of its own, grouped with Hover Mode under
 * the name they share.
 */

import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router'

import { ROUTES } from '@app/routes.ts'
import type { HoverDifficulty } from '@core/types'
import { HOVER_DIFFICULTY_OPTIONS } from '@features/ggtyping'

import { PillLink } from '../controls/controls.tsx'
import { useBranchTrees, useTreeOpen } from '../Unfold/branch-trees.ts'
import unfold from '../Unfold/Unfold.module.css'
import { UnfoldBranches, type UnfoldItem } from '../Unfold/UnfoldBranches.tsx'
import { useUnfold } from '../Unfold/useUnfold.ts'

import styles from './HoverSelector.module.css'

export type GGMode = 'standard' | 'hover' | 'syllable' | 'library'

const STANDARD_DESCRIPTION = 'Words, typed straight through'
const HOVER_DESCRIPTION = 'Target mistakes and repeat them'
const SYLLABLE_DESCRIPTION = 'Train long words as rhythm, not as one block'
const LIBRARY_DESCRIPTION = 'Quotes, goals, and the words you actually use'

/** How persistent each difficulty is: its beads, and how much accent it carries. */
const TONES: Readonly<Record<HoverDifficulty, Pick<UnfoldItem, 'marks' | 'tone'>>> = {
  standard: { marks: 1, tone: 'calm' },
  'all-in': { marks: 2, tone: 'committed' },
  tired: { marks: 3, tone: 'persistent' },
}

const ITEMS: readonly UnfoldItem[] = HOVER_DIFFICULTY_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
  description: option.description,
  marks: TONES[option.value].marks,
  tone: TONES[option.value].tone,
}))

export interface HoverSelectorProps {
  readonly mode: GGMode
  /** Hover Mode's difficulty: the chosen branch. */
  readonly difficulty: HoverDifficulty
  /** Present only in Hover Mode, where the branches are a choice. */
  readonly onDifficultyChange?: ((difficulty: HoverDifficulty) => void) | undefined
}

export const HoverSelector = ({ mode, difficulty, onDifficultyChange }: HoverSelectorProps) => {
  const trees = useBranchTrees()
  // Out only in Hover Mode: anywhere else the branches are only ever seen folding away.
  const open = useTreeOpen(trees, 'hover') && mode === 'hover'

  // Arriving anywhere but Hover Mode — ordinary practice, the Syllable Trainer,
  // the back button — leaves nothing open behind for when Hover Mode comes back.
  useEffect(() => {
    if (mode !== 'hover') trees.close('hover')
  }, [mode, trees])

  const node = useRef<HTMLAnchorElement>(null)
  const nodeGlass = useRef<HTMLSpanElement>(null)
  const nodeLight = useRef<HTMLSpanElement>(null)
  const row = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const stems = useRef<SVGGElement>(null)
  const list = useRef<HTMLDivElement>(null)
  // One object for the life of the selector, so the hook's effects see the same refs every render.
  const [refs] = useState(() => ({ node, nodeGlass, nodeLight, row, inner, stems, list }))
  const { phase, press } = useUnfold(open, refs, { trees, tree: 'hover' })
  const choosing = open && onDifficultyChange !== undefined

  const pressNode = (event: MouseEvent) => {
    // A pointer already pressed on the way down; a key arrives only as a click.
    if (event.detail === 0) press('node')
    // In Hover Mode the node is the disclosure: it opens and folds the branches,
    // and stays on the page — Hover Mode over Golden Nuggets included.
    // Anywhere else it is the way in, and the new page opens them.
    if (mode === 'hover') {
      event.preventDefault()
      trees.toggle('hover', performance.now())
    } else trees.open('hover', performance.now())
  }

  /** Another mode: whatever is open folds, and the page changes under it. */
  const pressOther = () => {
    press('other')
    trees.closeAll()
  }

  const choose = useCallback(
    (value: string) => {
      onDifficultyChange?.(value as HoverDifficulty)
      // Chosen, and folded away again.
      trees.close('hover')
    },
    [onDifficultyChange, trees],
  )

  const chosenLabel = ITEMS.find((item) => item.value === difficulty)?.label ?? ''
  const trainerLabel = useId()

  return (
    <>
      <nav aria-label="Mode" className={styles.modes}>
        <PillLink
          to={ROUTES.gg}
          label="Standard"
          description={STANDARD_DESCRIPTION}
          current={mode === 'standard'}
          onClick={pressOther}
        />

        {/* The typist's own material, beside the vocabularies the application
            brings: the way in is here, where a mode is chosen. */}
        <PillLink
          to={ROUTES.ggTexts}
          label="Your texts"
          description={LIBRARY_DESCRIPTION}
          current={mode === 'library'}
          onClick={pressOther}
        />

        <div role="group" aria-labelledby={trainerLabel} className={styles.trainer}>
          <span id={trainerLabel} className={styles.trainerLabel}>
            High Speed Trainer
          </span>

          <Link
            ref={node}
            to={ROUTES.ggHover}
            className={unfold.node}
            data-open={mode === 'hover'}
            // Part of Hover Mode's tree (see BRANCH_TREE_ATTRIBUTE), and its node.
            data-branch-tree="hover"
            data-branch-node=""
            aria-current={mode === 'hover' ? 'page' : undefined}
            aria-expanded={mode === 'hover' ? open : undefined}
            title={HOVER_DESCRIPTION}
            onPointerDown={() => press('node')}
            onClick={pressNode}
          >
            <span ref={nodeGlass} className={unfold.nodeGlass}>
              <span ref={nodeLight} className={unfold.nodeLight} aria-hidden="true" />
              <span className={unfold.nodeSeat} aria-hidden="true">
                <span className={unfold.nodeCore} />
              </span>
              <span className={unfold.nodeLabel}>
                Hover Mode
                <span className="visually-hidden">: {HOVER_DESCRIPTION}</span>
              </span>
              {/* Which difficulty is on, where the branches are not. */}
              {mode === 'hover' && <span className={styles.chosen}>{chosenLabel}</span>}
            </span>
          </Link>

          <Link
            to={ROUTES.ggSyllables}
            className={unfold.node}
            data-open={mode === 'syllable'}
            aria-current={mode === 'syllable' ? 'page' : undefined}
            title={SYLLABLE_DESCRIPTION}
            onClick={pressOther}
          >
            <span className={unfold.nodeGlass}>
              <span className={styles.syllableMark} aria-hidden="true">
                <span />
                <span />
              </span>
              <span className={unfold.nodeLabel}>
                Syllable Trainer
                <span className="visually-hidden">: {SYLLABLE_DESCRIPTION}</span>
              </span>
            </span>
          </Link>
        </div>
      </nav>

      <UnfoldBranches
        phase={phase}
        row={row}
        inner={inner}
        stems={stems}
        list={list}
        tree="hover"
        name="gg-hover-difficulty"
        label="Hover difficulty"
        items={ITEMS}
        value={difficulty}
        onChange={choosing ? choose : undefined}
        onReselect={() => trees.close('hover')}
        className={styles.branches}
      />
    </>
  )
}

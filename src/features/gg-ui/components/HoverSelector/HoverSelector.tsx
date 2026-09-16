/**
 * The mode selector: ordinary practice, and Hover Mode as a small glass node
 * that unfolds into its three difficulties.
 *
 * In Hover Mode the node is open: three glass branches — Standard, All In,
 * Tired — hang from it on stems, and choosing one is choosing the difficulty.
 * In ordinary practice it is folded shut. Going from one to the other plays the
 * unfolding or the fold (see Unfold/unfold.motion.ts) from wherever it is, even
 * though the page itself is replaced in between.
 *
 * Each branch shows the difficulty's own name and description, the same words
 * the result and Golden Nuggets use, and one to three beads for how persistent
 * it is.
 */

import { useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router'

import { ROUTES } from '@app/routes.ts'
import type { HoverDifficulty } from '@core/types'
import { HOVER_DIFFICULTY_OPTIONS } from '@features/ggtyping'

import { PillLink } from '../controls/controls.tsx'
import unfold from '../Unfold/Unfold.module.css'
import { UnfoldBranches, type UnfoldItem } from '../Unfold/UnfoldBranches.tsx'
import { useUnfold } from '../Unfold/useUnfold.ts'

import styles from './HoverSelector.module.css'

export type GGMode = 'standard' | 'hover'

const STANDARD_DESCRIPTION = 'Words, typed straight through'
const HOVER_DESCRIPTION = 'Target mistakes and repeat them'

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
  const open = mode === 'hover'
  const node = useRef<HTMLAnchorElement>(null)
  const nodeGlass = useRef<HTMLSpanElement>(null)
  const nodeLight = useRef<HTMLSpanElement>(null)
  const nodeCore = useRef<HTMLSpanElement>(null)
  const row = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const stems = useRef<SVGGElement>(null)
  const list = useRef<HTMLDivElement>(null)
  // One object for the life of the selector, so the hook's effects see the same refs every render.
  const [refs] = useState(() => ({ node, nodeGlass, nodeLight, nodeCore, row, inner, stems, list }))
  const { phase, press } = useUnfold(open, refs)
  const choosing = open && onDifficultyChange !== undefined

  const pressNode = (event: MouseEvent) => {
    // A pointer already pressed on the way down; a key arrives only as a click.
    if (event.detail === 0) press('node')
  }

  return (
    <>
      <nav aria-label="Mode" className={styles.modes}>
        <PillLink
          to={ROUTES.gg}
          label="Standard"
          description={STANDARD_DESCRIPTION}
          current={mode === 'standard'}
          onClick={() => press('other')}
        />

        <Link
          ref={node}
          to={ROUTES.ggHover}
          className={unfold.node}
          data-open={open}
          aria-current={open ? 'page' : undefined}
          title={HOVER_DESCRIPTION}
          onPointerDown={() => press('node')}
          onClick={pressNode}
        >
          <span ref={nodeGlass} className={unfold.nodeGlass}>
            <span ref={nodeLight} className={unfold.nodeLight} aria-hidden="true" />
            <span className={unfold.nodeSeat} aria-hidden="true">
              <span ref={nodeCore} className={unfold.nodeCore} />
            </span>
            <span className={unfold.nodeLabel}>
              Hover Mode
              <span className="visually-hidden">: {HOVER_DESCRIPTION}</span>
            </span>
          </span>
        </Link>
      </nav>

      <UnfoldBranches
        phase={phase}
        row={row}
        inner={inner}
        stems={stems}
        list={list}
        name="gg-hover-difficulty"
        label="Hover difficulty"
        items={ITEMS}
        value={difficulty}
        onChange={choosing ? (value) => onDifficultyChange?.(value as HoverDifficulty) : undefined}
        className={styles.branches}
      />
    </>
  )
}

/**
 * The mode selector: ordinary practice, and Hover Mode as a small glass node
 * that unfolds into its three difficulties.
 *
 * Entering Hover Mode unfolds the node: three glass branches — Standard, All
 * In, Tired — hang from it on stems, and choosing one is choosing the
 * difficulty. Choosing folds them away again, so the branches never sit there
 * taking up the page; the node itself then says which difficulty is on. Pressing
 * the node in Hover Mode unfolds them again, and leaving folds them.
 *
 * The unfolding (see Unfold/unfold.motion.ts) carries on from wherever it is,
 * even though entering and leaving Hover Mode replaces the page underneath it.
 *
 * Each branch shows the difficulty's own name and description, the same words
 * the result and Golden Nuggets use, and one to three beads for how persistent
 * it is.
 */

import { useCallback, useContext, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router'

import { ROUTES } from '@app/routes.ts'
import type { HoverDifficulty } from '@core/types'
import { HOVER_DIFFICULTY_OPTIONS } from '@features/ggtyping'

import { PillLink } from '../controls/controls.tsx'
import { justSwitched, UnfoldMemoryContext, type UnfoldMemory } from '../Unfold/unfold-memory.ts'
import unfold from '../Unfold/Unfold.module.css'
import { UNFOLD_MOTION } from '../Unfold/unfold.motion.ts'
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

/** Entering Hover Mode by pressing the node unfolds it; arriving any other way does not. */
const opensOnArrival = (mode: GGMode, memory: UnfoldMemory | null): boolean =>
  mode === 'hover' && justSwitched(memory, performance.now(), UNFOLD_MOTION.continuityMs)

export const HoverSelector = ({ mode, difficulty, onDifficultyChange }: HoverSelectorProps) => {
  const memory = useContext(UnfoldMemoryContext)
  /*
   * Whether the branches are out, and which mode that was decided for. A mode
   * change decides it again — on arrival by press they unfold, and a reload or
   * the back button shows the mode rather than the choice behind it — whether
   * the new mode arrives as a new selector or as a new prop on this one.
   */
  const [shown, setShown] = useState(() => ({ mode, open: opensOnArrival(mode, memory) }))
  if (shown.mode !== mode) setShown({ mode, open: opensOnArrival(mode, memory) })
  const open = shown.mode === mode && shown.open
  const setOpen = useCallback((next: boolean) => {
    setShown((was) => ({ ...was, open: next }))
  }, [])

  const node = useRef<HTMLAnchorElement>(null)
  const nodeGlass = useRef<HTMLSpanElement>(null)
  const nodeLight = useRef<HTMLSpanElement>(null)
  const row = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const stems = useRef<SVGGElement>(null)
  const list = useRef<HTMLDivElement>(null)
  // One object for the life of the selector, so the hook's effects see the same refs every render.
  const [refs] = useState(() => ({ node, nodeGlass, nodeLight, row, inner, stems, list }))
  const { phase, press } = useUnfold(open && mode === 'hover', refs)
  const choosing = open && mode === 'hover' && onDifficultyChange !== undefined

  const pressNode = (event: MouseEvent) => {
    // A pointer already pressed on the way down; a key arrives only as a click.
    if (event.detail === 0) press('node')
    // In Hover Mode the node is the disclosure: it opens and folds the branches.
    // On ordinary practice it is the way in, and the new page opens them.
    if (mode === 'hover') setOpen(!open)
  }

  const choose = useCallback(
    (value: string) => {
      onDifficultyChange?.(value as HoverDifficulty)
      // Chosen, and folded away again.
      setOpen(false)
    },
    [onDifficultyChange, setOpen],
  )

  const chosenLabel = ITEMS.find((item) => item.value === difficulty)?.label ?? ''

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
          data-open={mode === 'hover'}
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
        onChange={choosing ? choose : undefined}
        className={styles.branches}
      />
    </>
  )
}

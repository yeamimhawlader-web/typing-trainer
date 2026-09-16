/**
 * Pace: a glass node that unfolds into the speeds a pace caret can keep.
 *
 * The same object as Hover Mode's and the sound selector's, and one of the same
 * branch trees, so only one of the three is ever out. Its branches are Off and
 * three of the typist's own speeds — their typical speed, a push a little past
 * it, and their best recent test — each saying what it is worth in words per
 * minute, read from history (`paceTargets`). Until there are a few ordinary
 * tests to read, the speeds are there but cannot be chosen, and say why.
 *
 * Choosing folds the branches, and the node says the pace from then on. The
 * caret itself is drawn in the words (WordStream/PaceCaret.tsx).
 */

import { useCallback, useRef, useState } from 'react'

import type { PaceTargets } from '@core/statistics'
import type { PaceChoice } from '@core/types'

import { Separator } from '../controls/controls.tsx'
import { PaceIcon } from '../icons.tsx'
import { useBranchTrees, useTreeOpen } from '../Unfold/branch-trees.ts'
import unfold from '../Unfold/Unfold.module.css'
import { UnfoldBranches, type UnfoldItem } from '../Unfold/UnfoldBranches.tsx'
import { useUnfold } from '../Unfold/useUnfold.ts'

import styles from './PaceSelector.module.css'

const LABELS: Readonly<Record<PaceChoice, string>> = {
  off: 'Off',
  average: 'Average',
  push: 'Push',
  best: 'Best',
}

/** A speed as a branch: what it is worth, or why it cannot be chosen yet. */
const speed = (wpm: number | null, what: string): Pick<UnfoldItem, 'description' | 'disabled'> =>
  wpm === null ? { description: 'After a few tests', disabled: true } : { description: `${wpm} wpm · ${what}`, disabled: false }

const itemsFor = (targets: PaceTargets | null): readonly UnfoldItem[] => [
  { value: 'off', label: LABELS.off, description: 'No pace to follow', marks: 1, tone: 'calm' },
  { value: 'average', label: LABELS.average, marks: 1, tone: 'calm', ...speed(targets?.average ?? null, 'your typical speed') },
  { value: 'push', label: LABELS.push, marks: 2, tone: 'committed', ...speed(targets?.push ?? null, 'just past your typical') },
  { value: 'best', label: LABELS.best, marks: 3, tone: 'persistent', ...speed(targets?.best ?? null, 'your fastest recent test') },
]

export interface PaceSelectorProps {
  readonly value: PaceChoice
  readonly onChange: (value: PaceChoice) => void
  /** The typist's speeds, or null while history is being read. */
  readonly targets: PaceTargets | null
  /** The speed the caret is keeping now, or null when there is none. */
  readonly wpm: number | null
}

export const PaceSelector = ({ value, onChange, targets, wpm }: PaceSelectorProps) => {
  const trees = useBranchTrees()
  const open = useTreeOpen(trees, 'pace')

  const node = useRef<HTMLButtonElement>(null)
  const nodeGlass = useRef<HTMLSpanElement>(null)
  const nodeLight = useRef<HTMLSpanElement>(null)
  const row = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const stems = useRef<SVGGElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [refs] = useState(() => ({ node, nodeGlass, nodeLight, row, inner, stems, list }))
  const { phase, press } = useUnfold(open, refs, { memory: trees.memoryOf('pace'), trees, tree: 'pace' })

  const toggle = useCallback(() => {
    press('node')
    trees.toggle('pace', performance.now())
  }, [press, trees])

  const choose = useCallback(
    (next: string) => {
      onChange(next as PaceChoice)
      trees.close('pace')
    },
    [onChange, trees],
  )

  const on = value !== 'off' && wpm !== null
  const label = on ? `Pace: ${LABELS[value]}, ${wpm} words per minute` : 'Pace: off'

  return (
    <>
      <span className={styles.cell}>
        <Separator />
        <button
          ref={node}
          type="button"
          className={unfold.node}
          data-open={open}
          data-branch-tree="pace"
          data-branch-node=""
          aria-expanded={open}
          aria-label={label}
          title={label}
          onClick={toggle}
        >
          <span ref={nodeGlass} className={unfold.nodeGlass}>
            <span ref={nodeLight} className={unfold.nodeLight} aria-hidden="true" />
            <span className={unfold.nodeIcon} data-on={on} aria-hidden="true">
              <PaceIcon width="16" height="16" />
            </span>
            <span className={unfold.nodeLabel}>Pace</span>
            {/* The speed kept, where the branches are not. */}
            {on && (
              <span className={styles.chosen} aria-hidden="true">
                {wpm}
              </span>
            )}
          </span>
        </button>
      </span>

      <UnfoldBranches
        phase={phase}
        row={row}
        inner={inner}
        stems={stems}
        list={list}
        tree="pace"
        name="gg-pace"
        label="Pace"
        items={itemsFor(targets)}
        value={value}
        onChange={open ? choose : undefined}
        onReselect={() => trees.close('pace')}
        className={styles.branches}
      />
    </>
  )
}

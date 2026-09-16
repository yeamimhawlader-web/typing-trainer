/**
 * The branches a glass node unfolds into: one choice each, on stems.
 *
 * The same object serves Hover Mode's difficulties and the sound packs, because
 * it is the same interaction — a small glass thing that opens into the choices
 * it holds. What differs is only what the choices are, and whether they are
 * roomy enough to carry their description or compact enough to be named and
 * heard.
 *
 * Native radios in one group: arrow keys move between them, a screen reader
 * announces "2 of 6", and they can be used the moment they appear — nothing
 * waits for the animation. While a set of branches folds away they are inert
 * and hidden from assistive technology, because they are no longer a choice.
 */

import type { ReactNode, RefObject } from 'react'

import styles from './Unfold.module.css'
import type { UnfoldPhase } from './useUnfold.ts'
import { BRANCH_PART } from './useUnfold.ts'

/** How much a choice asks for, drawn as one to three beads. */
export type BranchTone = 'calm' | 'committed' | 'persistent'

export interface UnfoldItem {
  readonly value: string
  readonly label: string
  /** What the choice does, in a few words. Said aloud even where it is not shown. */
  readonly description: string
  readonly marks: 1 | 2 | 3
  readonly tone: BranchTone
}

export interface UnfoldBranchesProps {
  readonly phase: UnfoldPhase
  readonly row: RefObject<HTMLDivElement | null>
  readonly inner: RefObject<HTMLDivElement | null>
  readonly stems: RefObject<SVGGElement | null>
  readonly list: RefObject<HTMLDivElement | null>
  /** The radio group's name and its spoken label. */
  readonly name: string
  readonly label: string
  readonly items: readonly UnfoldItem[]
  readonly value: string
  /** Absent where the branches are only folding away, and no longer a choice. */
  readonly onChange?: ((value: string) => void) | undefined
  /** Names and beads only, for more choices than a row has room to describe. */
  readonly compact?: boolean
  /** The class that puts the row where it belongs in its own layout. */
  readonly className?: string | undefined
  /** Anything that belongs in the unfolded row beside the branches. */
  readonly beside?: ReactNode
}

/** The drawn stems: a trunk, used when the branches stack, and one per branch. */
const STEMS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'] as const

const BEADS = ['one', 'two', 'three'] as const

export const UnfoldBranches = ({
  phase,
  row,
  inner,
  stems,
  list,
  name,
  label,
  items,
  value,
  onChange,
  compact = false,
  className,
  beside,
}: UnfoldBranchesProps) => {
  if (phase === 'closed') return null
  const choosing = onChange !== undefined

  return (
    <div
      ref={row}
      className={[styles.row, className].filter(Boolean).join(' ')}
      data-phase={phase}
      inert={!choosing}
      aria-hidden={choosing ? undefined : true}
    >
      <div ref={inner} className={styles.inner}>
        <svg className={styles.stems} aria-hidden="true" focusable="false">
          <g ref={stems} className={styles.stemGroup}>
            {STEMS.slice(0, items.length + 1).map((key) => (
              <path key={key} pathLength={1} />
            ))}
          </g>
        </svg>

        <div ref={list} role="radiogroup" aria-label={label} className={styles.list} data-compact={compact}>
          {items.map((item) => (
            <label key={item.value} className={styles.branch} data-branch={item.value} data-tone={item.tone}>
              <input
                type="radio"
                className={styles.nativeInput}
                name={name}
                value={item.value}
                checked={item.value === value}
                onChange={() => onChange?.(item.value)}
                aria-label={`${item.label}: ${item.description}`}
              />
              <span className={styles.glass} title={item.description}>
                <span data-part={BRANCH_PART.light} className={styles.light} aria-hidden="true" />
                <span className={styles.beads} aria-hidden="true">
                  {BEADS.slice(0, item.marks).map((bead) => (
                    <span key={bead} className={styles.bead} />
                  ))}
                </span>
                <span data-part={BRANCH_PART.text} className={styles.text} aria-hidden="true">
                  <span className={styles.label}>{item.label}</span>
                  <span className={styles.subtitle}>{item.description}</span>
                </span>
              </span>
            </label>
          ))}
        </div>

        {beside}
      </div>
    </div>
  )
}

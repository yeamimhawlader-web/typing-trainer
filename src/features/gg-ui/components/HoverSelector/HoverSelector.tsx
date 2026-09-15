/**
 * The mode selector: ordinary practice, and Hover Mode as a small glass node
 * that unfolds into its three difficulties.
 *
 * In Hover Mode the node is open: three glass branches — Standard, All In,
 * Tired — hang from it on thin stems, and choosing one is choosing the
 * difficulty. In ordinary practice it is folded shut. Going from one to the
 * other plays the unfolding or the fold (see unfold.motion.ts) from wherever it
 * is, even though the page itself is replaced in between.
 *
 * The branches are native radios in one group, as every GG.Typing choice is:
 * arrow keys move between them and a screen reader announces "2 of 3". They can
 * be used the moment they appear; nothing waits for an animation. While they
 * fold away on the ordinary practice page they are inert and hidden from
 * assistive technology, because they are no longer a choice there.
 *
 * Each branch shows the difficulty's own name and description, the same words
 * the result and Golden Nuggets use, and one to three beads for how persistent
 * it is. A chosen branch fills its beads and lights from within, so the choice
 * is shown by shape and weight as well as by colour.
 */

import { useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router'

import { ROUTES } from '@app/routes.ts'
import type { HoverDifficulty } from '@core/types'
import { HOVER_DIFFICULTY_OPTIONS } from '@features/ggtyping'

import { PillLink } from '../controls/controls.tsx'

import styles from './HoverSelector.module.css'
import { BRANCH_PART, useUnfold } from './useUnfold.ts'

export type GGMode = 'standard' | 'hover'

const STANDARD_DESCRIPTION = 'Words, typed straight through'
const HOVER_DESCRIPTION = 'Target mistakes and repeat them'

/** How persistent each difficulty is, drawn as beads. */
const BEADS: Readonly<Record<HoverDifficulty, readonly string[]>> = {
  standard: ['one'],
  'all-in': ['one', 'two'],
  tired: ['one', 'two', 'three'],
}

/** The drawn stems: a trunk, used when the branches stack, and one per branch. */
const STEMS = ['first', 'second', 'third', 'fourth'] as const

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
          className={styles.node}
          data-open={open}
          aria-current={open ? 'page' : undefined}
          title={HOVER_DESCRIPTION}
          onPointerDown={() => press('node')}
          onClick={pressNode}
        >
          <span ref={nodeGlass} className={styles.nodeGlass}>
            <span ref={nodeLight} className={styles.nodeLight} aria-hidden="true" />
            <span className={styles.nodeSeat} aria-hidden="true">
              <span ref={nodeCore} className={styles.nodeCore} />
            </span>
            <span className={styles.nodeLabel}>
              Hover Mode
              <span className="visually-hidden">: {HOVER_DESCRIPTION}</span>
            </span>
          </span>
        </Link>
      </nav>

      {phase !== 'closed' && (
        <div
          ref={row}
          className={styles.row}
          data-phase={phase}
          inert={!choosing}
          aria-hidden={choosing ? undefined : true}
        >
          <div ref={inner} className={styles.inner}>
            <svg className={styles.stems} aria-hidden="true" focusable="false">
              <g ref={stems} className={styles.stemGroup}>
                {STEMS.map((key) => (
                  <path key={key} pathLength={1} />
                ))}
              </g>
            </svg>

            <div ref={list} role="radiogroup" aria-label="Hover difficulty" className={styles.list}>
              {HOVER_DIFFICULTY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={styles.branch}
                  data-difficulty={option.value}
                >
                  <input
                    type="radio"
                    className={styles.nativeInput}
                    name="gg-hover-difficulty"
                    value={option.value}
                    checked={option.value === difficulty}
                    onChange={() => onDifficultyChange?.(option.value)}
                    aria-label={`${option.label}: ${option.description}`}
                  />
                  <span className={styles.glass}>
                    <span data-part={BRANCH_PART.light} className={styles.light} aria-hidden="true" />
                    <span className={styles.beads} aria-hidden="true">
                      {BEADS[option.value].map((bead) => (
                        <span key={bead} className={styles.bead} />
                      ))}
                    </span>
                    <span data-part={BRANCH_PART.text} className={styles.text} aria-hidden="true">
                      <span className={styles.label}>{option.label}</span>
                      <span className={styles.subtitle}>{option.description}</span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

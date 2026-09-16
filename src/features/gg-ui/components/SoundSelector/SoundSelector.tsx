/**
 * Sound: a glass node that unfolds into the keyboards you can type on.
 *
 * The same object as Hover Mode's selector, holding a different kind of choice
 * — Off, and one branch per sound pack. Pressing the speaker opens it; pressing
 * it again folds it. Choosing a pack plays a key from that pack as you choose
 * it, because what a pack is cannot be read, only heard. Nothing is applied
 * later or on a confirmation: the choice is the preview.
 *
 * Unlike Hover Mode's, this selector is opened and closed on this page rather
 * than by changing page, so its motion is its own and is not remembered across
 * the shell.
 */

import { useCallback, useRef, useState } from 'react'

import { SOUND_PACK_LIST, useSound, type SoundPreference } from '@features/sound'

import { Separator } from '../controls/controls.tsx'
import { SoundOffIcon, SoundOnIcon } from '../icons.tsx'
import unfold from '../Unfold/Unfold.module.css'
import { UnfoldBranches, type BranchTone, type UnfoldItem } from '../Unfold/UnfoldBranches.tsx'
import { useUnfold } from '../Unfold/useUnfold.ts'

import styles from './SoundSelector.module.css'

/** How much each pack is heard: its beads, and how much accent it carries. */
const TONES: Readonly<Record<string, Pick<UnfoldItem, 'marks' | 'tone'>>> = {
  off: { marks: 1, tone: 'calm' },
  hush: { marks: 1, tone: 'calm' },
  cream: { marks: 2, tone: 'calm' },
  thock: { marks: 2, tone: 'committed' },
  click: { marks: 3, tone: 'committed' },
  typewriter: { marks: 3, tone: 'persistent' },
}

const toneOf = (id: string): Pick<UnfoldItem, 'marks' | 'tone'> =>
  TONES[id] ?? { marks: 2 as const, tone: 'calm' as BranchTone }

const ITEMS: readonly UnfoldItem[] = [
  { value: 'off', label: 'Off', description: 'No sound at all', marks: 1, tone: 'calm' },
  ...SOUND_PACK_LIST.map((pack) => {
    const tone = toneOf(pack.id)
    return { value: pack.id, label: pack.name, description: pack.description, marks: tone.marks, tone: tone.tone }
  }),
]

export interface SoundSelectorProps {
  /** Sound off, or the pack it is on. */
  readonly value: SoundPreference
  readonly onChange: (value: SoundPreference) => void
}

export const SoundSelector = ({ value, onChange }: SoundSelectorProps) => {
  const [open, setOpen] = useState(false)
  const sound = useSound()

  const node = useRef<HTMLButtonElement>(null)
  const nodeGlass = useRef<HTMLSpanElement>(null)
  const nodeLight = useRef<HTMLSpanElement>(null)
  const nodeCore = useRef<HTMLSpanElement>(null)
  const row = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const stems = useRef<SVGGElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [refs] = useState(() => ({ node, nodeGlass, nodeLight, nodeCore, row, inner, stems, list }))
  // Its own motion, not the shell's: this selector belongs to one page.
  const { phase, press } = useUnfold(open, refs, { shared: false })

  const toggle = useCallback(() => {
    press('node')
    setOpen((was) => !was)
  }, [press])

  const choose = useCallback(
    (next: string) => {
      onChange(next)
      // Heard as it is chosen, in the pack chosen — the description no words give.
      if (next !== 'off') sound?.preview(next as Parameters<NonNullable<typeof sound>['preview']>[0])
    },
    [onChange, sound],
  )

  const on = value !== 'off'
  const chosen = ITEMS.find((item) => item.value === value) ?? ITEMS[0]
  const label = on ? `Sound: ${chosen?.label ?? ''}` : 'Sound: off'

  return (
    <>
      <span className={styles.cell}>
        <Separator />
        <button
          ref={node}
          type="button"
          className={unfold.node}
          data-open={open}
          aria-expanded={open}
          aria-label={label}
          title={label}
          onClick={toggle}
        >
          <span ref={nodeGlass} className={unfold.nodeGlass}>
            <span ref={nodeLight} className={unfold.nodeLight} aria-hidden="true" />
            <span className={unfold.nodeIcon} aria-hidden="true">
              {on ? <SoundOnIcon width="16" height="16" /> : <SoundOffIcon width="16" height="16" />}
            </span>
            {/* The core is the unfolding's to light; the icon says whether sound is on. */}
            <span className={unfold.nodeSeat} aria-hidden="true" hidden>
              <span ref={nodeCore} className={unfold.nodeCore} />
            </span>
            <span className={unfold.nodeLabel}>Sound</span>
          </span>
        </button>
      </span>

      <UnfoldBranches
        phase={phase}
        row={row}
        inner={inner}
        stems={stems}
        list={list}
        name="gg-sound"
        label="Sound"
        items={ITEMS}
        value={on ? value : 'off'}
        onChange={open ? choose : undefined}
        compact
        className={styles.branches}
      />
    </>
  )
}

/**
 * Sound: a glass node that unfolds into the sounds you can type to.
 *
 * The same object as Hover Mode's selector, holding a different kind of choice
 * — Off, and one branch per sound of a style, with the style and the master
 * volume beside them. Sounds come in styles — Mechanical keyboards, Neon air
 * and synths, Soft bubbles and glass, Arcade blips — and the branches are the
 * sounds of the style showing: choosing another style brings its sounds into
 * the same branches, and the tree opens on the style of the sound in use.
 * Pressing the speaker opens it; choosing a pack plays that pack and folds it
 * again, so the branches are never left taking up the page. Nothing is applied
 * later or on a confirmation: the choice is the preview.
 *
 * The audio device is opened once the choices are out and still — opening the
 * sound choices is asking for sound — so that the first choice plays straight
 * away instead of spending the moment the branches fold waking the device.
 * Sound off and never looked at opens nothing.
 *
 * It is one of the branch trees (Unfold/branch-trees.ts), so it is never open
 * alongside Hover Mode's: pressing one while the other is out folds the other
 * as this one grows, in the same row beneath the toolbar. Its motion is kept
 * by the shell with the trees, so a page change mid-fold carries on folding.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  categoryOf,
  packsIn,
  SOUND_CATEGORIES,
  SOUND_PACK_LIST,
  useSound,
  type SoundPackDetails,
  type SoundPreference,
} from '@features/sound'

import { PillGroup, type PillOption } from '../controls/controls.tsx'
import { SoundOffIcon, SoundOnIcon } from '../icons.tsx'
import { useBranchTrees, useTreeOpen } from '../Unfold/branch-trees.ts'
import unfold from '../Unfold/Unfold.module.css'
import { UnfoldBranches, type BranchTone, type UnfoldItem } from '../Unfold/UnfoldBranches.tsx'
import { useUnfold } from '../Unfold/useUnfold.ts'

import styles from './SoundSelector.module.css'
import { VolumeSlider } from './VolumeSlider.tsx'

/** How much each pack is heard: its beads, and how much accent it carries. */
const TONES: Readonly<Record<string, Pick<UnfoldItem, 'marks' | 'tone'>>> = {
  off: { marks: 1, tone: 'calm' },
  hush: { marks: 1, tone: 'calm' },
  cream: { marks: 2, tone: 'calm' },
  thock: { marks: 2, tone: 'committed' },
  click: { marks: 3, tone: 'committed' },
  typewriter: { marks: 3, tone: 'persistent' },
  woosh: { marks: 2, tone: 'calm' },
  laser: { marks: 2, tone: 'committed' },
  synthwave: { marks: 3, tone: 'committed' },
  hologram: { marks: 2, tone: 'calm' },
  bubble: { marks: 1, tone: 'calm' },
  droplet: { marks: 1, tone: 'calm' },
  chime: { marks: 2, tone: 'calm' },
  blip: { marks: 2, tone: 'committed' },
  coin: { marks: 3, tone: 'committed' },
  chiptune: { marks: 3, tone: 'persistent' },
}

const toneOf = (id: string): Pick<UnfoldItem, 'marks' | 'tone'> =>
  TONES[id] ?? { marks: 2 as const, tone: 'calm' as BranchTone }

const OFF: UnfoldItem = { value: 'off', label: 'Off', description: 'No sound at all', marks: 1, tone: 'calm' }

const itemOf = (pack: SoundPackDetails): UnfoldItem => {
  const tone = toneOf(pack.id)
  return { value: pack.id, label: pack.name, description: pack.description, marks: tone.marks, tone: tone.tone }
}

type StyleId = (typeof SOUND_CATEGORIES)[number]['id']

/** Off, and the sounds of one style. */
const itemsIn = (style: StyleId): readonly UnfoldItem[] => [OFF, ...packsIn(style).map(itemOf)]

const STYLE_OPTIONS: readonly PillOption<StyleId>[] = SOUND_CATEGORIES.map((style) => ({
  value: style.id,
  label: style.name,
  accessibleLabel: `${style.name}: ${style.description}`,
}))

export interface SoundSelectorProps {
  /** Sound off, or the pack it is on. */
  readonly value: SoundPreference
  readonly onChange: (value: SoundPreference) => void
  /** The master volume, 0–100. */
  readonly volume: number
  readonly onVolumeChange: (volume: number) => void
}

export const SoundSelector = ({ value, onChange, volume, onVolumeChange }: SoundSelectorProps) => {
  const trees = useBranchTrees()
  const open = useTreeOpen(trees, 'sound')
  const sound = useSound()

  // The style showing: the one of the sound in use each time the tree opens,
  // and whichever is chosen while it is out.
  const [shown, setShown] = useState(() => ({ open, style: categoryOf(value) }))
  if (shown.open !== open) setShown({ open, style: open ? categoryOf(value) : shown.style })
  const style = shown.style
  const items = useMemo(() => itemsIn(style), [style])
  const chooseStyle = useCallback((next: StyleId) => {
    setShown((was) => ({ ...was, style: next }))
  }, [])

  const node = useRef<HTMLButtonElement>(null)
  const nodeGlass = useRef<HTMLSpanElement>(null)
  const nodeLight = useRef<HTMLSpanElement>(null)
  const row = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const stems = useRef<SVGGElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [refs] = useState(() => ({ node, nodeGlass, nodeLight, row, inner, stems, list }))
  const { phase, press } = useUnfold(open, refs, {
    memory: trees.memoryOf('sound'),
    trees,
    tree: 'sound',
    layoutKey: style,
  })

  // Out and still: ready the audio device now, when nothing is moving.
  useEffect(() => {
    if (phase !== 'open' || sound === null) return undefined
    const idle = globalThis.requestIdleCallback
    if (typeof idle === 'function') {
      const handle = idle(() => sound.prepare(), { timeout: 400 })
      return () => globalThis.cancelIdleCallback(handle)
    }
    const timer = window.setTimeout(() => sound.prepare(), 0)
    return () => window.clearTimeout(timer)
  }, [phase, sound])

  const toggle = useCallback(() => {
    press('node')
    trees.toggle('sound', performance.now())
  }, [press, trees])

  const choose = useCallback(
    (next: string) => {
      // Folded away first — the choice is made — then kept and heard: the
      // branches start moving on the next frame whatever the rest costs.
      trees.close('sound')
      onChange(next)
      // Heard as it is chosen, in the pack chosen — the description no words give.
      if (next !== 'off') sound?.preview(next as Parameters<NonNullable<typeof sound>['preview']>[0])
    },
    [onChange, sound, trees],
  )

  const on = value !== 'off'
  const chosen = SOUND_PACK_LIST.find((pack) => pack.id === value)
  const label = on && chosen !== undefined ? `Sound: ${chosen.name}` : 'Sound: off'

  return (
    <>
      <span className={styles.cell}>
        <button
          ref={node}
          type="button"
          className={unfold.node}
          data-open={open}
          data-branch-tree="sound"
          data-branch-node=""
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
        tree="sound"
        name="gg-sound"
        label="Sound"
        items={items}
        itemsKey={style}
        value={on ? value : 'off'}
        onChange={open ? choose : undefined}
        onReselect={(again) => {
          // Heard again, and folded: the same choice, made once more.
          if (again !== 'off') sound?.preview(again as Parameters<NonNullable<typeof sound>['preview']>[0])
          trees.close('sound')
        }}
        compact
        className={styles.branches}
        beside={
          <div className={styles.beside}>
            <PillGroup
              name="gg-sound-style"
              label="Sound style"
              caption="Style"
              options={STYLE_OPTIONS}
              value={style}
              onChange={chooseStyle}
            />
            <VolumeSlider value={volume} onChange={onVolumeChange} />
          </div>
        }
      />
    </>
  )
}

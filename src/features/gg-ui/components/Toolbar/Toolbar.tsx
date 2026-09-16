/**
 * The toolbar: the mode, Hover Mode's difficulty, text size and test length.
 *
 * The mode is a route rather than a setting — ordinary practice at `/gg`, Hover
 * Mode at `/gg/hover` — so a mode is a page that can be linked to and returned
 * to, and the two can never be mixed within one test. Hover Mode's difficulty is
 * part of the mode control: its glass node unfolds into the three difficulties
 * in a row of their own beneath the toolbar (see HoverSelector).
 *
 * Text size and the test's shape are real settings with nowhere else to live.
 * Text size is a preference, kept by the settings store with the rest. The
 * shape — a number of words, or a length of time — is kept there too, both
 * lengths at once, so switching between them remembers each.
 *
 * A drill has no length to choose: it is the material it was generated as, and
 * different text would make its before-and-after comparison meaningless. So the
 * shape is not offered for one.
 *
 * Sound is the same shape of control as the mode: a glass node that unfolds into
 * the keyboards to type on. The two are branch trees of one control, and the
 * toolbar is where they are in use (BranchTreesScope): only one is ever out, in
 * the one row beneath the toolbar, and a press anywhere else folds it.
 */

import { TEXT_SIZES, type HoverDifficulty, type PracticeMode, type PracticeWordCount, type TextSize } from '@core/types'
import type { SoundPreference } from '@features/sound'
import type { WordCount } from '@features/typing'

import { PillGroup, Separator, type PillOption } from '../controls/controls.tsx'
import { HoverSelector, type GGMode } from '../HoverSelector/HoverSelector.tsx'
import { SoundSelector } from '../SoundSelector/SoundSelector.tsx'
import { BranchTreesScope } from '../Unfold/BranchTreesScope.tsx'
import { TestShape } from './TestShape.tsx'

import styles from './Toolbar.module.css'

const SIZE_NAMES: Readonly<Record<TextSize, string>> = {
  xs: 'Extra small text',
  sm: 'Small text',
  md: 'Medium text',
  lg: 'Large text',
  xl: 'Extra large text',
}

const SIZE_OPTIONS: readonly PillOption<TextSize>[] = TEXT_SIZES.map((size) => ({
  value: size,
  label: size,
  accessibleLabel: SIZE_NAMES[size],
}))

export type { GGMode }

export interface ToolbarProps {
  /** The mode on screen. Null where there is no choice, such as a drill. */
  readonly mode: GGMode | null
  /** Hover Mode's difficulty: chosen in Hover Mode, shown folding away when leaving it. */
  readonly hoverDifficulty: HoverDifficulty
  /** How to change it. Absent outside Hover Mode. */
  readonly onHoverDifficultyChange?: ((difficulty: HoverDifficulty) => void) | undefined
  readonly size: TextSize
  readonly onSizeChange: (size: TextSize) => void
  /**
   * What ends a test — a word count or a time — and the two lengths it
   * remembers. Null for a drill, which is the material it was built as.
   */
  readonly shape: {
    readonly mode: PracticeMode
    readonly words: WordCount
    readonly seconds: number
    readonly onWords: (count: WordCount) => void
    readonly onTime: (seconds: number) => void
    /** False where only a number of words makes sense. */
    readonly timeOffered?: boolean
  } | null
  /** Sound off, or the pack it is on, and how to change it. */
  readonly sound: SoundPreference
  readonly onSoundChange: (sound: SoundPreference) => void
  /** The master volume, 0–100. */
  readonly soundVolume: number
  readonly onSoundVolumeChange: (volume: number) => void
}

export const Toolbar = ({
  mode,
  hoverDifficulty,
  onHoverDifficultyChange,
  size,
  onSizeChange,
  shape,
  sound,
  onSoundChange,
  soundVolume,
  onSoundVolumeChange,
}: ToolbarProps) => (
  <BranchTreesScope>
  <div className={styles.toolbar}>
    {mode !== null && (
      <HoverSelector mode={mode} difficulty={hoverDifficulty} onDifficultyChange={onHoverDifficultyChange} />
    )}

    <div className={styles.settings}>
      {mode !== null && <Separator />}

      <PillGroup name="gg-size" label="Text size" options={SIZE_OPTIONS} value={size} onChange={onSizeChange} />

      {shape !== null && (
        <>
          <Separator />
          <TestShape
            mode={shape.mode}
            words={shape.words as PracticeWordCount}
            seconds={shape.seconds}
            onWords={shape.onWords}
            onTime={shape.onTime}
            timeOffered={shape.timeOffered ?? true}
          />
        </>
      )}
    </div>

    <SoundSelector
      value={sound}
      onChange={onSoundChange}
      volume={soundVolume}
      onVolumeChange={onSoundVolumeChange}
    />
  </div>
  </BranchTreesScope>
)

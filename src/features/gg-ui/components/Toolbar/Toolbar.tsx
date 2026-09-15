/**
 * The toolbar: the mode, Hover Mode's difficulty, text size and test length.
 *
 * The mode is a route rather than a setting — ordinary practice at `/gg`, Hover
 * Mode at `/gg/hover` — so a mode is a page that can be linked to and returned
 * to, and the two can never be mixed within one test. Hover Mode's difficulty is
 * part of the mode control: its glass node unfolds into the three difficulties
 * in a row of their own beneath the toolbar (see HoverSelector).
 *
 * Text size and length are real settings with nowhere else to live. Text size is a preference,
 * kept by the settings store with the rest. Test length is the typing session's
 * own word count, which remembers itself through the same preference practice
 * already used — so a length chosen here is the length the classic screen opens
 * on too, and the other way round.
 *
 * A drill has no length to choose: it is the material it was generated as, and
 * different text would make its before-and-after comparison meaningless. So the
 * length group is not offered for one.
 */

import { TEXT_SIZES, type HoverDifficulty, type TextSize } from '@core/types'
import { WORD_COUNT_OPTIONS, type WordCount } from '@features/typing'

import { PillGroup, Separator, type PillOption } from '../controls/controls.tsx'
import { HoverSelector, type GGMode } from '../HoverSelector/HoverSelector.tsx'

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

const LENGTH_OPTIONS: readonly PillOption<WordCount>[] = WORD_COUNT_OPTIONS.map((count) => ({
  value: count,
  label: String(count),
  accessibleLabel: `${count} words`,
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
  /** Null for a drill, which has no length to choose. */
  readonly wordCount: WordCount | null
  readonly onWordCountChange: (count: WordCount) => void
}

export const Toolbar = ({
  mode,
  hoverDifficulty,
  onHoverDifficultyChange,
  size,
  onSizeChange,
  wordCount,
  onWordCountChange,
}: ToolbarProps) => (
  <div className={styles.toolbar}>
    {mode !== null && (
      <HoverSelector mode={mode} difficulty={hoverDifficulty} onDifficultyChange={onHoverDifficultyChange} />
    )}

    <div className={styles.settings}>
      {mode !== null && <Separator />}

      <PillGroup name="gg-size" label="Text size" options={SIZE_OPTIONS} value={size} onChange={onSizeChange} />

      {wordCount !== null && (
        <>
          <Separator />
          <PillGroup
            name="gg-length"
            label="Test length"
            options={LENGTH_OPTIONS}
            value={wordCount}
            onChange={onWordCountChange}
          />
        </>
      )}
    </div>
  </div>
)

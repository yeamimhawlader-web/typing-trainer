/**
 * The toolbar: text size and test length.
 *
 * Both are real settings with nowhere else to live. Text size is a preference,
 * kept by the settings store with the rest. Test length is the typing session's
 * own word count, which remembers itself through the same preference practice
 * already used — so a length chosen here is the length the classic screen opens
 * on too, and the other way round.
 *
 * A drill has no length to choose: it is the material it was generated as, and
 * different text would make its before-and-after comparison meaningless. So the
 * length group is not offered for one.
 */

import { TEXT_SIZES, type TextSize } from '@core/types'
import { WORD_COUNT_OPTIONS, type WordCount } from '@features/typing'

import { PillGroup, Separator, type PillOption } from '../controls/controls.tsx'

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

export interface ToolbarProps {
  readonly size: TextSize
  readonly onSizeChange: (size: TextSize) => void
  /** Null for a drill, which has no length to choose. */
  readonly wordCount: WordCount | null
  readonly onWordCountChange: (count: WordCount) => void
}

export const Toolbar = ({ size, onSizeChange, wordCount, onWordCountChange }: ToolbarProps) => (
  <div className={styles.toolbar}>
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
)

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
 * Pace and Sound are the same shape of control as the mode: glass nodes that
 * unfold, into the speeds a pace caret can keep and the keyboards to type on.
 * All three are branch trees of one control, and the toolbar is where they are
 * in use (BranchTreesScope): only one is ever out, in the one row beneath the
 * nodes, and a press anywhere else folds it.
 */

import type { PaceTargets } from '@core/statistics'
import {
  STREAM_FONTS,
  TEXT_SIZES,
  VOCABULARIES,
  type HoverDifficulty,
  type PaceChoice,
  type PracticeMode,
  type PracticeWordCount,
  type StreamFont,
  type TextSize,
  type Vocabulary,
} from '@core/types'
import type { SoundPreference } from '@features/sound'
import type { WordCount } from '@features/typing'

import { PillGroup, Separator, TogglePill, type PillOption } from '../controls/controls.tsx'
import { HoverSelector, type GGMode } from '../HoverSelector/HoverSelector.tsx'
import { PaceSelector } from '../PaceSelector/PaceSelector.tsx'
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

/** Each typeface's name, spoken, and shown when the pointer rests on its "Aa". */
const FONT_NAMES: Readonly<Record<StreamFont, string>> = {
  slab: 'Roboto Slab',
  mono: 'Geist Mono',
  sans: 'Inter',
  serif: 'Lora',
}

// Each shows itself: "Aa", set in the face it chooses.
const FONT_OPTIONS: readonly PillOption<StreamFont>[] = STREAM_FONTS.map((font) => ({
  value: font,
  label: 'Aa',
  accessibleLabel: FONT_NAMES[font],
  faceClassName: styles[`font-${font}`] ?? '',
}))

const VOCABULARY_NAMES: Readonly<Record<Vocabulary, string>> = { normal: 'Normal', advanced: 'Advanced' }
const VOCABULARY_DESCRIPTIONS: Readonly<Record<Vocabulary, string>> = {
  normal: 'Normal: the two hundred most frequent words',
  advanced: 'Advanced: a wider vocabulary of longer words',
}

const VOCABULARY_OPTIONS: readonly PillOption<Vocabulary>[] = VOCABULARIES.map((vocabulary) => ({
  value: vocabulary,
  label: VOCABULARY_NAMES[vocabulary],
  accessibleLabel: VOCABULARY_DESCRIPTIONS[vocabulary],
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
  /** The typeface the words are set in, and how to change it. */
  readonly font: StreamFont
  readonly onFontChange: (font: StreamFont) => void
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
  /**
   * How ordinary practice's text is dressed: punctuation, numbers, both or
   * neither. Null where the text is not ordinary practice's to dress.
   */
  readonly dress?: {
    readonly punctuation: boolean
    readonly numbers: boolean
    readonly onPunctuation: (on: boolean) => void
    readonly onNumbers: (on: boolean) => void
    /** The vocabulary the words are drawn from: normal, or advanced. */
    readonly vocabulary: Vocabulary
    readonly onVocabulary: (vocabulary: Vocabulary) => void
  } | null
  /** The pace caret: which of the typist's speeds, what those speeds are, and the one kept now. */
  readonly pace: PaceChoice
  readonly onPaceChange: (pace: PaceChoice) => void
  readonly paceTargets: PaceTargets | null
  readonly paceWpm: number | null
}

export const Toolbar = ({
  mode,
  hoverDifficulty,
  onHoverDifficultyChange,
  size,
  onSizeChange,
  font,
  onFontChange,
  shape,
  sound,
  onSoundChange,
  soundVolume,
  onSoundVolumeChange,
  pace,
  onPaceChange,
  paceTargets,
  paceWpm,
  dress = null,
}: ToolbarProps) => (
  <BranchTreesScope>
  <div className={styles.toolbar}>
    {mode !== null && (
      <HoverSelector mode={mode} difficulty={hoverDifficulty} onDifficultyChange={onHoverDifficultyChange} />
    )}

    <div className={styles.settings}>
      <PillGroup name="gg-font" label="Typeface" options={FONT_OPTIONS} value={font} onChange={onFontChange} />

      <Separator />
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

      {dress !== null && (
        <>
          <Separator />
          <PillGroup
            name="gg-vocabulary"
            label="Vocabulary"
            options={VOCABULARY_OPTIONS}
            value={dress.vocabulary}
            onChange={dress.onVocabulary}
          />
          <Separator />
          <div role="group" aria-label="Text" className={styles.dress}>
            <TogglePill
              label="Punctuation"
              description="Sentences, with capitals and commas"
              checked={dress.punctuation}
              onChange={dress.onPunctuation}
            />
            <TogglePill
              label="Numbers"
              description="Figures among the words"
              checked={dress.numbers}
              onChange={dress.onNumbers}
            />
          </div>
        </>
      )}
    </div>

    <PaceSelector value={pace} onChange={onPaceChange} targets={paceTargets} wpm={paceWpm} />

    <SoundSelector
      value={sound}
      onChange={onSoundChange}
      volume={soundVolume}
      onVolumeChange={onSoundVolumeChange}
    />
  </div>
  </BranchTreesScope>
)

/**
 * Hover Mode's difficulties as they are named on screen: the toolbar, the result
 * and Golden Nuggets all say the same thing.
 */

import { HOVER_DIFFICULTIES, type HoverDifficulty } from '@core/types'

export interface HoverDifficultyDetails {
  readonly label: string
  /** What the difficulty does, in a few words. */
  readonly description: string
}

export const HOVER_DIFFICULTY_DETAILS: Readonly<Record<HoverDifficulty, HoverDifficultyDetails>> = {
  standard: { label: 'Standard', description: 'One cycle of three repetitions' },
  'all-in': { label: 'All In', description: 'Two cycles of three repetitions' },
  tired: { label: 'Tired', description: 'Until it clears, up to ten clean repetitions' },
}

export const HOVER_DIFFICULTY_OPTIONS: readonly (HoverDifficultyDetails & { readonly value: HoverDifficulty })[] =
  HOVER_DIFFICULTIES.map((value) => ({
    value,
    label: HOVER_DIFFICULTY_DETAILS[value].label,
    description: HOVER_DIFFICULTY_DETAILS[value].description,
  }))

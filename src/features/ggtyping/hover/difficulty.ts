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
  standard: { label: 'Standard', description: 'One 3-repetition cycle' },
  'all-in': { label: 'All In', description: 'Two 3-repetition cycles' },
  tired: { label: 'Tired', description: 'Repeat until cleared, up to the safety limit' },
}

export const HOVER_DIFFICULTY_OPTIONS: readonly (HoverDifficultyDetails & { readonly value: HoverDifficulty })[] =
  HOVER_DIFFICULTIES.map((value) => ({
    value,
    label: HOVER_DIFFICULTY_DETAILS[value].label,
    description: HOVER_DIFFICULTY_DETAILS[value].description,
  }))

/**
 * Practice text — public entry point.
 *
 * The typing screen asks a `TextProvider` for a target and knows nothing about
 * where the words came from. Adding quotes, pasted text or adaptive material
 * later means adding a provider, not editing the typing screen.
 */

export type { TextProvider, TextRequest } from './types.ts'

export {
  COMMON_WORDS_PROVIDER_ID,
  createCommonWordsProvider,
} from './providers/common-words.provider.ts'
export type { CommonWordsProviderOptions } from './providers/common-words.provider.ts'

export {
  createGoldenNuggetsProvider,
  GOLDEN_NUGGETS_IN_A_TEST,
  GOLDEN_NUGGETS_PROVIDER_ID,
} from './providers/golden-nuggets.provider.ts'
export type { GoldenNuggetsProviderOptions } from './providers/golden-nuggets.provider.ts'

export {
  createSyllableWordsProvider,
  SYLLABLE_WORDS_PROVIDER_ID,
} from './providers/syllable-words.provider.ts'
export type { SyllableWordsProviderOptions } from './providers/syllable-words.provider.ts'

export { createWordText } from './generator.ts'
export { DRESS_RULES, dressWords, numberWord } from './dress.ts'
export type { DressOptions } from './dress.ts'
export type { RandomSource, WordTextOptions } from './generator.ts'

export {
  countOccurrences,
  createDrill,
  createDrillProvider,
  DRILL_PROVIDER_ID,
  DRILL_WORD_COUNT,
  findCarrierWords,
  isDrillableSequence,
  TARGET_DENSITY,
} from './drill.ts'
export type { DrillOptions, DrillPlan, DrillProvider } from './drill.ts'

export { COMMON_WORDS } from './word-list.ts'

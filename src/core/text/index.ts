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

export { createWordText } from './generator.ts'
export type { RandomSource, WordTextOptions } from './generator.ts'

export { COMMON_WORDS } from './word-list.ts'

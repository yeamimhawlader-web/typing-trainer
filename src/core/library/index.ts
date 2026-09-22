/**
 * Your own texts — public entry point.
 *
 * The quotes, goals and word lists a typist keeps for themselves, and the two
 * ways they become a test. The typing screen asks for a provider and knows
 * nothing about where the words came from.
 */

import { storage } from '@core/persistence'

import { createLibraryService } from './service.ts'

export type { LibraryDraft, LibraryKind, LibraryText } from './types.ts'
export { LIBRARY_KINDS, LIBRARY_RULES } from './types.ts'

export { cleanBody, cleanPassage, cleanTitle, isTypeable, plainCharacters, wordsFrom } from './text.ts'

export { createLibraryService, parseLibraryText } from './service.ts'
export type { LibraryService } from './service.ts'

export { createLibraryProvider, LIBRARY_PROVIDER_ID } from './provider.ts'
export type { LibraryProvider, LibraryProviderOptions } from './provider.ts'

/** The application's library, over the configured storage. */
export const libraryService = createLibraryService(storage)

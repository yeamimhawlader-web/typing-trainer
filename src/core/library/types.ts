/**
 * Your own texts: what you want in your hands and in your head.
 *
 * A quote worth keeping, the goals for this year, the words you actually write
 * every day. Typing a thing is a slow, deliberate reading of it — which is why
 * people copy out what they want to remember — so practice material anyone
 * chose for themselves is worth more to them than any word list shipped with
 * the application.
 *
 * Two kinds, because there are two shapes of thing worth keeping:
 *
 * - `passage`: typed as written, word for word, punctuation and all. A quote,
 *   a goal, a rule to live by, a paragraph to memorise.
 * - `words`: a bag of words, drawn from at random like the built-in
 *   vocabularies. The words someone uses most, practised until they are quick.
 */

export const LIBRARY_KINDS = ['passage', 'words'] as const
export type LibraryKind = (typeof LIBRARY_KINDS)[number]

export interface LibraryText {
  readonly id: string
  /** What it is called in the list. Never empty: a text with no title gets its first words. */
  readonly title: string
  /**
   * What is typed. A passage as written, with its whitespace collapsed to
   * single spaces; a word list as words separated by single spaces.
   */
  readonly body: string
  readonly kind: LibraryKind
  readonly createdAt: number
  readonly updatedAt: number
}

/** A text on its way in: no id and no times yet. */
export interface LibraryDraft {
  readonly id?: string
  readonly title: string
  readonly body: string
  readonly kind: LibraryKind
}

export const LIBRARY_RULES = {
  /** Long enough for a paragraph worth memorising, short enough to stay one test. */
  maxBodyCharacters: 4000,
  maxTitleCharacters: 80,
  /** Words kept from a list. Beyond this it is a dictionary, not a practice set. */
  maxWords: 600,
  /** Texts kept at once. A library, not an archive. */
  maxTexts: 60,
  /** Below this a passage is too short to be a test. */
  minBodyCharacters: 12,
} as const

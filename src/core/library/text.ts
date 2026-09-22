/**
 * Turning what someone pasted into something that can be typed.
 *
 * Whatever arrives here came from outside: a quote copied off a website, a list
 * an AI wrote, a paragraph out of a document. It may hold line breaks, tabs,
 * curly quotes, dashes no keyboard has, zero-width characters and emoji.
 *
 * The typing engine compares keystrokes to characters exactly, so a character
 * nobody can type is a test nobody can finish. Everything below exists to make
 * that impossible: whitespace becomes single spaces, typographic punctuation
 * becomes its plain equivalent, and anything still untypeable is dropped.
 */

import { LIBRARY_RULES, type LibraryKind } from './types.ts'

/**
 * Punctuation word processors and websites substitute, mapped back to the keys
 * a keyboard actually has.
 *
 * Whitespace is not here — it is normalised before this map is consulted — and
 * neither are the zero-width characters, which have no plain equivalent and are
 * dropped with everything else untypeable.
 */
const PLAIN: Readonly<Record<string, string>> = {
  '‘': "'",
  '’': "'",
  '‚': "'",
  '‛': "'",
  '“': '"',
  '”': '"',
  '„': '"',
  '′': "'",
  '″': '"',
  '–': '-',
  '—': '-',
  '―': '-',
  '−': '-',
  '…': '...',
}

/** Anything outside printable ASCII: what no keyboard here can produce. */
const UNTYPEABLE = /[^ -~]/g

/**
 * Whatever was pasted, as characters someone can actually type.
 *
 * Line breaks and tabs become spaces before anything untypeable is dropped:
 * dropped instead, they would run the end of one line into the start of the
 * next and make a word nobody wrote.
 */
export const plainCharacters = (text: string): string =>
  text
    .normalize('NFKC')
    .replaceAll(/\s/g, ' ')
    // Every character a keyboard cannot produce, replaced by the plain
    // equivalent it has — and dropped when it has none.
    .replaceAll(UNTYPEABLE, (character) => PLAIN[character] ?? '')

/**
 * A passage as it will be typed: plain characters, every run of whitespace a
 * single space, trimmed, and no longer than a test should be.
 *
 * Line breaks go with the rest of the whitespace. A line break is not a
 * keystroke the field takes — Enter is how a word test is finished — so a
 * passage that kept them could not be typed through.
 */
export const cleanPassage = (text: string): string =>
  plainCharacters(text).replaceAll(/\s+/g, ' ').trim().slice(0, LIBRARY_RULES.maxBodyCharacters)

/**
 * A list of words from anything: prose, a numbered list, comma-separated
 * output, one word a line. Lower case, no duplicates, no punctuation left
 * hanging off the edges.
 *
 * An apostrophe inside a word is kept — "don't" is a word people type — and
 * anything with a digit in it is dropped: those come from the numbering of a
 * list far more often than from a word worth practising.
 */
export const wordsFrom = (text: string): readonly string[] => {
  const seen = new Set<string>()
  for (const raw of plainCharacters(text).toLowerCase().split(/[^a-z'-]+/)) {
    const word = raw.replaceAll(/^['-]+|['-]+$/g, '')
    if (word.length === 0 || word.length > 24) continue
    seen.add(word)
    if (seen.size >= LIBRARY_RULES.maxWords) break
  }
  return [...seen]
}

/** The body as it is stored, by kind: a passage as written, a list as words. */
export const cleanBody = (text: string, kind: LibraryKind): string =>
  kind === 'words' ? wordsFrom(text).join(' ') : cleanPassage(text)

/**
 * A title, or the text's own opening when it has none: a quote someone pasted
 * in a hurry still needs a name in the list.
 */
export const cleanTitle = (title: string, body: string): string => {
  const given = plainCharacters(title).replaceAll(/\s+/g, ' ').trim()
  if (given.length > 0) return given.slice(0, LIBRARY_RULES.maxTitleCharacters)

  const opening = body.trim().split(' ').slice(0, 6).join(' ')
  return opening.length > 0 ? opening.slice(0, LIBRARY_RULES.maxTitleCharacters) : 'Untitled'
}

/** Whether a body is worth keeping: enough to type, and something to type. */
export const isTypeable = (body: string, kind: LibraryKind): boolean =>
  kind === 'words'
    ? body.split(' ').filter((word) => word.length > 0).length >= 3
    : body.length >= LIBRARY_RULES.minBodyCharacters

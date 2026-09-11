/**
 * The compact form, and back again.
 *
 * Storing the enriched record would be storing the same facts several times
 * over: `expected` is the target's character at that position, `correct` is a
 * comparison, the word index is a lookup, and every latency is a subtraction.
 * All of it rebuilds exactly from the position, the key, the time, and the text
 * the session already stores.
 *
 * So only those go to disk, as a tuple per event with delta-encoded times.
 * Measured at roughly 13 bytes of JSON per event against roughly 160 for the
 * enriched object — about a twelvefold difference, which is the difference
 * between a couple of months of history and a couple of years.
 */

import { toCharacters } from '@core/engine'
import type { Keystroke } from '@core/types'

import { rehydrateKeystroke } from './derive.ts'
import {
  TELEMETRY_VERSION,
  type StoredKeystroke,
  type StoredTelemetry,
} from './types.ts'

/** A backspace is the empty key: no character event can produce one. */
const BACKSPACE_KEY = ''

export const encodeTelemetry = (keystrokes: readonly Keystroke[]): StoredTelemetry => {
  let previousAt = 0

  const encoded: StoredKeystroke[] = keystrokes.map((keystroke) => {
    const delta = keystroke.at - previousAt
    previousAt = keystroke.at

    return [
      // Rounded: the browser's own clock is coarser than this, so decimals here
      // would be storing noise.
      Math.round(delta),
      keystroke.index,
      keystroke.kind === 'backspace' ? BACKSPACE_KEY : keystroke.key,
    ]
  })

  return { version: TELEMETRY_VERSION, keystrokes: encoded }
}

/**
 * Rebuilds the engine's keystroke log.
 *
 * `text` is the session's target — the source of `expected` and therefore of
 * `correct`. Returns an empty log for a version this build does not understand,
 * rather than guessing at a format it was not written for.
 */
export const decodeTelemetry = (
  stored: StoredTelemetry,
  text: string,
): readonly Keystroke[] => {
  if (stored.version !== TELEMETRY_VERSION) return []

  const characters = toCharacters(text)
  let at = 0

  return stored.keystrokes.map(([delta, index, key]) => {
    at += delta
    return rehydrateKeystroke(characters, at, index, key)
  })
}

const isStoredKeystroke = (value: unknown): value is StoredKeystroke =>
  Array.isArray(value) &&
  value.length === 3 &&
  typeof value[0] === 'number' &&
  Number.isFinite(value[0]) &&
  typeof value[1] === 'number' &&
  Number.isInteger(value[1]) &&
  value[1] >= 0 &&
  typeof value[2] === 'string'

/**
 * Reads an untrusted value as stored telemetry, or returns null.
 *
 * Same posture as session records: anything off disk was written by some other
 * build, or half-written, and one bad blob must not break a page. Individual
 * malformed events are dropped rather than rejecting the whole session, since a
 * partial keystroke log is still worth having.
 */
export const parseStoredTelemetry = (value: unknown): StoredTelemetry | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null

  const record = value as Record<string, unknown>
  if (typeof record['version'] !== 'number') return null
  if (!Array.isArray(record['keystrokes'])) return null

  return {
    version: record['version'],
    keystrokes: record['keystrokes'].filter(isStoredKeystroke),
  }
}

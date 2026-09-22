/**
 * The keys that cost you: which single characters get mistyped, and how long
 * the hands take to find them.
 *
 * The sequence analyses next door ask which *transitions* are slow — the
 * journey between two keys, which is where most lost time lives. This asks the
 * simpler question they cannot answer: which key does this typist actually miss?
 * That is what a keyboard drawn with the misses marked can show at a glance,
 * and it is the one thing history already knows that nothing yet says out loud.
 *
 * A key is what the typist meant to hit — the expected character, not what
 * came out — because a miss belongs to the key that was aimed at. Case is not
 * a key: A and a are the same one, hit with or without Shift. Only what is
 * hit deliberately is counted; the rest of the punctuation a dressed test adds
 * is counted the same way it is typed.
 */

import { median } from './distribution.ts'
import type { SessionTelemetry } from './types.ts'

export const KEY_RULES = {
  /** Below this many attempts a key's accuracy is noise, not a finding. */
  minimumAttempts: 12,
  /** How many keys the "worst" list holds. */
  worstKeys: 5,
} as const

export interface KeyCost {
  /** The key, as the character it types: 'a', ',', ' ' for the space bar. */
  readonly key: string
  readonly attempts: number
  readonly misses: number
  /** Hits out of attempts, 0–1. */
  readonly accuracy: number
  /** Typical time from the previous key to this one, in milliseconds; null when never hit cleanly. */
  readonly medianMs: number | null
}

export interface KeyCostReport {
  /** Every key with enough attempts to say anything about, worst accuracy first. */
  readonly keys: readonly KeyCost[]
  /** The worst few by accuracy, for saying in words what the keyboard shows in colour. */
  readonly worst: readonly KeyCost[]
  /** Keys seen at all, including those too rare to rank. */
  readonly keysSeen: number
  readonly attempts: number
}

const EMPTY: KeyCostReport = { keys: [], worst: [], keysSeen: 0, attempts: 0 }

interface Tally {
  attempts: number
  misses: number
  latencies: number[]
}

/**
 * One key per character aimed at, case folded, so Shift is not a separate key.
 */
const keyOf = (expected: string): string => expected.toLowerCase()

export const keyCosts = (
  sessions: readonly (SessionTelemetry | null)[],
  rules: { readonly minimumAttempts?: number; readonly worstKeys?: number } = {},
): KeyCostReport => {
  const minimumAttempts = rules.minimumAttempts ?? KEY_RULES.minimumAttempts
  const worstKeys = rules.worstKeys ?? KEY_RULES.worstKeys
  const tallies = new Map<string, Tally>()
  let attempts = 0

  for (const session of sessions) {
    if (session === null) continue
    for (const keystroke of session.keystrokes) {
      if (keystroke.kind !== 'character' || keystroke.expected === null) continue
      const key = keyOf(keystroke.expected)
      const tally = tallies.get(key) ?? { attempts: 0, misses: 0, latencies: [] }
      tally.attempts += 1
      attempts += 1
      if (keystroke.correct) {
        // Only a clean hit says how long the key takes to find; a miss times
        // the hesitation and the mistake together.
        if (keystroke.interKeystrokeMs !== null) tally.latencies.push(keystroke.interKeystrokeMs)
      } else {
        tally.misses += 1
      }
      tallies.set(key, tally)
    }
  }

  if (attempts === 0) return EMPTY

  const keys = [...tallies.entries()]
    .filter(([, tally]) => tally.attempts >= minimumAttempts)
    .map(([key, tally]) => ({
      key,
      attempts: tally.attempts,
      misses: tally.misses,
      accuracy: (tally.attempts - tally.misses) / tally.attempts,
      medianMs: tally.latencies.length > 0 ? Math.round(median(tally.latencies)) : null,
    }))
    // Worst first, and among equals the one with more attempts behind it.
    .toSorted((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts || a.key.localeCompare(b.key))

  return {
    keys,
    worst: keys.filter((key) => key.misses > 0).slice(0, worstKeys),
    keysSeen: tallies.size,
    attempts,
  }
}

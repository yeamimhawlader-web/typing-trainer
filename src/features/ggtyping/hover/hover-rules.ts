/**
 * Hover Mode's rules, as a pure state machine.
 *
 * ## The idea
 *
 * One mistake on a word is enough to focus it. The typist finishes the word as
 * they normally would, then types it again until it has gone cleanly three
 * times, and carries on. A repetition with a mistake in it does not start the
 * count over; it asks for three more clean ones.
 *
 * ## States
 *
 * - `normal` — ordinary typing. Nothing is focused.
 * - `pending` — a mistake has focused a word, and the typist is still on it in
 *   the text. The word is finished in the text exactly as in ordinary practice.
 * - `repeating` — the typist has left the word. Until the focus is released,
 *   every key types the next repetition of that word instead of the text.
 *
 * ## Events, and what each does
 *
 * | Event | normal | pending | repeating |
 * | --- | --- | --- | --- |
 * | `mistake` on a word in the text | focus that word → pending | ignored | ignored |
 * | `left-word` | ignored | → repeating, first repetition | ignored |
 * | `attempt-mistake` | ignored | ignored | first in this repetition: a failure, `required += 3` (to the limit); later ones in the same repetition: ignored |
 * | `attempt-completed` | ignored | ignored | clean: a success. Then released if `successes ≥ required`, or released at the attempt limit, or the next repetition begins |
 * | `end` (restart, test over) | — | → normal, unfinished | → normal, unfinished |
 *
 * Only one focus exists at a time: a mistake while something is focused never
 * starts a second one.
 *
 * ## Counting
 *
 * `required` starts at 3 and every failed repetition adds 3. Successes are never
 * taken away. So the work left is always `required − successes`: three clean
 * repetitions, then a miss after two of them, leaves `6 − 2 = 4`.
 *
 * A repetition is one typing of the word through the typing engine, from its
 * first letter to the space after it. It is clean when the engine recorded no
 * mistake in it — the engine's own verdict, including a mistake later fixed
 * with backspace. A repetition with several mistakes is still one failure: the
 * requirement grows once per repetition, never once per key, so a typist who
 * fumbles one repetition badly is not buried under it.
 *
 * ## The limit
 *
 * Without one, a typist who cannot get the word right would be held on it
 * forever, and a focus that cannot end is a punishment. Two bounds:
 *
 * - `required` never exceeds 12 — the first three and three extensions.
 * - A focus ends after 20 repetitions, clean or not: all twelve clean ones plus
 *   eight misses. The focus is then released as not completed and the text
 *   carries on. At an ordinary pace of about a second a repetition, no focus
 *   holds the typist for much more than twenty seconds.
 */

import type { HoverFocusRecord } from '@core/sessions'

export const HOVER_RULES = {
  /** Clean repetitions a new focus asks for. */
  initialRequired: 3,
  /** Added by each failed repetition. */
  extensionPerFailure: 3,
  /** The most clean repetitions a focus can ask for. */
  maxRequired: 12,
  /** Repetitions, clean or not, after which a focus is released regardless. */
  maxAttempts: 20,
} as const

export interface HoverFocus {
  /** Position of the word among the text's words. */
  readonly wordIndex: number
  readonly word: string
  /** When the mistake that started the focus was typed. */
  readonly activatedAt: number
  readonly required: number
  readonly successes: number
  readonly failures: number
  /** Repetitions finished, clean or not. */
  readonly attempts: number
}

export type HoverState =
  | { readonly phase: 'normal' }
  | { readonly phase: 'pending'; readonly focus: HoverFocus }
  | {
      readonly phase: 'repeating'
      readonly focus: HoverFocus
      /** Whether the repetition in progress has already failed. */
      readonly attemptFailed: boolean
    }

export type HoverEvent =
  | { readonly type: 'mistake'; readonly wordIndex: number; readonly word: string; readonly at: number }
  | { readonly type: 'left-word'; readonly at: number }
  | { readonly type: 'attempt-mistake'; readonly at: number }
  | { readonly type: 'attempt-completed'; readonly at: number }
  | { readonly type: 'end'; readonly at: number }

/**
 * What a step did, for whatever reacts to it — the motion, the screen reader
 * announcement. Exactly one per step, or null when the event changed nothing.
 */
export type HoverSignal = 'activated' | 'repeating' | 'failure' | 'success' | 'released' | 'ended'

export interface HoverStep {
  readonly state: HoverState
  readonly signal: HoverSignal | null
  /** The finished focus, when this step ended one. */
  readonly record: HoverFocusRecord | null
}

export const NORMAL: HoverState = { phase: 'normal' }

/** Clean repetitions still needed. */
export const remainingOf = (focus: HoverFocus): number => Math.max(0, focus.required - focus.successes)

const unchanged = (state: HoverState): HoverStep => ({ state, signal: null, record: null })

const recordOf = (focus: HoverFocus, at: number, limitReached: boolean): HoverFocusRecord => ({
  word: focus.word,
  wordIndex: focus.wordIndex,
  required: focus.required,
  successes: focus.successes,
  failures: focus.failures,
  completed: focus.successes >= focus.required,
  limitReached,
  focusMs: Math.max(0, at - focus.activatedAt),
})

export const stepHover = (state: HoverState, event: HoverEvent): HoverStep => {
  switch (event.type) {
    case 'mistake': {
      if (state.phase !== 'normal') return unchanged(state)
      const focus: HoverFocus = {
        wordIndex: event.wordIndex,
        word: event.word,
        activatedAt: event.at,
        required: HOVER_RULES.initialRequired,
        successes: 0,
        failures: 0,
        attempts: 0,
      }
      return { state: { phase: 'pending', focus }, signal: 'activated', record: null }
    }

    case 'left-word': {
      if (state.phase !== 'pending') return unchanged(state)
      return {
        state: { phase: 'repeating', focus: state.focus, attemptFailed: false },
        signal: 'repeating',
        record: null,
      }
    }

    case 'attempt-mistake': {
      if (state.phase !== 'repeating' || state.attemptFailed) return unchanged(state)
      const { focus } = state
      return {
        state: {
          phase: 'repeating',
          attemptFailed: true,
          focus: {
            ...focus,
            failures: focus.failures + 1,
            required: Math.min(HOVER_RULES.maxRequired, focus.required + HOVER_RULES.extensionPerFailure),
          },
        },
        signal: 'failure',
        record: null,
      }
    }

    case 'attempt-completed': {
      if (state.phase !== 'repeating') return unchanged(state)
      const clean = !state.attemptFailed
      const focus: HoverFocus = {
        ...state.focus,
        attempts: state.focus.attempts + 1,
        successes: state.focus.successes + (clean ? 1 : 0),
      }

      if (focus.successes >= focus.required) {
        return { state: NORMAL, signal: 'released', record: recordOf(focus, event.at, false) }
      }
      if (focus.attempts >= HOVER_RULES.maxAttempts) {
        return { state: NORMAL, signal: 'released', record: recordOf(focus, event.at, true) }
      }

      return {
        state: { phase: 'repeating', focus, attemptFailed: false },
        // A failed repetition was already signalled at its mistake; finishing it
        // is only the start of the next one.
        signal: clean ? 'success' : null,
        record: null,
      }
    }

    case 'end': {
      if (state.phase === 'normal') return unchanged(state)
      return { state: NORMAL, signal: 'ended', record: recordOf(state.focus, event.at, false) }
    }
  }
}

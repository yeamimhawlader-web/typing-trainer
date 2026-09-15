/**
 * Hover Mode's rules, as a pure state machine.
 *
 * ## The idea
 *
 * One mistake on a word is enough to focus it. The typist finishes the word as
 * they normally would, then types it again — how many times depends on the
 * difficulty — and carries on.
 *
 * ## States
 *
 * - `normal` — ordinary typing. Nothing is focused.
 * - `pending` — a mistake has focused a word, and the typist is still on it in
 *   the text. The word is finished in the text exactly as in ordinary practice.
 * - `repeating` — the typist has left the word. Until the focus is released,
 *   every key types the next repetition of that word instead of the text.
 *
 * A repetition is one typing of the word through the typing engine, from its
 * first letter to the space after it. It is clean when the engine recorded no
 * mistake in it — the engine's own verdict, which counts a mistake later put
 * right with backspace. A repetition with several mistakes is still one failed
 * repetition.
 *
 * ## Difficulties
 *
 * **Standard** — one cycle: three repetitions, clean or not, then the word is
 * released. A mistake inside the cycle never adds another.
 *
 * **All In** — two cycles of three: six repetitions, clean or not, then the word
 * is released. Never a third.
 *
 * **Tired** — escalating. Three clean repetitions are required; each repetition
 * with a mistake adds three more, but the requirement never passes ten: 3, 6, 9,
 * then 10. The word is released when the clean repetitions reach the
 * requirement.
 *
 * ## Cleared, or not
 *
 * - Standard and All In: the word cleared when its last cycle was clean — three
 *   clean repetitions in a row at the end. A mistake early in All In that the
 *   second cycle put behind it does not stop the word clearing.
 * - Tired: the word cleared when it met its requirement before the requirement
 *   reached the ten-repetition ceiling. A word that escalated to the ceiling was
 *   still costing mistakes at the limit, so it is released without clearing.
 *
 * A word released without clearing is what goes into Golden Nuggets.
 *
 * ## Safety limit
 *
 * Standard and All In end after a fixed number of repetitions. Tired's ceiling
 * bounds the clean repetitions, but a typist who cannot get the word right at all
 * would never collect them, so Tired also ends after 20 repetitions of any kind —
 * released without clearing, and the text carries on.
 *
 * ## Events, and what each does
 *
 * | Event | normal | pending | repeating |
 * | --- | --- | --- | --- |
 * | `mistake` on a word in the text | focus that word → pending | another on the focused word: counted | — |
 * | `left-word` | ignored | → repeating, first repetition | ignored |
 * | `attempt-mistake` | ignored | ignored | counted; the first in a repetition fails it (Tired: required +3, to 10) |
 * | `attempt-completed` | ignored | ignored | the repetition is recorded; the focus is released if its difficulty's end is reached |
 * | `end` (restart, test over) | — | → normal, unfinished | → normal, unfinished |
 *
 * Only one focus exists at a time: a mistake on another word while something is
 * focused never starts a second one.
 */

import type { HoverFocusRecord } from '@core/sessions'
import type { HoverDifficulty } from '@core/types'

export const HOVER_RULES = {
  /** Repetitions in one cycle. */
  cycleLength: 3,
  /** Cycles for the difficulties that repeat in cycles. */
  cycles: { standard: 1, 'all-in': 2 },
  tired: {
    /** Clean repetitions a new focus asks for. */
    initialRequired: 3,
    /** Added by each repetition with a mistake. */
    extensionPerFailure: 3,
    /** The most clean repetitions a focus can ask for. */
    maxRequired: 10,
    /** Repetitions of any kind after which a focus is released regardless. */
    maxAttempts: 20,
  },
} as const

export type RepetitionOutcome = 'clean' | 'missed'

export interface HoverFocus {
  /** Position of the word among the text's words. */
  readonly wordIndex: number
  readonly word: string
  readonly difficulty: HoverDifficulty
  /** When the mistake that started the focus was typed. */
  readonly activatedAt: number
  /**
   * Repetitions asked for. Standard and All In: every repetition of every cycle,
   * clean or not. Tired: clean repetitions, rising with each failed one.
   */
  readonly required: number
  /** One per finished repetition, in order. */
  readonly outcomes: readonly RepetitionOutcome[]
  /** Repetitions with a mistake, including one still being typed. */
  readonly failures: number
  /** Wrong keystrokes on the word, in the text and in its repetitions. */
  readonly mistakes: number
  /** Tired: whether the requirement has reached its ceiling. */
  readonly atCeiling: boolean
}

export type HoverState =
  | { readonly phase: 'normal' }
  | { readonly phase: 'pending'; readonly focus: HoverFocus }
  | {
      readonly phase: 'repeating'
      readonly focus: HoverFocus
      /** Whether the repetition in progress already has a mistake in it. */
      readonly attemptFailed: boolean
    }

export type HoverEvent =
  | {
      readonly type: 'mistake'
      readonly wordIndex: number
      readonly word: string
      readonly difficulty: HoverDifficulty
      readonly at: number
    }
  | { readonly type: 'left-word'; readonly at: number }
  | { readonly type: 'attempt-mistake'; readonly at: number }
  | { readonly type: 'attempt-completed'; readonly at: number }
  | { readonly type: 'end'; readonly at: number }

/**
 * What a step did, for whatever reacts to it — the motion, the screen reader
 * announcement. At most one per step.
 *
 * - `cycle`: a repetition finished a cycle and the next cycle begins (All In).
 * - `success` / `missed`: a repetition finished, clean or not, and the focus goes on.
 */
export type HoverSignal =
  | 'activated'
  | 'repeating'
  | 'failure'
  | 'success'
  | 'missed'
  | 'cycle'
  | 'released'
  | 'ended'

export interface HoverStep {
  readonly state: HoverState
  readonly signal: HoverSignal | null
  /** The finished focus, when this step ended one. */
  readonly record: HoverFocusRecord | null
  /** The focus as it stood when this step ended it, for drawing its last moment. */
  readonly final: HoverFocus | null
}

export const NORMAL: HoverState = { phase: 'normal' }

const isCycled = (difficulty: HoverDifficulty): difficulty is 'standard' | 'all-in' => difficulty !== 'tired'

const successesOf = (focus: HoverFocus): number => focus.outcomes.filter((outcome) => outcome === 'clean').length

/** Repetitions still to come: every one left for cycles, clean ones for Tired. */
export const remainingOf = (focus: HoverFocus): number =>
  Math.max(0, focus.required - (isCycled(focus.difficulty) ? focus.outcomes.length : successesOf(focus)))

/** Cycles the focus has gone through, including one under way. */
export const cyclesOf = (focus: HoverFocus): number => {
  if (isCycled(focus.difficulty)) {
    const total = HOVER_RULES.cycles[focus.difficulty]
    return Math.min(total, Math.floor(focus.outcomes.length / HOVER_RULES.cycleLength) + 1)
  }
  // Tired: the first three, and one more cycle for every extension.
  return Math.ceil(focus.required / HOVER_RULES.cycleLength)
}

export type ProgressNode = RepetitionOutcome | 'open'

export interface HoverProgress {
  /** One per repetition shown. */
  readonly nodes: readonly ProgressNode[]
  /** Nodes per visual group: a cycle, for the difficulties that have them. */
  readonly groupSize: number | null
}

/**
 * What the progress row under a focused word shows.
 *
 * Standard and All In: every repetition of every cycle, each marked clean or
 * missed once typed. Tired: the clean repetitions required, filled as they come;
 * missed ones add to the row rather than taking a place in it.
 */
export const progressOf = (focus: HoverFocus): HoverProgress => {
  if (isCycled(focus.difficulty)) {
    return {
      nodes: Array.from({ length: focus.required }, (_, index) => focus.outcomes[index] ?? 'open'),
      groupSize: HOVER_RULES.cycles[focus.difficulty] > 1 ? HOVER_RULES.cycleLength : null,
    }
  }
  const clean = successesOf(focus)
  return {
    nodes: Array.from({ length: focus.required }, (_, index) => (index < clean ? 'clean' : 'open')),
    groupSize: null,
  }
}

const unchanged = (state: HoverState): HoverStep => ({ state, signal: null, record: null, final: null })

const recordOf = (focus: HoverFocus, at: number, outcome: 'cleared' | 'unresolved' | 'unfinished', limitReached: boolean): HoverFocusRecord => ({
  word: focus.word,
  wordIndex: focus.wordIndex,
  required: focus.required,
  cycles: cyclesOf(focus),
  attempts: focus.outcomes.length,
  successes: successesOf(focus),
  failures: focus.failures,
  mistakes: focus.mistakes,
  cleared: outcome === 'cleared',
  limitReached,
  // A focus cut short by a restart never had its chance, so it is not logged.
  goldenNugget: outcome === 'unresolved',
  focusMs: Math.max(0, at - focus.activatedAt),
})

const release = (focus: HoverFocus, at: number, cleared: boolean, limitReached = false): HoverStep => ({
  state: NORMAL,
  signal: 'released',
  record: recordOf(focus, at, cleared ? 'cleared' : 'unresolved', limitReached),
  final: focus,
})

export const stepHover = (state: HoverState, event: HoverEvent): HoverStep => {
  switch (event.type) {
    case 'mistake': {
      if (state.phase === 'pending') {
        if (event.wordIndex !== state.focus.wordIndex) return unchanged(state)
        return {
          state: { phase: 'pending', focus: { ...state.focus, mistakes: state.focus.mistakes + 1 } },
          signal: null,
          record: null,
          final: null,
        }
      }
      if (state.phase !== 'normal') return unchanged(state)
      const focus: HoverFocus = {
        wordIndex: event.wordIndex,
        word: event.word,
        difficulty: event.difficulty,
        activatedAt: event.at,
        required: isCycled(event.difficulty)
          ? HOVER_RULES.cycleLength * HOVER_RULES.cycles[event.difficulty]
          : HOVER_RULES.tired.initialRequired,
        outcomes: [],
        failures: 0,
        mistakes: 1,
        atCeiling: false,
      }
      return { state: { phase: 'pending', focus }, signal: 'activated', record: null, final: null }
    }

    case 'left-word': {
      if (state.phase !== 'pending') return unchanged(state)
      return {
        state: { phase: 'repeating', focus: state.focus, attemptFailed: false },
        signal: 'repeating',
        record: null,
        final: null,
      }
    }

    case 'attempt-mistake': {
      if (state.phase !== 'repeating') return unchanged(state)
      const { focus } = state
      const counted = { ...focus, mistakes: focus.mistakes + 1 }

      // Further mistakes in a repetition that has already failed are counted,
      // and change nothing else.
      if (state.attemptFailed) {
        return { state: { ...state, focus: counted }, signal: null, record: null, final: null }
      }

      const failed = { ...counted, failures: counted.failures + 1 }
      if (focus.difficulty === 'tired') {
        const { extensionPerFailure, maxRequired } = HOVER_RULES.tired
        const required = Math.min(maxRequired, focus.required + extensionPerFailure)
        return {
          state: {
            phase: 'repeating',
            attemptFailed: true,
            focus: { ...failed, required, atCeiling: required >= maxRequired },
          },
          signal: 'failure',
          record: null,
          final: null,
        }
      }
      return { state: { phase: 'repeating', attemptFailed: true, focus: failed }, signal: 'failure', record: null, final: null }
    }

    case 'attempt-completed': {
      if (state.phase !== 'repeating') return unchanged(state)
      const outcome: RepetitionOutcome = state.attemptFailed ? 'missed' : 'clean'
      const focus: HoverFocus = { ...state.focus, outcomes: [...state.focus.outcomes, outcome] }
      const attempts = focus.outcomes.length
      const next = (signal: HoverSignal): HoverStep => ({
        state: { phase: 'repeating', focus, attemptFailed: false },
        signal,
        record: null,
        final: null,
      })

      if (isCycled(focus.difficulty)) {
        if (attempts >= focus.required) {
          const lastCycle = focus.outcomes.slice(-HOVER_RULES.cycleLength)
          return release(focus, event.at, lastCycle.every((result) => result === 'clean'))
        }
        return next(attempts % HOVER_RULES.cycleLength === 0 ? 'cycle' : outcome === 'clean' ? 'success' : 'missed')
      }

      if (successesOf(focus) >= focus.required) return release(focus, event.at, !focus.atCeiling, focus.atCeiling)
      if (attempts >= HOVER_RULES.tired.maxAttempts) return release(focus, event.at, false, true)
      return next(outcome === 'clean' ? 'success' : 'missed')
    }

    case 'end': {
      if (state.phase === 'normal') return unchanged(state)
      return {
        state: NORMAL,
        signal: 'ended',
        record: recordOf(state.focus, event.at, 'unfinished', false),
        final: state.focus,
      }
    }
  }
}

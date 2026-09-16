/**
 * Validation for session records.
 *
 * Two jobs, and they fail differently on purpose.
 *
 * On the way *in*, `assertValidSession` throws: writing a malformed record is a
 * bug in this codebase, and it should be loud.
 *
 * On the way *out*, `parseTypingSession` returns null: a malformed record in
 * storage is not a bug in today's code, it is history written by an older
 * build, or something else on the origin, or a half-finished write. One bad row
 * must not take down the history page, so bad rows are dropped and the rest are
 * shown.
 *
 * Hand-rolled rather than schema-library-driven, consistent with `config/env`.
 * If these shapes grow much further, replace this file with a schema and delete
 * the helpers.
 */

import { HOVER_DIFFICULTIES, type SessionMetrics } from '@core/types'

import type {
  HoverFocusRecord,
  HoverSessionRecord,
  KeyboardLayout,
  SessionContext,
  SessionDifficulty,
  SessionMode,
  TypingSession,
} from './types.ts'

const MODES: readonly SessionMode[] = ['words', 'time', 'quote', 'drill', 'hover', 'syllable']
const DIFFICULTIES: readonly SessionDifficulty[] = ['normal', 'punctuation', 'numbers']
const LAYOUTS: readonly KeyboardLayout[] = ['qwerty', 'dvorak', 'colemak']
const STATUSES = ['completed', 'abandoned'] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

const isOneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value)

const parseMetrics = (value: unknown): SessionMetrics | null => {
  if (!isRecord(value)) return null

  const numeric = [
    'netWpm',
    'rawWpm',
    'accuracy',
    'totalCharacters',
    'typedCharacters',
    'correctCharacters',
    'incorrectCharacters',
    'correctedCharacters',
    'errorCount',
  ] as const

  for (const field of numeric) {
    if (!isCount(value[field])) return null
  }

  const accuracy = value['accuracy'] as number
  if (accuracy > 1) return null

  return value as unknown as SessionMetrics
}

/**
 * A focus record, or null.
 *
 * Hover Mode first saved records without difficulties: no cycles, attempts,
 * mistakes or Golden Nugget flag, and `completed` where `cleared` is now. Those
 * are read into the current shape rather than dropped — `completed` meant the
 * word cleared, attempts were the clean ones plus the missed ones, and none of
 * them could have gone into Golden Nuggets, which did not exist.
 */
const parseFocusRecord = (value: unknown): HoverFocusRecord | null => {
  if (!isRecord(value)) return null

  const counts = ['wordIndex', 'required', 'successes', 'failures', 'focusMs'] as const
  if (!isNonEmptyString(value['word']) || !counts.every((field) => isCount(value[field]))) return null
  if (typeof value['limitReached'] !== 'boolean') return null

  if (typeof value['cleared'] === 'boolean') {
    const current = ['cycles', 'attempts', 'mistakes'] as const
    if (!current.every((field) => isCount(value[field]))) return null
    if (typeof value['goldenNugget'] !== 'boolean') return null
    return value as unknown as HoverFocusRecord
  }

  if (typeof value['completed'] !== 'boolean') return null
  const required = value['required'] as number
  const successes = value['successes'] as number
  const failures = value['failures'] as number
  return {
    word: value['word'],
    wordIndex: value['wordIndex'] as number,
    required,
    cycles: Math.max(1, Math.ceil(required / 3)),
    attempts: successes + failures,
    successes,
    failures,
    mistakes: failures,
    cleared: value['completed'],
    limitReached: value['limitReached'],
    goldenNugget: false,
    focusMs: value['focusMs'] as number,
  }
}

const parseHoverRecord = (value: unknown): HoverSessionRecord | null => {
  if (!isRecord(value) || !Array.isArray(value['focuses'])) return null

  const difficulty = value['difficulty']
  if (difficulty !== undefined && !isOneOf(difficulty, HOVER_DIFFICULTIES)) return null

  const focuses: HoverFocusRecord[] = []
  for (const entry of value['focuses']) {
    const focus = parseFocusRecord(entry)
    if (focus === null) return null
    focuses.push(focus)
  }

  return difficulty === undefined ? { focuses } : { difficulty, focuses }
}

const parseContext = (value: unknown): SessionContext | null => {
  if (!isRecord(value)) return null
  if (!isOneOf(value['mode'], MODES)) return null
  if (!isOneOf(value['difficulty'], DIFFICULTIES)) return null
  if (!isOneOf(value['keyboardLayout'], LAYOUTS)) return null
  if (!isNonEmptyString(value['language'])) return null

  // Absent on every session written before drills existed, which is not a
  // defect in those records — only a present-but-wrong value is.
  const target = value['targetSequence']
  if (target !== undefined && !isNonEmptyString(target)) return null

  // The same for the time a timed test was set to run for.
  const seconds = value['durationSeconds']
  if (seconds !== undefined && (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0)) return null

  if (value['hover'] === undefined) return value as unknown as SessionContext

  const hover = parseHoverRecord(value['hover'])
  if (hover === null) return null
  return { ...(value as unknown as SessionContext), hover }
}

/**
 * Reads an untrusted value as a session, or returns null.
 *
 * Anything that reaches this came off disk and is treated as hostile: the shape
 * is checked field by field rather than cast.
 */
export const parseTypingSession = (value: unknown): TypingSession | null => {
  if (!isRecord(value)) return null

  if (!isNonEmptyString(value['id'])) return null
  if (!isNonEmptyString(value['text'])) return null
  if (typeof value['textSourceId'] !== 'string') return null
  if (!isCount(value['startedAt'])) return null
  if (!isCount(value['completedAt'])) return null
  if (!isCount(value['durationMs'])) return null
  if (!isOneOf(value['status'], STATUSES)) return null

  const context = parseContext(value['context'])
  if (context === null) return null
  if (parseMetrics(value['metrics']) === null) return null

  // The context as read, which may have brought an older Hover Mode record
  // into the current shape.
  return { ...(value as unknown as TypingSession), context }
}

export class InvalidSessionError extends Error {
  override readonly name = 'InvalidSessionError'
}

/** Throws unless the session is well formed. Used before writing. */
export const assertValidSession = (session: TypingSession): void => {
  if (parseTypingSession(session) === null) {
    throw new InvalidSessionError(
      `Refusing to save a malformed session (id: ${String(session?.id)})`,
    )
  }
}

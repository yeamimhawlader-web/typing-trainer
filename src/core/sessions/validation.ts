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

import type { SessionMetrics } from '@core/types'

import type {
  KeyboardLayout,
  SessionContext,
  SessionDifficulty,
  SessionMode,
  TypingSession,
} from './types.ts'

const MODES: readonly SessionMode[] = ['words', 'time', 'quote']
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

const parseContext = (value: unknown): SessionContext | null => {
  if (!isRecord(value)) return null
  if (!isOneOf(value['mode'], MODES)) return null
  if (!isOneOf(value['difficulty'], DIFFICULTIES)) return null
  if (!isOneOf(value['keyboardLayout'], LAYOUTS)) return null
  if (!isNonEmptyString(value['language'])) return null

  return value as unknown as SessionContext
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

  if (parseContext(value['context']) === null) return null
  if (parseMetrics(value['metrics']) === null) return null

  return value as unknown as TypingSession
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

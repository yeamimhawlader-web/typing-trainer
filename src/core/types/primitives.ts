/**
 * Domain primitives: the small set of measurements this product is built on.
 *
 * Each is branded (see brand.ts) and has a constructor that validates its
 * invariant. Constructors are the only supported way to create these values,
 * which means an `Accuracy` is guaranteed to be between 0 and 1 everywhere it
 * appears — no defensive checks needed downstream.
 */

import type { Brand } from './brand.ts'

/** A duration in milliseconds. Never negative. */
export type Milliseconds = Brand<number, 'Milliseconds'>

/** A wall-clock instant, epoch milliseconds (UTC). */
export type Timestamp = Brand<number, 'Timestamp'>

/** Words per minute, where a "word" is the standard 5 characters. */
export type Wpm = Brand<number, 'Wpm'>

/** Correctness as a ratio in the inclusive range 0..1. */
export type Accuracy = Brand<number, 'Accuracy'>

/** Stable identifier for a single typing session. */
export type SessionId = Brand<string, 'SessionId'>

export const milliseconds = (value: number): Milliseconds => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Milliseconds must be a non-negative number, got ${value}`)
  }
  return value as Milliseconds
}

export const timestamp = (value: number): Timestamp => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`Timestamp must be a non-negative number, got ${value}`)
  }
  return value as Timestamp
}

export const wpm = (value: number): Wpm => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`WPM must be a non-negative number, got ${value}`)
  }
  return value as Wpm
}

export const accuracy = (value: number): Accuracy => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`Accuracy must be a ratio between 0 and 1, got ${value}`)
  }
  return value as Accuracy
}

export const sessionId = (value: string): SessionId => {
  if (value.length === 0) {
    throw new RangeError('SessionId must not be empty')
  }
  return value as SessionId
}

/** Standard characters-per-word divisor used by every WPM calculation. */
export const CHARACTERS_PER_WORD = 5

export const MILLISECONDS_PER_MINUTE = 60_000

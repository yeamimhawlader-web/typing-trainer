/**
 * Joins class names, dropping anything falsy.
 *
 * Also does quiet type work. CSS Modules are typed as a string index signature,
 * so under `noUncheckedIndexedAccess` every `styles.foo` is `string | undefined`
 * — correct, since a typo in a class name really does yield undefined. `cx`
 * narrows that back to a plain `string` at the one place it matters, which lets
 * the strict flag stay on for the code where it catches actual bugs: indexing
 * into character and keystroke arrays in the engine.
 */

export type ClassValue = string | false | null | undefined

export const cx = (...values: readonly ClassValue[]): string =>
  values.filter((value): value is string => Boolean(value)).join(' ')

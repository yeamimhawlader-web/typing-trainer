/**
 * Nominal ("branded") types.
 *
 * TypeScript is structural: a plain `number` for milliseconds and a plain
 * `number` for words-per-minute are the same type, so passing one where the
 * other is expected compiles cleanly and fails at runtime — or worse, silently
 * produces a wrong number on a statistics screen.
 *
 * Branding attaches a compile-time-only tag that makes those mistakes type
 * errors. The tag is erased at build time: zero runtime cost.
 */

declare const brand: unique symbol

export type Brand<TValue, TBrand extends string> = TValue & {
  readonly [brand]: TBrand
}

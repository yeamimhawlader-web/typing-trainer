/**
 * Where practice text comes from.
 *
 * One provider exists today (random common words). The interface is here so
 * that quotes, pasted text, generated text and eventually adaptive text —
 * material chosen from what the typist keeps getting wrong — are all additions
 * behind the same call rather than changes to the typing screen.
 *
 * `provide` is synchronous on purpose, which is worth stating because the
 * persistence layer went the other way. A provider that needs to load
 * something — a quote file, a corpus — loads it when it is *constructed*
 * (`createQuotesProvider(quotes)`), not on every request. That keeps the
 * loading concern at the composition root, where it belongs, instead of
 * putting a loading state in front of every keystroke.
 */

import type { SessionTarget } from '@core/types'

export interface TextRequest {
  /** How many words the generated text should contain. */
  readonly wordCount: number
}

export interface TextProvider {
  /** Stable identifier, recorded on the session for later attribution. */
  readonly id: string
  /** Human-readable name, for a future source picker. */
  readonly label: string
  provide(request: TextRequest): SessionTarget
}

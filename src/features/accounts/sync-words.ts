/**
 * What a round of syncing moved, in a sentence.
 *
 * Counts rather than a spinner's memory: "3 tests sent" is something a typist
 * can check against what they did, and "Up to date." is the answer they are
 * usually looking for.
 */

import type { SyncResult } from '@core/accounts'

const tests = (count: number): string => `${count} ${count === 1 ? 'test' : 'tests'}`
const texts = (count: number): string => `${count} ${count === 1 ? 'text' : 'texts'}`

export const movedInWords = (result: SyncResult): string => {
  const parts = [
    result.sessionsUp > 0 ? `${tests(result.sessionsUp)} sent` : null,
    result.sessionsDown > 0 ? `${tests(result.sessionsDown)} brought back` : null,
    result.textsUp > 0 ? `${texts(result.textsUp)} sent` : null,
    result.textsDown > 0 ? `${texts(result.textsDown)} brought back` : null,
  ].filter((part): part is string => part !== null)

  return parts.length === 0 ? 'Up to date.' : `${parts.join(', ')}.`
}

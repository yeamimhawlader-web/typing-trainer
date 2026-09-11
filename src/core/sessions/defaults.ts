/**
 * The configuration every session is recorded with today.
 *
 * These are domain defaults rather than build settings, so they live here
 * instead of in `@config`. When the typing screen grows real controls for mode,
 * difficulty, language or layout, those controls supply a `SessionContext` and
 * this becomes the fallback rather than the only value.
 */

import type { SessionContext } from './types.ts'

export const DEFAULT_SESSION_CONTEXT: SessionContext = {
  mode: 'words',
  difficulty: 'normal',
  language: 'en',
  keyboardLayout: 'qwerty',
}

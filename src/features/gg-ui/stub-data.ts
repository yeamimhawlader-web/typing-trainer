/**
 * Placeholder data for parts of the GG.Typing shell with nothing behind them.
 *
 * There are no accounts, no server and no live presence in this application.
 * These values exist only so the shell can be laid out and judged as it will
 * look. Every one is replaced in the wiring pass — nothing else should import
 * from here.
 */

import { createCommonWordsProvider } from '@core/text'

export const STUB_LIVE_USERS = 2067

export const STUB_ACCOUNT = {
  username: 'guest',
  level: 12,
} as const

export const STUB_LANGUAGES = [{ id: 'english', label: 'English (english)' }] as const

/** Enough words for a minute at 150 WPM with room to spare. */
export const stubWords = (): readonly string[] =>
  createCommonWordsProvider().provide({ wordCount: 200 }).text.split(' ')

/**
 * The inline first-paint script, run as the page head runs it.
 */

import { afterEach, describe, expect, it } from 'vitest'

import { appConfig } from '@config'
import { buildKeyPrefix, STORAGE_KEYS } from '@core/persistence'

import { darkThemeValues, firstPaintScript, PREFERENCES_STORAGE_KEY } from './first-paint.ts'
import { GG_THEMES } from './themes.ts'

const run = () => {
  document.documentElement.removeAttribute('data-theme')
  // The page runs it as an inline script; here it is evaluated the same way.
  new Function(firstPaintScript())()
  return document.documentElement.getAttribute('data-theme')
}

const save = (value: unknown) => window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(value))

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('the first paint', () => {
  it('reads the key the settings store writes', () => {
    expect(PREFERENCES_STORAGE_KEY).toBe(`${buildKeyPrefix(appConfig.persistence)}${STORAGE_KEYS.preferences}`)
  })

  it('is light for a fresh installation, which opens in Classic Milk', () => {
    expect(run()).toBe('light')
  })

  it('is light for Classic Milk and every other light theme', () => {
    for (const theme of GG_THEMES.filter((candidate) => candidate.scheme === 'light')) {
      save({ theme: theme.id })
      expect(run()).toBe('light')
    }
  })

  it('stays dark for anyone who chose a dark theme, including the old "dark"', () => {
    expect(darkThemeValues()).toEqual(['dark', 'default-dark', 'glow', 'nord', 'midnight', 'valentine'])
    for (const theme of darkThemeValues()) {
      save({ theme })
      expect(run()).toBe('dark')
    }
  })

  it('falls back to light, not to an error, when storage holds something unreadable', () => {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, '{not json')
    expect(run()).toBe('light')
    save(null)
    expect(run()).toBe('light')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyTheme,
  removeTheme,
  THEME_FADE_ATTRIBUTE,
  THEME_FADE_MARGIN_MS,
  THEME_FADE_MS,
  THEME_FADE_REDUCED_MS,
} from './apply-theme.ts'
import { themeById } from './themes.ts'

const root = () => document.documentElement

const reducedMotion = (reduce: boolean) =>
  ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion: reduce'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia

describe('applying a theme', () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    window.matchMedia = originalMatchMedia
    removeTheme()
  })

  it('writes the theme to :root as custom properties, and names it', () => {
    applyTheme(themeById('glow'), { fade: false })

    expect(root().style.getPropertyValue('--gg-base-bg')).toBe('#060607')
    expect(root().style.getPropertyValue('--gg-base-accent')).toBe('#3dffa8')
    expect(root().style.getPropertyValue('color-scheme')).toBe('dark')
    expect(root().dataset.ggTheme).toBe('glow')
  })

  it('does not fade the first theme in: a page load is not a switch', () => {
    applyTheme(themeById('default-dark'), { fade: false })

    expect(root().hasAttribute(THEME_FADE_ATTRIBUTE)).toBe(false)
  })

  it('turns the cross-fade on for a switch, and off again once it has run', () => {
    window.matchMedia = reducedMotion(false)
    applyTheme(themeById('classic'))

    expect(root().hasAttribute(THEME_FADE_ATTRIBUTE)).toBe(true)

    vi.advanceTimersByTime(THEME_FADE_MS + THEME_FADE_MARGIN_MS - 1)
    expect(root().hasAttribute(THEME_FADE_ATTRIBUTE)).toBe(true)

    vi.advanceTimersByTime(1)
    // Off, so characters changing state mid-test are never faded.
    expect(root().hasAttribute(THEME_FADE_ATTRIBUTE)).toBe(false)
  })

  it('shortens the fade to 120ms under reduced motion rather than removing it', () => {
    window.matchMedia = reducedMotion(true)
    applyTheme(themeById('valentine'))

    vi.advanceTimersByTime(THEME_FADE_REDUCED_MS + THEME_FADE_MARGIN_MS)
    expect(root().hasAttribute(THEME_FADE_ATTRIBUTE)).toBe(false)
    expect(THEME_FADE_REDUCED_MS).toBe(120)
  })

  it('restarts the fade when switched again mid-fade, instead of ending the new one early', () => {
    window.matchMedia = reducedMotion(false)
    applyTheme(themeById('classic'))
    vi.advanceTimersByTime(THEME_FADE_MS)
    applyTheme(themeById('lemondrop'))

    vi.advanceTimersByTime(THEME_FADE_MS)
    expect(root().hasAttribute(THEME_FADE_ATTRIBUTE)).toBe(true)
  })

  it('takes everything off :root when the shell goes away', () => {
    applyTheme(themeById('glow'))
    removeTheme()

    expect(root().style.getPropertyValue('--gg-base-bg')).toBe('')
    expect(root().hasAttribute(THEME_FADE_ATTRIBUTE)).toBe(false)
    expect(root().dataset.ggTheme).toBeUndefined()
  })
})

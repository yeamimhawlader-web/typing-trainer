import { afterEach, describe, expect, it, vi } from 'vitest'

import { applyTheme, removeTheme, THEME_SWITCHING_ATTRIBUTE } from './apply-theme.ts'
import { themeById } from './themes.ts'

const root = () => document.documentElement

describe('applying a theme', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    removeTheme()
  })

  it('writes the theme to :root as custom properties, and names it', () => {
    applyTheme(themeById('glow'))

    expect(root().style.getPropertyValue('--gg-base-bg')).toBe('#060607')
    expect(root().style.getPropertyValue('--gg-base-accent')).toBe('#3dffa8')
    expect(root().style.getPropertyValue('color-scheme')).toBe('dark')
    expect(root().dataset.ggTheme).toBe('glow')
  })

  it('switches at once, with nothing left to fade afterwards', () => {
    vi.useFakeTimers()
    try {
      applyTheme(themeById('classic'))
      applyTheme(themeById('lemondrop'))

      expect(root().dataset.ggTheme).toBe('lemondrop')
      expect(root().hasAttribute(THEME_SWITCHING_ATTRIBUTE)).toBe(false)
      // No timer to wait on: the switch is finished when the call returns.
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('recalculates style once, with the new colours written and transitions still off', () => {
    applyTheme(themeById('classic'))
    const recalculations: { readonly transitionsOff: boolean; readonly theme: string | undefined }[] = []
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function read(this: HTMLElement) {
      recalculations.push({
        transitionsOff: this.hasAttribute(THEME_SWITCHING_ATTRIBUTE),
        theme: this.dataset.ggTheme,
      })
      return 0
    })

    applyTheme(themeById('valentine'))

    expect(recalculations).toEqual([{ transitionsOff: true, theme: 'valentine' }])
    expect(root().hasAttribute(THEME_SWITCHING_ATTRIBUTE)).toBe(false)
  })

  it('takes everything off :root when the shell goes away', () => {
    applyTheme(themeById('glow'))
    removeTheme()

    expect(root().style.getPropertyValue('--gg-base-bg')).toBe('')
    expect(root().hasAttribute(THEME_SWITCHING_ATTRIBUTE)).toBe(false)
    expect(root().dataset.ggTheme).toBeUndefined()
  })
})

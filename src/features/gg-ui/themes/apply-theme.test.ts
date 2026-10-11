import { afterEach, describe, expect, it, vi } from 'vitest'

import { applyTheme, removeTheme, switchTheme, THEME_SWITCHING_ATTRIBUTE } from './apply-theme.ts'
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

  it('takes the browser furniture with it, and puts it back on the way out', () => {
    // A phone tints the bar above the page from this, and so does a window
    // installed from the site. One baked-in value gives a typist on Midnight a
    // cream strip above a near-black page.
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = '#f7f4ee'
    document.head.append(meta)

    try {
      applyTheme(themeById('midnight'))
      expect(meta.content).toBe(themeById('midnight').colors.bg)

      applyTheme(themeById('lemondrop'))
      expect(meta.content).toBe(themeById('lemondrop').colors.bg)

      removeTheme()
      expect(meta.content).toBe('#f7f4ee')
    } finally {
      meta.remove()
    }
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

describe('switching to another theme', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    removeTheme()
  })

  it('crossfades where the browser can, making the change inside the crossfade rather than before it', () => {
    // The browser photographs the page as it is, runs the change, photographs
    // it again and fades one picture into the other. A theme written before
    // the first photograph would leave nothing to fade from.
    let update: (() => void) | undefined
    const crossfade = {
      startViewTransition: vi.fn((next: () => void) => {
        update = next
      }),
    }

    switchTheme(themeById('glow'), { crossfade, reducedMotion: false })

    expect(crossfade.startViewTransition).toHaveBeenCalledTimes(1)
    expect(root().dataset.ggTheme).toBeUndefined()

    update?.()

    expect(root().dataset.ggTheme).toBe('glow')
  })

  it('switches at once where the browser cannot crossfade, as it always has', () => {
    switchTheme(themeById('glow'), { crossfade: {}, reducedMotion: false })

    expect(root().dataset.ggTheme).toBe('glow')
  })

  it('switches at once for anyone who has asked their system for less motion', () => {
    const crossfade = { startViewTransition: vi.fn() }

    switchTheme(themeById('glow'), { crossfade, reducedMotion: true })

    expect(crossfade.startViewTransition).not.toHaveBeenCalled()
    expect(root().dataset.ggTheme).toBe('glow')
  })
})

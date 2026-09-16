import { beforeEach, describe, expect, it } from 'vitest'

import { STORAGE_KEYS, createMemoryAdapter } from '@core/persistence'
import type { StorageAdapter } from '@core/persistence'
import type { UserPreferences } from '@core/types'

import { createSettingsStore } from './settings.store.ts'

const DEFAULTS: UserPreferences = {
  theme: 'classic-milk',
  practiceWordCount: 30,
  textSize: 'sm',
  hoverDifficulty: 'standard',
  soundEnabled: false,
}

describe('settings store', () => {
  let adapter: StorageAdapter

  beforeEach(() => {
    adapter = createMemoryAdapter()
  })

  it('starts on defaults before hydration', () => {
    const store = createSettingsStore(adapter)

    expect(store.getState().preferences.theme).toBe('classic-milk')
    expect(store.getState().status).toBe('idle')
  })

  it('opens a fresh installation in Classic Milk', async () => {
    const store = createSettingsStore(adapter)

    await store.getState().hydrate()

    expect(store.getState().preferences.theme).toBe('classic-milk')
    // Nothing is written just by opening: the default is not saved as a choice.
    await expect(adapter.read(STORAGE_KEYS.preferences)).resolves.toBeNull()
  })

  it.each(['default-dark', 'glow', 'default-light', 'classic'])(
    'keeps a theme already saved — %s — including the dark theme that used to be the default',
    async (theme) => {
      await adapter.write(STORAGE_KEYS.preferences, { ...DEFAULTS, theme })
      const store = createSettingsStore(adapter)
      await store.getState().hydrate()

      expect(store.getState().preferences.theme).toBe(theme)
    },
  )

  it('hydrates from persisted preferences', async () => {
    await adapter.write<UserPreferences>(STORAGE_KEYS.preferences, {
      theme: 'lemondrop',
      practiceWordCount: 60,
      textSize: 'lg',
      hoverDifficulty: 'tired',
      soundEnabled: true,
    })
    const store = createSettingsStore(adapter)

    await store.getState().hydrate()

    expect(store.getState().preferences).toEqual({
      theme: 'lemondrop',
      practiceWordCount: 60,
      textSize: 'lg',
      hoverDifficulty: 'tired',
      soundEnabled: true,
    })
    expect(store.getState().status).toBe('ready')
  })

  it('falls back to defaults when nothing is stored', async () => {
    const store = createSettingsStore(adapter)

    await store.getState().hydrate()

    expect(store.getState().preferences).toEqual(DEFAULTS)
    expect(store.getState().status).toBe('ready')
  })

  it('fills in preferences missing from an older stored record', async () => {
    // A record written before any of them existed.
    await adapter.write(STORAGE_KEYS.preferences, {})
    const store = createSettingsStore(adapter)

    await store.getState().hydrate()

    expect(store.getState().preferences).toEqual(DEFAULTS)
  })

  it('carries over the dark and light themes earlier versions stored', async () => {
    // A record from before GG.Typing: no text size, and one of the two old themes.
    await adapter.write(STORAGE_KEYS.preferences, { theme: 'light', practiceWordCount: 15 })
    const light = createSettingsStore(adapter)
    await light.getState().hydrate()

    expect(light.getState().preferences).toEqual({ ...DEFAULTS, theme: 'default-light', practiceWordCount: 15 })

    await adapter.write(STORAGE_KEYS.preferences, { theme: 'dark' })
    const dark = createSettingsStore(adapter)
    await dark.getState().hydrate()

    expect(dark.getState().preferences.theme).toBe('default-dark')
  })

  it('persists a theme change through the adapter', async () => {
    const store = createSettingsStore(adapter)

    await store.getState().setTheme('glow')

    expect(store.getState().preferences.theme).toBe('glow')
    await expect(adapter.read(STORAGE_KEYS.preferences)).resolves.toEqual({ ...DEFAULTS, theme: 'glow' })
  })

  it('survives a reload: a new store reads back what the previous one wrote', async () => {
    await createSettingsStore(adapter).getState().setTheme('valentine')

    const reloaded = createSettingsStore(adapter)
    await reloaded.getState().hydrate()

    expect(reloaded.getState().preferences.theme).toBe('valentine')
  })

  it('remembers the practice length across a reload', async () => {
    await createSettingsStore(adapter).getState().setPracticeWordCount(60)

    const reloaded = createSettingsStore(adapter)
    await reloaded.getState().hydrate()

    expect(reloaded.getState().preferences.practiceWordCount).toBe(60)
  })

  it('remembers the text size across a reload', async () => {
    await createSettingsStore(adapter).getState().setTextSize('xl')

    const reloaded = createSettingsStore(adapter)
    await reloaded.getState().hydrate()

    expect(reloaded.getState().preferences.textSize).toBe('xl')
  })

  it('remembers the Hover Mode difficulty across a reload', async () => {
    await createSettingsStore(adapter).getState().setHoverDifficulty('all-in')

    const reloaded = createSettingsStore(adapter)
    await reloaded.getState().hydrate()

    expect(reloaded.getState().preferences.hoverDifficulty).toBe('all-in')
  })

  it('keeps the preferences independent of each other', async () => {
    const store = createSettingsStore(adapter)
    await store.getState().setPracticeWordCount(15)
    await store.getState().setTheme('classic')
    await store.getState().setTextSize('xs')
    await store.getState().setHoverDifficulty('tired')
    await store.getState().setSoundEnabled(true)

    await expect(adapter.read(STORAGE_KEYS.preferences)).resolves.toEqual({
      theme: 'classic',
      practiceWordCount: 15,
      textSize: 'xs',
      hoverDifficulty: 'tired',
      soundEnabled: true,
    })
  })

  it('ignores stored values this build does not recognise', async () => {
    await adapter.write(STORAGE_KEYS.preferences, {
      theme: 'neon-purple',
      practiceWordCount: 9999,
      textSize: 'huge',
      hoverDifficulty: 'exhausted',
      soundEnabled: 'yes please',
    })
    const store = createSettingsStore(adapter)

    await store.getState().hydrate()

    expect(store.getState().preferences).toEqual(DEFAULTS)
  })

  it('ignores a stored record that is not an object at all', async () => {
    await adapter.write(STORAGE_KEYS.preferences, 'not preferences')
    const store = createSettingsStore(adapter)

    await store.getState().hydrate()

    expect(store.getState().preferences).toEqual(DEFAULTS)
  })

  it('falls back to defaults, ready, when storage cannot be read', async () => {
    const broken: StorageAdapter = { ...adapter, read: () => Promise.reject(new Error('denied')) }
    const store = createSettingsStore(broken)

    await store.getState().hydrate()

    // Ready rather than stuck loading: a screen waiting on settings must still appear.
    expect(store.getState().status).toBe('ready')
    expect(store.getState().preferences.practiceWordCount).toBe(30)
  })
})

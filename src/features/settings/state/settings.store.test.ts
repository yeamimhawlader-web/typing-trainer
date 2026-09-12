import { beforeEach, describe, expect, it } from 'vitest'

import { STORAGE_KEYS, createMemoryAdapter } from '@core/persistence'
import type { StorageAdapter } from '@core/persistence'
import type { UserPreferences } from '@core/types'

import { createSettingsStore } from './settings.store.ts'

describe('settings store', () => {
  let adapter: StorageAdapter

  beforeEach(() => {
    adapter = createMemoryAdapter()
  })

  it('starts on defaults before hydration', () => {
    const store = createSettingsStore(adapter)

    expect(store.getState().preferences.theme).toBe('dark')
    expect(store.getState().status).toBe('idle')
  })

  it('hydrates from persisted preferences', async () => {
    await adapter.write<UserPreferences>(STORAGE_KEYS.preferences, {
      theme: 'light',
      practiceWordCount: 60,
    })
    const store = createSettingsStore(adapter)

    await store.getState().hydrate()

    expect(store.getState().preferences.theme).toBe('light')
    expect(store.getState().status).toBe('ready')
  })

  it('falls back to defaults when nothing is stored', async () => {
    const store = createSettingsStore(adapter)

    await store.getState().hydrate()

    expect(store.getState().preferences.theme).toBe('dark')
    expect(store.getState().status).toBe('ready')
  })

  it('fills in preferences missing from an older stored record', async () => {
    // A record written before `theme` existed.
    await adapter.write(STORAGE_KEYS.preferences, {})
    const store = createSettingsStore(adapter)

    await store.getState().hydrate()

    expect(store.getState().preferences).toEqual({ theme: 'dark', practiceWordCount: 30 })
  })

  it('persists a theme change through the adapter', async () => {
    const store = createSettingsStore(adapter)

    await store.getState().setTheme('light')

    expect(store.getState().preferences.theme).toBe('light')
    await expect(adapter.read(STORAGE_KEYS.preferences)).resolves.toEqual({
      theme: 'light',
      practiceWordCount: 30,
    })
  })

  it('survives a reload: a new store reads back what the previous one wrote', async () => {
    await createSettingsStore(adapter).getState().setTheme('light')

    const reloaded = createSettingsStore(adapter)
    await reloaded.getState().hydrate()

    expect(reloaded.getState().preferences.theme).toBe('light')
  })

  it('remembers the practice length across a reload', async () => {
    await createSettingsStore(adapter).getState().setPracticeWordCount(60)

    const reloaded = createSettingsStore(adapter)
    await reloaded.getState().hydrate()

    expect(reloaded.getState().preferences.practiceWordCount).toBe(60)
  })

  it('keeps the two preferences independent of each other', async () => {
    const store = createSettingsStore(adapter)
    await store.getState().setPracticeWordCount(15)
    await store.getState().setTheme('light')

    await expect(adapter.read(STORAGE_KEYS.preferences)).resolves.toEqual({
      theme: 'light',
      practiceWordCount: 15,
    })
  })

  it('ignores stored values this build does not recognise', async () => {
    await adapter.write(STORAGE_KEYS.preferences, { theme: 'neon-purple', practiceWordCount: 9999 })
    const store = createSettingsStore(adapter)

    await store.getState().hydrate()

    expect(store.getState().preferences).toEqual({ theme: 'dark', practiceWordCount: 30 })
  })

  it('ignores a stored record that is not an object at all', async () => {
    await adapter.write(STORAGE_KEYS.preferences, 'not preferences')
    const store = createSettingsStore(adapter)

    await store.getState().hydrate()

    expect(store.getState().preferences).toEqual({ theme: 'dark', practiceWordCount: 30 })
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

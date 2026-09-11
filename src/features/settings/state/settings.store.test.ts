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
    await adapter.write<UserPreferences>(STORAGE_KEYS.preferences, { theme: 'light' })
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

    expect(store.getState().preferences).toEqual({ theme: 'dark' })
  })

  it('persists a theme change through the adapter', async () => {
    const store = createSettingsStore(adapter)

    await store.getState().setTheme('light')

    expect(store.getState().preferences.theme).toBe('light')
    await expect(adapter.read(STORAGE_KEYS.preferences)).resolves.toEqual({
      theme: 'light',
    })
  })

  it('survives a reload: a new store reads back what the previous one wrote', async () => {
    await createSettingsStore(adapter).getState().setTheme('light')

    const reloaded = createSettingsStore(adapter)
    await reloaded.getState().hydrate()

    expect(reloaded.getState().preferences.theme).toBe('light')
  })
})

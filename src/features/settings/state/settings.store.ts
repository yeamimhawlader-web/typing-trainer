/**
 * Settings store — the application-state layer for user preferences.
 *
 * This is the first vertical slice through the architecture, and exists partly
 * to prove the seams work: UI dispatches, state updates, persistence is written
 * through the adapter abstraction. No component touches storage directly.
 *
 * Two deliberate choices:
 *
 * 1. Zustand's `persist` middleware is *not* used, despite doing roughly this.
 *    It talks to localStorage itself, which would route around the persistence
 *    layer and make the eventual IndexedDB migration a per-store rewrite.
 *
 * 2. The store is created by a factory taking a StorageAdapter. Tests inject an
 *    in-memory adapter and assert on real persistence behaviour with no mocks
 *    and no global state to reset between cases.
 */

import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'

import { DEFAULT_PREFERENCES } from '@config'
import { STORAGE_KEYS, storage, type StorageAdapter } from '@core/persistence'
import type { ThemePreference, UserPreferences } from '@core/types'

export type SettingsStatus = 'idle' | 'loading' | 'ready'

export interface SettingsState {
  readonly preferences: UserPreferences
  readonly status: SettingsStatus
  /** Reads persisted preferences. Safe to call more than once. */
  readonly hydrate: () => Promise<void>
  readonly setTheme: (theme: ThemePreference) => Promise<void>
}

export const createSettingsStore = (adapter: StorageAdapter): StoreApi<SettingsState> =>
  createStore<SettingsState>()((set, get) => ({
    preferences: DEFAULT_PREFERENCES,
    status: 'idle',

    hydrate: async () => {
      if (get().status === 'loading') return
      set({ status: 'loading' })

      const stored = await adapter.read<Partial<UserPreferences>>(
        STORAGE_KEYS.preferences,
      )

      // Merged over defaults rather than replacing them, so a preference added
      // in a later version is present even in a record written before it existed.
      set({
        preferences: { ...DEFAULT_PREFERENCES, ...stored },
        status: 'ready',
      })
    },

    setTheme: async (theme) => {
      const preferences: UserPreferences = { ...get().preferences, theme }
      // Update first: the UI should never wait on a disk write to repaint.
      set({ preferences })
      await adapter.write(STORAGE_KEYS.preferences, preferences)
    },
  }))

/** The application's settings store. */
export const settingsStore = createSettingsStore(storage)

/** React binding. Always pass a selector so components re-render narrowly. */
export const useSettingsStore = <T>(selector: (state: SettingsState) => T): T =>
  useStore(settingsStore, selector)

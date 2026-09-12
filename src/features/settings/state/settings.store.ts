/**
 * Settings state.
 *
 * User preferences, persisted through the storage adapter and restored at
 * start-up. Kept entirely apart from session history: clearing history never
 * touches a preference, and a preference never lives inside a session record.
 *
 * Created by a factory taking its adapter, so tests drive it with an in-memory
 * one and no mocks.
 */

import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'

import { DEFAULT_PREFERENCES } from '@config'
import { STORAGE_KEYS, storage, type StorageAdapter } from '@core/persistence'
import {
  PRACTICE_WORD_COUNTS,
  type PracticeWordCount,
  type ThemePreference,
  type UserPreferences,
} from '@core/types'

export type SettingsStatus = 'idle' | 'loading' | 'ready'

export interface SettingsState {
  readonly preferences: UserPreferences
  readonly status: SettingsStatus
  readonly hydrate: () => Promise<void>
  readonly setTheme: (theme: ThemePreference) => Promise<void>
  readonly setPracticeWordCount: (count: PracticeWordCount) => Promise<void>
}

/**
 * The preferences a stored record actually supplies, and only valid ones.
 *
 * The stored value came off disk and is treated as untrusted. Spreading it over
 * the defaults unchecked would accept `{"theme":"neon-purple"}` as a theme or a
 * word count of 9999 as a practice length; each field is taken only if it is one
 * this build understands, and anything else falls back to its default.
 */
const validPreferences = (stored: unknown): Partial<UserPreferences> => {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {}

  const record = stored as Record<string, unknown>
  const result: { theme?: ThemePreference; practiceWordCount?: PracticeWordCount } = {}

  const theme = record['theme']
  if (theme === 'dark' || theme === 'light') result.theme = theme

  const count = record['practiceWordCount']
  const known = PRACTICE_WORD_COUNTS.find((option) => option === count)
  if (known !== undefined) result.practiceWordCount = known

  return result
}

export const createSettingsStore = (adapter: StorageAdapter): StoreApi<SettingsState> =>
  createStore<SettingsState>()((set, get) => {
    const persist = async (preferences: UserPreferences): Promise<void> => {
      // Update first: the UI should never wait on a disk write to repaint.
      set({ preferences })
      await adapter.write(STORAGE_KEYS.preferences, preferences)
    }

    return {
      preferences: DEFAULT_PREFERENCES,
      status: 'idle',

      hydrate: async () => {
        const { status } = get()
        if (status === 'loading' || status === 'ready') return
        set({ status: 'loading' })

        try {
          const stored = await adapter.read<unknown>(STORAGE_KEYS.preferences)

          // Merged over defaults rather than replacing them, so a preference added
          // in a later version is present even in a record written before it.
          set({
            preferences: { ...DEFAULT_PREFERENCES, ...validPreferences(stored) },
            status: 'ready',
          })
        } catch (error) {
          // Unreadable storage costs the preferences, not the application.
          console.warn('[settings] failed to read preferences', error)
          set({ preferences: DEFAULT_PREFERENCES, status: 'ready' })
        }
      },

      setTheme: (theme) => persist({ ...get().preferences, theme }),

      setPracticeWordCount: (practiceWordCount) =>
        persist({ ...get().preferences, practiceWordCount }),
    }
  })

export const settingsStore = createSettingsStore(storage)

/**
 * Hydrated as soon as this module loads, not from an effect after the first
 * render.
 *
 * The adapter resolves without real waiting, so reading here finishes before
 * React's first render task runs. Starting from an effect instead meant the
 * first paint used defaults and then corrected itself: a 60-word typist saw a
 * 30-word test replaced a frame later, and a light-theme typist saw a flash of
 * dark.
 */
void settingsStore.getState().hydrate()

export const useSettingsStore = <T>(selector: (state: SettingsState) => T): T =>
  useStore(settingsStore, selector)

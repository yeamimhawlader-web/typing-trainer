/**
 * What the GG.Typing shell's controls are set to.
 *
 * UI state only, held in memory. None of it is wired to the typing engine or
 * persisted yet — that is the next pass. The defaults are the first-load
 * defaults the design asks for: Default (Dark), size sm, a 1-minute test,
 * English, Normal mode.
 */

import { create } from 'zustand'

import { DEFAULT_THEME_ID, type GGThemeId } from '../themes/themes.ts'

export const STREAM_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const
export type StreamSize = (typeof STREAM_SIZES)[number]

/** Test lengths, in minutes. */
export const TEST_MINUTES = [1, 2, 3, 4, 5, 7, 10, 20, 30] as const
export type TestMinutes = (typeof TEST_MINUTES)[number]

export const MODES = ['normal', 'advanced'] as const
export type Mode = (typeof MODES)[number]

export const PRESET_KEYS = ['F1', 'F2', 'F3', 'F4'] as const
export type PresetKey = (typeof PRESET_KEYS)[number]

/** The icon toggles in the toolbar. Placeholders until behaviour is wired. */
export const TOGGLES = ['mute', 'emoji', 'emojiFilled', 'chart', 'timer', 'focus', 'edit'] as const
export type Toggle = (typeof TOGGLES)[number]

export interface ShellState {
  readonly themeId: GGThemeId
  readonly size: StreamSize
  readonly minutes: TestMinutes
  readonly mode: Mode
  readonly language: string
  readonly preset: PresetKey | null
  readonly toggles: Readonly<Record<Toggle, boolean>>

  readonly setTheme: (themeId: GGThemeId) => void
  readonly setSize: (size: StreamSize) => void
  readonly setMinutes: (minutes: TestMinutes) => void
  readonly setMode: (mode: Mode) => void
  readonly setPreset: (preset: PresetKey | null) => void
  readonly toggle: (name: Toggle) => void
}

const initialToggles: Record<Toggle, boolean> = {
  mute: false,
  emoji: false,
  emojiFilled: false,
  chart: false,
  timer: true,
  focus: false,
  edit: false,
}

export const createShellStore = () =>
  create<ShellState>()((set) => ({
    themeId: DEFAULT_THEME_ID,
    size: 'sm',
    minutes: 1,
    mode: 'normal',
    language: 'english',
    preset: null,
    toggles: initialToggles,

    setTheme: (themeId) => set({ themeId }),
    setSize: (size) => set({ size }),
    setMinutes: (minutes) => set({ minutes }),
    setMode: (mode) => set({ mode }),
    setPreset: (preset) => set({ preset }),
    toggle: (name) => set((state) => ({ toggles: { ...state.toggles, [name]: !state.toggles[name] } })),
  }))

export type ShellStore = ReturnType<typeof createShellStore>

/** The shell's store. Tests reset it with `useShellStore.setState`. */
export const useShellStore = createShellStore()

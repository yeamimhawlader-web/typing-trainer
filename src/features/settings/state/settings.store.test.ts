import { beforeEach, describe, expect, it } from 'vitest'

import { STORAGE_KEYS, createMemoryAdapter } from '@core/persistence'
import type { StorageAdapter } from '@core/persistence'
import { DEFAULT_PREFERENCES } from '@config'
import type { UserPreferences } from '@core/types'

import { createSettingsStore } from './settings.store.ts'

const DEFAULTS: UserPreferences = {
  theme: 'classic-milk',
  practiceWordCount: 30,
  practiceMode: 'words',
  practiceSeconds: 30,
  textSize: 'sm',
  streamFont: 'slab',
  vocabulary: 'normal',
  hoverDifficulty: 'standard',
  // Arcade Gremlin, the default preset: its pack, and its recordings as configured.
  sound: 'blip',
  soundVolume: 100,
  soundSamples: DEFAULT_PREFERENCES.soundSamples,
  pace: 'off',
  lineScroll: 'glide',
  caret: 'bar',
  punctuation: false,
  numbers: false,
  opening: 'portal',
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
      practiceMode: 'time',
      practiceSeconds: 45,
      textSize: 'lg',
      streamFont: 'serif',
      vocabulary: 'advanced',
      hoverDifficulty: 'tired',
      lineScroll: 'instant',
      caret: 'block',
      sound: 'click',
      soundVolume: 40,
      soundSamples: { key: 'cursor3', mistake: 'line-girl1-giku1' },
      pace: 'push',
      punctuation: true,
      numbers: true,
      opening: 'direct',
    })
    const store = createSettingsStore(adapter)

    await store.getState().hydrate()

    expect(store.getState().preferences).toEqual({
      theme: 'lemondrop',
      practiceWordCount: 60,
      practiceMode: 'time',
      practiceSeconds: 45,
      textSize: 'lg',
      streamFont: 'serif',
      vocabulary: 'advanced',
      hoverDifficulty: 'tired',
      lineScroll: 'instant',
      caret: 'block',
      sound: 'click',
      soundVolume: 40,
      soundSamples: { key: 'cursor3', mistake: 'line-girl1-giku1' },
      pace: 'push',
      punctuation: true,
      numbers: true,
      opening: 'direct',
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

  it('carries over the sound switch the first version of sound stored', async () => {
    await adapter.write(STORAGE_KEYS.preferences, { soundEnabled: true })
    const on = createSettingsStore(adapter)
    await on.getState().hydrate()

    expect(on.getState().preferences.sound).toBe('thock')

    await adapter.write(STORAGE_KEYS.preferences, { soundEnabled: false })
    const off = createSettingsStore(adapter)
    await off.getState().hydrate()

    expect(off.getState().preferences.sound).toBe('off')
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
    await store.getState().setSound('cream')
    await store.getState().setSoundVolume(55)
    await store.getState().setPracticeMode('time')
    await store.getState().setPracticeSeconds(45)
    await store.getState().setPace('average')
    await store.getState().setPunctuation(true)
    await store.getState().setStreamFont('sans')
    await store.getState().setVocabulary('advanced')
    await store.getState().setLineScroll('instant')
    await store.getState().setCaret('block')
    await store.getState().setSoundSample('space', 'decision34')

    await expect(adapter.read(STORAGE_KEYS.preferences)).resolves.toEqual({
      theme: 'classic',
      practiceWordCount: 15,
      practiceMode: 'time',
      practiceSeconds: 45,
      textSize: 'xs',
      streamFont: 'sans',
      vocabulary: 'advanced',
      hoverDifficulty: 'tired',
      sound: 'cream',
      soundVolume: 55,
      soundSamples: { space: 'decision34' },
      pace: 'average',
      punctuation: true,
      numbers: false,
      opening: 'portal',
      lineScroll: 'instant',
      caret: 'block',
    })
  })

  it('remembers that the opening has been seen once, and keeps it off', async () => {
    const store = createSettingsStore(adapter)
    await store.getState().hydrate()

    // On by default: the opening is the only place the application says what it
    // is for before being asked.
    expect(store.getState().preferences.opening).toBe('portal')

    await store.getState().setOpening('direct')

    expect(store.getState().preferences.opening).toBe('direct')
    const stored = await adapter.read<UserPreferences>(STORAGE_KEYS.preferences)
    expect(stored?.opening).toBe('direct')

    const next = createSettingsStore(adapter)
    await next.getState().hydrate()
    expect(next.getState().preferences.opening).toBe('direct')
  })

  it('ignores stored values this build does not recognise', async () => {
    await adapter.write(STORAGE_KEYS.preferences, {
      theme: 'neon-purple',
      practiceWordCount: 9999,
      practiceMode: 'vibes',
      practiceSeconds: 9000,
      textSize: 'huge',
      streamFont: 'comic-sans',
      vocabulary: 'klingon',
      hoverDifficulty: 'exhausted',
      sound: 'bongos',
      soundVolume: 999,
      pace: 'warp-speed',
      punctuation: 'yes',
      numbers: 1,
      opening: 'cinematic',
    })
    const store = createSettingsStore(adapter)

    await store.getState().hydrate()

    expect(store.getState().preferences).toEqual(DEFAULTS)
  })

  it('remembers the typeface and the vocabulary across a reload', async () => {
    const store = createSettingsStore(adapter)
    await store.getState().setStreamFont('mono')
    await store.getState().setVocabulary('advanced')
    const reloaded = createSettingsStore(adapter)

    await reloaded.getState().hydrate()

    expect(reloaded.getState().preferences.streamFont).toBe('mono')
    expect(reloaded.getState().preferences.vocabulary).toBe('advanced')
  })

  it('remembers the pace chosen across a reload', async () => {
    await createSettingsStore(adapter).getState().setPace('best')
    const reloaded = createSettingsStore(adapter)

    await reloaded.getState().hydrate()

    expect(reloaded.getState().preferences.pace).toBe('best')
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

  it('keeps only recordings this build has, each for its own moment', async () => {
    await adapter.write(STORAGE_KEYS.preferences, {
      ...DEFAULTS,
      // A real recording, one for the wrong moment, one that does not exist, and a moment that does not.
      soundSamples: { key: 'cursor3', space: 'line-girl1-baka1', mistake: 'gone', nowhere: 'cursor3' },
    })
    const store = createSettingsStore(adapter)
    await store.getState().hydrate()

    expect(store.getState().preferences.soundSamples).toEqual({ key: 'cursor3' })
  })

  it('chooses a recording for a moment, and goes back to the built-in sound', async () => {
    const store = createSettingsStore(adapter)
    await store.getState().hydrate()
    // A pack on its own first, with no recordings to start from.
    await store.getState().setSound('click')

    await store.getState().setSoundSample('key', 'cursor3')
    await store.getState().setSoundSample('mistakeStreak', 'line-girl1-baka1')
    expect(store.getState().preferences.soundSamples).toEqual({ key: 'cursor3', mistakeStreak: 'line-girl1-baka1' })

    await store.getState().setSoundSample('key', null)
    expect(store.getState().preferences.soundSamples).toEqual({ mistakeStreak: 'line-girl1-baka1' })
    expect(await adapter.read(STORAGE_KEYS.preferences)).toMatchObject({ soundSamples: { mistakeStreak: 'line-girl1-baka1' } })
  })

  it('sets a preset as its pack and its recordings together, and a pack on its own with none', async () => {
    const store = createSettingsStore(adapter)
    await store.getState().hydrate()

    await store.getState().setSound('preset:office-desk')
    expect(store.getState().preferences.sound).toBe('thock')
    expect(store.getState().preferences.soundSamples).toMatchObject({ key: 'pc-keyboard03-04single-mid' })

    // Off keeps the recordings for when sound comes back.
    await store.getState().setSound('off')
    expect(store.getState().preferences.soundSamples).toMatchObject({ key: 'pc-keyboard03-04single-mid' })

    await store.getState().setSound('click')
    expect(store.getState().preferences).toMatchObject({ sound: 'click', soundSamples: {} })
  })

  it('keeps a sound chosen before there were recordings as that sound alone', async () => {
    // Stored by an earlier version: a pack, and no recordings at all.
    await adapter.write(STORAGE_KEYS.preferences, { theme: 'classic', sound: 'cream' })
    const store = createSettingsStore(adapter)
    await store.getState().hydrate()

    expect(store.getState().preferences).toMatchObject({ sound: 'cream', soundSamples: {} })
  })
})

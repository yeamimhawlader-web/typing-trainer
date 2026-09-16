/**
 * The application's sound: one audio context, one master level, one call to
 * play a voice.
 *
 * Off until asked for, and silent in every sense until then: no audio context
 * is created, so nothing is initialised, no device is opened and no browser
 * warns about audio starting on its own. The context is created when sound is
 * switched on — which is a click, the gesture browsers require — and resumed
 * again if the browser suspends it.
 *
 * Playing is deliberately forgiving. A browser with no Web Audio, a context
 * that will not start, a voice played while sound is off: all of them do
 * nothing rather than throw. A typing test must never fail because of a sound.
 */

import { playVoice, type PlayOptions } from './synth.ts'
import {
  DEFAULT_SOUND_PACK,
  FULL_VOLUME,
  gainForVolume,
  packById,
  type SoundChoice,
  type SoundPackId,
  type SoundVoice,
} from './voices.ts'

export interface SoundEngine {
  readonly isEnabled: () => boolean
  /** The pack in use, whether or not sound is on. */
  readonly pack: () => SoundPackId
  /**
   * Sound off, or on with a pack. Choosing a pack creates the audio context;
   * choosing `off` silences and keeps it.
   */
  readonly choose: (choice: SoundChoice) => void
  /** The master volume, 0–100. */
  readonly volume: () => number
  /** Sets it. 0 is silence; 100 is the level the packs were made at. */
  readonly setVolume: (volume: number) => void
  readonly play: (voice: SoundVoice, options?: PlayOptions) => void
  /** One key from `id`, whether or not that is the pack in use: what a pack sounds like. */
  readonly preview: (id: SoundPackId) => void
  /** Gives the audio device back. The engine can be used again afterwards. */
  readonly close: () => void
}

export interface SoundEngineOptions {
  /** Where to start. Off, as a fresh installation is. */
  readonly choice?: SoundChoice
  /** Where the master volume starts, 0–100. Full by default. */
  readonly volume?: number
  /** Injectable for tests; defaults to the browser's own. */
  readonly createContext?: (() => AudioContext | null) | undefined
  /** Injectable for tests; defaults to a small random wobble per play. */
  readonly wobble?: () => { readonly pitch: number; readonly gain: number }
}

type AudioContextConstructor = new () => AudioContext

const browserContext = (): AudioContext | null => {
  const constructor = (globalThis as { AudioContext?: AudioContextConstructor }).AudioContext
  if (constructor === undefined) return null
  try {
    return new constructor()
  } catch {
    return null
  }
}

/** Both wobbles in -1..1: what makes one keystroke differ from the next. */
const randomWobble = () => ({ pitch: Math.random() * 2 - 1, gain: Math.random() * 2 - 1 })

export const createSoundEngine = ({
  choice = 'off',
  volume: startingVolume = FULL_VOLUME,
  createContext = browserContext,
  wobble = randomWobble,
}: SoundEngineOptions = {}): SoundEngine => {
  let enabled = choice !== 'off'
  let packId: SoundPackId = choice === 'off' ? DEFAULT_SOUND_PACK : choice
  let volume = startingVolume
  let context: AudioContext | null = null
  let master: GainNode | null = null

  const open = (): AudioContext | null => {
    if (context !== null) return context
    context = createContext()
    if (context === null) return null
    master = context.createGain()
    master.gain.value = gainForVolume(volume)
    master.connect(context.destination)
    return context
  }

  // Browsers suspend a context started before a gesture, and again when a tab
  // has been in the background. Asking it to resume costs nothing when running.
  const wake = (audio: AudioContext): void => {
    if (audio.state === 'suspended') void audio.resume().catch(() => undefined)
  }

  /** Plays `voice` from `from`, whatever is chosen. Silent without a context. */
  const sound = (voice: SoundVoice, from: SoundPackId, options: PlayOptions = {}): void => {
    const audio = open()
    if (audio === null || master === null) return
    wake(audio)
    try {
      playVoice(audio, master, packById(from)[voice], { wobble: wobble(), ...options })
    } catch {
      // A sound that cannot be played is not worth a broken test.
    }
  }

  return {
    isEnabled: () => enabled,

    pack: () => packId,

    volume: () => volume,

    setVolume: (next) => {
      volume = Math.min(Math.max(next, 0), FULL_VOLUME)
      // One gain for everything, so the packs keep their proportions exactly.
      if (master !== null) master.gain.value = gainForVolume(volume)
    },

    choose: (next) => {
      enabled = next !== 'off'
      if (next !== 'off') packId = next
      if (!enabled) return
      const audio = open()
      if (audio !== null) wake(audio)
    },

    play: (voice, options = {}) => {
      if (!enabled || volume <= 0) return
      sound(voice, packId, options)
    },

    // A preview is asked for by pressing the pack itself, so it plays even
    // before the choice it demonstrates has been saved.
    preview: (id) => {
      if (volume <= 0) return
      sound('key', id)
    },

    close: () => {
      const audio = context
      context = null
      master = null
      if (audio !== null) void audio.close().catch(() => undefined)
    },
  }
}

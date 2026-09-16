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
import { MASTER_GAIN, THOCK_PACK, type SoundPack, type SoundVoice } from './voices.ts'

export interface SoundEngine {
  readonly isEnabled: () => boolean
  /** Switching on creates the audio context; switching off silences and keeps it. */
  readonly setEnabled: (enabled: boolean) => void
  readonly play: (voice: SoundVoice, options?: PlayOptions) => void
  /** Gives the audio device back. The engine can be used again afterwards. */
  readonly close: () => void
}

export interface SoundEngineOptions {
  readonly pack?: SoundPack
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
  pack = THOCK_PACK,
  createContext = browserContext,
  wobble = randomWobble,
}: SoundEngineOptions = {}): SoundEngine => {
  let enabled = false
  let context: AudioContext | null = null
  let master: GainNode | null = null

  const open = (): AudioContext | null => {
    if (context !== null) return context
    context = createContext()
    if (context === null) return null
    master = context.createGain()
    master.gain.value = MASTER_GAIN
    master.connect(context.destination)
    return context
  }

  // Browsers suspend a context started before a gesture, and again when a tab
  // has been in the background. Asking it to resume costs nothing when running.
  const wake = (audio: AudioContext): void => {
    if (audio.state === 'suspended') void audio.resume().catch(() => undefined)
  }

  return {
    isEnabled: () => enabled,

    setEnabled: (next) => {
      enabled = next
      if (!next) return
      const audio = open()
      if (audio !== null) wake(audio)
    },

    play: (voice, options = {}) => {
      if (!enabled) return
      const audio = open()
      if (audio === null || master === null) return
      wake(audio)
      try {
        playVoice(audio, master, pack[voice], { wobble: wobble(), ...options })
      } catch {
        // A sound that cannot be played is not worth a broken test.
      }
    },

    close: () => {
      const audio = context
      context = null
      master = null
      if (audio !== null) void audio.close().catch(() => undefined)
    },
  }
}

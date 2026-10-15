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
 *
 * ## Recordings
 *
 * A moment can have a recording chosen for it (samples.ts). It is fetched and
 * decoded once, when it is chosen with sound on, and until it is ready the
 * moment plays as it would without one — the built-in voice, or nothing. A
 * recording that will not load is the same: silence, never an error.
 */

import { pressesIn } from './presses.ts'
import { PRESS_MOMENTS, SAMPLES, sampleById, type SampleChoices, type SampleMoment } from './samples.ts'
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
  /**
   * Plays a voice, or a moment: its recording when one is chosen and loaded,
   * otherwise its built-in voice, and nothing for a moment that has none.
   */
  readonly play: (voice: SoundVoice | SampleMoment, options?: PlayOptions) => void
  /** The recordings chosen per moment. Fetches the ones not yet loaded, if sound is on. */
  readonly setSamples: (choices: SampleChoices) => void
  /** Whether a recording is chosen for `moment`, loaded or not. */
  readonly hasSample: (moment: SampleMoment) => boolean
  /** Plays one recording, chosen or not, sound on or not: what it sounds like. */
  readonly previewSample: (id: string) => void
  /** One key from `id`, whether or not that is the pack in use: what a pack sounds like. */
  readonly preview: (id: SoundPackId) => void
  /**
   * Opens the audio device ahead of a choice, playing nothing. Asked for while
   * the sound choices are open and still, so the first sound chosen does not
   * spend the moment the choices fold away waking the device.
   */
  readonly prepare: () => void
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
  /** Injectable for tests; defaults to fetching the file from public/sounds. */
  readonly loadSample?: (file: string) => Promise<ArrayBuffer>
}

/**
 * How loud a recording plays under the master level. The libraries' files are
 * mastered near full scale; this brings them to sit with the built-in voices.
 */
const SAMPLE_GAIN = 0.6
/** How far a key press's pitch wanders from one press to the next, either way. */
const PRESS_PITCH_WOBBLE = 0.03

const fetchSample = async (file: string): Promise<ArrayBuffer> => {
  const response = await fetch(`${import.meta.env.BASE_URL}sounds/${file}`)
  if (!response.ok) throw new Error(`sound ${file}: ${response.status}`)
  return response.arrayBuffer()
}

/** Whether a recording is one of key presses, to be cut apart: it belongs to a press moment. */
const isPressSample = (id: string): boolean =>
  PRESS_MOMENTS.some((moment) => SAMPLES[moment].some((sample) => sample.id === id))

type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContext

/**
 * The smallest buffer the browser will give, asked for by name.
 *
 * A context opened with no options is not the fastest one available: measured
 * in Chrome on Windows, the default reports a 10ms base latency and this
 * reports 2.5ms, for the same device. `'interactive'` is the specification's
 * default and measures the same as passing nothing at all; only a number asks
 * for the minimum. The browser clamps it to whatever it can really do.
 *
 * It is the part of the delay that is ours. The rest belongs to the sound
 * device — 40ms of output latency on the machine this was measured on — and no
 * page can talk its way past that.
 */
const SMALLEST_BUFFER: AudioContextOptions = { latencyHint: 0 }

const browserContext = (): AudioContext | null => {
  const constructor = (globalThis as { AudioContext?: AudioContextConstructor }).AudioContext
  if (constructor === undefined) return null
  try {
    return new constructor(SMALLEST_BUFFER)
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
  loadSample = fetchSample,
}: SoundEngineOptions = {}): SoundEngine => {
  let enabled = choice !== 'off'
  let packId: SoundPackId = choice === 'off' ? DEFAULT_SOUND_PACK : choice
  let volume = startingVolume
  let context: AudioContext | null = null
  let master: GainNode | null = null
  let samples: SampleChoices = {}
  /** Decoded recordings by id: one buffer, or one per press. Null for one that would not load. */
  const decoded = new Map<string, readonly AudioBuffer[] | null>()
  const loading = new Set<string>()

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

  /** Cuts a recording of presses into one buffer per press. */
  const cut = (audio: AudioContext, buffer: AudioBuffer): readonly AudioBuffer[] =>
    pressesIn(buffer.getChannelData(0), buffer.sampleRate).map(([from, to]) => {
      const press = audio.createBuffer(buffer.numberOfChannels, Math.max(1, to - from), buffer.sampleRate)
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        press.copyToChannel(buffer.getChannelData(channel).subarray(from, to), channel)
      }
      return press
    })

  /** Fetches and decodes a recording once. `then` runs with it when it is ready. */
  const load = (id: string, then?: (buffers: readonly AudioBuffer[]) => void): void => {
    const known = decoded.get(id)
    if (known !== undefined) {
      if (known !== null) then?.(known)
      return
    }
    const sample = sampleById(id)
    const audio = open()
    if (sample === null || audio === null || loading.has(id)) return
    loading.add(id)
    loadSample(sample.file)
      .then((bytes) => audio.decodeAudioData(bytes))
      .then((buffer) => (isPressSample(id) ? cut(audio, buffer) : [buffer]))
      .then(
        (buffers) => {
          decoded.set(id, buffers)
          then?.(buffers)
        },
        (error: unknown) => {
          console.warn('[sound] a recording could not be loaded', error)
          decoded.set(id, null)
        },
      )
      .finally(() => loading.delete(id))
  }

  const loadChosen = (): void => {
    if (!enabled) return
    for (const id of Object.values(samples)) if (id !== undefined) load(id)
  }

  /** Plays one of `buffers` now. A press takes a random one, a little off pitch. */
  const playBuffers = (id: string, buffers: readonly AudioBuffer[]): void => {
    const audio = open()
    if (audio === null || master === null) return
    wake(audio)
    const presses = isPressSample(id)
    const buffer = buffers[presses ? Math.floor(Math.random() * buffers.length) : 0]
    if (buffer === undefined) return
    try {
      const source = audio.createBufferSource()
      const level = audio.createGain()
      source.buffer = buffer
      if (presses) source.playbackRate.value = 1 + wobble().pitch * PRESS_PITCH_WOBBLE
      level.gain.value = SAMPLE_GAIN
      source.connect(level).connect(master)
      source.start()
    } catch {
      // As with a voice: a recording that cannot play is not worth a broken test.
    }
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
      loadChosen()
    },

    play: (voice, options = {}) => {
      if (!enabled || volume <= 0) return
      const id = (samples as Readonly<Partial<Record<string, string>>>)[voice]
      const recording = id === undefined ? undefined : decoded.get(id)
      if (id !== undefined && recording !== undefined && recording !== null) {
        playBuffers(id, recording)
        return
      }
      // A moment with no built-in voice is silent without its recording.
      if (voice in packById(packId)) sound(voice as SoundVoice, packId, options)
    },

    setSamples: (choices) => {
      samples = choices
      loadChosen()
    },

    hasSample: (moment) => samples[moment] !== undefined,

    previewSample: (id) => {
      if (volume <= 0) return
      load(id, (buffers) => {
        playBuffers(id, buffers)
      })
    },

    // A preview is asked for by pressing the pack itself, so it plays even
    // before the choice it demonstrates has been saved.
    preview: (id) => {
      if (volume <= 0) return
      sound('key', id)
    },

    prepare: () => {
      open()
    },

    close: () => {
      const audio = context
      context = null
      master = null
      if (audio !== null) void audio.close().catch(() => undefined)
    },
  }
}

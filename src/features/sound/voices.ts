/**
 * GG.Typing's sounds — every number that shapes them, in one place.
 *
 * ## Why they are made, not recorded
 *
 * A pack of recordings would be megabytes of somebody else's audio, licensed
 * separately, fetched over a network this application otherwise never touches.
 * These are built in the browser instead: a few oscillators and a burst of
 * noise per sound. That costs nothing to ship, can be tuned by changing a
 * number here, and lets every keystroke differ slightly — the thing that keeps
 * a typing sound from turning into a loop after ten seconds.
 *
 * ## What a key sounds like
 *
 * A dampened keyboard makes two sounds at once: a click as the key moves, and
 * a low knock as it bottoms out. So each voice is a short burst of filtered
 * noise (the click) over a pitched body that falls as it decays (the knock),
 * both under a low-pass filter, which is what "dampened" means — the hard top
 * end taken off. Space is deeper and longer, backspace lighter and shorter, a
 * mistake duller and lower still, with no click at all: it is the sound of a
 * key that did not want to be pressed.
 *
 * Hover Mode's sounds are notes rather than knocks. Each clean repetition steps
 * up a pentatonic ladder, so a word being cleared plays a small rising figure,
 * and nothing in the ladder can sound wrong against anything else. A word let go
 * unresolved is a soft low note, not a buzzer: Golden Nuggets are not a telling-off.
 *
 * Nothing here is loud. The master level sits well under a comfortable listening
 * volume for an hour of typing, and sound is off until it is asked for.
 */

/** The oscillator shapes used. (A subset, kept as a plain union so this file needs no DOM types.) */
export type ToneType = 'sine' | 'triangle'

export interface Tone {
  readonly type: ToneType
  /** Where the pitch starts, in hertz. */
  readonly from: number
  /** Where it falls (or rises) to over the decay. */
  readonly to: number
  readonly decayMs: number
  readonly gain: number
}

export interface Noise {
  /** Centre of the band the burst is filtered to, in hertz. */
  readonly frequency: number
  readonly q: number
  readonly decayMs: number
  readonly gain: number
}

export interface VoiceRecipe {
  /** The knock, or the note. */
  readonly body: Tone
  /** A second voice above the body, for the sounds that are chords rather than knocks. */
  readonly partial?: Tone
  /** The click of the key itself; absent where a sound is all body. */
  readonly click?: Noise
  /** Everything above this is taken off: the dampening. */
  readonly lowpassHz: number
  /** How much each play differs from the last, as a share either way. */
  readonly variation: { readonly pitch: number; readonly gain: number }
  /** Steps up the ladder (see `LADDER`), for voices played at a pitch. */
  readonly ladder?: boolean
}

export type SoundVoice =
  | 'key'
  | 'space'
  | 'backspace'
  | 'mistake'
  | 'hoverCaught'
  | 'hoverLift'
  | 'hoverClean'
  | 'hoverCycle'
  | 'hoverMissed'
  | 'hoverCleared'
  | 'hoverKept'
  | 'selectorOpen'
  | 'selectorClose'

/**
 * A pentatonic ladder in semitones, for the repetitions of a word: no two steps
 * can sound wrong together, and a cleared word rises.
 */
export const LADDER = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21] as const

export const stepRatio = (step: number): number => {
  const index = Math.min(Math.max(0, Math.round(step)), LADDER.length - 1)
  return 2 ** ((LADDER[index] as number) / 12)
}

/** The master level everything is played at: present, never loud. */
export const MASTER_GAIN = 0.34

/**
 * The one pack, deep and dampened. Another pack is another object of the same
 * shape; nothing else would have to change.
 */
export const THOCK_PACK: Readonly<Record<SoundVoice, VoiceRecipe>> = {
  // A key: a small click over a low knock that falls away in a twentieth of a second.
  key: {
    body: { type: 'sine', from: 168, to: 116, decayMs: 55, gain: 0.5 },
    click: { frequency: 1850, q: 0.9, decayMs: 14, gain: 0.17 },
    lowpassHz: 2600,
    variation: { pitch: 0.05, gain: 0.12 },
  },
  // The space bar: wider, deeper, and a little longer, as a big key is.
  space: {
    body: { type: 'sine', from: 126, to: 88, decayMs: 78, gain: 0.58 },
    click: { frequency: 1450, q: 0.8, decayMs: 18, gain: 0.15 },
    lowpassHz: 2200,
    variation: { pitch: 0.04, gain: 0.1 },
  },
  // Taking a character back: lighter and shorter than typing one.
  backspace: {
    body: { type: 'sine', from: 152, to: 124, decayMs: 38, gain: 0.32 },
    click: { frequency: 2500, q: 1.4, decayMs: 9, gain: 0.1 },
    lowpassHz: 3000,
    variation: { pitch: 0.05, gain: 0.1 },
  },
  // A mistake: no click, lower, duller, a touch longer. Felt rather than heard.
  mistake: {
    body: { type: 'triangle', from: 98, to: 72, decayMs: 120, gain: 0.5 },
    lowpassHz: 1100,
    variation: { pitch: 0.03, gain: 0.08 },
  },

  // Hover Mode. A word is caught…
  hoverCaught: {
    body: { type: 'sine', from: 232, to: 196, decayMs: 190, gain: 0.3 },
    lowpassHz: 2000,
    variation: { pitch: 0.02, gain: 0.06 },
  },
  // …lifts off the line…
  hoverLift: {
    body: { type: 'sine', from: 330, to: 392, decayMs: 260, gain: 0.2 },
    partial: { type: 'sine', from: 660, to: 784, decayMs: 200, gain: 0.06 },
    lowpassHz: 3200,
    variation: { pitch: 0.015, gain: 0.06 },
  },
  // …and each clean repetition steps up the ladder.
  hoverClean: {
    body: { type: 'triangle', from: 392, to: 392, decayMs: 170, gain: 0.22 },
    partial: { type: 'sine', from: 784, to: 784, decayMs: 120, gain: 0.05 },
    lowpassHz: 3600,
    variation: { pitch: 0.01, gain: 0.05 },
    ladder: true,
  },
  // A cycle done: the same note, fuller.
  hoverCycle: {
    body: { type: 'triangle', from: 392, to: 392, decayMs: 260, gain: 0.26 },
    partial: { type: 'sine', from: 588, to: 588, decayMs: 220, gain: 0.1 },
    lowpassHz: 3600,
    variation: { pitch: 0.01, gain: 0.05 },
    ladder: true,
  },
  // A repetition with a mistake: a dull tick, quieter than the mistake itself.
  hoverMissed: {
    body: { type: 'sine', from: 138, to: 104, decayMs: 95, gain: 0.3 },
    lowpassHz: 900,
    variation: { pitch: 0.03, gain: 0.08 },
  },
  // Cleared: a small resolve, two notes at once.
  hoverCleared: {
    body: { type: 'sine', from: 392, to: 392, decayMs: 320, gain: 0.24 },
    partial: { type: 'sine', from: 588, to: 588, decayMs: 300, gain: 0.14 },
    lowpassHz: 3400,
    variation: { pitch: 0.008, gain: 0.05 },
  },
  // Let go still unresolved: a soft low note. Something set down, not a buzzer.
  hoverKept: {
    body: { type: 'sine', from: 196, to: 174, decayMs: 300, gain: 0.26 },
    partial: { type: 'sine', from: 294, to: 261, decayMs: 260, gain: 0.08 },
    lowpassHz: 1800,
    variation: { pitch: 0.01, gain: 0.05 },
  },

  // The selector: glass, not keys. Quiet enough to be almost texture.
  selectorOpen: {
    body: { type: 'sine', from: 784, to: 1046, decayMs: 200, gain: 0.1 },
    partial: { type: 'sine', from: 1568, to: 1760, decayMs: 150, gain: 0.03 },
    click: { frequency: 5200, q: 2.2, decayMs: 40, gain: 0.03 },
    lowpassHz: 7000,
    variation: { pitch: 0.01, gain: 0.05 },
  },
  selectorClose: {
    body: { type: 'sine', from: 698, to: 587, decayMs: 160, gain: 0.08 },
    click: { frequency: 4200, q: 2.2, decayMs: 26, gain: 0.02 },
    lowpassHz: 6000,
    variation: { pitch: 0.01, gain: 0.05 },
  },
}

export type SoundPack = typeof THOCK_PACK

/** The longest any single sound lasts, in milliseconds: nothing rings on. */
export const longestVoiceMs = (pack: SoundPack = THOCK_PACK): number =>
  Math.max(
    ...Object.values(pack).map((voice) =>
      Math.max(voice.body.decayMs, voice.partial?.decayMs ?? 0, voice.click?.decayMs ?? 0),
    ),
  )

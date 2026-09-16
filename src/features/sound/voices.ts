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
 * A keyboard makes two sounds at once: a click as the key moves, and a knock as
 * it bottoms out. So each voice is a short burst of filtered noise (the click)
 * over a pitched body that falls as it decays (the knock), both under a low-pass
 * filter, which is what "dampened" means — the hard top end taken off. Space is
 * deeper and longer, backspace lighter and shorter, a mistake duller and lower
 * still, with no click at all: it is the sound of a key that did not want to be
 * pressed.
 *
 * ## Packs are characters, not copies
 *
 * Every mechanical pack is built from the same recipes below, bent by a handful
 * of numbers: how deep the knock is, how long it rings, how bright and hard the
 * click is, how much top end is taken off, and whether there is a metallic ring
 * over it. So a new keyboard is one small object, not a table of forty numbers,
 * and no keyboard can quietly drift out of proportion with the rest.
 *
 * ## Styles that are not keyboards
 *
 * Not every typist wants a keyboard. The other styles — Neon, Soft, Arcade —
 * are not keys at all, so they are not bent from the knock: each designs its
 * four keyboard voices outright, from the same few parts. A rush of air is a
 * band of noise that sweeps as it fades; a laser is a square wave falling fast;
 * a synth pluck is two detuned saws through a filter that closes; a chime or a
 * chiptune takes its note from a scale, a different one on each key, so typing
 * plays something rather than repeating one pitch. The same proportions hold:
 * space bigger than a letter, backspace lighter, a mistake lower and duller, and
 * nothing loud or long.
 *
 * Hover Mode's notes and the selector's glass are the same in every pack. They
 * are not keyboard sounds: they belong to the application, not to the keyboard
 * you chose. Only how loud they are follows the pack.
 *
 * Each clean repetition steps up a pentatonic ladder, so a word being cleared
 * plays a small rising figure, and nothing in the ladder can sound wrong against
 * anything else. A word let go unresolved is a soft low note, not a buzzer:
 * Golden Nuggets are not a telling-off.
 *
 * Nothing here is loud. The master level sits well under a comfortable listening
 * volume for an hour of typing, and sound is off until it is asked for.
 */

/** The oscillator shapes used. (Kept as a plain union so this file needs no DOM types.) */
export type ToneType = 'sine' | 'triangle' | 'square' | 'sawtooth'

export interface Tone {
  readonly type: ToneType
  /** Where the pitch starts, in hertz. */
  readonly from: number
  /** Where it falls (or rises) to over the decay. */
  readonly to: number
  readonly decayMs: number
  readonly gain: number
  /** How long it takes to arrive, for a sound that swells rather than strikes. 1.5 ms by default. */
  readonly attackMs?: number
  /** How long after the sound starts this part begins: a second note after a first. */
  readonly delayMs?: number
}

export interface Noise {
  /** Centre of the band the burst is filtered to, in hertz. */
  readonly frequency: number
  readonly q: number
  readonly decayMs: number
  readonly gain: number
  /** Where the band sweeps to as it fades: a rush of air, rather than a click. */
  readonly sweepTo?: number
  /** How long it takes to arrive. 1.5 ms by default. */
  readonly attackMs?: number
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
  /** Where the low-pass closes (or opens) to over the body's decay: a pluck, a wah. */
  readonly lowpassTo?: number
  /** The low-pass's resonance, for a filter that sings as it moves. */
  readonly resonance?: number
  /**
   * Notes to choose from, in semitones above the body's pitch: each play takes
   * one, so a run of keys is a phrase rather than one note repeated.
   */
  readonly scale?: readonly number[]
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

/** The voices that are the keyboard, and so take the pack's character. */
export const KEYBOARD_VOICES = ['key', 'space', 'backspace', 'mistake'] as const

/**
 * A pentatonic ladder in semitones, for the repetitions of a word: no two steps
 * can sound wrong together, and a cleared word rises.
 */
export const LADDER = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21] as const

export const stepRatio = (step: number): number => {
  const index = Math.min(Math.max(0, Math.round(step)), LADDER.length - 1)
  return 2 ** ((LADDER[index] as number) / 12)
}

/** The master level everything is played at, at full volume: present, never loud. */
export const MASTER_GAIN = 0.34

/** Volume is a percentage; full is the master level above. */
export const FULL_VOLUME = 100

/**
 * The gain a volume percentage asks for.
 *
 * Squared rather than straight, because hearing is not linear: half the slider
 * on a straight line is only a few decibels down and sounds nearly as loud,
 * where a squared taper puts it about 12 dB down — which is roughly half as
 * loud to a listener. Zero is silence, not a whisper.
 */
export const gainForVolume = (volume: number, full: number = MASTER_GAIN): number => {
  const share = Math.min(Math.max(volume, 0), FULL_VOLUME) / FULL_VOLUME
  return full * share * share
}

// --- The recipes every pack is bent from -------------------------------

const BASE: Readonly<Record<SoundVoice, VoiceRecipe>> = {
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

// --- Characters --------------------------------------------------------

/**
 * How a pack bends the recipes. Every number is a multiplier on the base above,
 * except `ring`, which adds a partial the base has no equivalent of.
 */
export interface PackCharacter {
  /** Deeper or higher knock. */
  readonly bodyPitch: number
  /** Longer or shorter knock. */
  readonly bodyDecay: number
  readonly bodyGain: number
  /** Brighter or darker click, harder or softer, longer or shorter. */
  readonly clickPitch: number
  readonly clickGain: number
  readonly clickDecay: number
  /** How much top end is left on: below 1 is more dampened. */
  readonly lowpass: number
  /** How lively each play is against the last. */
  readonly variation: number
  /** A metallic ring over the knock, for the packs that have one. */
  readonly ring?: { readonly frequency: number; readonly decayMs: number; readonly gain: number }
  /** How loud Hover Mode's notes and the selector's glass are in this pack. */
  readonly noteGain: number
}

/** The four voices that are the keyboard, designed outright by a style that is not a keyboard. */
export type KeyboardRecipes = Readonly<Record<(typeof KEYBOARD_VOICES)[number], VoiceRecipe>>

export const SOUND_CATEGORIES = [
  { id: 'mechanical', name: 'Mechanical', description: 'Keyboards: knocks, clicks and a typewriter' },
  { id: 'neon', name: 'Neon', description: 'Air, light and synths' },
  { id: 'soft', name: 'Soft', description: 'Bubbles, water and glass' },
  { id: 'arcade', name: 'Arcade', description: 'Eight-bit blips and notes' },
] as const

export type SoundCategoryId = (typeof SOUND_CATEGORIES)[number]['id']

interface PackBasics {
  readonly id: string
  readonly name: string
  /** What it sounds like, in a few words. */
  readonly description: string
  readonly category: SoundCategoryId
}

export type SoundPackDetails =
  /** A keyboard, bent from the base recipes. */
  | (PackBasics & { readonly character: PackCharacter })
  /** Not a keyboard: its keyboard voices designed outright, its notes at a level of its own. */
  | (PackBasics & { readonly keys: KeyboardRecipes; readonly noteGain: number })

/**
 * The packs, style by style. The keyboards come first, in order of how much they
 * are heard — from the dampened knock of a heavy board to a sharp click, with a
 * typewriter at the end — then the styles that are not keyboards.
 */
export const SOUND_PACK_LIST = [
  {
    id: 'thock',
    category: 'mechanical',
    name: 'Thock',
    description: 'Deep and dampened, like a heavy board on a desk mat',
    character: {
      bodyPitch: 1,
      bodyDecay: 1,
      bodyGain: 1,
      clickPitch: 1,
      clickGain: 1,
      clickDecay: 1,
      lowpass: 1,
      variation: 1,
      noteGain: 1,
    },
  },
  {
    id: 'cream',
    category: 'mechanical',
    name: 'Cream',
    description: 'Smooth and rounded, a long buttery bottom-out',
    character: {
      bodyPitch: 1.1,
      bodyDecay: 1.5,
      bodyGain: 1.05,
      clickPitch: 0.72,
      clickGain: 0.55,
      clickDecay: 1.5,
      lowpass: 0.78,
      variation: 0.9,
      noteGain: 1,
    },
  },
  {
    id: 'click',
    category: 'mechanical',
    name: 'Click',
    description: 'Crisp and tactile, with a bright top to every press',
    character: {
      bodyPitch: 1.28,
      bodyDecay: 0.62,
      bodyGain: 0.78,
      clickPitch: 1.75,
      clickGain: 1.7,
      clickDecay: 0.8,
      lowpass: 1.9,
      variation: 1.1,
      noteGain: 1,
    },
  },
  {
    id: 'hush',
    category: 'mechanical',
    name: 'Hush',
    description: 'Barely there, for a shared room or a late night',
    character: {
      bodyPitch: 0.94,
      bodyDecay: 0.72,
      bodyGain: 0.5,
      clickPitch: 0.85,
      clickGain: 0.3,
      clickDecay: 0.7,
      lowpass: 0.55,
      variation: 0.8,
      noteGain: 0.7,
    },
  },
  {
    id: 'typewriter',
    category: 'mechanical',
    name: 'Typewriter',
    description: 'A hard strike with a little ring left behind it',
    character: {
      bodyPitch: 1.15,
      bodyDecay: 0.85,
      bodyGain: 0.9,
      clickPitch: 1.35,
      clickGain: 1.5,
      clickDecay: 1.15,
      lowpass: 2.2,
      variation: 1.2,
      ring: { frequency: 2960, decayMs: 130, gain: 0.05 },
      noteGain: 1,
    },
  },

  // --- Neon -------------------------------------------------------------
  {
    id: 'woosh',
    name: 'Woosh',
    category: 'neon',
    description: 'A rush of air on every key, like a neon sign flickering on',
    noteGain: 0.9,
    keys: {
      // A band of noise sweeping up as it fades, with a faint glassy glint over it.
      key: {
        body: { type: 'sine', from: 620, to: 930, decayMs: 70, gain: 0.05, attackMs: 6 },
        click: { frequency: 1100, sweepTo: 5200, q: 1.1, decayMs: 88, gain: 0.34, attackMs: 9 },
        lowpassHz: 7000,
        variation: { pitch: 0.09, gain: 0.12 },
      },
      // The space: a longer rush, falling.
      space: {
        body: { type: 'sine', from: 480, to: 300, decayMs: 120, gain: 0.038, attackMs: 10 },
        click: { frequency: 4200, sweepTo: 900, q: 0.9, decayMs: 150, gain: 0.227, attackMs: 14 },
        lowpassHz: 6000,
        variation: { pitch: 0.06, gain: 0.1 },
      },
      backspace: {
        body: { type: 'sine', from: 700, to: 520, decayMs: 45, gain: 0.027 },
        click: { frequency: 3800, sweepTo: 1400, q: 1.3, decayMs: 55, gain: 0.15, attackMs: 4 },
        lowpassHz: 6500,
        variation: { pitch: 0.06, gain: 0.1 },
      },
      mistake: {
        body: { type: 'triangle', from: 150, to: 110, decayMs: 120, gain: 0.22 },
        click: { frequency: 700, sweepTo: 380, q: 0.8, decayMs: 120, gain: 0.24, attackMs: 5 },
        lowpassHz: 1400,
        variation: { pitch: 0.03, gain: 0.08 },
      },
    },
  },
  {
    id: 'laser',
    name: 'Laser',
    category: 'neon',
    description: 'A quick pew of light, pitched down as it goes',
    noteGain: 0.9,
    keys: {
      key: {
        body: { type: 'square', from: 1500, to: 420, decayMs: 62, gain: 0.08 },
        partial: { type: 'sine', from: 750, to: 210, decayMs: 50, gain: 0.06 },
        lowpassHz: 4200,
        lowpassTo: 1600,
        variation: { pitch: 0.07, gain: 0.1 },
      },
      space: {
        body: { type: 'sawtooth', from: 900, to: 130, decayMs: 125, gain: 0.09 },
        lowpassHz: 3000,
        lowpassTo: 800,
        variation: { pitch: 0.05, gain: 0.08 },
      },
      // Backspace runs the other way: a short rising blip.
      backspace: {
        body: { type: 'square', from: 320, to: 980, decayMs: 42, gain: 0.05 },
        lowpassHz: 4000,
        variation: { pitch: 0.05, gain: 0.08 },
      },
      mistake: {
        body: { type: 'sawtooth', from: 140, to: 90, decayMs: 110, gain: 0.11 },
        lowpassHz: 700,
        variation: { pitch: 0.03, gain: 0.06 },
      },
    },
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    category: 'neon',
    description: 'Detuned saw plucks through a closing filter, a note of a minor scale on every key',
    noteGain: 0.85,
    keys: {
      key: {
        body: { type: 'sawtooth', from: 440, to: 440, decayMs: 150, gain: 0.08 },
        partial: { type: 'sawtooth', from: 443, to: 443, decayMs: 150, gain: 0.06 },
        lowpassHz: 3400,
        lowpassTo: 420,
        resonance: 6,
        scale: [0, 3, 5, 7, 10, 12],
        variation: { pitch: 0.003, gain: 0.08 },
      },
      // The space: a bass note under it.
      space: {
        body: { type: 'sawtooth', from: 110, to: 110, decayMs: 230, gain: 0.11 },
        partial: { type: 'sawtooth', from: 110.7, to: 110.7, decayMs: 230, gain: 0.09 },
        lowpassHz: 1500,
        lowpassTo: 260,
        resonance: 4,
        variation: { pitch: 0.002, gain: 0.06 },
      },
      backspace: {
        body: { type: 'square', from: 880, to: 880, decayMs: 60, gain: 0.05 },
        lowpassHz: 2600,
        lowpassTo: 800,
        variation: { pitch: 0.01, gain: 0.06 },
      },
      // Two saws a little apart, beating: a note that is off.
      mistake: {
        body: { type: 'sawtooth', from: 104, to: 98, decayMs: 160, gain: 0.09 },
        partial: { type: 'sawtooth', from: 110, to: 104, decayMs: 160, gain: 0.07 },
        lowpassHz: 900,
        variation: { pitch: 0.01, gain: 0.06 },
      },
    },
  },
  {
    id: 'hologram',
    name: 'Hologram',
    category: 'neon',
    description: 'A glassy shimmer, like light through a prism, in a bright scale',
    noteGain: 0.9,
    keys: {
      key: {
        body: { type: 'sine', from: 1320, to: 1320, decayMs: 150, gain: 0.07 },
        partial: { type: 'sine', from: 1987, to: 1987, decayMs: 110, gain: 0.035 },
        click: { frequency: 7000, q: 3, decayMs: 20, gain: 0.035 },
        lowpassHz: 9000,
        scale: [0, 2, 4, 7, 9],
        variation: { pitch: 0.002, gain: 0.1 },
      },
      space: {
        body: { type: 'sine', from: 660, to: 660, decayMs: 260, gain: 0.073 },
        partial: { type: 'sine', from: 990, to: 990, decayMs: 220, gain: 0.033 },
        click: { frequency: 3000, sweepTo: 8000, q: 1, decayMs: 180, gain: 0.08, attackMs: 20 },
        lowpassHz: 8000,
        variation: { pitch: 0.004, gain: 0.08 },
      },
      backspace: {
        body: { type: 'sine', from: 1760, to: 1480, decayMs: 70, gain: 0.048 },
        lowpassHz: 9000,
        variation: { pitch: 0.01, gain: 0.08 },
      },
      mistake: {
        body: { type: 'sine', from: 262, to: 247, decayMs: 180, gain: 0.1 },
        partial: { type: 'sine', from: 277, to: 262, decayMs: 160, gain: 0.054 },
        lowpassHz: 2000,
        variation: { pitch: 0.01, gain: 0.06 },
      },
    },
  },

  // --- Soft -------------------------------------------------------------
  {
    id: 'bubble',
    name: 'Bubble',
    category: 'soft',
    description: 'A small round pop, like bubbles rising',
    noteGain: 0.85,
    keys: {
      key: {
        body: { type: 'sine', from: 420, to: 980, decayMs: 55, gain: 0.21, attackMs: 2 },
        lowpassHz: 3000,
        variation: { pitch: 0.12, gain: 0.12 },
      },
      space: {
        body: { type: 'sine', from: 260, to: 640, decayMs: 90, gain: 0.265, attackMs: 2 },
        lowpassHz: 2400,
        variation: { pitch: 0.08, gain: 0.1 },
      },
      backspace: {
        body: { type: 'sine', from: 900, to: 420, decayMs: 45, gain: 0.07 },
        lowpassHz: 3000,
        variation: { pitch: 0.08, gain: 0.1 },
      },
      mistake: {
        body: { type: 'sine', from: 180, to: 150, decayMs: 110, gain: 0.24 },
        lowpassHz: 900,
        variation: { pitch: 0.03, gain: 0.06 },
      },
    },
  },
  {
    id: 'droplet',
    name: 'Droplet',
    category: 'soft',
    description: 'Water dropping into a still bowl',
    noteGain: 0.85,
    keys: {
      // The fall, and the little plip that answers it.
      key: {
        body: { type: 'sine', from: 1500, to: 620, decayMs: 45, gain: 0.132 },
        partial: { type: 'sine', from: 700, to: 1100, decayMs: 60, gain: 0.053, delayMs: 18 },
        lowpassHz: 5000,
        variation: { pitch: 0.1, gain: 0.12 },
      },
      space: {
        body: { type: 'sine', from: 900, to: 380, decayMs: 70, gain: 0.14 },
        partial: { type: 'sine', from: 420, to: 700, decayMs: 90, gain: 0.058, delayMs: 24 },
        lowpassHz: 4000,
        variation: { pitch: 0.08, gain: 0.1 },
      },
      backspace: {
        body: { type: 'sine', from: 1800, to: 1100, decayMs: 30, gain: 0.07 },
        lowpassHz: 6000,
        variation: { pitch: 0.08, gain: 0.1 },
      },
      mistake: {
        body: { type: 'sine', from: 300, to: 180, decayMs: 120, gain: 0.139 },
        lowpassHz: 1200,
        variation: { pitch: 0.03, gain: 0.06 },
      },
    },
  },
  {
    id: 'chime',
    name: 'Chime',
    category: 'soft',
    description: 'A soft glass chime, a different note on every key',
    noteGain: 0.8,
    keys: {
      // A bell: a note with an inharmonic partial above it, from a major scale.
      key: {
        body: { type: 'triangle', from: 880, to: 880, decayMs: 240, gain: 0.075 },
        partial: { type: 'sine', from: 2428, to: 2428, decayMs: 120, gain: 0.023 },
        lowpassHz: 6000,
        scale: [0, 2, 4, 7, 9, 12],
        variation: { pitch: 0.002, gain: 0.1 },
      },
      space: {
        body: { type: 'triangle', from: 440, to: 440, decayMs: 320, gain: 0.112 },
        partial: { type: 'sine', from: 660, to: 660, decayMs: 260, gain: 0.045 },
        lowpassHz: 5000,
        variation: { pitch: 0.002, gain: 0.08 },
      },
      backspace: {
        body: { type: 'sine', from: 1320, to: 1320, decayMs: 90, gain: 0.044 },
        lowpassHz: 6000,
        variation: { pitch: 0.004, gain: 0.08 },
      },
      mistake: {
        body: { type: 'sine', from: 220, to: 208, decayMs: 220, gain: 0.139 },
        lowpassHz: 1500,
        variation: { pitch: 0.01, gain: 0.06 },
      },
    },
  },

  // --- Arcade -----------------------------------------------------------
  {
    id: 'blip',
    name: 'Blip',
    category: 'arcade',
    description: 'A tidy eight-bit blip',
    noteGain: 0.9,
    keys: {
      key: {
        body: { type: 'square', from: 988, to: 988, decayMs: 40, gain: 0.08 },
        lowpassHz: 6000,
        variation: { pitch: 0.03, gain: 0.08 },
      },
      space: {
        body: { type: 'square', from: 494, to: 494, decayMs: 70, gain: 0.09 },
        lowpassHz: 5000,
        variation: { pitch: 0.02, gain: 0.08 },
      },
      backspace: {
        body: { type: 'square', from: 660, to: 523, decayMs: 35, gain: 0.06 },
        lowpassHz: 5000,
        variation: { pitch: 0.02, gain: 0.08 },
      },
      mistake: {
        body: { type: 'square', from: 131, to: 123, decayMs: 110, gain: 0.1 },
        lowpassHz: 1200,
        variation: { pitch: 0.02, gain: 0.06 },
      },
    },
  },
  {
    id: 'coin',
    name: 'Coin',
    category: 'arcade',
    description: 'Two quick notes, the sound of a pickup',
    noteGain: 0.9,
    keys: {
      key: {
        body: { type: 'square', from: 988, to: 988, decayMs: 45, gain: 0.07 },
        partial: { type: 'square', from: 1319, to: 1319, decayMs: 90, gain: 0.06, delayMs: 45 },
        lowpassHz: 7000,
        variation: { pitch: 0.01, gain: 0.08 },
      },
      space: {
        body: { type: 'square', from: 523, to: 523, decayMs: 50, gain: 0.08 },
        partial: { type: 'square', from: 784, to: 784, decayMs: 120, gain: 0.07, delayMs: 50 },
        lowpassHz: 6000,
        variation: { pitch: 0.01, gain: 0.08 },
      },
      backspace: {
        body: { type: 'square', from: 784, to: 659, decayMs: 40, gain: 0.05 },
        lowpassHz: 5000,
        variation: { pitch: 0.01, gain: 0.08 },
      },
      // The other way down: a bonk.
      mistake: {
        body: { type: 'square', from: 147, to: 131, decayMs: 90, gain: 0.09 },
        partial: { type: 'square', from: 139, to: 117, decayMs: 110, gain: 0.07, delayMs: 70 },
        lowpassHz: 1400,
        variation: { pitch: 0.01, gain: 0.06 },
      },
    },
  },
  {
    id: 'chiptune',
    name: 'Chiptune',
    category: 'arcade',
    description: 'Square-wave notes in a major key: a tune as you type',
    noteGain: 0.9,
    keys: {
      key: {
        body: { type: 'square', from: 523, to: 523, decayMs: 70, gain: 0.07 },
        partial: { type: 'triangle', from: 261.5, to: 261.5, decayMs: 70, gain: 0.08 },
        lowpassHz: 5000,
        scale: [0, 2, 4, 7, 9, 12, 14],
        variation: { pitch: 0.002, gain: 0.08 },
      },
      space: {
        body: { type: 'triangle', from: 262, to: 262, decayMs: 110, gain: 0.24 },
        lowpassHz: 3000,
        variation: { pitch: 0.002, gain: 0.06 },
      },
      backspace: {
        body: { type: 'square', from: 1047, to: 1047, decayMs: 30, gain: 0.04 },
        lowpassHz: 6000,
        variation: { pitch: 0.004, gain: 0.06 },
      },
      mistake: {
        body: { type: 'square', from: 104, to: 98, decayMs: 120, gain: 0.09 },
        lowpassHz: 1000,
        variation: { pitch: 0.01, gain: 0.06 },
      },
    },
  },
] as const satisfies readonly SoundPackDetails[]

export type SoundPackId = (typeof SOUND_PACK_LIST)[number]['id']

/** The packs of one style, in order. */
export const packsIn = (category: SoundCategoryId): readonly SoundPackDetails[] =>
  SOUND_PACK_LIST.filter((pack) => pack.category === category)

/** Which style a pack belongs to; the keyboards for anything unknown, or off. */
export const categoryOf = (id: string): SoundCategoryId =>
  SOUND_PACK_LIST.find((pack) => pack.id === id)?.category ?? 'mechanical'

/** How loud Hover Mode's notes and the selector's glass are in a pack. */
export const noteGainOf = (pack: SoundPackDetails): number => ('character' in pack ? pack.character.noteGain : pack.noteGain)

/** Sound off, or the pack it is on. */
export type SoundChoice = 'off' | SoundPackId

export const DEFAULT_SOUND_PACK: SoundPackId = 'thock'

const bendTone = (tone: Tone, pitch: number, decay: number, gain: number): Tone => ({
  type: tone.type,
  from: Math.round(tone.from * pitch),
  to: Math.round(tone.to * pitch),
  decayMs: Math.round(tone.decayMs * decay),
  gain: Number((tone.gain * gain).toFixed(3)),
})

/** One pack's voices: the base recipes with the character applied to the keys. */
export const buildPack = (character: PackCharacter): Readonly<Record<SoundVoice, VoiceRecipe>> => {
  const voices = Object.entries(BASE).map(([name, recipe]) => {
    const isKeyboard = (KEYBOARD_VOICES as readonly string[]).includes(name)
    if (!isKeyboard) {
      // A note: only its level follows the pack.
      return [
        name,
        {
          ...recipe,
          body: { ...recipe.body, gain: Number((recipe.body.gain * character.noteGain).toFixed(3)) },
          ...(recipe.partial === undefined
            ? {}
            : { partial: { ...recipe.partial, gain: Number((recipe.partial.gain * character.noteGain).toFixed(3)) } }),
        },
      ] as const
    }

    const body = bendTone(recipe.body, character.bodyPitch, character.bodyDecay, character.bodyGain)
    const click =
      recipe.click === undefined
        ? undefined
        : {
            frequency: Math.round(recipe.click.frequency * character.clickPitch),
            q: recipe.click.q,
            decayMs: Math.round(recipe.click.decayMs * character.clickDecay),
            gain: Number((recipe.click.gain * character.clickGain).toFixed(3)),
          }
    // The ring sits over the knock, at the pack's own pitch rather than the key's.
    const ring =
      character.ring === undefined || name === 'mistake'
        ? undefined
        : ({
            type: 'sine',
            from: character.ring.frequency,
            to: Math.round(character.ring.frequency * 0.98),
            decayMs: character.ring.decayMs,
            gain: character.ring.gain,
          } satisfies Tone)

    return [
      name,
      {
        body,
        ...(ring === undefined ? {} : { partial: ring }),
        ...(click === undefined ? {} : { click }),
        lowpassHz: Math.round(recipe.lowpassHz * character.lowpass),
        variation: {
          pitch: Number((recipe.variation.pitch * character.variation).toFixed(3)),
          gain: Number((recipe.variation.gain * character.variation).toFixed(3)),
        },
      },
    ] as const
  })

  return Object.fromEntries(voices) as Readonly<Record<SoundVoice, VoiceRecipe>>
}

export type SoundPack = Readonly<Record<SoundVoice, VoiceRecipe>>

/** A style that is not a keyboard: its own keyboard voices, and the notes every pack shares at its level. */
export const buildDesignedPack = (keys: KeyboardRecipes, noteGain: number): SoundPack => {
  const notes = buildPack({ ...NEUTRAL_CHARACTER, noteGain })
  return { ...notes, ...keys }
}

const NEUTRAL_CHARACTER: PackCharacter = {
  bodyPitch: 1,
  bodyDecay: 1,
  bodyGain: 1,
  clickPitch: 1,
  clickGain: 1,
  clickDecay: 1,
  lowpass: 1,
  variation: 1,
  noteGain: 1,
}

/** Every pack, built once. */
export const SOUND_PACKS: Readonly<Record<SoundPackId, SoundPack>> = Object.fromEntries(
  (SOUND_PACK_LIST as readonly SoundPackDetails[]).map((pack) => [
    pack.id,
    'character' in pack ? buildPack(pack.character) : buildDesignedPack(pack.keys, pack.noteGain),
  ]),
) as Readonly<Record<SoundPackId, SoundPack>>

export const packById = (id: string): SoundPack => SOUND_PACKS[id as SoundPackId] ?? SOUND_PACKS[DEFAULT_SOUND_PACK]

export const isSoundPackId = (value: unknown): value is SoundPackId =>
  SOUND_PACK_LIST.some((pack) => pack.id === value)

/** The pack a stored preference names, or null if it names none. */
export const soundChoiceFromStored = (value: unknown): SoundChoice | null => {
  if (value === 'off') return 'off'
  if (isSoundPackId(value)) return value
  // What the first version of sound stored, before there were packs to choose.
  if (value === true) return DEFAULT_SOUND_PACK
  if (value === false) return 'off'
  return null
}

/** The longest any single sound lasts, in milliseconds, a delayed second note included: nothing rings on. */
export const longestVoiceMs = (pack: SoundPack = SOUND_PACKS[DEFAULT_SOUND_PACK]): number =>
  Math.max(
    ...Object.values(pack).map((voice) =>
      Math.max(
        (voice.body.delayMs ?? 0) + voice.body.decayMs,
        (voice.partial?.delayMs ?? 0) + (voice.partial?.decayMs ?? 0),
        voice.click?.decayMs ?? 0,
      ),
    ),
  )

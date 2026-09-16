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
 * Every pack is built from the same recipes below, bent by a handful of numbers:
 * how deep the knock is, how long it rings, how bright and hard the click is,
 * how much top end is taken off, and whether there is a metallic ring over it.
 * So a new pack is one small object, not a table of forty numbers, and no pack
 * can quietly drift out of proportion with the rest.
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

export interface SoundPackDetails {
  readonly id: string
  readonly name: string
  /** What it sounds like, in a few words. */
  readonly description: string
  readonly character: PackCharacter
}

/**
 * The packs, in order of how much they are heard: from the dampened knock of a
 * heavy board to a sharp click, with a typewriter at the end.
 */
export const SOUND_PACK_LIST = [
  {
    id: 'thock',
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
] as const satisfies readonly SoundPackDetails[]

export type SoundPackId = (typeof SOUND_PACK_LIST)[number]['id']

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

/** Every pack, built once. */
export const SOUND_PACKS: Readonly<Record<SoundPackId, SoundPack>> = Object.fromEntries(
  SOUND_PACK_LIST.map((pack) => [pack.id, buildPack(pack.character)]),
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

/** The longest any single sound lasts, in milliseconds: nothing rings on. */
export const longestVoiceMs = (pack: SoundPack = SOUND_PACKS[DEFAULT_SOUND_PACK]): number =>
  Math.max(
    ...Object.values(pack).map((voice) =>
      Math.max(voice.body.decayMs, voice.partial?.decayMs ?? 0, voice.click?.decayMs ?? 0),
    ),
  )

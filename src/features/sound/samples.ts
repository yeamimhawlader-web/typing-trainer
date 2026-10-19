/**
 * Recorded sounds: the catalogue of the ones that can stand in for a voice, or
 * play at a moment no built-in voice covers.
 *
 * ## Why there are recordings at all
 *
 * The packs in voices.ts are made in the browser, and stay the default. These
 * are for what a few oscillators cannot do — a real keyboard, a cartoon pop, a
 * voice saying 「ばかーー！」. Each moment can take one, chosen in Settings, and
 * a moment with nothing chosen sounds as it always has.
 *
 * Nothing here is fetched until it is both chosen and sound is on, so a typist
 * who never picks one downloads nothing.
 *
 * ## Where they come from
 *
 * Three free Japanese libraries, under their own terms:
 *
 * - Sound Effect Lab (効果音ラボ), soundeffect-lab.info — free, credit optional.
 *   Used as the application's own sounds, which its terms allow; the files are
 *   not offered for download, and are never linked from their site.
 * - Maou Damashii (魔王魂), maou.audio — CC BY 4.0: credit required.
 * - OtoLogic, otologic.jp — CC BY 4.0: credit required.
 *
 * The credits are on the Settings page, under the choices themselves. A file
 * keeps the name its source gave it, where that source asks for that.
 */

/** Where a recording came from, for its credit. */
export type SampleSource = 'soundEffectLab' | 'maouDamashii' | 'otoLogic'

export interface Sample {
  /** Stable, stored in preferences: never renamed once shipped. */
  readonly id: string
  readonly label: string
  /** Under public/sounds. */
  readonly file: string
  readonly source: SampleSource
}

/**
 * The moments a recording can be chosen for.
 *
 * The first ones are voices the packs already play, which a recording replaces.
 * The rest have no built-in voice: with nothing chosen they are silent.
 */
export const SAMPLE_MOMENTS = [
  'key',
  'space',
  'backspace',
  'mistake',
  'mistakeStreak',
  'finish',
  'best',
  'selectorOpen',
  'selectorClose',
  'hoverCleared',
  'hoverMissed',
  'hoverKept',
  'allInLaugh',
  'idle',
] as const

export type SampleMoment = (typeof SAMPLE_MOMENTS)[number]

/** Moments whose recording holds many separate presses, cut apart and taken in turn. */
export const PRESS_MOMENTS: readonly SampleMoment[] = ['key', 'space', 'backspace']

export const SAMPLES: Readonly<Record<SampleMoment, readonly Sample[]>> = {
  key: [
    { id: 'pc-keyboard03-04single-mid', label: 'Keyboard B, medium', file: 'otologic/pc-keyboard03-04single-mid.mp3', source: 'otoLogic' },
    { id: 'pc-keyboard05-04single-mid', label: 'Keyboard D, medium', file: 'otologic/pc-keyboard05-04single-mid.mp3', source: 'otoLogic' },
    { id: 'typewriter02-03type-single', label: 'Typewriter key', file: 'otologic/typewriter02-03type-single.mp3', source: 'otoLogic' },
    { id: 'cursor3', label: 'Electronic pip (ピッ)', file: 'soundeffect-lab/cursor3.mp3', source: 'soundEffectLab' },
    { id: 'cursor12', label: 'Wooden tock (コッ)', file: 'soundeffect-lab/cursor12.mp3', source: 'soundEffectLab' },
    { id: 'touch1', label: 'Tiny poke (ポインチョ)', file: 'soundeffect-lab/touch1.mp3', source: 'soundEffectLab' },
    { id: 'nyu3', label: 'Little pop-out (ニュッ)', file: 'soundeffect-lab/nyu3.mp3', source: 'soundEffectLab' },
    { id: 'peta1', label: 'Stamp (ペタッ)', file: 'soundeffect-lab/peta1.mp3', source: 'soundEffectLab' },
    { id: 'pa1', label: 'Cute message pop (パッ)', file: 'soundeffect-lab/pa1.mp3', source: 'soundEffectLab' },
    { id: 'anime-motion31-1high', label: 'Anime blip', file: 'otologic/anime-motion31-1high.mp3', source: 'otoLogic' },
  ],
  space: [
    { id: 'pc-keyboard05-10space-mid', label: 'Keyboard D space', file: 'otologic/pc-keyboard05-10space-mid.mp3', source: 'otoLogic' },
    { id: 'decision34', label: 'Soft pop (ポン)', file: 'soundeffect-lab/decision34.mp3', source: 'soundEffectLab' },
    { id: 'onoma-pop01-1dry', label: 'Cartoon pop', file: 'otologic/onoma-pop01-1dry.mp3', source: 'otoLogic' },
    { id: 'balloon01-04slap', label: 'Balloon slap', file: 'otologic/balloon01-04slap.mp3', source: 'otoLogic' },
  ],
  backspace: [
    { id: 'nes-action01-06throw', label: '8-bit throw', file: 'otologic/nes-action01-06throw.mp3', source: 'otoLogic' },
  ],
  mistake: [
    { id: 'cat-synthetic01-1', label: 'Synth cat meow', file: 'otologic/cat-synthetic01-1.mp3', source: 'otoLogic' },
    { id: 'line-girl1-are1', label: '「あれっ？」 Huh?', file: 'soundeffect-lab/line-girl1-are1.mp3', source: 'soundEffectLab' },
    { id: 'line-girl1-n1', label: '「ん？」 Hm?', file: 'soundeffect-lab/line-girl1-n1.mp3', source: 'soundEffectLab' },
    { id: 'line-girl1-giku1', label: '「ぎくっ」 Gulp', file: 'soundeffect-lab/line-girl1-giku1.mp3', source: 'soundEffectLab' },
    { id: 'line-girl1-ee2', label: '「えー…」 Ew…', file: 'soundeffect-lab/line-girl1-ee2.mp3', source: 'soundEffectLab' },
    { id: 'line-girl1-u1', label: '「うっ！」 Ugh!', file: 'soundeffect-lab/line-girl1-u1.mp3', source: 'soundEffectLab' },
    { id: 'healer-damage1', label: 'Healer girl 「いたっ！」 Ow!', file: 'soundeffect-lab/healer-damage1.mp3', source: 'soundEffectLab' },
    { id: 'swordwoman-damage1', label: 'Swordswoman 「きゃっ！」 Eek!', file: 'soundeffect-lab/swordwoman-damage1.mp3', source: 'soundEffectLab' },
    { id: 'thief-boy-damage1', label: 'Thief boy 「いてっ！」 Ouch!', file: 'soundeffect-lab/thief-boy-damage1.mp3', source: 'soundEffectLab' },
    { id: 'info-lady1-out1', label: 'Announcer 「アウト」 Out!', file: 'soundeffect-lab/info-lady1-out1.mp3', source: 'soundEffectLab' },
  ],
  mistakeStreak: [
    { id: 'line-girl1-baka1', label: '「ばかーー！」 Baka!', file: 'soundeffect-lab/line-girl1-baka1.mp3', source: 'soundEffectLab' },
    { id: 'line-girl1-nanbisuruno1', label: '「何するの！」 What are you doing!', file: 'soundeffect-lab/line-girl1-nanbisuruno1.mp3', source: 'soundEffectLab' },
    { id: 'line-girl1-chottofuzakenaideyo1', label: '「ちょっと…ふざけないでよ」 Quit messing around', file: 'soundeffect-lab/line-girl1-chottofuzakenaideyo1.mp3', source: 'soundEffectLab' },
    { id: 'princess-guard2', label: 'Princess 「こしゃくな」 Insolent!', file: 'soundeffect-lab/princess-guard2.mp3', source: 'soundEffectLab' },
  ],
  finish: [
    { id: 'success1', label: 'Success', file: 'soundeffect-lab/success1.mp3', source: 'soundEffectLab' },
    { id: 'line-girl1-otsukaresamadeshita1', label: '「お疲れ様でした」 Good work', file: 'soundeffect-lab/line-girl1-otsukaresamadeshita1.mp3', source: 'soundEffectLab' },
  ],
  best: [
    { id: 'info-lady1-levelupshimashita1', label: 'Announcer 「レベルアップしました」 Level up!', file: 'soundeffect-lab/info-lady1-levelupshimashita1.mp3', source: 'soundEffectLab' },
    { id: 'people-performance-uwaa1', label: 'Crowd 「わぁーーっ♪」', file: 'soundeffect-lab/people-performance-uwaa1.mp3', source: 'soundEffectLab' },
  ],
  allInLaugh: [
    { id: 'line-girl1-ahahaha2', label: '「あははははっ！…」 Can’t stop laughing', file: 'soundeffect-lab/line-girl1-ahahaha2.mp3', source: 'soundEffectLab' },
  ],
  selectorOpen: [
    { id: 'menu4', label: 'Window opens', file: 'soundeffect-lab/menu4.mp3', source: 'soundEffectLab' },
    { id: 'nyu2', label: 'Boing pop-out (ニュッ 2)', file: 'soundeffect-lab/nyu2.mp3', source: 'soundEffectLab' },
  ],
  selectorClose: [
    { id: 'cancel4', label: 'Soft cancel', file: 'soundeffect-lab/cancel4.mp3', source: 'soundEffectLab' },
  ],
  hoverCleared: [
    { id: 'suck1', label: 'Gobbled it up (パクッ)', file: 'soundeffect-lab/suck1.mp3', source: 'soundEffectLab' },
    { id: 'line-girl1-yaa2', label: '「やあ！」 Haa!', file: 'soundeffect-lab/line-girl1-yaa2.mp3', source: 'soundEffectLab' },
    { id: 'healer-attack1', label: 'Healer girl 「えいっ！」', file: 'soundeffect-lab/healer-attack1.mp3', source: 'soundEffectLab' },
  ],
  hoverMissed: [
    { id: 'line-girl1-uu2', label: '「ううっ…」 Uuu…', file: 'soundeffect-lab/line-girl1-uu2.mp3', source: 'soundEffectLab' },
  ],
  hoverKept: [
    { id: 'maou_se_onepoint23', label: 'Convinced (納得)', file: 'maou-damashii/maou_se_onepoint23.mp3', source: 'maouDamashii' },
  ],
  idle: [
    { id: 'line-girl1-suyasuya1', label: '「ス～…ス～…」 Sleeping breaths', file: 'soundeffect-lab/line-girl1-suyasuya1.mp3', source: 'soundEffectLab' },
    { id: 'line-girl1-munyamunya1', label: '「ムニャムニャ…」 Sleep mumbles', file: 'soundeffect-lab/line-girl1-munyamunya1.mp3', source: 'soundEffectLab' },
    { id: 'line-girl1-zii1', label: '「じぃ～…」 *stares at you*', file: 'soundeffect-lab/line-girl1-zii1.mp3', source: 'soundEffectLab' },
  ],
}

export interface MomentDetails {
  readonly title: string
  readonly when: string
  /** Whether a built-in voice plays here when no recording is chosen. */
  readonly builtIn: boolean
}

export const MOMENT_DETAILS: Readonly<Record<SampleMoment, MomentDetails>> = {
  key: { title: 'Keystroke', when: 'Every letter you type.', builtIn: true },
  space: { title: 'Space', when: 'The space between words.', builtIn: true },
  backspace: { title: 'Backspace', when: 'Each letter you delete.', builtIn: true },
  mistake: { title: 'Mistake', when: 'A wrong letter.', builtIn: true },
  mistakeStreak: {
    title: 'Mistakes in a row',
    when: 'The third wrong letter in a row, instead of the mistake sound.',
    builtIn: false,
  },
  finish: { title: 'Test finished', when: 'When the result appears.', builtIn: false },
  best: {
    title: 'Personal best',
    when: 'With the confetti, instead of the finished sound.',
    builtIn: false,
  },
  selectorOpen: { title: 'Menu opens', when: 'Opening a choice on the toolbar.', builtIn: true },
  selectorClose: { title: 'Menu closes', when: 'Closing it again.', builtIn: true },
  hoverCleared: { title: 'Hover Mode: word cleared', when: 'A focused word, typed clean.', builtIn: true },
  hoverMissed: { title: 'Hover Mode: repetition missed', when: 'A repetition with a mistake in it.', builtIn: true },
  hoverKept: { title: 'Hover Mode: Golden Nugget kept', when: 'A word kept for later practice.', builtIn: true },
  allInLaugh: {
    title: 'All In: too many mistakes',
    when: 'Once a test, when a second word has needed three or more repetitions retyped.',
    builtIn: false,
  },
  idle: { title: 'Idle', when: 'After a minute without typing on the typing screen.', builtIn: false },
}

export const SOURCE_CREDITS: Readonly<Record<SampleSource, { readonly name: string; readonly url: string; readonly licence: string }>> = {
  soundEffectLab: { name: 'Sound Effect Lab (効果音ラボ)', url: 'https://soundeffect-lab.info/', licence: 'free to use' },
  maouDamashii: { name: 'Maou Damashii (魔王魂)', url: 'https://maou.audio/', licence: 'CC BY 4.0' },
  otoLogic: { name: 'OtoLogic', url: 'https://otologic.jp/', licence: 'CC BY 4.0' },
}

const byId = new Map(Object.values(SAMPLES).flat().map((sample) => [sample.id, sample]))

/** The recording with this id, or null for an id this build does not have. */
export const sampleById = (id: string): Sample | null => byId.get(id) ?? null

/** Whether `id` is one of `moment`'s recordings. */
export const isSampleFor = (moment: SampleMoment, id: unknown): id is string =>
  typeof id === 'string' && SAMPLES[moment].some((sample) => sample.id === id)

/** Recordings chosen per moment. A moment left out plays its built-in voice, or nothing. */
export type SampleChoices = Readonly<Partial<Record<SampleMoment, string>>>

/** Only the choices this build understands, from something read off disk. */
export const sampleChoicesFromStored = (stored: unknown): SampleChoices => {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {}
  const record = stored as Record<string, unknown>
  const result: Partial<Record<SampleMoment, string>> = {}
  for (const moment of SAMPLE_MOMENTS) {
    const id = record[moment]
    if (isSampleFor(moment, id)) result[moment] = id
  }
  return result
}

/** The sources whose recordings are in use: the credits that have to be shown. */
export const sourcesIn = (choices: SampleChoices): readonly SampleSource[] => [
  ...new Set(Object.values(choices).flatMap((id) => (id === undefined ? [] : [sampleById(id)?.source ?? []].flat()))),
]

/**
 * A ready-made set of recordings, one choice for every moment at once.
 *
 * Choosing a preset puts its recordings on every moment it names and the pack
 * under it on the rest — Hover Mode's notes, and any keyboard voice it leaves
 * alone. What it chooses can still be changed a moment at a time afterwards;
 * it is then no longer that preset, but the typist's own mix.
 */
export interface SoundPreset {
  /** Stable: stored as `preset:<id>` in the sound choice the menu shows. */
  readonly id: string
  readonly name: string
  /** What it sounds like, in a few words. */
  readonly description: string
  /** The built-in pack under it, for the moments it leaves alone. */
  readonly base: string
  readonly samples: SampleChoices
}

export const SOUND_PRESETS: readonly SoundPreset[] = [
  {
    id: 'mochi-pop',
    name: 'Mochi Pop',
    description: 'Little pops and a voice that sighs at mistakes',
    base: 'bubble',
    samples: {
      key: 'nyu3',
      space: 'onoma-pop01-1dry',
      backspace: 'nes-action01-06throw',
      mistake: 'line-girl1-n1',
      mistakeStreak: 'line-girl1-chottofuzakenaideyo1',
      finish: 'line-girl1-otsukaresamadeshita1',
      best: 'people-performance-uwaa1',
      selectorOpen: 'menu4',
      selectorClose: 'cancel4',
      hoverCleared: 'suck1',
      hoverMissed: 'line-girl1-uu2',
      hoverKept: 'maou_se_onepoint23',
      allInLaugh: 'line-girl1-ahahaha2',
      idle: 'line-girl1-suyasuya1',
    },
  },
  {
    id: 'office-desk',
    name: 'Office Desk',
    description: 'A real keyboard, and quiet otherwise',
    base: 'thock',
    samples: {
      key: 'pc-keyboard03-04single-mid',
      space: 'pc-keyboard05-10space-mid',
      finish: 'success1',
      best: 'info-lady1-levelupshimashita1',
    },
  },
  {
    id: 'ink-and-ribbon',
    name: 'Ink & Ribbon',
    description: 'A typewriter, with a bell for the finish',
    base: 'typewriter',
    samples: {
      key: 'typewriter02-03type-single',
      finish: 'success1',
      best: 'people-performance-uwaa1',
    },
  },
  {
    id: 'kawaii-quest',
    name: 'Kawaii Quest',
    description: 'Soft pips and a healer cheering you on',
    base: 'chime',
    samples: {
      key: 'cursor3',
      space: 'decision34',
      mistake: 'healer-damage1',
      mistakeStreak: 'line-girl1-baka1',
      finish: 'line-girl1-otsukaresamadeshita1',
      best: 'info-lady1-levelupshimashita1',
      selectorOpen: 'nyu2',
      selectorClose: 'cancel4',
      hoverCleared: 'healer-attack1',
      hoverMissed: 'line-girl1-uu2',
      hoverKept: 'maou_se_onepoint23',
      allInLaugh: 'line-girl1-ahahaha2',
      idle: 'line-girl1-munyamunya1',
    },
  },
  {
    id: 'arcade-gremlin',
    name: 'Arcade Gremlin',
    description: 'Blips, a balloon slap and a cat that hates typos',
    base: 'blip',
    samples: {
      key: 'anime-motion31-1high',
      space: 'balloon01-04slap',
      backspace: 'nes-action01-06throw',
      mistake: 'cat-synthetic01-1',
      mistakeStreak: 'princess-guard2',
      finish: 'success1',
      best: 'people-performance-uwaa1',
      selectorOpen: 'nyu2',
      selectorClose: 'cancel4',
      hoverCleared: 'line-girl1-yaa2',
      hoverMissed: 'line-girl1-uu2',
      hoverKept: 'maou_se_onepoint23',
      allInLaugh: 'line-girl1-ahahaha2',
      idle: 'line-girl1-zii1',
    },
  },
  {
    id: 'paper-stamp',
    name: 'Paper Stamp',
    description: 'Every letter stamped, and an ouch for a slip',
    base: 'cream',
    samples: {
      key: 'peta1',
      space: 'decision34',
      mistake: 'thief-boy-damage1',
      mistakeStreak: 'line-girl1-nanbisuruno1',
      finish: 'success1',
      best: 'info-lady1-levelupshimashita1',
      selectorOpen: 'menu4',
      selectorClose: 'cancel4',
      idle: 'line-girl1-suyasuya1',
    },
  },
  {
    id: 'bamboo-whisper',
    name: 'Bamboo Whisper',
    description: 'Wooden taps and a gulp at a mistake',
    base: 'hush',
    samples: {
      key: 'cursor12',
      space: 'decision34',
      mistake: 'line-girl1-giku1',
      mistakeStreak: 'line-girl1-baka1',
      finish: 'line-girl1-otsukaresamadeshita1',
      best: 'people-performance-uwaa1',
      hoverCleared: 'suck1',
      hoverKept: 'maou_se_onepoint23',
      idle: 'line-girl1-zii1',
    },
  },
]

const PRESET_PREFIX = 'preset:'

/** How a preset is named in the sound choice the menu shows. */
export const presetChoice = (preset: SoundPreset): string => `${PRESET_PREFIX}${preset.id}`

/** The preset a choice names, or null for a pack or off. */
export const presetByChoice = (choice: string): SoundPreset | null =>
  choice.startsWith(PRESET_PREFIX) ? (SOUND_PRESETS.find((preset) => presetChoice(preset) === choice) ?? null) : null

/**
 * The preset this pack and these recordings are, or null when they are not one
 * — a pack alone, or a mix the typist has changed.
 */
export const presetMatching = (pack: string, choices: SampleChoices): SoundPreset | null => {
  const chosen = Object.entries(choices).filter(([, id]) => id !== undefined)
  return (
    SOUND_PRESETS.find(
      (preset) =>
        preset.base === pack &&
        chosen.length === Object.keys(preset.samples).length &&
        chosen.every(([moment, id]) => preset.samples[moment as SampleMoment] === id),
    ) ?? null
  )
}

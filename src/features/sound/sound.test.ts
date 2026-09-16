/**
 * Sound: the engine, what it builds on the audio graph, and what plays when.
 *
 * jsdom has no Web Audio, so a small recording context stands in for it: every
 * node it hands out remembers what was connected to it and every value that was
 * scheduled on it. That is enough to check the things that matter and cannot be
 * heard from here — that nothing is created until sound is asked for, that
 * every envelope ends at true silence, that nothing is left running, and that
 * the right voice plays for the right moment.
 *
 * How it actually sounds was listened to in a browser; no test can do that.
 */

import { describe, expect, it, vi } from 'vitest'

import type { EngineEvent, EngineEventListener, TypingEngine } from '@core/engine'
import type { HoverController, HoverProgress, HoverSignal } from '@features/ggtyping'
import type { Keystroke } from '@core/types'

import { ladderStep, playHoverSounds, playTypingSounds, voiceForKeystroke, voiceForSignal } from './connect.ts'
import { createSoundEngine, type SoundEngine } from './sound-engine.ts'
import { scaleRatio } from './synth.ts'
import {
  buildPack,
  categoryOf,
  DEFAULT_SOUND_PACK,
  KEYBOARD_VOICES,
  LADDER,
  longestVoiceMs,
  MASTER_GAIN,
  noteGainOf,
  packById,
  packsIn,
  SOUND_CATEGORIES,
  SOUND_PACK_LIST,
  SOUND_PACKS,
  soundChoiceFromStored,
  stepRatio,
  type SoundPackId,
  type SoundVoice,
  type VoiceRecipe,
} from './voices.ts'

const THOCK_PACK = SOUND_PACKS[DEFAULT_SOUND_PACK]

// --- A recording audio context ----------------------------------------

interface Scheduled {
  readonly method: string
  readonly value: number
  readonly at: number
}

class FakeParam {
  readonly calls: Scheduled[] = []
  value = 0
  setValueAtTime(value: number, at: number) {
    this.calls.push({ method: 'set', value, at })
    return this
  }
  linearRampToValueAtTime(value: number, at: number) {
    this.calls.push({ method: 'linear', value, at })
    return this
  }
  exponentialRampToValueAtTime(value: number, at: number) {
    this.calls.push({ method: 'exponential', value, at })
    return this
  }
}

class FakeNode {
  readonly connected: FakeNode[] = []
  readonly kind: string
  constructor(kind: string) {
    this.kind = kind
  }
  connect(target: FakeNode) {
    this.connected.push(target)
    return target
  }
  disconnect() {}
}

class FakeSource extends FakeNode {
  started: number | null = null
  stopped: number | null = null
  type = ''
  buffer: { duration: number } | null = null
  readonly frequency = new FakeParam()
  readonly Q = new FakeParam()
  readonly detune = new FakeParam()
  start(at: number) {
    this.started = at
  }
  stop(at: number) {
    this.stopped = at
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam()
}

class FakeContext {
  currentTime = 12.5
  sampleRate = 48_000
  state: AudioContextState = 'suspended'
  closed = false
  resumes = 0
  readonly destination = new FakeNode('destination')
  readonly nodes: FakeNode[] = []

  private make<T extends FakeNode>(node: T): T {
    this.nodes.push(node)
    return node
  }
  createGain() {
    return this.make(new FakeGain('gain'))
  }
  createOscillator() {
    return this.make(new FakeSource('oscillator'))
  }
  createBufferSource() {
    return this.make(new FakeSource('buffer-source'))
  }
  createBiquadFilter() {
    return this.make(new FakeSource('filter'))
  }
  createBuffer(_channels: number, length: number, sampleRate: number) {
    return { duration: length / sampleRate, getChannelData: () => new Float32Array(length) }
  }
  async resume() {
    this.resumes += 1
    this.state = 'running'
  }
  async close() {
    this.closed = true
    this.state = 'closed'
  }
}

const withContext = () => {
  const contexts: FakeContext[] = []
  const sound = createSoundEngine({
    createContext: () => {
      const context = new FakeContext()
      contexts.push(context)
      return context as unknown as AudioContext
    },
    // No wobble: the numbers below are then the recipe's own.
    wobble: () => ({ pitch: 0, gain: 0 }),
  })
  return { sound, contexts, latest: () => contexts.at(-1) as FakeContext }
}

const sources = (context: FakeContext, kind: string) =>
  context.nodes.filter((node): node is FakeSource => node.kind === kind)

// --- The pack ----------------------------------------------------------

describe('the sound pack', () => {
  it('has a recipe for every voice, and none of them is loud or long', () => {
    for (const [name, recipe] of Object.entries(THOCK_PACK) as [string, VoiceRecipe][]) {
      const loudest = recipe.body.gain + (recipe.partial?.gain ?? 0) + (recipe.click?.gain ?? 0)
      expect(loudest, name).toBeLessThanOrEqual(1)
      expect(recipe.body.decayMs, name).toBeGreaterThan(0)
      expect(recipe.lowpassHz, name).toBeGreaterThan(200)
      expect(recipe.variation.pitch, name).toBeLessThan(0.2)
    }
    // Everything the master level can add at once still leaves headroom.
    expect(MASTER_GAIN).toBeLessThan(0.5)
    expect(longestVoiceMs()).toBeLessThanOrEqual(400)
  })

  it('makes a mistake duller and deeper than a key, and gives it no click', () => {
    expect(THOCK_PACK.mistake.body.from).toBeLessThan(THOCK_PACK.key.body.from)
    expect(THOCK_PACK.mistake.lowpassHz).toBeLessThan(THOCK_PACK.key.lowpassHz)
    expect(THOCK_PACK.mistake.click).toBeUndefined()
    expect(THOCK_PACK.key.click).toBeDefined()
  })

  it('makes the space deeper and longer than a letter, and backspace lighter', () => {
    expect(THOCK_PACK.space.body.from).toBeLessThan(THOCK_PACK.key.body.from)
    expect(THOCK_PACK.space.body.decayMs).toBeGreaterThan(THOCK_PACK.key.body.decayMs)
    expect(THOCK_PACK.backspace.body.gain).toBeLessThan(THOCK_PACK.key.body.gain)
    expect(THOCK_PACK.backspace.body.decayMs).toBeLessThan(THOCK_PACK.key.body.decayMs)
  })

  it('steps repetitions up a pentatonic ladder, and never past its top', () => {
    expect(stepRatio(0)).toBe(1)
    const steps = LADDER.map((_, index) => stepRatio(index))
    expect(steps).toEqual([...steps].sort((a, b) => a - b))
    expect(stepRatio(LADDER.length + 5)).toBe(stepRatio(LADDER.length - 1))
    expect(stepRatio(-3)).toBe(1)
    // Under two octaves: the last repetition is not a shriek.
    expect(stepRatio(LADDER.length - 1)).toBeLessThan(4)
  })
})

describe('the packs', () => {
  it('offers several keyboards, each named, described and unique', () => {
    const ids = SOUND_PACK_LIST.map((pack) => pack.id)

    expect(ids.length).toBeGreaterThanOrEqual(4)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(SOUND_PACK_LIST.map((pack) => pack.name)).size).toBe(ids.length)
    for (const pack of SOUND_PACK_LIST) {
      expect(pack.description.length).toBeGreaterThan(10)
      expect(pack.name).not.toBe('')
    }
    expect(ids).toContain(DEFAULT_SOUND_PACK)
  })

  it('builds every voice of every pack, none of them loud or long', () => {
    for (const id of SOUND_PACK_LIST.map((pack) => pack.id)) {
      const pack = SOUND_PACKS[id]
      expect(Object.keys(pack).sort()).toEqual(Object.keys(THOCK_PACK).sort())
      for (const [name, recipe] of Object.entries(pack) as [string, VoiceRecipe][]) {
        const loudest = recipe.body.gain + (recipe.partial?.gain ?? 0) + (recipe.click?.gain ?? 0)
        expect(loudest, `${id}/${name}`).toBeLessThanOrEqual(1)
        expect(recipe.body.from, `${id}/${name}`).toBeGreaterThan(20)
        expect(recipe.lowpassHz, `${id}/${name}`).toBeGreaterThan(200)
      }
      expect(longestVoiceMs(pack)).toBeLessThanOrEqual(500)
    }
  })

  it('bends only the keyboard voices: the notes are the same in every pack', () => {
    const notes = (id: SoundPackId) =>
      Object.entries(SOUND_PACKS[id]).filter(([name]) => !(KEYBOARD_VOICES as readonly string[]).includes(name))

    for (const pack of SOUND_PACK_LIST) {
      for (const [name, recipe] of notes(pack.id)) {
        const base = THOCK_PACK[name as SoundVoice]
        expect(recipe.body.from, `${pack.id}/${name}`).toBe(base.body.from)
        expect(recipe.body.decayMs, `${pack.id}/${name}`).toBe(base.body.decayMs)
        // Only how loud a note is follows the pack.
        expect(recipe.body.gain, `${pack.id}/${name}`).toBeCloseTo(base.body.gain * noteGainOf(pack), 3)
      }
    }
  })

  it('gives each character the sound its description promises', () => {
    const key = (id: SoundPackId) => SOUND_PACKS[id].key

    // Cream is smoother and longer than Thock; Click is brighter and harder.
    expect(key('cream').body.decayMs).toBeGreaterThan(key('thock').body.decayMs)
    expect(key('cream').click?.gain).toBeLessThan(key('thock').click?.gain as number)
    expect(key('click').click?.gain).toBeGreaterThan(key('thock').click?.gain as number)
    expect(key('click').lowpassHz).toBeGreaterThan(key('thock').lowpassHz)
    // Hush is quieter than all of them, and darker.
    expect(key('hush').body.gain).toBeLessThan(key('thock').body.gain)
    expect(key('hush').lowpassHz).toBeLessThan(key('thock').lowpassHz)
    // The typewriter is the only one that rings.
    expect(SOUND_PACKS.typewriter.key.partial).toBeDefined()
    expect(SOUND_PACKS.thock.key.partial).toBeUndefined()
    // …and never over a mistake, which is not a strike.
    expect(SOUND_PACKS.typewriter.mistake.partial).toBeUndefined()
  })

  it('builds a pack from its character alone, and falls back to the default for an unknown one', () => {
    const quiet = buildPack({
      bodyPitch: 1,
      bodyDecay: 1,
      bodyGain: 0.5,
      clickPitch: 1,
      clickGain: 1,
      clickDecay: 1,
      lowpass: 1,
      variation: 1,
      noteGain: 1,
    })

    expect(quiet.key.body.gain).toBeCloseTo(THOCK_PACK.key.body.gain / 2, 3)
    expect(packById('no-such-pack')).toBe(SOUND_PACKS[DEFAULT_SOUND_PACK])
    expect(packById('cream')).toBe(SOUND_PACKS.cream)
  })

  it('reads a stored choice of any style', () => {
    expect(soundChoiceFromStored('woosh')).toBe('woosh')
    expect(soundChoiceFromStored('chiptune')).toBe('chiptune')
  })

  it('reads a stored choice, including the switch the first version of sound stored', () => {
    expect(soundChoiceFromStored('off')).toBe('off')
    expect(soundChoiceFromStored('typewriter')).toBe('typewriter')
    expect(soundChoiceFromStored(true)).toBe(DEFAULT_SOUND_PACK)
    expect(soundChoiceFromStored(false)).toBe('off')
    expect(soundChoiceFromStored('bongos')).toBeNull()
    expect(soundChoiceFromStored(undefined)).toBeNull()
  })
})

describe('the styles', () => {
  it('sorts every pack into a style, and gives every style a few to choose from', () => {
    const styles = SOUND_CATEGORIES.map((category) => category.id)

    for (const pack of SOUND_PACK_LIST) expect(styles).toContain(pack.category)
    for (const style of styles) expect(packsIn(style).length).toBeGreaterThanOrEqual(3)
    // Every pack in exactly one style, in the order the list gives them.
    expect(styles.flatMap((style) => packsIn(style).map((pack) => pack.id))).toEqual(
      SOUND_PACK_LIST.map((pack) => pack.id),
    )
  })

  it('keeps the keyboards together, and puts the air, bubbles and blips in styles of their own', () => {
    expect(packsIn('mechanical').map((pack) => pack.id)).toEqual(['thock', 'cream', 'click', 'hush', 'typewriter'])
    expect(categoryOf('woosh')).toBe('neon')
    expect(categoryOf('bubble')).toBe('soft')
    expect(categoryOf('coin')).toBe('arcade')
    expect(categoryOf('off')).toBe('mechanical')
  })

  it('keeps the proportions in every style: space bigger than a key, backspace lighter, a mistake lower', () => {
    for (const { id } of SOUND_PACK_LIST) {
      const pack = SOUND_PACKS[id]
      const loudness = (recipe: VoiceRecipe) => recipe.body.gain + (recipe.partial?.gain ?? 0) + (recipe.click?.gain ?? 0)
      const longest = (recipe: VoiceRecipe) =>
        Math.max(recipe.body.decayMs, (recipe.partial?.delayMs ?? 0) + (recipe.partial?.decayMs ?? 0), recipe.click?.decayMs ?? 0)

      expect(longest(pack.space), `${id}: space lasts longer`).toBeGreaterThan(longest(pack.key) - 1)
      expect(loudness(pack.backspace), `${id}: backspace is lighter`).toBeLessThan(loudness(pack.key) + 0.001)
      expect(pack.mistake.body.from, `${id}: a mistake is lower`).toBeLessThan(pack.key.body.from)
      expect(pack.mistake.lowpassHz, `${id}: a mistake is duller`).toBeLessThan(pack.key.lowpassHz)
    }
  })

  it('makes Woosh air rather than a knock: a band of noise sweeping as it fades, louder than any tone under it', () => {
    const { key, space } = SOUND_PACKS.woosh

    expect(key.click?.sweepTo).toBeGreaterThan(key.click?.frequency as number)
    expect(space.click?.sweepTo).toBeLessThan(space.click?.frequency as number)
    expect(key.click?.gain).toBeGreaterThan(key.body.gain)
    expect(key.click?.attackMs).toBeGreaterThan(1.5)
  })

  it('gives the styles that play notes a scale, and the keyboards none', () => {
    for (const id of ['synthwave', 'hologram', 'chime', 'chiptune'] as const) {
      expect(SOUND_PACKS[id].key.scale?.length, id).toBeGreaterThanOrEqual(5)
    }
    for (const { id } of packsIn('mechanical')) expect(SOUND_PACKS[id as SoundPackId].key.scale).toBeUndefined()
  })

  it('never lets a synth wave be as loud as a knock: squares and saws are quieter by recipe', () => {
    for (const { id } of SOUND_PACK_LIST) {
      for (const [name, recipe] of Object.entries(SOUND_PACKS[id]) as [string, VoiceRecipe][]) {
        for (const tone of [recipe.body, recipe.partial]) {
          if (tone !== undefined && (tone.type === 'square' || tone.type === 'sawtooth')) {
            expect(tone.gain, `${id}/${name}`).toBeLessThanOrEqual(0.12)
          }
        }
      }
    }
  })
})

describe('a scale', () => {
  it('lands every play on one of its notes, the lowest at one end of the draw and the highest at the other', () => {
    const scale = [0, 3, 7, 12]

    expect(scaleRatio(scale, -1)).toBe(1)
    expect(scaleRatio(scale, 1)).toBe(2)
    expect(scaleRatio(scale, 0)).toBeCloseTo(2 ** (7 / 12), 10)
    for (let draw = -1; draw <= 1; draw += 0.05) {
      expect(scale.map((step) => 2 ** (step / 12))).toContainEqual(scaleRatio(scale, draw))
    }
  })

  it('changes nothing without one', () => {
    expect(scaleRatio(undefined, 0.7)).toBe(1)
    expect(scaleRatio([], 0.7)).toBe(1)
  })
})

// --- The engine --------------------------------------------------------

describe('the sound engine', () => {
  it('opens no audio context at all until sound is switched on', () => {
    const { sound, contexts } = withContext()

    sound.play('key')
    sound.play('mistake')

    expect(contexts).toEqual([])
    expect(sound.isEnabled()).toBe(false)
  })

  it('opens one when it is switched on — a click, the gesture browsers ask for — and wakes it', () => {
    const { sound, contexts, latest } = withContext()

    sound.choose(DEFAULT_SOUND_PACK)

    expect(contexts).toHaveLength(1)
    expect(latest().resumes).toBe(1)
    expect(latest().state).toBe('running')
    const master = latest().nodes[0] as FakeGain
    expect(master.gain.value).toBe(MASTER_GAIN)
    expect(master.connected).toContain(latest().destination)
  })

  it('plays a key as a click over a falling body, through one low-pass, into the master', () => {
    const { sound, latest } = withContext()
    sound.choose(DEFAULT_SOUND_PACK)
    const before = latest().nodes.length

    sound.play('key')

    const context = latest()
    const recipe = THOCK_PACK.key
    const at = context.currentTime + 0.002
    const [filter] = sources(context, 'filter')
    const [body] = sources(context, 'oscillator')
    const [click] = sources(context, 'buffer-source')

    expect(context.nodes.length).toBeGreaterThan(before)
    expect(body?.type).toBe(recipe.body.type)
    expect(body?.frequency.calls).toEqual([
      { method: 'set', value: recipe.body.from, at },
      { method: 'exponential', value: recipe.body.to, at: at + recipe.body.decayMs / 1000 },
    ])
    expect(click?.buffer?.duration).toBeCloseTo(0.2, 5)
    expect(filter?.type).toBe('lowpass')
    expect(filter?.frequency.calls[0]?.value).toBe(recipe.lowpassHz)
    // Everything ends up at the master gain, which is the only thing on the destination.
    expect(filter?.connected[0]).toBe(context.nodes[0])
  })

  it('ends every envelope at true silence, and stops every source it starts', () => {
    const { sound, latest } = withContext()
    sound.choose(DEFAULT_SOUND_PACK)

    for (const voice of Object.keys(THOCK_PACK) as SoundVoice[]) sound.play(voice)

    const context = latest()
    for (const gain of context.nodes.filter((node): node is FakeGain => node instanceof FakeGain).slice(1)) {
      expect(gain.gain.calls.at(-1)).toMatchObject({ method: 'linear', value: 0 })
    }
    for (const source of [...sources(context, 'oscillator'), ...sources(context, 'buffer-source')]) {
      expect(source.started).not.toBeNull()
      expect(source.stopped).toBeGreaterThan(source.started as number)
    }
  })

  it('sweeps a noise band, swells an attack, delays a second note and closes a filter, where a recipe asks', () => {
    const { sound, latest } = withContext()
    sound.choose('woosh')

    sound.play('key')
    const woosh = SOUND_PACKS.woosh.key
    const at = latest().currentTime + 0.002
    const [band] = sources(latest(), 'filter').filter((filter) => filter.frequency.calls[0]?.value === woosh.click?.frequency)
    expect(band?.frequency.calls[1]).toEqual({
      method: 'exponential',
      value: woosh.click?.sweepTo,
      at: at + (woosh.click?.decayMs as number) / 1000,
    })
    const swell = latest()
      .nodes.filter((node): node is FakeGain => node instanceof FakeGain)
      .find((gain) => gain.gain.calls[1]?.value === woosh.click?.gain)
    expect(swell?.gain.calls[1]?.at).toBeCloseTo(at + (woosh.click?.attackMs as number) / 1000, 6)

    sound.choose('coin')
    sound.play('key')
    const coin = SOUND_PACKS.coin.key
    const later = sources(latest(), 'oscillator').find((node) => node.frequency.calls[0]?.value === coin.partial?.from)
    expect(later?.started).toBeCloseTo(latest().currentTime + 0.002 + (coin.partial?.delayMs as number) / 1000, 6)

    sound.choose('laser')
    sound.play('key')
    const laser = SOUND_PACKS.laser.key
    const [pluck] = sources(latest(), 'filter').filter((filter) => filter.type === 'lowpass' && filter.frequency.calls[0]?.value === laser.lowpassHz)
    expect(pluck?.frequency.calls[1]).toMatchObject({ method: 'exponential', value: laser.lowpassTo })
  })

  it("plays a scale's note, chosen by the play's own draw", () => {
    const contexts: FakeContext[] = []
    const draws = [-1, 1]
    const sound = createSoundEngine({
      createContext: () => {
        const context = new FakeContext()
        contexts.push(context)
        return context as unknown as AudioContext
      },
      wobble: () => ({ pitch: draws.shift() ?? 0, gain: 0 }),
    })
    sound.choose('chiptune')

    sound.play('key')
    sound.play('key')

    const recipe = SOUND_PACKS.chiptune.key
    const bodies = sources(contexts[0] as FakeContext, 'oscillator').filter((node) => node.type === recipe.body.type)
    const [low, high] = bodies.map((node) => node.frequency.calls[0]?.value as number)
    const scale = recipe.scale as readonly number[]
    const variation = recipe.variation.pitch
    expect(low).toBeCloseTo(recipe.body.from * (1 - variation), 3)
    expect(high).toBeCloseTo(recipe.body.from * (1 + variation) * 2 ** ((scale.at(-1) as number) / 12), 3)
  })

  it('pitches a repetition by its rung on the ladder', () => {
    const { sound, latest } = withContext()
    sound.choose(DEFAULT_SOUND_PACK)

    sound.play('hoverClean', { step: 0 })
    sound.play('hoverClean', { step: 3 })

    const [first, , second] = sources(latest(), 'oscillator').filter((node) => node.frequency.calls.length > 0)
    const base = first?.frequency.calls[0]?.value as number
    expect(second?.frequency.calls[0]?.value).toBeCloseTo(base * stepRatio(3), 5)
  })

  it('goes quiet when switched off, and keeps the context for the next time', () => {
    const { sound, contexts, latest } = withContext()
    sound.choose(DEFAULT_SOUND_PACK)
    const opened = latest().nodes.length

    sound.choose('off')
    sound.play('key')

    expect(latest().nodes.length).toBe(opened)
    expect(contexts).toHaveLength(1)

    sound.choose(DEFAULT_SOUND_PACK)
    sound.play('key')
    expect(contexts).toHaveLength(1)
    expect(latest().nodes.length).toBeGreaterThan(opened)
  })

  it('plays the pack it was given, and keeps it when sound is switched off and on', () => {
    const { sound, latest } = withContext()

    sound.choose('click')
    expect(sound.pack()).toBe('click')
    sound.play('key')
    const [body] = sources(latest(), 'oscillator')
    expect(body?.frequency.calls[0]?.value).toBe(SOUND_PACKS.click.key.body.from)

    sound.choose('off')
    expect(sound.isEnabled()).toBe(false)
    expect(sound.pack()).toBe('click')
  })

  it('previews a pack as it is chosen, whatever is playing at the time', () => {
    const { sound, latest } = withContext()
    sound.choose('thock')

    sound.preview('typewriter')

    // Its body, and the ring only the typewriter has over it.
    const pitches = sources(latest(), 'oscillator').map((node) => node.frequency.calls[0]?.value)
    expect(pitches).toContain(SOUND_PACKS.typewriter.key.body.from)
    expect(pitches).toContain(SOUND_PACKS.typewriter.key.partial?.from)
    // The preview does not change what is chosen.
    expect(sound.pack()).toBe('thock')
  })

  it('gives the audio device back when it is closed', () => {
    const { sound, latest } = withContext()
    sound.choose(DEFAULT_SOUND_PACK)

    sound.close()

    expect(latest().closed).toBe(true)
  })

  it('makes no sound, and no trouble, in a browser without Web Audio', () => {
    const sound = createSoundEngine({ createContext: () => null })

    sound.choose(DEFAULT_SOUND_PACK)
    expect(() => sound.play('key')).not.toThrow()
    expect(() => sound.close()).not.toThrow()
  })

  it('carries on when the audio graph itself throws', () => {
    const broken = {
      currentTime: 0,
      sampleRate: 48_000,
      state: 'running' as AudioContextState,
      destination: new FakeNode('destination'),
      createGain: () => new FakeGain('gain'),
      createOscillator: () => {
        throw new Error('no more oscillators')
      },
      createBuffer: () => ({ duration: 0.2, getChannelData: () => new Float32Array(1) }),
      createBiquadFilter: () => new FakeSource('filter'),
    }
    const sound = createSoundEngine({ createContext: () => broken as unknown as AudioContext })
    sound.choose(DEFAULT_SOUND_PACK)

    expect(() => sound.play('key')).not.toThrow()
  })
})

// --- What plays when ---------------------------------------------------

const keystroke = (event: Partial<Keystroke>): Extract<EngineEvent, { type: 'keystroke' }> => ({
  type: 'keystroke',
  at: 0 as never,
  keystroke: { kind: 'character', key: 'a', expected: 'a', index: 0, correct: true, at: 0 as never, ...event },
})

const recorder = () => {
  const played: { voice: SoundVoice; step: number | undefined }[] = []
  const sound = {
    isEnabled: () => true,
    pack: () => DEFAULT_SOUND_PACK,
    choose: () => undefined,
    volume: () => 100,
    setVolume: () => undefined,
    play: (voice: SoundVoice, options?: { step?: number }) => {
      played.push({ voice, step: options?.step })
    },
    preview: () => undefined,
    close: () => undefined,
  } satisfies SoundEngine
  return { sound, played }
}

describe('what plays when', () => {
  it('gives every kind of keystroke its own voice', () => {
    expect(voiceForKeystroke(keystroke({}))).toBe('key')
    expect(voiceForKeystroke(keystroke({ key: ' ', expected: ' ' }))).toBe('space')
    expect(voiceForKeystroke(keystroke({ correct: false, key: 'x' }))).toBe('mistake')
    expect(voiceForKeystroke(keystroke({ kind: 'backspace', key: 'Backspace', correct: false }))).toBe('backspace')
    // A space typed where a letter belongs is a mistake, not a space.
    expect(voiceForKeystroke(keystroke({ key: ' ', expected: 'a', correct: false }))).toBe('mistake')
  })

  it('plays a keystroke through the session events, and nothing else', () => {
    const { sound, played } = recorder()
    let listener: EngineEventListener = () => undefined
    const engine = {
      on: (next: EngineEventListener) => {
        listener = next
        return () => undefined
      },
    } as unknown as TypingEngine

    playTypingSounds(engine, sound)
    listener(keystroke({}))
    listener({ type: 'started', at: 0 as never })
    listener({ type: 'reset' })

    expect(played).toEqual([{ voice: 'key', step: undefined }])
  })

  it("gives each of Hover Mode's moments a voice, and the quiet ones none", () => {
    expect(voiceForSignal('activated', false)).toBe('hoverCaught')
    expect(voiceForSignal('repeating', false)).toBe('hoverLift')
    expect(voiceForSignal('success', false)).toBe('hoverClean')
    expect(voiceForSignal('cycle', false)).toBe('hoverCycle')
    expect(voiceForSignal('missed', false)).toBe('hoverMissed')
    expect(voiceForSignal('released', true)).toBe('hoverCleared')
    expect(voiceForSignal('released', false)).toBe('hoverKept')
    // A mistake has already sounded as the keystroke it was.
    expect(voiceForSignal('failure', false)).toBeNull()
    expect(voiceForSignal('ended', false)).toBeNull()
  })

  it('steps each clean repetition one rung up from the last', () => {
    const progress = (clean: number): HoverProgress => ({
      nodes: [...Array.from({ length: clean }, () => 'clean' as const), 'open'],
      groupSize: null,
    })

    expect(ladderStep(progress(1))).toBe(0)
    expect(ladderStep(progress(3))).toBe(2)
    expect(ladderStep(null)).toBe(0)
  })

  it("plays Hover Mode's signals, pitched by how far the word has come", () => {
    const { sound, played } = recorder()
    let listener: (event: { signal: HoverSignal; record: { cleared: boolean } | null; progress: HoverProgress | null }) => void =
      () => undefined
    const hover = {
      onSignal: (next: typeof listener) => {
        listener = next
        return () => undefined
      },
    } as unknown as HoverController

    playHoverSounds(hover, sound)
    listener({ signal: 'activated', record: null, progress: null })
    listener({ signal: 'success', record: null, progress: { nodes: ['clean', 'clean', 'open'], groupSize: null } })
    listener({ signal: 'released', record: { cleared: true }, progress: { nodes: ['clean'], groupSize: null } })
    listener({ signal: 'ended', record: null, progress: null })

    expect(played).toEqual([
      { voice: 'hoverCaught', step: 0 },
      { voice: 'hoverClean', step: 1 },
      { voice: 'hoverCleared', step: 0 },
    ])
  })

  it('stops listening when it is unsubscribed', () => {
    const { sound, played } = recorder()
    const off = vi.fn()
    const engine = { on: () => off } as unknown as TypingEngine

    playTypingSounds(engine, sound)()

    expect(off).toHaveBeenCalled()
    expect(played).toEqual([])
  })
})

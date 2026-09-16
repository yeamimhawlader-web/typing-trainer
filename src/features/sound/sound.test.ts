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
import { LADDER, longestVoiceMs, MASTER_GAIN, stepRatio, THOCK_PACK, type SoundVoice } from './voices.ts'

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
    for (const [name, recipe] of Object.entries(THOCK_PACK)) {
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

    sound.setEnabled(true)

    expect(contexts).toHaveLength(1)
    expect(latest().resumes).toBe(1)
    expect(latest().state).toBe('running')
    const master = latest().nodes[0] as FakeGain
    expect(master.gain.value).toBe(MASTER_GAIN)
    expect(master.connected).toContain(latest().destination)
  })

  it('plays a key as a click over a falling body, through one low-pass, into the master', () => {
    const { sound, latest } = withContext()
    sound.setEnabled(true)
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
    sound.setEnabled(true)

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

  it('pitches a repetition by its rung on the ladder', () => {
    const { sound, latest } = withContext()
    sound.setEnabled(true)

    sound.play('hoverClean', { step: 0 })
    sound.play('hoverClean', { step: 3 })

    const [first, , second] = sources(latest(), 'oscillator').filter((node) => node.frequency.calls.length > 0)
    const base = first?.frequency.calls[0]?.value as number
    expect(second?.frequency.calls[0]?.value).toBeCloseTo(base * stepRatio(3), 5)
  })

  it('goes quiet when switched off, and keeps the context for the next time', () => {
    const { sound, contexts, latest } = withContext()
    sound.setEnabled(true)
    const opened = latest().nodes.length

    sound.setEnabled(false)
    sound.play('key')

    expect(latest().nodes.length).toBe(opened)
    expect(contexts).toHaveLength(1)

    sound.setEnabled(true)
    sound.play('key')
    expect(contexts).toHaveLength(1)
    expect(latest().nodes.length).toBeGreaterThan(opened)
  })

  it('gives the audio device back when it is closed', () => {
    const { sound, latest } = withContext()
    sound.setEnabled(true)

    sound.close()

    expect(latest().closed).toBe(true)
  })

  it('makes no sound, and no trouble, in a browser without Web Audio', () => {
    const sound = createSoundEngine({ createContext: () => null })

    sound.setEnabled(true)
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
    sound.setEnabled(true)

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
    setEnabled: () => undefined,
    play: (voice: SoundVoice, options?: { step?: number }) => played.push({ voice, step: options?.step }),
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

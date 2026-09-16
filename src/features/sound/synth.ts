/**
 * Plays one voice on a Web Audio context.
 *
 * Every sound is built the same way: a pitched body that falls as it decays,
 * optionally a second partial above it, optionally a burst of noise for the
 * click, all through one low-pass filter into the master level. Nodes are
 * created per sound and stopped when it ends; the browser collects them.
 *
 * The styles that are not keyboards use a few more of the same parts: a noise
 * band that sweeps (a rush of air), a slower attack (a swell), a second note
 * that starts a moment after the first, a filter that closes as the note fades,
 * and a note chosen from a scale for each play.
 *
 * Gains are ramped, never stepped, and every envelope ends at a real zero
 * reached by a short linear ramp: an exponential ramp alone can only approach
 * zero, and stopping on a non-zero value is a click at the end of every sound.
 *
 * Timing is the audio clock's, not the page's: a sound is scheduled a couple of
 * milliseconds ahead so it starts on a sample boundary rather than whenever the
 * main thread next gets a turn.
 */

import { stepRatio, type Noise, type Tone, type VoiceRecipe } from './voices.ts'

/** How far ahead a sound is scheduled, in seconds. */
const LEAD_SECONDS = 0.002
/** The last moments of every envelope, ramped to true silence. */
const SILENCE_SECONDS = 0.008
/** Web Audio cannot ramp exponentially to zero; this stands in for it. */
const NEAR_SILENT = 0.0001

export interface PlayOptions {
  /** Which rung of the ladder, for voices that have one. */
  readonly step?: number
  /** When to play, on the context's clock. The next moment by default. */
  readonly at?: number
  /** Pitch and gain wobble for this play, each -1..1. Zero is the recipe exactly. */
  readonly wobble?: { readonly pitch: number; readonly gain: number }
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>()

/** A fifth of a second of white noise, made once per context and reused. */
const noiseBuffer = (context: BaseAudioContext): AudioBuffer => {
  const existing = noiseBuffers.get(context)
  if (existing !== undefined) return existing

  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.2), context.sampleRate)
  const samples = buffer.getChannelData(0)
  for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1
  noiseBuffers.set(context, buffer)
  return buffer
}

/** The default attack: fast enough to sound instant, slow enough not to click. */
const ATTACK_MS = 1.5

const envelope = (gain: GainNode, peak: number, at: number, decaySeconds: number, attackMs = ATTACK_MS): void => {
  const end = at + decaySeconds
  // Never longer than half the sound, so every sound still decays.
  const attack = Math.min(attackMs, (decaySeconds * 1000) / 2) / 1000
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(peak, at + attack)
  gain.gain.exponentialRampToValueAtTime(Math.max(NEAR_SILENT, peak * 0.01), end)
  gain.gain.linearRampToValueAtTime(0, end + SILENCE_SECONDS)
}

const playTone = (
  context: BaseAudioContext,
  destination: AudioNode,
  tone: Tone,
  at: number,
  pitch: number,
  level: number,
): void => {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const start = at + (tone.delayMs ?? 0) / 1000
  oscillator.type = tone.type
  oscillator.frequency.setValueAtTime(tone.from * pitch, start)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, tone.to * pitch), start + tone.decayMs / 1000)

  envelope(gain, tone.gain * level, start, tone.decayMs / 1000, tone.attackMs)
  oscillator.connect(gain)
  gain.connect(destination)
  oscillator.start(start)
  oscillator.stop(start + tone.decayMs / 1000 + SILENCE_SECONDS * 2)
}

const playNoise = (
  context: BaseAudioContext,
  destination: AudioNode,
  noise: Noise,
  at: number,
  pitch: number,
  level: number,
): void => {
  const source = context.createBufferSource()
  const band = context.createBiquadFilter()
  const gain = context.createGain()
  source.buffer = noiseBuffer(context)
  // Started at a random point in the buffer, so no two clicks are the same.
  const offset = Math.random() * ((source.buffer?.duration ?? 0.2) / 2)
  band.type = 'bandpass'
  band.frequency.setValueAtTime(noise.frequency * pitch, at)
  // A band that moves as it fades is air rushing past, not a click.
  if (noise.sweepTo !== undefined) {
    band.frequency.exponentialRampToValueAtTime(Math.max(20, noise.sweepTo * pitch), at + noise.decayMs / 1000)
  }
  band.Q.setValueAtTime(noise.q, at)

  envelope(gain, noise.gain * level, at, noise.decayMs / 1000, noise.attackMs)
  source.connect(band)
  band.connect(gain)
  gain.connect(destination)
  source.start(at, offset)
  source.stop(at + noise.decayMs / 1000 + SILENCE_SECONDS * 2)
}

/**
 * The note a play takes from a scale: one degree, chosen by the play's own
 * wobble (-1..1), so every key lands somewhere in the scale and no two runs of
 * typing play the same phrase. No scale, no change.
 */
export const scaleRatio = (scale: readonly number[] | undefined, draw: number): number => {
  if (scale === undefined || scale.length === 0) return 1
  const index = Math.min(scale.length - 1, Math.max(0, Math.floor(((draw + 1) / 2) * scale.length)))
  return 2 ** ((scale[index] as number) / 12)
}

/**
 * Plays `recipe` into `destination`. Returns when everything is scheduled: the
 * sound itself is the audio thread's business from here.
 */
export const playVoice = (
  context: BaseAudioContext,
  destination: AudioNode,
  recipe: VoiceRecipe,
  options: PlayOptions = {},
): void => {
  const wobble = options.wobble ?? { pitch: 0, gain: 0 }
  const pitch =
    (1 + wobble.pitch * recipe.variation.pitch) *
    (recipe.ladder === true ? stepRatio(options.step ?? 0) : 1) *
    scaleRatio(recipe.scale, wobble.pitch)
  const level = 1 + wobble.gain * recipe.variation.gain
  const at = options.at ?? context.currentTime + LEAD_SECONDS

  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(recipe.lowpassHz, at)
  // A filter that closes as the note fades: the pluck.
  if (recipe.lowpassTo !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, recipe.lowpassTo), at + recipe.body.decayMs / 1000)
  }
  if (recipe.resonance !== undefined) filter.Q.setValueAtTime(recipe.resonance, at)
  filter.connect(destination)

  playTone(context, filter, recipe.body, at, pitch, level)
  if (recipe.partial !== undefined) playTone(context, filter, recipe.partial, at, pitch, level)
  if (recipe.click !== undefined) playNoise(context, filter, recipe.click, at, pitch, level)
}

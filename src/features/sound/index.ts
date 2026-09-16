/**
 * Sound: the sounds GG.Typing makes, and what makes them.
 *
 * Built in the browser rather than shipped as recordings (see voices.ts), off
 * until it is switched on, and connected to events the rest of the application
 * already announces. Nothing here is required for anything to work: with sound
 * off, or in a browser without Web Audio, every call is a no-op.
 */

export { playHoverSounds, playTypingSounds, voiceForKeystroke, voiceForSignal, ladderStep } from './connect.ts'
export { SoundContext, useSound } from './context.ts'
export { createSoundEngine } from './sound-engine.ts'
export type { SoundEngine, SoundEngineOptions } from './sound-engine.ts'
export { playVoice } from './synth.ts'
export type { PlayOptions } from './synth.ts'
export { LADDER, longestVoiceMs, MASTER_GAIN, stepRatio, THOCK_PACK } from './voices.ts'
export type { Noise, SoundPack, SoundVoice, Tone, ToneType, VoiceRecipe } from './voices.ts'

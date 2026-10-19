/**
 * Sound: the sounds GG.Typing makes, and what makes them.
 *
 * Built in the browser rather than shipped as recordings (see voices.ts), off
 * until it is switched on, and connected to events the rest of the application
 * already announces. Nothing here is required for anything to work: with sound
 * off, or in a browser without Web Audio, every call is a no-op.
 */

export {
  BAD_WORDS_FOR_THE_LAUGH,
  createLaughWatcher,
  IDLE_AFTER_MS,
  ladderStep,
  MISTAKES_IN_A_ROW,
  playHoverSounds,
  playIdleSound,
  playTypingSounds,
  RETYPES_FOR_A_BAD_WORD,
  voiceForKeystroke,
  voiceForSignal,
} from './connect.ts'
export { pressesIn } from './presses.ts'
export {
  isSampleFor,
  MOMENT_DETAILS,
  presetByChoice,
  presetChoice,
  presetMatching,
  PRESS_MOMENTS,
  SAMPLE_MOMENTS,
  sampleById,
  sampleChoicesFromStored,
  SAMPLES,
  SOUND_PRESETS,
  SOURCE_CREDITS,
  sourcesIn,
} from './samples.ts'
export type { MomentDetails, Sample, SampleChoices, SampleMoment, SampleSource, SoundPreset } from './samples.ts'
export { SoundContext, useSound } from './context.ts'
export { createSoundEngine } from './sound-engine.ts'
export type { SoundEngine, SoundEngineOptions } from './sound-engine.ts'
export { playVoice, scaleRatio } from './synth.ts'
export type { PlayOptions } from './synth.ts'
export {
  buildDesignedPack,
  buildPack,
  categoryOf,
  DEFAULT_SOUND_PACK,
  FULL_VOLUME,
  gainForVolume,
  isSoundPackId,
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
} from './voices.ts'
export type {
  Noise,
  PackCharacter,
  SoundChoice,
  SoundPack,
  SoundPackDetails,
  SoundPackId,
  SoundVoice,
  Tone,
  ToneType,
  VoiceRecipe,
} from './voices.ts'
export type { SoundPreference } from '@core/types'

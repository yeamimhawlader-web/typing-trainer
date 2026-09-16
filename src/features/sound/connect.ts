/**
 * What plays when.
 *
 * Sound listens to the events the typing session and Hover Mode already
 * announce; it is told nothing specially and asks for nothing. Neither the
 * engine nor the controller knows sound exists, and a keystroke does no extra
 * work beyond one listener reading the event it already produced.
 *
 * A repetition's note is its rung on the ladder — the number of clean
 * repetitions so far — so a word being cleared rises as it goes.
 */

import type { EngineEvent, TypingEngine, Unsubscribe } from '@core/engine'
import type { HoverController, HoverProgress, HoverSignal } from '@features/ggtyping'

import type { SoundEngine } from './sound-engine.ts'
import type { SoundVoice } from './voices.ts'

/** Which voice a keystroke is, or none for the keys that make no sound. */
export const voiceForKeystroke = (event: Extract<EngineEvent, { type: 'keystroke' }>): SoundVoice => {
  const { kind, key, correct } = event.keystroke
  if (kind === 'backspace') return 'backspace'
  if (!correct) return 'mistake'
  return key === ' ' ? 'space' : 'key'
}

/** How many clean repetitions are behind this one: its rung on the ladder. */
export const ladderStep = (progress: HoverProgress | null): number =>
  Math.max(0, (progress?.nodes.filter((node) => node === 'clean').length ?? 1) - 1)

/** Which voice a Hover Mode signal is, given how the focus ended. */
export const voiceForSignal = (signal: HoverSignal, cleared: boolean): SoundVoice | null => {
  switch (signal) {
    case 'activated':
      return 'hoverCaught'
    case 'repeating':
      return 'hoverLift'
    case 'success':
      return 'hoverClean'
    case 'cycle':
      return 'hoverCycle'
    case 'missed':
      return 'hoverMissed'
    case 'released':
      return cleared ? 'hoverCleared' : 'hoverKept'
    // A mistake already sounds as the keystroke it was, and an ended focus is
    // a test restarting or finishing: neither is a moment of its own.
    case 'failure':
    case 'ended':
      return null
  }
}

/** Keystrokes and mistakes, from the session's own events. */
export const playTypingSounds = (engine: TypingEngine, sound: SoundEngine): Unsubscribe =>
  engine.on((event) => {
    if (event.type !== 'keystroke') return
    sound.play(voiceForKeystroke(event))
  })

/** Hover Mode's moments, from the controller's own signals. */
export const playHoverSounds = (hover: HoverController, sound: SoundEngine): Unsubscribe =>
  hover.onSignal(({ signal, record, progress }) => {
    const voice = voiceForSignal(signal, record?.cleared ?? false)
    if (voice === null) return
    sound.play(voice, { step: ladderStep(progress) })
  })

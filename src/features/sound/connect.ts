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
 *
 * Two moments are counted here rather than announced by anything, because they
 * exist only for sound: the third wrong letter in a row, and All In's laugh.
 */

import type { EngineEvent, TypingEngine, Unsubscribe } from '@core/engine'
import type { HoverController, HoverProgress, HoverSignal, HoverSignalEvent } from '@features/ggtyping'

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

/** How many wrong letters in a row make a streak, which plays its own sound instead of a mistake's. */
export const MISTAKES_IN_A_ROW = 3

/**
 * Keystrokes and mistakes, from the session's own events.
 *
 * The wrong letter that makes a streak plays the streak's recording, when one
 * is chosen, in place of the mistake: once per streak, not on every letter
 * after it. A correct letter, a backspace or a new test ends a streak.
 */
export const playTypingSounds = (engine: TypingEngine, sound: SoundEngine): Unsubscribe => {
  let wrongInARow = 0
  return engine.on((event) => {
    if (event.type === 'reset' || event.type === 'started') wrongInARow = 0
    if (event.type !== 'keystroke') return
    const voice = voiceForKeystroke(event)
    wrongInARow = voice === 'mistake' ? wrongInARow + 1 : 0
    sound.play(wrongInARow === MISTAKES_IN_A_ROW && sound.hasSample('mistakeStreak') ? 'mistakeStreak' : voice)
  })
}

/** How long without a key before the idle sound. */
export const IDLE_AFTER_MS = 60_000
/** How often idleness is looked for: a check, not a timer reset on every key. */
const IDLE_CHECK_MS = 5_000

/**
 * The idle sound, after a minute with no key pressed on the typing screen:
 * once, until a key is pressed again. A key only notes the time — nothing is
 * scheduled per keystroke — and a page in the background never counts as idle.
 */
export const playIdleSound = (
  engines: readonly TypingEngine[],
  sound: SoundEngine,
  { afterMs = IDLE_AFTER_MS, now = () => performance.now() }: { readonly afterMs?: number; readonly now?: () => number } = {},
): Unsubscribe => {
  let lastKey = now()
  let played = false
  const offs = engines.map((engine) =>
    engine.on((event) => {
      if (event.type !== 'keystroke') return
      lastKey = now()
      played = false
    }),
  )
  const timer = setInterval(() => {
    if (played || now() - lastKey < afterMs) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    played = true
    sound.play('idle')
  }, IDLE_CHECK_MS)
  return () => {
    clearInterval(timer)
    for (const off of offs) off()
  }
}

/** Repetitions retyped on one word that make it a word that went badly. */
export const RETYPES_FOR_A_BAD_WORD = 3
/** Bad words in one All In test that bring the laugh. */
export const BAD_WORDS_FOR_THE_LAUGH = 2

/**
 * Watches an All In test for the laugh: once a second word has had three
 * repetitions go wrong, it laughs — once per test. Other difficulties never.
 *
 * Returns whether this signal is the one that laughs.
 */
export const createLaughWatcher = (): ((event: Pick<HoverSignalEvent, 'signal' | 'snapshot'>) => boolean) => {
  let testId: string | null = null
  let laughed = false
  const failures = new Map<number, number>()
  let badWords = 0

  return ({ signal, snapshot }) => {
    if (snapshot.testId !== testId) {
      testId = snapshot.testId
      laughed = false
      failures.clear()
      badWords = 0
    }
    if (signal !== 'failure' || snapshot.difficulty !== 'all-in' || laughed) return false
    const count = (failures.get(snapshot.focusId) ?? 0) + 1
    failures.set(snapshot.focusId, count)
    if (count === RETYPES_FOR_A_BAD_WORD) badWords += 1
    laughed = badWords >= BAD_WORDS_FOR_THE_LAUGH
    return laughed
  }
}

/** Hover Mode's moments, from the controller's own signals. */
export const playHoverSounds = (hover: HoverController, sound: SoundEngine): Unsubscribe => {
  const laughs = createLaughWatcher()
  return hover.onSignal(({ signal, snapshot, record, progress }) => {
    if (laughs({ signal, snapshot })) sound.play('allInLaugh')
    const voice = voiceForSignal(signal, record?.cleared ?? false)
    if (voice === null) return
    sound.play(voice, { step: ladderStep(progress) })
  })
}

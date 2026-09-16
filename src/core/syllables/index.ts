/**
 * Syllables — the Syllable Trainer's domain: its words, where their syllables
 * are in a test's text, how far a word has got through them, and the rhythm the
 * trainer teaches.
 *
 * Laid over the ordinary typing engine rather than beside it: a Syllable
 * Trainer test is typed, scored and saved by the same engine as any other, and
 * nothing here compares a key with the text.
 */

export { SYLLABLE_CORPUS } from './corpus.ts'
export type { SyllableWord } from './corpus.ts'

export { createSyllableLookup, layoutSyllables, syllableRanges, syllableStarts } from './layout.ts'
export type { SyllableLayout, SyllableLookup, SyllableRange } from './layout.ts'

export { syllableState, wordResolution } from './progress.ts'
export type { SyllableState, WordResolution } from './progress.ts'

export { guidanceStrength, SYLLABLE_RHYTHM } from './rhythm.ts'
export type { SyllableRhythm } from './rhythm.ts'

export { buildDemoTimeline, cueOf } from './demo.ts'
export type { DemoCue, DemoPhase, DemoStep, DemoTimeline } from './demo.ts'

export { READING_RULES, readRhythm } from './reading.ts'
export type { RhythmReading, RhythmTiming, RhythmVerdict } from './reading.ts'

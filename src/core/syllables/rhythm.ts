/**
 * The Syllable Trainer's rhythm — every duration that shapes it, in one place.
 *
 * The rhythm being taught is: syllable, a breath, syllable, a breath, next word.
 * It appears twice, and the two are deliberately different things.
 *
 * ## The demonstration
 *
 * The demonstration *is* the rhythm, played at a pace slow enough to see and
 * quick enough to feel: the word shown whole, pulled apart into its chunks,
 * each chunk typed a letter at a time, a breath of a quarter of a second between
 * them, and the word closing back up. One word takes about two seconds, which
 * is the time the technique should take to understand.
 *
 * ## The guidance
 *
 * While the typist trains, nothing waits for anyone. A key is taken the moment
 * it arrives, and no pause is measured, scored or required — a breath that is
 * 40ms shorter or longer than this one is not a mistake. What the trainer does
 * is mark each chunk boundary with a short breath of light as it is crossed:
 * a cue to feel, not a gate to wait at. And it fades as the test goes on — full
 * for the first few words, then quieter, never quite gone — so the rhythm moves
 * from the screen into the typist rather than becoming something they follow.
 */

export const SYLLABLE_RHYTHM = {
  demo: {
    /** The word shown whole, before it comes apart. */
    wholeMs: 440,
    /** Coming apart into its syllables. */
    chunkMs: 420,
    /** Each letter typed: about 125 WPM, quick and still followable. */
    characterMs: 95,
    /** The breath between syllables: the pause being taught. */
    breathMs: 260,
    /** The word closing back up, all of it typed. */
    resolveMs: 480,
    /** Before the next word. */
    restMs: 380,
    /** Before the demonstration begins again from its first word. */
    loopRestMs: 1400,
    /** How many times it plays by itself before waiting to be asked. */
    loops: 2,
  },
  guidance: {
    /** How long the light at a boundary takes to breathe out and back. */
    breathMs: 200,
    /** Words at the start of a test that get the whole cue. */
    fullForWords: 6,
    /** Words over which it then fades. */
    fadeOverWords: 14,
    /** What it fades to: quieter, never gone. */
    faintest: 0.3,
  },
} as const

export type SyllableRhythm = typeof SYLLABLE_RHYTHM

/**
 * How strong the boundary cue is on the word at `wordIndex`: 1 for the first
 * words, easing down to the faintest over the words after them.
 */
export const guidanceStrength = (wordIndex: number, guidance: SyllableRhythm['guidance'] = SYLLABLE_RHYTHM.guidance): number => {
  const past = wordIndex - guidance.fullForWords
  if (past <= 0) return 1
  const faded = Math.min(1, past / guidance.fadeOverWords)
  return Math.round((1 - (1 - guidance.faintest) * faded) * 100) / 100
}

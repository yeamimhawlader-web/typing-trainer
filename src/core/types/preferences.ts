/**
 * User preferences — persisted, user-owned settings.
 *
 * Distinct from application configuration (see src/config): configuration is
 * fixed at build time and identical for everyone, preferences are chosen by the
 * typist at runtime and survive restarts.
 */

/**
 * A theme, by its id in the GG.Typing theme registry
 * (`features/gg-ui/themes/themes.ts`).
 *
 * A string rather than a union of ids: the registry is the one list of themes,
 * so adding a theme is one object there and nothing here. A stored value is
 * checked against the registry when preferences are read, and the two themes of
 * earlier versions, `dark` and `light`, are carried over to their equivalents.
 */
export type ThemePreference = string

/** Sound off, or a pack id. */
export type SoundPreference = string

/** The practice lengths on offer, in words. */
export const PRACTICE_WORD_COUNTS = [15, 30, 60] as const
export type PracticeWordCount = (typeof PRACTICE_WORD_COUNTS)[number]

/**
 * What decides a test is over: a number of words, or a length of time.
 *
 * Both are the same test typed the same way — the same engine, the same
 * measurements — differing only in which of the two runs out first.
 */
export const PRACTICE_MODES = ['words', 'time'] as const
export type PracticeMode = (typeof PRACTICE_MODES)[number]

/**
 * How persistently Hover Mode repeats a word it has focused.
 *
 * - `standard`: one cycle of three repetitions, then the word is released.
 * - `all-in`: two cycles of three.
 * - `tired`: three clean repetitions, three more for each repetition with a
 *   mistake, never more than ten.
 *
 * The rules themselves are in `@features/ggtyping`; this is only the choice.
 */
export const HOVER_DIFFICULTIES = ['standard', 'all-in', 'tired'] as const
export type HoverDifficulty = (typeof HOVER_DIFFICULTIES)[number]

/**
 * The pace a ghost caret keeps in the words, for the typist to hold or chase.
 *
 * - `off`: no caret.
 * - `average`: the typist's own recent typical speed.
 * - `best`: their fastest recent test.
 * - `push`: a little past the average — the speed that is trained towards.
 *
 * What each is worth in words per minute is read from history when a test
 * loads (`@core/statistics`); only the choice is kept here, so the pace follows
 * the typist as they get faster.
 */
export const PACE_CHOICES = ['off', 'average', 'best', 'push'] as const
export type PaceChoice = (typeof PACE_CHOICES)[number]

/** The sizes the typing text can be set in. */
export const TEXT_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const
export type TextSize = (typeof TEXT_SIZES)[number]

/**
 * The typefaces the typing text can be set in.
 *
 * - `slab`: Roboto Slab — open, even letters with a slab serif at each end.
 * - `mono`: Geist Mono — every letter the same width.
 * - `sans`: Inter — plain and quick to read.
 * - `serif`: Lora — a book face.
 *
 * Which font file each is, is the typing screen's business; only the choice is
 * kept here.
 */
export const STREAM_FONTS = ['slab', 'mono', 'sans', 'serif'] as const
export type StreamFont = (typeof STREAM_FONTS)[number]

/**
 * The words ordinary practice draws from.
 *
 * - `normal`: the two hundred most frequent English words.
 * - `advanced`: a wider vocabulary — longer, less frequent words, with the
 *   letter combinations the frequent ones never reach.
 */
export const VOCABULARIES = ['normal', 'advanced'] as const
export type Vocabulary = (typeof VOCABULARIES)[number]

/**
 * How the front page opens.
 *
 * - `portal`: through the letters. The name fills the screen and scrolling
 *   carries you into one of them, past what the application is for, to the way
 *   in at the end of it.
 * - `direct`: the name, a line about it, and a button. For anyone who has seen
 *   the opening and would now like to type.
 */
export const OPENINGS = ['portal', 'direct'] as const
export type Opening = (typeof OPENINGS)[number]

export interface UserPreferences {
  readonly theme: ThemePreference
  /**
   * The length ordinary practice opens at. Remembered because it is the one
   * choice a daily typist makes every visit; before, a 60-word typist had to pick
   * 60 again after every reload. Drills ignore it — a drill is its own length.
   */
  readonly practiceWordCount: PracticeWordCount
  /** The size of the typing text on the GG.Typing screen. */
  readonly textSize: TextSize
  /** The typeface of the typing text on the GG.Typing screen. */
  readonly streamFont: StreamFont
  /** Whether ordinary practice is the most frequent words or a wider vocabulary. */
  readonly vocabulary: Vocabulary
  /** Whether practice ends on a word count or on the clock. */
  readonly practiceMode: PracticeMode
  /**
   * How long a timed test runs, in seconds. Kept beside the word count rather
   * than replacing it, so switching between the two remembers both.
   */
  readonly practiceSeconds: number
  /** The Hover Mode difficulty last chosen. */
  readonly hoverDifficulty: HoverDifficulty
  /**
   * Sound off, or the pack it is on, by its id in the sound packs
   * (`features/sound/voices.ts`). Off until asked for: a typing tool that
   * starts making noise on a shared or quiet machine is a bad guest.
   *
   * A string rather than a union of ids, for the reason the theme is: the packs
   * are the one list, and a stored value is checked against it when preferences
   * are read.
   */
  readonly sound: SoundPreference
  /** How loud sound is, 0–100. Full by default: the level the packs were made at. */
  readonly soundVolume: number
  /** Whether a pace caret runs in the words, and at which of the typist's own speeds. */
  readonly pace: PaceChoice
  /** Whether ordinary practice is dressed as sentences: capitals, commas, endings. */
  readonly punctuation: boolean
  /** Whether ordinary practice has figures among its words. */
  readonly numbers: boolean
  /** Whether the front page opens through the letters, or goes straight in. */
  readonly opening: Opening
}

/**
 * Character transitions that are consistently slow across many sessions.
 *
 * The single-session experiment answered its question and the answer was no:
 * three runs of the same typist, with nothing planted, produced three different
 * "slowest" lists, while a planted 90 ms penalty was recovered cleanly at
 * +87 ms. The arithmetic was sound; the sample was thin. A 60-word test gives
 * roughly 180 clean transitions over ~100 distinct sequences, so the most
 * common digraph is seen about five times — barely past the threshold, and well
 * inside the run-to-run jitter.
 *
 * This module asks the same question of accumulated history instead. It is
 * still an experiment, and the parameters below are still guesses.
 *
 * ## Aggregation: sessions are weighted equally, not observations
 *
 * The obvious implementation pools every timing for a digraph and takes one
 * median. It is wrong here. A single long or bad session — one where a digraph
 * happens to appear twelve times, or a 60-word test typed while tired — would
 * contribute twelve of the twenty numbers and effectively decide the ranking on
 * its own. That is precisely the failure the single-session experiment already
 * demonstrated, re-created at a larger scale.
 *
 * So each session gets **one vote per digraph**: its own median for that
 * digraph. The reported figure is the median of those per-session medians. A
 * session contributes the same weight whether the digraph appeared in it three
 * times or thirty.
 *
 * Pooled observations are still kept, but only to report spread and a count.
 * They are not averaged as though they were independent measurements:
 * keystroke intervals within one session share a typist, a moment, a text and a
 * mood, and treating them as independent is what makes a thin sample look
 * convincing.
 *
 * ## Baseline: the typist's own, over the same sessions
 *
 * Every session has a baseline — the median of *all* its clean transitions. The
 * report's baseline is the median of those per-session baselines, computed the
 * same way as the digraph figures so the two are comparable by subtraction.
 *
 * There is no fixed "slower than 100 ms is bad" anywhere in this file. A 130 WPM
 * typist and a 40 WPM typist have nothing in common on an absolute scale, and
 * even one typist is slower when tired. Comparing a digraph only against the
 * same person over the same period is the only comparison that survives that.
 *
 * ## Stability: slow repeatedly, not slow once
 *
 * For each session a digraph appears in, its session median is compared against
 * *that session's own* baseline. Doing the comparison inside the session is
 * what removes day-to-day speed drift: a session where everything was slow
 * makes every digraph in it slow by the same amount, and so proves nothing.
 *
 * `slowSessionRatio` is the fraction of those sessions in which the digraph was
 * slower than its session's baseline. A digraph slow in nine sessions out of
 * eleven is a pattern. A digraph slow in one session out of eleven is a bad
 * evening — exactly what the single-session experiment could not tell apart.
 *
 * ## Evidence tiers: how much to believe a row
 *
 * Passing the thresholds below makes a sequence a candidate. It does not make it
 * a finding worth acting on, and the audit showed why: with nothing slow at all,
 * ten sessions of ordinary jitter produced candidates in every simulated
 * history, because the more sequences there are to check, the more of them
 * clear a "slow in 70% of sessions" bar by chance. So every candidate is also
 * given a tier, from two questions asked together:
 *
 * - **Is it big enough to matter?** `relativeDelta` — the delta as a fraction of
 *   the typist's own baseline. A few milliseconds is not worth a drill however
 *   consistent it is.
 * - **Is it consistent enough not to be luck, given how many were checked?**
 *   `expectedByChance` — the exact one-sided sign-test probability of being
 *   slower in at least that many of its sessions if it were really no slower,
 *   multiplied by the number of sequences judged. That product bounds how many
 *   sequences this consistent chance alone would be expected to produce
 *   (Bonferroni), so checking more sequences demands more consistency of each.
 *
 * `strong` needs both at a strict level, and is the only tier offered
 * prominently for training. `possible` is a smaller or less settled difference,
 * shown as exactly that. A candidate reaching neither is not reported. The
 * levels, and the simulation they were calibrated against, are in
 * `EVIDENCE_TIERS`.
 *
 * None of this is certainty. The sign test assumes that, for a sequence that is
 * not really slower, being slower than the session's baseline is a coin flip;
 * real typing only approximately behaves like that.
 *
 * ## What this is not
 *
 * A heuristic ranking of timings, not a diagnosis. It cannot distinguish a
 * genuinely awkward hand movement from an unfamiliar word, a letter pair that
 * only appears in long words, or a habit of pausing to think mid-word. It says
 * which transitions are consistently slower than the typist's own average, and
 * how far to believe it, and deliberately stops there — no "weakness" and no
 * recommendation. Offering a drill is the statistics screen's decision, made
 * from the tier.
 */

import { median, quantile, spreadOf, type Spread } from './distribution.ts'
import { collectCleanTransitions } from './sequences.ts'
import type { SessionTelemetry } from './types.ts'

/**
 * Evidence thresholds.
 *
 * **These are experimental parameters, not established constants.** Nothing
 * derives them; they are the smallest values that seemed defensible for a first
 * look, chosen against the measured shape of the data and expected to change
 * once there is real history to argue with.
 */
export const PERSISTENT_THRESHOLDS = {
  /**
   * Total clean observations across all sessions.
   *
   * A common digraph appears about five times in a 60-word test, so twenty is
   * roughly four sessions' worth — enough that the figure is not one afternoon,
   * low enough that a few weeks of practice produces candidates at all.
   */
  minimumObservations: 20,

  /**
   * Distinct sessions the digraph must appear in.
   *
   * This is the threshold that matters, and the one the single-session
   * experiment argued for. Without it, twenty observations from a single
   * session would qualify — which is the thing being ruled out. Four is the
   * fewest from which "consistently" means anything, and the fewest that lets
   * the stability rule below reject one bad session without rejecting
   * everything.
   */
  minimumSessions: 4,

  /**
   * Fraction of its sessions in which the digraph must be slower than that
   * session's own baseline.
   *
   * Chance alone puts a digraph on the slow side of the baseline about half the
   * time, so this is asking how far past a coin flip to insist on.
   *
   * **Calibrated against a real run rather than guessed.** Eight simulated
   * sessions with a deliberate slowdown planted on one digraph: at 0.6 the
   * planted sequence came out at +44 ms and slow in 8 of 8, but two unrelated
   * sequences also qualified at +4 ms and +1 ms on 5 of 8 — and 5 of 8 happens
   * by chance 36% of the time. At 0.7, needing 6 of 8 (14% by chance), only the
   * planted sequence survived.
   *
   * So 0.7. It still admits noise at the four-session minimum, where the rule
   * can only ask for 3 of 4 and chance supplies that 31% of the time. The
   * stability rule genuinely sharpens as history accumulates and is weakest
   * exactly where the data is thinnest, which is worth knowing about it.
   */
  minimumSlowSessionRatio: 0.7,
} as const

/**
 * How many recent sessions to analyse.
 *
 * Telemetry is retained for the most recent 50 sessions; this caps the work of
 * a statistics-page load at something deliberate rather than at whatever the
 * retention limit happens to be. Thirty sessions is a few weeks of practice.
 */
export const MAX_SESSIONS_ANALYSED = 30

/** How much weight a candidate's evidence will bear. See the header. */
export type EvidenceTier = 'strong' | 'possible'

/**
 * The two tiers' requirements.
 *
 * **Calibrated against simulation, not derived.** Histories were generated with
 * the audit's typist model — 86 ms transitions with log-normal jitter (σ 0.3)
 * and a 150–400 ms pause on 3% of keystrokes, over 60-word tests — forty
 * histories per case, with one pair made slower where stated:
 *
 * | Case                      | Before tiers        | `strong`     | `possible` or better |
 * | ------------------------- | ------------------- | ------------ | -------------------- |
 * | Nothing slow, 10 sessions | fake rows in 40/40  | fake in 1/40 | fake in 9/40         |
 * | Nothing slow, 20 sessions | fake rows in 40/40  | fake in 0/40 | fake in 8/40         |
 * | +40 ms, 6 sessions        | found in 31/40      | 0/40         | 30/40                |
 * | +40 ms, 10 sessions       | found in 40/40      | 38/40        | 40/40                |
 * | +25 ms, 20 sessions       | found in 40/40      | 33/40        | 39/40                |
 * | +15 ms, 20 sessions       | found in 37/40      | 8/40         | 27/40                |
 *
 * So a large, persistent slowdown reaches `strong` at around ten sessions, a
 * real but small one mostly stays `possible`, and noise almost never reaches
 * `strong`. Below about eight sessions nothing can be `strong`: even slower in
 * every session is too likely by chance across all the sequences checked. That
 * is the honest cost of asking the question of many sequences at once.
 */
export const EVIDENCE_TIERS = {
  strong: {
    /** At least a fifth slower than the typist's own typical transition. */
    minimumRelativeDelta: 0.2,
    /** Chance would be expected to produce one like it in under 1 in 20 histories. */
    maximumExpectedByChance: 0.05,
  },
  possible: {
    /** At least a tenth slower. */
    minimumRelativeDelta: 0.1,
    /** Chance would be expected to produce one like it in under 1 in 2 histories. */
    maximumExpectedByChance: 0.5,
  },
} as const satisfies Record<
  EvidenceTier,
  { readonly minimumRelativeDelta: number; readonly maximumExpectedByChance: number }
>

/**
 * Probability of at least `slower` heads in `sessions` fair coin flips.
 *
 * The exact one-sided sign test. Summed in log space so a long history cannot
 * underflow `0.5 ** n` to zero and report an impossible certainty.
 */
export const signTestProbability = (sessions: number, slower: number): number => {
  if (slower <= 0) return 1
  if (slower > sessions) return 0

  const logHalfPower = sessions * Math.log(0.5)
  let logChoose = 0 // log C(sessions, 0)
  let total = 0

  for (let index = 0; index <= sessions; index += 1) {
    if (index > 0) logChoose += Math.log((sessions - index + 1) / index)
    if (index >= slower) total += Math.exp(logChoose + logHalfPower)
  }

  return Math.min(1, total)
}

const tierOf = (relativeDelta: number, expectedByChance: number): EvidenceTier | null => {
  const { strong, possible } = EVIDENCE_TIERS

  if (
    relativeDelta >= strong.minimumRelativeDelta &&
    expectedByChance <= strong.maximumExpectedByChance
  ) {
    return 'strong'
  }

  if (
    relativeDelta >= possible.minimumRelativeDelta &&
    expectedByChance <= possible.maximumExpectedByChance
  ) {
    return 'possible'
  }

  return null
}

export interface PersistentThresholds {
  readonly minimumObservations: number
  readonly minimumSessions: number
  readonly minimumSlowSessionRatio: number
}

/** One session's telemetry, or the honest absence of it. */
export interface SessionTelemetryEntry {
  readonly sessionId: string
  /**
   * Null for a session recorded before telemetry existed, or one whose detail
   * has aged out of the retention window. Both are ordinary and neither is an
   * error: the session is counted as analysed and then skipped.
   */
  readonly telemetry: SessionTelemetry | null
}

export interface SequenceEvidence {
  /** The two characters, in order. */
  readonly sequence: string

  /**
   * Median of the per-session medians. One vote per session, so a session in
   * which this digraph appeared twenty times counts no more than one where it
   * appeared three times.
   */
  readonly medianMs: number

  /**
   * `medianMs` minus the report's baseline. Positive means slower than this
   * typist's own typical transition over the same sessions — and verifiable by
   * subtracting the two numbers shown on screen.
   */
  readonly deltaMs: number

  /** Clean observations pooled across every session. A count, not a sample. */
  readonly observations: number

  /** Distinct sessions it appeared in. */
  readonly sessions: number

  /** Of those, how many had it slower than that same session's baseline. */
  readonly slowerSessions: number

  /** `slowerSessions / sessions`. The stability measure. */
  readonly slowSessionRatio: number

  /** `deltaMs / baselineMs`: how much slower, relative to this typist. */
  readonly relativeDelta: number

  /**
   * Sign-test probability of this much consistency by chance, times the number
   * of sequences judged: an upper bound on how many sequences this consistent
   * chance alone would be expected to turn up. Smaller is stronger.
   */
  readonly expectedByChance: number

  /** How much weight this row will bear. See `EVIDENCE_TIERS`. */
  readonly tier: EvidenceTier

  /** Quartiles of the pooled observations — enough to judge spread. */
  readonly spread: Spread

  /** The per-session medians themselves, ascending, so nothing is hidden. */
  readonly perSessionMedians: readonly number[]
}

export interface PersistentSequenceReport {
  /**
   * Sequences meeting every threshold and reaching at least the `possible`
   * tier: `strong` first, then by how far above baseline.
   *
   * Empty is a normal and common answer. It is not a reason to relax a
   * threshold until something appears.
   */
  readonly candidates: readonly SequenceEvidence[]

  /** Median of the per-session baselines; null when nothing was measurable. */
  readonly baselineMs: number | null

  /** Sessions handed in, including those with no telemetry. */
  readonly sessionsAnalysed: number
  /** Of those, the ones that yielded at least one clean transition. */
  readonly sessionsWithTelemetry: number

  readonly totalObservations: number
  readonly distinctSequences: number

  /**
   * Sequences that cleared the observation and session counts, before the
   * stability and baseline rules. The gap between this and `candidates.length`
   * is how much work the stability rule is doing.
   */
  readonly metEvidenceThreshold: number

  readonly thresholds: PersistentThresholds

  /**
   * Whether there is enough history for the question to be worth asking. False
   * means a screen should say so plainly rather than show an empty ranking.
   */
  readonly hasEnoughHistory: boolean
}

export interface PersistentSequenceOptions {
  readonly minimumObservations?: number
  readonly minimumSessions?: number
  readonly minimumSlowSessionRatio?: number
}

interface Accumulated {
  readonly pooled: number[]
  readonly perSessionMedians: number[]
  slowerSessions: number
}

interface Accumulation {
  readonly accumulated: ReadonlyMap<string, Accumulated>
  readonly sessionBaselines: readonly number[]
}

/**
 * Walks the sessions once, gathering per-sequence evidence.
 *
 * Extracted so the ranking and a single-sequence lookup cannot drift apart:
 * the number a drill shows as "your baseline for `in`" has to be the number
 * the ranking used to call `in` slow, or the comparison on the drill screen
 * would be against something the user was never shown.
 */
const accumulate = (entries: readonly SessionTelemetryEntry[]): Accumulation => {
  const accumulated = new Map<string, Accumulated>()
  const sessionBaselines: number[] = []

  for (const entry of entries) {
    if (entry.telemetry === null) continue

    const { bySequence, all } = collectCleanTransitions(entry.telemetry)

    // A session with no clean transitions at all — every character mistyped, or
    // a test abandoned at once — has no baseline and so cannot vote.
    if (all.length === 0) continue

    const sessionBaseline = median(all)
    sessionBaselines.push(sessionBaseline)

    for (const [sequence, intervals] of bySequence) {
      const sessionMedian = median(intervals)

      let record = accumulated.get(sequence)
      if (record === undefined) {
        record = { pooled: [], perSessionMedians: [], slowerSessions: 0 }
        accumulated.set(sequence, record)
      }

      record.pooled.push(...intervals)
      record.perSessionMedians.push(sessionMedian)

      // Compared inside the session, against that session's own baseline, so a
      // uniformly slow day moves everything together and proves nothing.
      if (sessionMedian > sessionBaseline) record.slowerSessions += 1
    }
  }

  return { accumulated, sessionBaselines }
}

/** One sequence's history, whether or not it was ever ranked. */
export interface SequenceBaseline {
  readonly sequence: string
  /** Median of the per-session medians — the same figure the ranking uses. */
  readonly medianMs: number
  readonly observations: number
  readonly sessions: number
  readonly slowerSessions: number
  /** The typist's overall transition median across the same sessions. */
  readonly overallMedianMs: number
  /**
   * Where this sequence's per-session medians usually fall: their 10th to 90th
   * percentile. Null below `PERSISTENT_THRESHOLDS.minimumSessions` sessions,
   * where a range would describe a few numbers rather than a habit.
   *
   * It lets a drill result say when its difference is inside ordinary
   * variation. In simulation, with nothing changed, the drill landed inside
   * this range in 42 of 60 histories at four sessions and 54 of 60 at ten; a
   * genuine 40 ms change landed outside it in at least 58 of 60 at every length.
   */
  readonly typicalRangeMs: TypicalRange | null
}

export interface TypicalRange {
  readonly lowMs: number
  readonly highMs: number
}

/**
 * One sequence's prior history, ignoring the evidence thresholds.
 *
 * The thresholds decide what is worth *ranking*; they are the wrong question
 * for "what was this like before the drill". A drill reached directly by URL
 * may be for a sequence that never qualified, and showing its real baseline is
 * more honest than showing none. Null only when it was never seen at all.
 */
export const findSequenceBaseline = (
  entries: readonly SessionTelemetryEntry[],
  sequence: string,
): SequenceBaseline | null => {
  const { accumulated, sessionBaselines } = accumulate(entries)
  const record = accumulated.get(sequence)

  if (record === undefined || sessionBaselines.length === 0) return null

  return {
    sequence,
    medianMs: median(record.perSessionMedians),
    observations: record.pooled.length,
    sessions: record.perSessionMedians.length,
    slowerSessions: record.slowerSessions,
    overallMedianMs: median(sessionBaselines),
    typicalRangeMs:
      record.perSessionMedians.length < PERSISTENT_THRESHOLDS.minimumSessions
        ? null
        : {
            lowMs: quantile(record.perSessionMedians, 0.1),
            highMs: quantile(record.perSessionMedians, 0.9),
          },
  }
}

/**
 * Ranks transitions that are consistently slower than the typist's own baseline.
 *
 * Pure: no storage, no clock, no React. The caller decides which sessions are in
 * scope and reads their telemetry; this only does the arithmetic.
 *
 * Ordering is total and reproducible — by tier, then how far above baseline,
 * then how consistently, then how often observed, then alphabetically — so the same
 * history always produces the same ranking and a reload cannot reshuffle it.
 */
export const analysePersistentSequences = (
  entries: readonly SessionTelemetryEntry[],
  options: PersistentSequenceOptions = {},
): PersistentSequenceReport => {
  const thresholds: PersistentThresholds = {
    minimumObservations:
      options.minimumObservations ?? PERSISTENT_THRESHOLDS.minimumObservations,
    minimumSessions: options.minimumSessions ?? PERSISTENT_THRESHOLDS.minimumSessions,
    minimumSlowSessionRatio:
      options.minimumSlowSessionRatio ?? PERSISTENT_THRESHOLDS.minimumSlowSessionRatio,
  }

  const { accumulated, sessionBaselines } = accumulate(entries)

  const sessionsWithTelemetry = sessionBaselines.length
  const baselineMs = sessionsWithTelemetry === 0 ? null : median(sessionBaselines)

  let totalObservations = 0
  const judged: (readonly [string, Accumulated])[] = []

  for (const [sequence, record] of accumulated) {
    totalObservations += record.pooled.length

    if (
      record.pooled.length < thresholds.minimumObservations ||
      record.perSessionMedians.length < thresholds.minimumSessions
    ) {
      continue
    }

    judged.push([sequence, record])
  }

  // Every sequence judged counts towards the multiple-comparison adjustment,
  // including those the rules below go on to reject: each was a chance for
  // noise to look like a pattern.
  const metEvidenceThreshold = judged.length
  const candidates: SequenceEvidence[] = []

  for (const [sequence, record] of judged) {
    const sessions = record.perSessionMedians.length
    const slowSessionRatio = record.slowerSessions / sessions
    if (slowSessionRatio < thresholds.minimumSlowSessionRatio) continue

    const medianMs = median(record.perSessionMedians)
    const deltaMs = baselineMs === null ? 0 : medianMs - baselineMs

    // Slower than the typist's own typical transition, or it is not a finding —
    // the rule the single-session experiment had to learn. Sorting alone always
    // produces a leader, including out of a list of things that are all fast.
    if (deltaMs <= 0 || baselineMs === null) continue

    const relativeDelta = deltaMs / baselineMs
    const expectedByChance =
      signTestProbability(sessions, record.slowerSessions) * metEvidenceThreshold
    const tier = tierOf(relativeDelta, expectedByChance)
    if (tier === null) continue

    candidates.push({
      sequence,
      medianMs,
      deltaMs,
      observations: record.pooled.length,
      sessions,
      slowerSessions: record.slowerSessions,
      slowSessionRatio,
      relativeDelta,
      expectedByChance,
      tier,
      spread: spreadOf(record.pooled),
      perSessionMedians: [...record.perSessionMedians].sort((a, b) => a - b),
    })
  }

  const tierRank = (tier: EvidenceTier): number => (tier === 'strong' ? 0 : 1)

  candidates.sort(
    (a, b) =>
      tierRank(a.tier) - tierRank(b.tier) ||
      b.deltaMs - a.deltaMs ||
      b.slowSessionRatio - a.slowSessionRatio ||
      b.observations - a.observations ||
      a.sequence.localeCompare(b.sequence),
  )

  return {
    candidates,
    baselineMs,
    sessionsAnalysed: entries.length,
    sessionsWithTelemetry,
    totalObservations,
    distinctSequences: accumulated.size,
    metEvidenceThreshold,
    thresholds,
    hasEnoughHistory: sessionsWithTelemetry >= thresholds.minimumSessions,
  }
}

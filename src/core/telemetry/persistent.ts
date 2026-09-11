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
 * ## What this is not
 *
 * A heuristic ranking of timings, not a diagnosis. It cannot distinguish a
 * genuinely awkward hand movement from an unfamiliar word, a letter pair that
 * only appears in long words, or a habit of pausing to think mid-word. It says
 * which transitions are consistently slower than the typist's own average, and
 * deliberately stops there — no "weakness", no recommendation, no drill.
 */

import { median, spreadOf, type Spread } from './distribution.ts'
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

  /** Quartiles of the pooled observations — enough to judge spread. */
  readonly spread: Spread

  /** The per-session medians themselves, ascending, so nothing is hidden. */
  readonly perSessionMedians: readonly number[]
}

export interface PersistentSequenceReport {
  /**
   * Sequences meeting every threshold, most consistently slow first.
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

/**
 * Ranks transitions that are consistently slower than the typist's own baseline.
 *
 * Pure: no storage, no clock, no React. The caller decides which sessions are in
 * scope and reads their telemetry; this only does the arithmetic.
 *
 * Ordering is total and reproducible — by how far above baseline, then how
 * consistently, then how often observed, then alphabetically — so the same
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

  const sessionsWithTelemetry = sessionBaselines.length
  const baselineMs = sessionsWithTelemetry === 0 ? null : median(sessionBaselines)

  let totalObservations = 0
  let metEvidenceThreshold = 0
  const candidates: SequenceEvidence[] = []

  for (const [sequence, record] of accumulated) {
    totalObservations += record.pooled.length

    const sessions = record.perSessionMedians.length
    if (
      record.pooled.length < thresholds.minimumObservations ||
      sessions < thresholds.minimumSessions
    ) {
      continue
    }

    metEvidenceThreshold += 1

    const slowSessionRatio = record.slowerSessions / sessions
    if (slowSessionRatio < thresholds.minimumSlowSessionRatio) continue

    const medianMs = median(record.perSessionMedians)
    const deltaMs = baselineMs === null ? 0 : medianMs - baselineMs

    // Slower than the typist's own typical transition, or it is not a finding —
    // the rule the single-session experiment had to learn. Sorting alone always
    // produces a leader, including out of a list of things that are all fast.
    if (deltaMs <= 0) continue

    candidates.push({
      sequence,
      medianMs,
      deltaMs,
      observations: record.pooled.length,
      sessions,
      slowerSessions: record.slowerSessions,
      slowSessionRatio,
      spread: spreadOf(record.pooled),
      perSessionMedians: [...record.perSessionMedians].sort((a, b) => a - b),
    })
  }

  candidates.sort(
    (a, b) =>
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

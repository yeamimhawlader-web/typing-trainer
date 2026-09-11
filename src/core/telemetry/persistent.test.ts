/**
 * Cross-session sequence tests.
 *
 * Fixtures go through the real typing engine at explicit intervals, so the
 * cleanliness rules genuinely apply rather than being assumed, and every
 * expected number below can be worked out by hand from the gaps in the fixture.
 *
 * The arithmetic to check most of these against:
 *
 *   sessionOf('thqwab', 5, 80, { th: 120 })
 *
 * types "thqwab thqwab …" five times. Each repeat contributes five clean
 * transitions — th, hq, qw, wa, ab — of which four are 80 ms and one is 120 ms.
 * Across five repeats that is 25 transitions: twenty at 80 and five at 120, so
 * the session baseline (their median) is 80, and `th`'s session median is 120.
 * Transitions across the spaces are excluded, which is why the word is repeated
 * rather than lengthened.
 */

import { describe, expect, it } from 'vitest'

import { createTypingEngine } from '@core/engine'
import { timestamp, type SessionTarget } from '@core/types'

import { deriveSessionTelemetry } from './derive.ts'
import {
  analysePersistentSequences,
  PERSISTENT_THRESHOLDS,
  type SessionTelemetryEntry,
} from './persistent.ts'
import type { SessionTelemetry } from './types.ts'

const target = (text: string): SessionTarget => ({ text, sourceId: 'test' })

/** Types a script of `[key, gap before it]` pairs through the real engine. */
const type = (
  text: string,
  script: ReadonlyArray<readonly [key: string, gapMs: number]>,
): SessionTelemetry => {
  const engine = createTypingEngine()
  engine.start(target(text), timestamp(0))

  let at = 0
  for (const [key, gap] of script) {
    at += gap
    engine.input(key, timestamp(at))
  }

  return deriveSessionTelemetry(engine.getSnapshot().keystrokes, text)
}

/**
 * One session: `word` repeated `repeats` times, every transition at `gapMs`.
 *
 * `slow` overrides a named digraph everywhere it occurs. `at` overrides a single
 * character position, for planting one outlier rather than a pattern.
 */
const sessionOf = (
  word: string,
  repeats: number,
  gapMs: number,
  slow: Readonly<Record<string, number>> = {},
  at: Readonly<Record<number, number>> = {},
): SessionTelemetry => {
  const text = Array.from({ length: repeats }, () => word).join(' ')
  const characters = Array.from(text)

  return type(
    text,
    characters.map((key, index) => {
      if (index === 0) return [key, 0] as const
      const pair = `${characters[index - 1] as string}${key}`
      return [key, at[index] ?? slow[pair] ?? gapMs] as const
    }),
  )
}

/** Wraps sessions as entries, with ids that make failures readable. */
const entries = (...sessions: readonly SessionTelemetry[]): SessionTelemetryEntry[] =>
  sessions.map((telemetry, index) => ({ sessionId: `s${index}`, telemetry }))

/** Four identical sessions in which `th` is 120 ms against an 80 ms baseline. */
const fourSlowThSessions = (): SessionTelemetryEntry[] =>
  entries(...Array.from({ length: 4 }, () => sessionOf('thqwab', 5, 80, { th: 120 })))

const find = (
  report: ReturnType<typeof analysePersistentSequences>,
  sequence: string,
) => report.candidates.find((candidate) => candidate.sequence === sequence)

describe('analysePersistentSequences', () => {
  describe('with nothing to analyse', () => {
    it('reports an empty result for no sessions at all', () => {
      const report = analysePersistentSequences([])

      expect(report.candidates).toEqual([])
      expect(report.baselineMs).toBeNull()
      expect(report.sessionsAnalysed).toBe(0)
      expect(report.sessionsWithTelemetry).toBe(0)
      expect(report.totalObservations).toBe(0)
      expect(report.hasEnoughHistory).toBe(false)
    })

    it('counts sessions whose telemetry is missing, and analyses none of them', () => {
      const report = analysePersistentSequences([
        { sessionId: 'old-1', telemetry: null },
        { sessionId: 'old-2', telemetry: null },
      ])

      expect(report.sessionsAnalysed).toBe(2)
      expect(report.sessionsWithTelemetry).toBe(0)
      expect(report.baselineMs).toBeNull()
      expect(report.hasEnoughHistory).toBe(false)
      expect(report.candidates).toEqual([])
    })

    it('skips a session in which nothing was typed correctly', () => {
      // Every character wrong, so no pair is clean and the session has no
      // baseline to contribute.
      const allWrong = type('abc', [
        ['x', 0],
        ['x', 80],
        ['x', 80],
      ])

      const report = analysePersistentSequences(entries(allWrong))

      expect(report.sessionsAnalysed).toBe(1)
      expect(report.sessionsWithTelemetry).toBe(0)
      expect(report.baselineMs).toBeNull()
    })
  })

  describe('evidence thresholds', () => {
    it('finds nothing from a single session, however slow the sequence', () => {
      // 25 observations of `th` at 120 ms against an 80 ms baseline — a large,
      // obvious effect, and still one session. This is the whole point.
      const report = analysePersistentSequences(entries(sessionOf('thqwab', 25, 80, { th: 120 })))

      expect(report.sessionsWithTelemetry).toBe(1)
      expect(report.hasEnoughHistory).toBe(false)
      expect(report.candidates).toEqual([])
      expect(report.metEvidenceThreshold).toBe(0)
    })

    it('rejects a sequence with too few total observations', () => {
      // Four sessions, but `th` appears only twice in each: 8 observations.
      const report = analysePersistentSequences(
        entries(...Array.from({ length: 4 }, () => sessionOf('thqwab', 2, 80, { th: 120 }))),
      )

      expect(report.sessionsWithTelemetry).toBe(4)
      expect(report.hasEnoughHistory).toBe(true)
      expect(report.metEvidenceThreshold).toBe(0)
      expect(report.candidates).toEqual([])
    })

    it('rejects a sequence seen often enough but in too few sessions', () => {
      // 30 observations of `th`, across three sessions rather than four.
      const report = analysePersistentSequences(
        entries(...Array.from({ length: 3 }, () => sessionOf('thqwab', 10, 80, { th: 120 }))),
      )

      expect(report.sessionsWithTelemetry).toBe(3)
      expect(report.hasEnoughHistory).toBe(false)
      expect(report.metEvidenceThreshold).toBe(0)
      expect(report.candidates).toEqual([])
    })

    it('accepts a sequence that meets both counts exactly', () => {
      const report = analysePersistentSequences(fourSlowThSessions())

      expect(report.thresholds).toEqual(PERSISTENT_THRESHOLDS)
      expect(report.hasEnoughHistory).toBe(true)

      const th = find(report, 'th')
      expect(th?.observations).toBe(PERSISTENT_THRESHOLDS.minimumObservations)
      expect(th?.sessions).toBe(PERSISTENT_THRESHOLDS.minimumSessions)
    })
  })

  describe('a sequence that is consistently slower', () => {
    it('reports it with every figure a reader would check', () => {
      const report = analysePersistentSequences(fourSlowThSessions())
      const th = find(report, 'th')

      // Per-session baselines are all 80, so the report baseline is 80.
      expect(report.baselineMs).toBe(80)

      // Per-session medians for `th` are all 120, so the reported median is 120
      // and the delta is the difference the screen shows.
      expect(th?.medianMs).toBe(120)
      expect(th?.deltaMs).toBe(40)
      expect(th?.observations).toBe(20)
      expect(th?.sessions).toBe(4)
      expect(th?.slowerSessions).toBe(4)
      expect(th?.slowSessionRatio).toBe(1)
      expect(th?.perSessionMedians).toEqual([120, 120, 120, 120])
    })

    it('states the delta as exactly the difference of the two numbers shown', () => {
      const report = analysePersistentSequences(fourSlowThSessions())
      const th = find(report, 'th')

      // Nothing on screen should fail to reconcile by subtraction.
      expect(th?.deltaMs).toBe((th?.medianMs ?? 0) - (report.baselineMs ?? 0))
    })

    it('reports spread over the pooled observations', () => {
      const report = analysePersistentSequences(fourSlowThSessions())
      const th = find(report, 'th')

      // Twenty identical observations: no spread at all.
      expect(th?.spread).toEqual({ p25: 120, median: 120, p75: 120, iqr: 0 })
    })

    it('does not report sequences typed at the baseline', () => {
      const report = analysePersistentSequences(fourSlowThSessions())

      // `hq`, `qw`, `wa` and `ab` were all typed at exactly 80 ms.
      expect(report.candidates.map((candidate) => candidate.sequence)).toEqual(['th'])
      // They did clear the observation and session counts, though — so the
      // stability rule is what excluded them, not a lack of data.
      expect(report.metEvidenceThreshold).toBe(5)
    })
  })

  describe('stability', () => {
    it('rejects a sequence that was slow in only one session', () => {
      const report = analysePersistentSequences(
        entries(
          sessionOf('thqwab', 5, 80, { th: 200 }),
          sessionOf('thqwab', 5, 80),
          sessionOf('thqwab', 5, 80),
          sessionOf('thqwab', 5, 80),
        ),
      )

      // Enough observations and enough sessions — it fails on consistency.
      expect(report.metEvidenceThreshold).toBe(5)
      expect(find(report, 'th')).toBeUndefined()
      expect(report.candidates).toEqual([])
    })

    it('rejects a sequence slow in three sessions of five', () => {
      // 0.6 — better than a coin flip, but not by enough. A browser run showed
      // sequences clearing 0.6 on nothing but chance, which is why the bar moved.
      const report = analysePersistentSequences(
        entries(
          ...Array.from({ length: 3 }, () => sessionOf('thqwab', 5, 80, { th: 120 })),
          ...Array.from({ length: 2 }, () => sessionOf('thqwab', 5, 80)),
        ),
      )

      expect(report.metEvidenceThreshold).toBe(5)
      expect(find(report, 'th')).toBeUndefined()
    })

    it('accepts a sequence slow in three sessions out of four', () => {
      const report = analysePersistentSequences(
        entries(
          sessionOf('thqwab', 5, 80, { th: 120 }),
          sessionOf('thqwab', 5, 80, { th: 120 }),
          sessionOf('thqwab', 5, 80, { th: 120 }),
          sessionOf('thqwab', 5, 80),
        ),
      )

      const th = find(report, 'th')
      expect(th?.slowerSessions).toBe(3)
      expect(th?.sessions).toBe(4)
      expect(th?.slowSessionRatio).toBe(0.75)
      // Per-session medians 120, 120, 120, 80 → median 120.
      expect(th?.medianMs).toBe(120)
    })

    it('rejects a sequence above baseline that was slow in only half its sessions', () => {
      // Deliberately the case where stability is the *only* rule that applies.
      // Two sessions at 120 and two at 80 give per-session medians of
      // 80, 80, 120, 120 — a median of 100 against an 80 baseline, so the delta
      // rule would happily admit it at +20. It is the 2-of-4 ratio that must
      // reject it, and a mutation test confirmed nothing else does.
      const report = analysePersistentSequences(
        entries(
          sessionOf('thqwab', 5, 80, { th: 120 }),
          sessionOf('thqwab', 5, 80, { th: 120 }),
          sessionOf('thqwab', 5, 80),
          sessionOf('thqwab', 5, 80),
        ),
      )

      expect(report.metEvidenceThreshold).toBe(5)
      expect(find(report, 'th')).toBeUndefined()
    })

    it('accepts a sequence sitting exactly on the ratio threshold', () => {
      // Slow in seven sessions of ten: 0.7 exactly, which must pass rather than
      // fall foul of a strict comparison.
      const report = analysePersistentSequences(
        entries(
          ...Array.from({ length: 7 }, () => sessionOf('thqwab', 5, 80, { th: 120 })),
          ...Array.from({ length: 3 }, () => sessionOf('thqwab', 5, 80)),
        ),
      )

      const th = find(report, 'th')
      expect(th?.slowSessionRatio).toBeCloseTo(PERSISTENT_THRESHOLDS.minimumSlowSessionRatio)
      expect(th?.slowerSessions).toBe(7)
      expect(th?.sessions).toBe(10)
      expect(th?.medianMs).toBe(120)
    })

    it('is unmoved by a session in which everything was slow', () => {
      // A tired session: every transition doubled. Nothing stands out inside it,
      // because the comparison happens against that session's own baseline.
      const report = analysePersistentSequences(
        entries(
          sessionOf('thqwab', 5, 160),
          sessionOf('thqwab', 5, 80),
          sessionOf('thqwab', 5, 80),
          sessionOf('thqwab', 5, 80),
        ),
      )

      expect(report.candidates).toEqual([])
      // The slow session still raised the reported baseline, which is honest.
      expect(report.baselineMs).toBe(80)
    })
  })

  describe('session weighting', () => {
    it('lets one long session count once, not many times', () => {
      // One session with twenty observations of `th` at 200 ms, and three with
      // two each at 100 ms. Pooling every timing would put the median at 200;
      // one vote per session puts it at 100.
      const report = analysePersistentSequences(
        entries(
          sessionOf('thqwab', 20, 80, { th: 200 }),
          sessionOf('thqwab', 2, 80, { th: 100 }),
          sessionOf('thqwab', 2, 80, { th: 100 }),
          sessionOf('thqwab', 2, 80, { th: 100 }),
        ),
      )

      const th = find(report, 'th')
      expect(th?.observations).toBe(26)
      expect(th?.sessions).toBe(4)
      expect(th?.perSessionMedians).toEqual([100, 100, 100, 200])

      // Median of the per-session medians, not of the 26 pooled timings.
      expect(th?.medianMs).toBe(100)
      expect(th?.deltaMs).toBe(20)
    })

    it('does not let a sequence common in one session qualify on its own', () => {
      // Twenty observations in one session, one in each of three others. The
      // observation count is met, but only the long session was slow.
      const report = analysePersistentSequences(
        entries(
          sessionOf('thqwab', 20, 80, { th: 200 }),
          sessionOf('thqwab', 1, 80),
          sessionOf('thqwab', 1, 80),
          sessionOf('thqwab', 1, 80),
        ),
      )

      expect(find(report, 'th')).toBeUndefined()
    })
  })

  describe('outliers', () => {
    it('is not moved by a single abnormal timing', () => {
      // One 2000 ms pause in the middle of the first session — a phone ringing.
      // `qw` is the third transition of the first repeat, at character index 3.
      const withPause = sessionOf('thqwab', 5, 80, {}, { 3: 2000 })

      const report = analysePersistentSequences(
        entries(withPause, sessionOf('thqwab', 5, 80), sessionOf('thqwab', 5, 80), sessionOf('thqwab', 5, 80)),
      )

      // The median of five `qw` observations is still 80 despite the outlier.
      expect(report.candidates).toEqual([])
      expect(report.baselineMs).toBe(80)
    })

    it('still shows the outlier in the reported spread', () => {
      const report = analysePersistentSequences(
        entries(
          sessionOf('thqwab', 5, 80, { th: 120 }, { 1: 2000 }),
          sessionOf('thqwab', 5, 80, { th: 120 }),
          sessionOf('thqwab', 5, 80, { th: 120 }),
          sessionOf('thqwab', 5, 80, { th: 120 }),
        ),
      )

      const th = find(report, 'th')
      // The ranking is unmoved — medians throughout — but the 2000 ms is not
      // hidden: the top of the pooled range reaches it.
      expect(th?.medianMs).toBe(120)
      expect(th?.spread.median).toBe(120)
      expect(th?.observations).toBe(20)
    })

    it('uses identical timings without dividing by zero or ranking noise', () => {
      const report = analysePersistentSequences(
        entries(...Array.from({ length: 4 }, () => sessionOf('thqwab', 5, 80))),
      )

      expect(report.baselineMs).toBe(80)
      expect(report.candidates).toEqual([])
      expect(report.metEvidenceThreshold).toBe(5)
    })
  })

  describe('history changing underneath it', () => {
    it('counts sessions without telemetry but still analyses the rest', () => {
      const report = analysePersistentSequences([
        ...fourSlowThSessions(),
        { sessionId: 'pre-telemetry', telemetry: null },
        { sessionId: 'aged-out', telemetry: null },
      ])

      expect(report.sessionsAnalysed).toBe(6)
      expect(report.sessionsWithTelemetry).toBe(4)
      expect(find(report, 'th')?.sessions).toBe(4)
    })

    it('drops a candidate when a session is deleted from history', () => {
      const all = fourSlowThSessions()

      expect(find(analysePersistentSequences(all), 'th')).toBeDefined()

      // One session deleted: the sequence no longer has four to stand on.
      const remaining = all.slice(1)
      const after = analysePersistentSequences(remaining)

      expect(after.sessionsWithTelemetry).toBe(3)
      expect(after.hasEnoughHistory).toBe(false)
      expect(find(after, 'th')).toBeUndefined()
    })
  })

  describe('ranking', () => {
    it('orders competing sequences by how far above baseline they are', () => {
      const report = analysePersistentSequences(
        entries(
          ...Array.from({ length: 4 }, () => sessionOf('thqwab', 5, 80, { th: 140, qw: 110 })),
        ),
      )

      expect(report.candidates.map((candidate) => candidate.sequence)).toEqual(['th', 'qw'])
      expect(find(report, 'th')?.deltaMs).toBe(60)
      expect(find(report, 'qw')?.deltaMs).toBe(30)
    })

    it('breaks an exact tie alphabetically rather than by map order', () => {
      const report = analysePersistentSequences(
        entries(
          ...Array.from({ length: 4 }, () => sessionOf('thqwab', 5, 80, { th: 120, qw: 120 })),
        ),
      )

      // Identical delta, ratio and observation count — so the order is the only
      // thing left to decide, and it must not depend on insertion order.
      expect(report.candidates.map((candidate) => candidate.sequence)).toEqual(['qw', 'th'])
    })

    it('produces the same ranking every time it is run', () => {
      const input = entries(
        ...Array.from({ length: 4 }, () => sessionOf('thqwab', 5, 80, { th: 140, qw: 110 })),
      )

      expect(analysePersistentSequences(input)).toEqual(analysePersistentSequences(input))
    })

    it('does not modify the sessions it was given', () => {
      const input = fourSlowThSessions()
      const before = structuredClone(input)

      analysePersistentSequences(input)

      expect(input).toEqual(before)
    })
  })

  describe('cleanliness rules are inherited, not re-implemented', () => {
    it('ignores a digraph that was always mistyped', () => {
      // `th` typed as `tX` every time: never a clean pair, so never a candidate
      // however slow it was. Slowness is only measured where it was typed right.
      const session = (): SessionTelemetry => {
        const text = 'thqwab thqwab thqwab thqwab thqwab'
        const characters = Array.from(text)

        return type(
          text,
          characters.map((key, index) => {
            const gap = index === 0 ? 0 : 300
            // Every `h` of a `th` becomes an `X`, and is then left uncorrected.
            return key === 'h' ? (['X', gap] as const) : ([key, 80] as const)
          }),
        )
      }

      const report = analysePersistentSequences(
        entries(session(), session(), session(), session()),
      )

      expect(find(report, 'th')).toBeUndefined()
      expect(report.candidates).toEqual([])
    })
  })

  describe('thresholds are adjustable, and say what was applied', () => {
    it('reports the thresholds actually used', () => {
      const report = analysePersistentSequences(fourSlowThSessions(), {
        minimumObservations: 8,
        minimumSessions: 2,
        minimumSlowSessionRatio: 0.5,
      })

      expect(report.thresholds).toEqual({
        minimumObservations: 8,
        minimumSessions: 2,
        minimumSlowSessionRatio: 0.5,
      })
    })

    it('can be relaxed enough to admit what the defaults reject', () => {
      const twoSessions = entries(
        sessionOf('thqwab', 5, 80, { th: 120 }),
        sessionOf('thqwab', 5, 80, { th: 120 }),
      )

      expect(analysePersistentSequences(twoSessions).candidates).toEqual([])

      const relaxed = analysePersistentSequences(twoSessions, {
        minimumObservations: 10,
        minimumSessions: 2,
      })

      expect(find(relaxed, 'th')?.deltaMs).toBe(40)
    })
  })
})

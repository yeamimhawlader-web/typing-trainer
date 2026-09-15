/**
 * The word jump's motion — every number that shapes it, in one place.
 *
 * ## The idea
 *
 * A word that has been mistyped three times in a row reacts as if it were a
 * small physical object that got poked: it gathers itself, springs up, hangs
 * for a moment at the top, drops back and settles. It is feedback, not a
 * celebration, so it is small — about a lowercase letter's height — and over in
 * half a second.
 *
 * ## The five phases
 *
 * Each phase is one or two segments of a Web Animations keyframe track with its
 * own cubic-bézier. Per-segment curves are what give the motion its asymmetry:
 * one ease-in-out over the whole jump would rise and fall like a sine wave,
 * which reads as a CSS bounce rather than as weight.
 *
 * 1. **Anticipation** — the word sinks a pixel and squashes slightly on its
 *    baseline, eased from rest to rest: preparing, not yet moving.
 * 2. **Launch** — leaves at full speed, the way an impulse does, springing out
 *    of the squash, and covers most of the height while losing speed.
 * 3. **Apex** — the last few percent of the height at a crawl, arriving at zero
 *    speed. That slow stretch is what makes the peak read as a peak.
 * 4. **Descent** — starts from rest and accelerates all the way down under
 *    constant "gravity", landing with a slight squash. That gravity is about
 *    1.4 times what slows the rise, so the word goes up light and comes down
 *    heavy — the difference between a thing that floats and a thing that fell.
 * 5. **Settle** — a rebound of about a pixel and a half, then rest. Small enough
 *    to feel rather than see; without it the landing reads as a stop.
 *
 * ## Why the rise is one curve, split in two
 *
 * The first version gave launch and apex independent curves and a hand-picked
 * share of the height. Sampled in the browser, the word slowed almost to a stop
 * at the end of the launch, then sped up again inside the apex before slowing a
 * second time: a double push at the top. The apex had to cover its share faster
 * on average than the launch was moving when it handed over, so its curve had
 * to accelerate somewhere. Matching speeds at the join alone does not prevent
 * that.
 *
 * So the rise is modelled as a single ease-out, `1 − (1 − t)^risePower` — fast
 * off the ground, decelerating continuously, zero speed at the top — and cut at
 * the launch/apex boundary. Both segments' béziers and the height reached by
 * the end of the launch are derived from the durations (`riseSegments`), which
 * makes the speed continuous across the join by construction, for any timing
 * chosen here. Tune the durations; the curves follow.
 *
 * There is no stretch on the way up. An earlier version stretched the word by
 * 3% at the end of the launch and relaxed it through the apex; sampled, that
 * relaxation pulled the glyphs down against the rise and put a kink into the top
 * of the curve, for a stretch of about half a pixel that nobody could see as
 * one. Squash on take-off and landing carry the weight on their own.
 *
 * The descent is `t²`, constant acceleration. Two joins are discontinuous on
 * purpose: the launch leaves rest at full speed, which is what an impulse looks
 * like, and the settle reverses direction on landing, which is what a bounce is.
 *
 * ## Tuning, and how it was measured
 *
 * Tuned in Chromium by pausing a real jump and stepping `currentTime` 10 ms at a
 * time, reading the word's position and screenshotting frames. The first
 * smooth version (cubic rise, launch 110 ms, apex 80 ms, descent 140 ms) kept
 * the word within a tenth of its peak for about 130 ms — over a quarter of the
 * jump — which read as floating rather than reacting. The current values
 * (quadratic rise, 100 / 60 / 130 ms), measured the same way: 455 ms in total,
 * 85 ms within a tenth of the peak, leaving the ground at 0.16 px/ms and landing
 * at 0.18, with speed changing linearly through both the rise and the fall.
 *
 * ## Constraints this respects
 *
 * Only `transform` is animated, so nothing reflows, no neighbour moves and the
 * compositor can run it off the main thread. Scale stays within a few percent
 * and tilt under a degree, so the glyphs stay legible throughout. There is no
 * randomness: the same mistake produces the same motion every time.
 */

export interface CubicBezier {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
}

const bezier = (x1: number, y1: number, x2: number, y2: number): CubicBezier => ({
  x1,
  y1,
  x2,
  y2,
})

export const WORD_JUMP_MOTION = {
  /** Pivot for squash, stretch and tilt: the middle of the word's bottom edge. */
  origin: '50% 100%',

  /**
   * Peak height of the jump, measured from rest, in ems of the typing text.
   *
   * Relative rather than in pixels because the text is 28 px on a desktop and
   * 20 px on a phone, on the same 1.75 line height. A fixed 12 px jump was
   * 0.43 em on one and 0.6 em on the other, and on the phone the jumping word's
   * text box overlapped the line above by 1.3 px at the apex. In ems the jump
   * keeps the same proportion to the line everywhere: 12 px on a desktop,
   * 8.6 px on a phone.
   */
  heightEm: 0.43,

  /** Peak tilt, reached at the apex. Negative leans the top of the word left. */
  tiltDeg: -0.8,

  /**
   * Shape of the rise: `1 − (1 − t)^risePower`. 2 is a thrown object —
   * decelerating evenly to the top. 3 hangs noticeably longer near the peak,
   * which in the browser read as floaty: the word spent over a quarter of the
   * jump within a tenth of its height. See "Tuning" below.
   */
  risePower: 2,

  anticipation: {
    durationMs: 70,
    /** How far the word sinks while gathering itself: about 1 px at 28 px. */
    sinkEm: 0.036,
    scaleX: 1.02,
    scaleY: 0.955,
    easing: bezier(0.45, 0, 0.55, 1),
  },

  /**
   * Launch and apex share one decelerating curve; see "Why the rise is one
   * curve". The squash from the anticipation springs back over the launch, on
   * the same fast-then-slow curve, so it has released within the first few
   * frames of leaving the ground.
   */
  launch: {
    durationMs: 100,
  },

  apex: {
    durationMs: 60,
  },

  descent: {
    durationMs: 130,
    /** Squash on landing. */
    scaleX: 1.012,
    scaleY: 0.975,
    /** `t²`: constant acceleration from rest. */
    easing: bezier(1 / 3, 0, 2 / 3, 1 / 3),
  },

  settle: {
    reboundMs: 45,
    restMs: 50,
    /** About 1.5 px at 28 px. */
    reboundEm: 0.054,
    reboundEasing: bezier(0.2, 0.6, 0.4, 1),
    restEasing: bezier(0.45, 0, 0.55, 1),
  },
} as const

export type WordJumpMotion = typeof WORD_JUMP_MOTION

/** Total length of the jump, from the first frame of anticipation to rest. */
export const wordJumpDurationMs = (motion: WordJumpMotion = WORD_JUMP_MOTION): number =>
  motion.anticipation.durationMs +
  motion.launch.durationMs +
  motion.apex.durationMs +
  motion.descent.durationMs +
  motion.settle.reboundMs +
  motion.settle.restMs

export interface RiseSegments {
  /** Share of the rise covered by the end of the launch. */
  readonly reach: number
  readonly launch: CubicBezier
  readonly apex: CubicBezier
}

/**
 * The launch and apex curves: the rise `1 − (1 − t)^power`, cut where the
 * launch ends.
 *
 * For a power of 2 or 3 the rise is a polynomial of degree at most three, and a
 * polynomial over a linear stretch of time is exactly a cubic bézier. With the
 * time axis linear the x handles are ⅓ and ⅔; for `y(s) = c₁s + c₂s² + c₃s³`
 * the y handles are `c₁/3` and `(2c₁ + c₂)/3`. The apex piece is always the
 * plain ease-out of that power, whatever the split.
 */
export const riseSegments = (launchMs: number, apexMs: number, power: 2 | 3): RiseSegments => {
  const a = launchMs / (launchMs + apexMs)
  const reach = 1 - (1 - a) ** power

  // 1 − (1 − t)^p = p·t − C(p,2)·t² + [p = 3]·t³
  const first = power
  const second = power === 3 ? -3 : -1

  // Launch piece: y(s) = rise(a·s) / rise(a).
  const c1 = (first * a) / reach
  const c2 = (second * a * a) / reach

  return {
    reach,
    launch: bezier(1 / 3, c1 / 3, 2 / 3, (2 * c1 + c2) / 3),
    apex: bezier(1 / 3, first / 3, 2 / 3, (2 * first + second) / 3),
  }
}

const round = (value: number): number => Math.round(value * 10_000) / 10_000

const cssEasing = ({ x1, y1, x2, y2 }: CubicBezier): string =>
  `cubic-bezier(${round(x1)}, ${round(y1)}, ${round(x2)}, ${round(y2)})`

const transform = (translateYEm: number, scaleX: number, scaleY: number, tiltDeg: number): string =>
  `translateY(${round(translateYEm)}em) scale(${round(scaleX)}, ${round(scaleY)}) rotate(${round(tiltDeg)}deg)`

/**
 * The keyframe track for `Element.animate`.
 *
 * Every keyframe carries the full transform, in the same function order, so the
 * browser interpolates each component numerically rather than falling back to
 * matrix decomposition. `easing` on a keyframe applies to the segment that
 * starts there.
 */
export const buildWordJumpKeyframes = (motion: WordJumpMotion = WORD_JUMP_MOTION): Keyframe[] => {
  const total = wordJumpDurationMs(motion)
  const { anticipation, launch, apex, descent, settle } = motion
  const curves = riseSegments(launch.durationMs, apex.durationMs, motion.risePower)

  // The rise runs from the sunk position up to the peak.
  const riseDistance = motion.heightEm + anticipation.sinkEm
  const launchEndY = anticipation.sinkEm - riseDistance * curves.reach

  let elapsed = 0
  const at = (durationMs: number): number => {
    elapsed += durationMs
    return elapsed / total
  }

  const frame = (offset: number, value: string, easing: CubicBezier | null): Keyframe => ({
    offset,
    transform: value,
    transformOrigin: motion.origin,
    ...(easing === null ? {} : { easing: cssEasing(easing) }),
  })

  return [
    frame(0, transform(0, 1, 1, 0), anticipation.easing),
    frame(
      at(anticipation.durationMs),
      transform(anticipation.sinkEm, anticipation.scaleX, anticipation.scaleY, 0),
      curves.launch,
    ),
    frame(
      at(launch.durationMs),
      transform(launchEndY, 1, 1, motion.tiltDeg * curves.reach),
      curves.apex,
    ),
    frame(at(apex.durationMs), transform(-motion.heightEm, 1, 1, motion.tiltDeg), descent.easing),
    frame(at(descent.durationMs), transform(0, descent.scaleX, descent.scaleY, 0), settle.reboundEasing),
    frame(at(settle.reboundMs), transform(-settle.reboundEm, 1, 1, 0), settle.restEasing),
    // The last offset is exactly 1 rather than an accumulated float.
    frame(1, transform(0, 1, 1, 0), null),
  ]
}

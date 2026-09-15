/**
 * Hover Mode's motion — every number that shapes it, in one place.
 *
 * ## The idea
 *
 * A focused word detaches slightly from the text and floats in place while it
 * is repeated: it gathers, lifts, and hangs a few pixels above the line,
 * drifting and breathing so slowly that it reads as held rather than moving.
 * Everything that happens to it after that — a clean repetition, a miss, the
 * release — is a short event layered on top of the hover, which carries on
 * underneath, so the word never snaps back to a fixed pose.
 *
 * ## Layers
 *
 * Each concern is its own nested element with its own transform, so they
 * compose instead of fighting over one property:
 *
 * | Element | Moves by | Lifetime |
 * | --- | --- | --- |
 * | `lift` | lift-off, and the descent on release | the focus |
 * | `accent` | the failure jump, the success settle | a few hundred ms each |
 * | `float` | the vertical hover | loops |
 * | `drift` | sideways drift | loops |
 * | `tilt` | a slight lean | loops |
 * | `glow` | breathing brighter at the top of the hover | loops |
 * | `pool` | a soft light on the line under the word, smaller as it rises | loops |
 *
 * ## Why the loops have no seam
 *
 * Every loop's keyframes sit only at its extremes, joined by the sine-shaped
 * ease-in-out. At an extreme the speed is zero from both sides, so the join
 * between one segment and the next — including the wrap from the last keyframe
 * back to the first — is smooth in both position and speed. The first and last
 * keyframes are the same value. There is no frame zero to restart from.
 *
 * The vertical hover rises more slowly than it sinks (56% of the period up),
 * the difference between being lifted and settling. Drift and tilt run on their
 * own periods, unrelated to the hover's, so the combined motion does not visibly
 * repeat, while each loop on its own is exact and deterministic.
 *
 * Lift-off ends each loop's layer exactly on that loop's first keyframe, at zero
 * speed, so the handover into the hover is seamless too.
 *
 * ## Size
 *
 * All distances are in ems of the typing text. At rest in the hover the word
 * sits between 0.24 and 0.31 em above its line; the failure jump adds 0.26 em.
 * The peak, 0.57 em, stays inside the 0.5 em the stream reserves above its first
 * line plus the space above the letters themselves, so nothing is clipped, and
 * well clear of the line below the word. Tilt stays under a degree and scale
 * within a few percent, so the letters are never distorted.
 */

import { bezier, cssEasing, round, WORD_JUMP_MOTION, type CubicBezier, type WordJumpMotion } from './word-jump.motion.ts'

/** The sine-shaped ease-in-out: zero speed at both ends. */
const SINE_IN_OUT = bezier(0.37, 0, 0.63, 1)

export const HOVER_MOTION = {
  origin: '50% 100%',

  enter: {
    /** The word sinks a hair while gathering itself, as the jump does. */
    gatherMs: 170,
    gatherEm: 0.03,
    gatherEasing: SINE_IN_OUT,
    /** Then rises, quickly at first, easing to a stop at the hover. */
    riseMs: 560,
    riseEasing: bezier(0.3, 0, 0.12, 1),
    /** Height of the bottom of the hover. */
    liftEm: 0.24,
  },

  float: {
    periodMs: 3400,
    /** Distance between the bottom and top of the hover. */
    travelEm: 0.07,
    /** Share of the period spent rising. */
    riseShare: 0.56,
  },

  drift: {
    periodMs: 6100,
    /** Either side of centre. */
    distanceEm: 0.03,
  },

  tilt: {
    periodMs: 4700,
    /** Either side of upright. */
    angleDeg: 0.6,
  },

  glow: {
    /** At the bottom and top of the hover. */
    opacity: [0.55, 0.9],
    scale: [0.97, 1.03],
  },

  pool: {
    /** The light under the word: brighter and wider while the word is low. */
    opacity: [0.75, 0.45],
    scaleX: [1, 0.84],
  },

  success: {
    /** A small dip and recovery — the word settling, not bouncing. */
    dipEm: 0.045,
    downMs: 110,
    upMs: 320,
    upEasing: bezier(0.25, 0, 0.15, 1),
  },

  node: {
    /** A node filling in grows and returns. */
    popScale: 1.5,
    popMs: 340,
    /** New nodes after a miss grow in, one after another. */
    appearMs: 300,
    appearStaggerMs: 45,
    appearEasing: bezier(0.3, 1.35, 0.6, 1),
  },

  release: {
    /** The descent to the line, landing a hair below it and settling. */
    descentMs: 560,
    descentEasing: bezier(0.45, 0, 0.35, 1),
    undershootEm: 0.018,
    settleMs: 220,
    /** Glow, light and nodes fade out over the descent. */
    fadeMs: 420,
    nodeFadeMs: 280,
    nodeStaggerMs: 40,
  },
} as const

/**
 * The failure reaction: the word jump, lower and quicker. Built from the jump's
 * own parameters and played by the jump's own player, so a miss in Hover Mode
 * and a jump in ordinary practice are recognisably the same motion.
 */
export const HOVER_FAILURE_JUMP: WordJumpMotion = {
  ...WORD_JUMP_MOTION,
  heightEm: 0.26,
  tiltDeg: -0.6,
  anticipation: { ...WORD_JUMP_MOTION.anticipation, durationMs: 55 },
  launch: { durationMs: 85 },
  apex: { durationMs: 45 },
  descent: { ...WORD_JUMP_MOTION.descent, durationMs: 105 },
  settle: { ...WORD_JUMP_MOTION.settle, reboundMs: 40, restMs: 45, reboundEm: 0.04 },
}

export const hoverEnterDurationMs = (): number => HOVER_MOTION.enter.gatherMs + HOVER_MOTION.enter.riseMs

export const hoverReleaseDurationMs = (): number => HOVER_MOTION.release.descentMs + HOVER_MOTION.release.settleMs

const frame = (offset: number, properties: Keyframe, easing: CubicBezier | null): Keyframe => ({
  offset: round(offset),
  ...properties,
  ...(easing === null ? {} : { easing: cssEasing(easing) }),
})

const translateY = (em: number): string => `translateY(${round(em)}em)`

/** A loop between two extremes, `a` → `b` → `a`, spending `share` of the period going to `b`. */
const loopBetween = (a: Keyframe, b: Keyframe, share: number): Keyframe[] => [
  frame(0, a, SINE_IN_OUT),
  frame(share, b, SINE_IN_OUT),
  frame(1, a, null),
]

// --- Lift-off -----------------------------------------------------------

/** `lift`: gather, then rise to the bottom of the hover. Held there afterwards. */
export const buildLiftEnter = (): Keyframe[] => {
  const { gatherMs, gatherEm, gatherEasing, riseEasing, liftEm } = HOVER_MOTION.enter
  return [
    frame(0, { transform: translateY(0) }, gatherEasing),
    frame(gatherMs / hoverEnterDurationMs(), { transform: translateY(gatherEm) }, riseEasing),
    frame(1, { transform: translateY(-liftEm) }, null),
  ]
}

/** `drift`, `tilt`, `glow` and `pool` over the rise: from rest to where their loops begin. */
export const buildEnterTo = (loop: readonly Keyframe[], rest: Keyframe): Keyframe[] => {
  const { riseMs } = HOVER_MOTION.enter
  const start = { ...loop[0] }
  delete start.offset
  delete start.easing
  const riseStart = 1 - riseMs / hoverEnterDurationMs()
  return [
    frame(0, rest, null),
    frame(riseStart, rest, SINE_IN_OUT),
    frame(1, start, null),
  ]
}

// --- The hover ----------------------------------------------------------

/** `float`: from the bottom of the hover to the top and back. */
export const buildFloatLoop = (): Keyframe[] =>
  loopBetween(
    { transform: translateY(0) },
    { transform: translateY(-HOVER_MOTION.float.travelEm) },
    HOVER_MOTION.float.riseShare,
  )

export const buildDriftLoop = (): Keyframe[] => {
  const distance = HOVER_MOTION.drift.distanceEm
  return loopBetween(
    { transform: `translateX(${round(-distance)}em)` },
    { transform: `translateX(${round(distance)}em)` },
    0.5,
  )
}

export const buildTiltLoop = (): Keyframe[] => {
  const angle = HOVER_MOTION.tilt.angleDeg
  return loopBetween(
    { transform: `rotate(${round(-angle)}deg)`, transformOrigin: HOVER_MOTION.origin },
    { transform: `rotate(${round(angle)}deg)`, transformOrigin: HOVER_MOTION.origin },
    0.5,
  )
}

/** `glow`, in step with `float`: brightest at the top. */
export const buildGlowLoop = (): Keyframe[] => {
  const { opacity, scale } = HOVER_MOTION.glow
  return loopBetween(
    { opacity: opacity[0], transform: `scale(${scale[0]})` },
    { opacity: opacity[1], transform: `scale(${scale[1]})` },
    HOVER_MOTION.float.riseShare,
  )
}

/** `pool`, in step with `float`: dimmer and narrower as the word rises. */
export const buildPoolLoop = (): Keyframe[] => {
  const { opacity, scaleX } = HOVER_MOTION.pool
  return loopBetween(
    { opacity: opacity[0], transform: `scaleX(${scaleX[0]})` },
    { opacity: opacity[1], transform: `scaleX(${scaleX[1]})` },
    HOVER_MOTION.float.riseShare,
  )
}

// --- Events on top of the hover ----------------------------------------

export const successDurationMs = (): number => HOVER_MOTION.success.downMs + HOVER_MOTION.success.upMs

/** `accent`: a clean repetition settles the word a little. */
export const buildSuccessSettle = (): Keyframe[] => {
  const { dipEm, downMs, upEasing } = HOVER_MOTION.success
  return [
    frame(0, { transform: translateY(0) }, SINE_IN_OUT),
    frame(downMs / successDurationMs(), { transform: translateY(dipEm) }, upEasing),
    frame(1, { transform: translateY(0) }, null),
  ]
}

/** A node filling in. */
export const buildNodePop = (): Keyframe[] => [
  frame(0, { transform: 'scale(1)' }, bezier(0.2, 0.6, 0.35, 1)),
  frame(0.3, { transform: `scale(${HOVER_MOTION.node.popScale})` }, SINE_IN_OUT),
  frame(1, { transform: 'scale(1)' }, null),
]

/** A node added after a miss. */
export const buildNodeAppear = (): Keyframe[] => [
  frame(0, { transform: 'scale(0)', opacity: 0 }, HOVER_MOTION.node.appearEasing),
  frame(1, { transform: 'scale(1)', opacity: 1 }, null),
]

// --- Release ------------------------------------------------------------

/** `lift`, from wherever the hover is, down to the line: a slight undershoot, then rest. */
export const buildLiftRelease = (from: string): Keyframe[] => {
  const { descentMs, descentEasing, undershootEm } = HOVER_MOTION.release
  return [
    frame(0, { transform: from }, descentEasing),
    frame(descentMs / hoverReleaseDurationMs(), { transform: translateY(undershootEm) }, SINE_IN_OUT),
    frame(1, { transform: translateY(0) }, null),
  ]
}

/** Any looping layer, from its current value back to rest. */
export const buildSettleToRest = (from: Keyframe, rest: Keyframe): Keyframe[] => [
  frame(0, from, SINE_IN_OUT),
  frame(1, rest, null),
]

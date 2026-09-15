/**
 * A damped spring, solved exactly rather than stepped.
 *
 * GG.Typing's physical motion — Hover Mode's selector unfolding and folding —
 * is a spring pulling a single number towards a target. Solving it in closed
 * form means its state is known at any moment without having run a single
 * frame: where it is, and how fast it is going. That is what makes the motion
 * interruptible. Reversing it mid-flight starts a new spring from exactly that
 * position and velocity, so it turns around instead of snapping back first,
 * even when the page it is drawn on has been replaced in between.
 *
 * Time is in milliseconds on the document's clock (`performance.now()`), the
 * same clock the Web Animations API runs on, so a trajectory started here can
 * be handed to `element.animate` with its start time in the past.
 *
 * No DOM: this is arithmetic, tested as such.
 */

export interface Spring {
  /** Natural frequency, in radians per second: how quickly it moves. */
  readonly frequency: number
  /** Damping ratio. 1 arrives without overshoot; below 1 passes the target once, a little. */
  readonly damping: number
}

export interface SpringState {
  readonly value: number
  /** Units per second. */
  readonly velocity: number
}

export interface Trajectory {
  readonly spring: Spring
  readonly from: SpringState
  readonly to: number
  /** When it started, in milliseconds on the document's clock. */
  readonly startedAt: number
  /** How long until it is at rest, in milliseconds. */
  readonly durationMs: number
}

/** Close enough to the target, and slow enough, to be called at rest. */
const REST_DISTANCE = 0.001
const REST_SPEED = 0.01
/** No spring used here takes this long; a bound against a mistyped constant. */
const LONGEST_MS = 2000
const STEP_MS = 1

/** The spring's state `ms` after leaving `from`, pulled towards `to`. */
export const springAt = (spring: Spring, from: SpringState, to: number, ms: number): SpringState => {
  const t = Math.max(0, ms) / 1000
  const omega = spring.frequency
  const zeta = spring.damping
  const offset = from.value - to
  const v0 = from.velocity

  if (zeta < 1) {
    const damped = omega * Math.sqrt(1 - zeta * zeta)
    const decay = Math.exp(-zeta * omega * t)
    const a = offset
    const b = (v0 + zeta * omega * offset) / damped
    const cos = Math.cos(damped * t)
    const sin = Math.sin(damped * t)
    const value = decay * (a * cos + b * sin)
    const velocity = decay * ((b * damped - zeta * omega * a) * cos - (a * damped + zeta * omega * b) * sin)
    return { value: to + value, velocity }
  }

  // Critically damped. (Overdamped springs are not used: they only arrive later.)
  const decay = Math.exp(-omega * t)
  const c = v0 + omega * offset
  return {
    value: to + (offset + c * t) * decay,
    velocity: (c - omega * (offset + c * t)) * decay,
  }
}

/** Milliseconds until the spring is at rest and stays there. */
export const restMs = (spring: Spring, from: SpringState, to: number): number => {
  let lastMoving = 0
  for (let ms = 0; ms <= LONGEST_MS; ms += STEP_MS) {
    const state = springAt(spring, from, to, ms)
    if (Math.abs(state.value - to) > REST_DISTANCE || Math.abs(state.velocity) > REST_SPEED) lastMoving = ms
  }
  return Math.min(LONGEST_MS, lastMoving + STEP_MS)
}

export const startTrajectory = (spring: Spring, from: SpringState, to: number, startedAt: number): Trajectory => ({
  spring,
  from,
  to,
  startedAt,
  durationMs: restMs(spring, from, to),
})

/** Where a trajectory is at `at`: exactly at its target once it has come to rest. */
export const trajectoryAt = (trajectory: Trajectory, at: number): SpringState => {
  const elapsed = at - trajectory.startedAt
  if (elapsed <= 0) return trajectory.from
  if (elapsed >= trajectory.durationMs) return { value: trajectory.to, velocity: 0 }
  return springAt(trajectory.spring, trajectory.from, trajectory.to, elapsed)
}

export const isAtRest = (trajectory: Trajectory, at: number): boolean =>
  at - trajectory.startedAt >= trajectory.durationMs

/**
 * A new trajectory towards `to` from wherever `current` is at `at`, carrying
 * its velocity. With nothing in motion, it starts at rest from `restingAt`.
 */
export const retarget = (
  current: Trajectory | null,
  to: number,
  spring: Spring,
  at: number,
  restingAt: number,
): Trajectory => {
  const from = current === null ? { value: restingAt, velocity: 0 } : trajectoryAt(current, at)
  return startTrajectory(spring, from, to, at)
}

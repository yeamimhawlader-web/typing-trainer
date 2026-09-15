/**
 * GGTyping — Geek Gamified Typing — public entry point.
 *
 * Feedback effects that react to how someone is typing. They only ever listen
 * to the engine: nothing here can change what is measured. The conventions
 * every effect follows are in GGTYPING.md at the repository root.
 *
 * One effect: a word jumps when it has been mistyped three times in a row. One
 * mode: Hover Mode, where one mistake focuses a word for repetition.
 */

export { createMistakeStreaks, MISTAKES_PER_JUMP, wordOwning } from './mistake-streak.ts'
export type { MistakeStreaks } from './mistake-streak.ts'

export { buildWordJumpKeyframes, WORD_JUMP_MOTION, wordJumpDurationMs } from './motion/word-jump.motion.ts'
export type { WordJumpMotion } from './motion/word-jump.motion.ts'
export { playWordJump, prefersReducedMotion } from './motion/word-jump.ts'

export { createWordJumpController } from './word-jump-controller.ts'
export type { WordJumpController, WordJumpControllerOptions } from './word-jump-controller.ts'

export { useWordJumps } from './useWordJumps.ts'

export { createHoverController, HOVER_ATTEMPT_SOURCE } from './hover/hover-controller.ts'
export type {
  HoverController,
  HoverControllerOptions,
  HoverSignalEvent,
  HoverSnapshot,
} from './hover/hover-controller.ts'
export { cyclesOf, HOVER_RULES, progressOf, remainingOf, stepHover } from './hover/hover-rules.ts'
export type {
  HoverEvent,
  HoverFocus,
  HoverProgress,
  HoverSignal,
  HoverState,
  HoverStep,
  ProgressNode,
  RepetitionOutcome,
} from './hover/hover-rules.ts'
export { HOVER_FAILURE_JUMP, HOVER_MOTION } from './motion/hover.motion.ts'
export { HOVER_DIFFICULTY_DETAILS, HOVER_DIFFICULTY_OPTIONS } from './hover/difficulty.ts'
export type { HoverDifficultyDetails } from './hover/difficulty.ts'
export { recordGoldenNuggets } from './hover/golden-nuggets.ts'
export type { GoldenNuggetRecorderOptions } from './hover/golden-nuggets.ts'
export { createHoverMotion } from './motion/hover.ts'
export type { HoverElements, HoverMotion } from './motion/hover.ts'

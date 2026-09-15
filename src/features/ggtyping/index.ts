/**
 * GGTyping — Geek Gamified Typing — public entry point.
 *
 * Feedback effects that react to how someone is typing. They only ever listen
 * to the engine: nothing here can change what is measured. The conventions
 * every effect follows are in GGTYPING.md at the repository root.
 *
 * One effect exists: a word jumps when it has been mistyped three times in a
 * row.
 */

export { createMistakeStreaks, MISTAKES_PER_JUMP, wordOwning } from './mistake-streak.ts'
export type { MistakeStreaks } from './mistake-streak.ts'

export { buildWordJumpKeyframes, WORD_JUMP_MOTION, wordJumpDurationMs } from './motion/word-jump.motion.ts'
export type { WordJumpMotion } from './motion/word-jump.motion.ts'
export { playWordJump, prefersReducedMotion } from './motion/word-jump.ts'

export { createWordJumpController } from './word-jump-controller.ts'
export type { WordJumpController, WordJumpControllerOptions } from './word-jump-controller.ts'

export { useWordJumps } from './useWordJumps.ts'

/**
 * Typing engine — public entry point.
 *
 * Boundary rule, enforced by lint: nothing in this directory may import from
 * `@features`, `@app`, `@shared`, React, or the DOM. If the engine ever needs
 * something from those layers, the dependency is pointing the wrong way.
 */

export { createTypingEngine, isTypeableCharacter } from './engine.ts'

export { cursorAfterCharacter, ruleForCharacter } from './input-rules.ts'
export type { CharacterRule } from './input-rules.ts'

export { BACKSPACE, IDLE_GAP_CAP_MS } from './types.ts'
export type {
  CompletionPolicy,
  EngineEvent,
  EngineEventListener,
  EngineSnapshot,
  FinishedStatus,
  TypingEngine,
  TypingEngineOptions,
  Unsubscribe,
} from './types.ts'

export { calculateAccuracy, calculateWpm } from './metrics.ts'

export {
  computeWordRanges,
  findCurrentWordIndex,
  findWordDeleteIndex,
} from './words.ts'
export type { WordRange } from './words.ts'

export { toCharacters } from './characters.ts'

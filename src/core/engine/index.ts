/**
 * Typing engine — public entry point.
 *
 * Currently exports the contract only. The implementation is the next task.
 *
 * Boundary rule, enforced by review: nothing in this directory may import from
 * `@features`, `@app`, `@shared`, React, or the DOM. If the engine ever needs
 * something from those layers, the dependency is pointing the wrong way.
 */

export type { EngineSnapshot, TypingEngine, Unsubscribe } from './types.ts'

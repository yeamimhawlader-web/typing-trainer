/**
 * Subscribes a component to one derived value from the engine.
 *
 * This hook is the whole performance strategy in four lines. The engine is an
 * external store, so React re-renders a component only when the specific value
 * its selector returns actually changes — not whenever the engine changes.
 *
 * Two rules for selectors, both load-bearing:
 *
 * 1. **Return a primitive**, or a reference that is stable between changes.
 *    Returning a fresh object or array every call makes React believe the value
 *    changed on every read, which re-renders forever.
 *
 * 2. **Select what is displayed, not what it is derived from.** A timer that
 *    selects `elapsedMs` re-renders sixty times a second; one that selects
 *    `Math.floor(elapsedMs / 1000)` re-renders once a second and looks
 *    identical. The rounding belongs in the selector, not the JSX.
 */

import { useSyncExternalStore } from 'react'

import type { EngineSnapshot, TypingEngine } from '@core/engine'

export const useEngineValue = <T>(
  engine: TypingEngine,
  select: (snapshot: EngineSnapshot) => T,
): T => useSyncExternalStore(engine.subscribe, () => select(engine.getSnapshot()))

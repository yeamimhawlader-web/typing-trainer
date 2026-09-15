/**
 * The word jump for one typing screen.
 *
 * Creates a controller once and keeps it connected to whichever engine the
 * screen has. The returned controller is stable for the life of the component,
 * so passing it down through a memoised list does not break the memo.
 */

import { useEffect, useState } from 'react'

import type { TypingEngine } from '@core/engine'

import {
  createWordJumpController,
  type WordJumpController,
  type WordJumpControllerOptions,
} from './word-jump-controller.ts'

export const useWordJumps = (
  engine: TypingEngine,
  options?: WordJumpControllerOptions,
): WordJumpController => {
  // State rather than a memo: React may discard a memoised value, and a
  // controller replaced mid-session would lose its registered words.
  const [controller] = useState(() => createWordJumpController(options))

  useEffect(() => controller.connect(engine), [controller, engine])

  return controller
}

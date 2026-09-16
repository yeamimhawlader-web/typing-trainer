/**
 * The typist's own speeds, for the pace caret: read from history when the screen
 * opens, and again each time a test is saved, so the pace moves with them.
 *
 * Read from storage, never while typing — the only reads are on arrival and
 * after a save, which happens after the last character. A history that cannot be
 * read offers no pace rather than breaking anything.
 */

import { useEffect, useState } from 'react'

import type { SessionService } from '@core/sessions'
import { PACE_RULES, paceTargets, type PaceTargets } from '@core/statistics'

/** Enough recent tests that the ordinary ones among them still number PACE_RULES.recent. */
const READ = PACE_RULES.recent * 3

interface Read {
  /** The saved test these speeds include, or null for what was there on arrival. */
  readonly through: string | null
  readonly targets: PaceTargets | null
}

export const usePaceTargets = (service: SessionService, savedTest: string | null): PaceTargets | null => {
  const [read, setRead] = useState<Read>({ through: null, targets: null })

  useEffect(() => {
    let active = true
    service
      .getRecent(READ)
      .then((sessions) => {
        if (active) setRead({ through: savedTest, targets: paceTargets(sessions) })
      })
      .catch((error: unknown) => {
        console.warn('[pace] failed to read history', error)
        if (active) setRead({ through: savedTest, targets: null })
      })
    return () => {
      active = false
    }
  }, [savedTest, service])

  return read.targets
}

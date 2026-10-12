/**
 * A new personal best: said in words on the result, and marked with one burst
 * of confetti — the plain one from the component's demo — over the window.
 *
 * The canvas only exists while there is something to celebrate, so a test that
 * beat nothing costs nothing. It fires once when it appears and lets clicks
 * through to the result beneath it. It is put on the page itself rather than
 * inside the result: the result rises into place with a transform, and a fixed
 * canvas inside a transformed box is fixed to that box, not to the window.
 */

import { createPortal } from 'react-dom'

import { canDrawConfetti, Confetti } from '@/components/ui/confetti.tsx'
import type { PersonalBest } from '@core/sessions'
import { formatWpm } from '@features/results'

import styles from './PersonalBestCelebration.module.css'

export interface PersonalBestCelebrationProps {
  readonly best: PersonalBest
  /** The speed that beat it. */
  readonly wpm: number
}

export const PersonalBestCelebration = ({ best, wpm }: PersonalBestCelebrationProps) => (
  <>
    <p className={styles.line}>
      <span className={styles.badge}>New personal best</span>
      <span>
        {formatWpm(wpm)} wpm, up from {formatWpm(best.previousWpm)}
      </span>
    </p>
    {canDrawConfetti() && createPortal(<Confetti className={styles.canvas} aria-hidden="true" />, document.body)}
  </>
)

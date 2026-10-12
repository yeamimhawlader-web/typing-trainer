/**
 * A new personal best: said in words on the result, and celebrated with
 * confetti over the whole window, once.
 *
 * The canvas only exists while there is something to celebrate, so a test that
 * beat nothing costs nothing. It lets clicks through to the result beneath it.
 * It is put on the page itself rather than inside the result: the result rises
 * into place with a transform, and a fixed canvas inside a transformed box is
 * fixed to that box, not to the window.
 *
 * The confetti takes the theme's own colours — its accent, and the text and
 * success colours around it — so it belongs to whichever theme is on screen.
 */

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import { canDrawConfetti, celebrate, Confetti, themeColour, type ConfettiRef } from '@/components/ui/confetti.tsx'
import type { PersonalBest } from '@core/sessions'
import { formatWpm } from '@features/results'

import styles from './PersonalBestCelebration.module.css'

export interface PersonalBestCelebrationProps {
  readonly best: PersonalBest
  /** The speed that beat it. */
  readonly wpm: number
}

const PALETTE = ['--gg-accent', '--color-accent-base', '--color-status-success', '--gg-fg', '--color-text-primary']

export const PersonalBestCelebration = ({ best, wpm }: PersonalBestCelebrationProps) => {
  const confettiRef = useRef<ConfettiRef>(null)

  useEffect(() => {
    const fire = confettiRef.current?.fire
    if (fire === undefined) return
    const colours = [...new Set(PALETTE.map((variable) => themeColour(variable)).filter((colour) => colour !== null))]
    return celebrate(fire, colours)
  }, [])

  return (
    <>
      <p className={styles.line}>
        <span className={styles.badge}>New personal best</span>
        <span>
          {formatWpm(wpm)} wpm, up from {formatWpm(best.previousWpm)}
        </span>
      </p>
      {canDrawConfetti() &&
        createPortal(<Confetti ref={confettiRef} manualstart className={styles.canvas} aria-hidden="true" />, document.body)}
    </>
  )
}

/**
 * How far through the text the typist is.
 *
 * The selector returns whole percent, so this re-renders at most a hundred
 * times per test rather than once per keystroke.
 */

import type { TypingEngine } from '@core/engine'

import { useEngineValue } from '../hooks/useEngineValue.ts'

import styles from './ProgressBar.module.css'

export interface ProgressBarProps {
  readonly engine: TypingEngine
  readonly total: number
}

export const ProgressBar = ({ engine, total }: ProgressBarProps) => {
  const percent = useEngineValue(engine, (snapshot) =>
    total <= 0 ? 0 : Math.min(100, Math.round((snapshot.cursorIndex / total) * 100)),
  )

  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Test progress"
    >
      <div className={styles.fill} style={{ transform: `scaleX(${percent / 100})` }} />
    </div>
  )
}

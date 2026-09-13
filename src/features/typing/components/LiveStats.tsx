/**
 * Live speed, accuracy and elapsed time.
 *
 * Each figure is its own subscriber, and each selector returns the value as it
 * is *displayed* rather than the raw number behind it. The timer selects whole
 * seconds, so it re-renders once a second instead of ten times; speed selects a
 * rounded integer, so it re-renders only when the digits would actually differ.
 *
 * The container itself subscribes to nothing and never re-renders.
 */

import { formatDuration } from '@features/results'
import type { CSSProperties } from 'react'

import type { TypingEngine } from '@core/engine'
import { cx } from '@shared/lib'

import { useEngineValue } from '../hooks/useEngineValue.ts'

import styles from './LiveStats.module.css'

interface StatProps {
  readonly value: string
  readonly unit: string
  /** Widest value this stat can hold, in characters. Reserves the space. */
  readonly width: number
  readonly primary?: boolean
}

const Stat = ({ value, unit, width, primary = false }: StatProps) => (
  <div className={cx(styles.stat, primary && styles.primary)}>
    <span
      className={styles.value}
      style={{ '--stat-width': `${width}ch` } as CSSProperties}
    >
      {value}
    </span>
    <span className={styles.unit}>{unit}</span>
  </div>
)

/**
 * Live speed is meaningless for the first moment of a test.
 *
 * The clock starts on the first keystroke, so after N characters only N-1
 * intervals have actually been measured — the first character is free. Early on
 * that inflates the figure badly: a typist holding a steady 130 WPM sees 229 on
 * their third keystroke, falling through 176 and 153 before it settles.
 *
 * Over a whole test the same bias is worth about 0.3%, so the engine's
 * definition stays as it is. This only withholds the number until there is
 * enough signal to be worth showing, which a dash says honestly and a
 * confidently wrong "229" does not.
 */
const MIN_ELAPSED_FOR_WPM_MS = 1_000

const WpmStat = ({ engine }: { engine: TypingEngine }) => {
  const wpm = useEngineValue(engine, (snapshot) =>
    snapshot.elapsedMs < MIN_ELAPSED_FOR_WPM_MS ? null : Math.round(snapshot.netWpm),
  )

  return <Stat value={wpm === null ? '—' : String(wpm)} unit="wpm" width={3} primary />
}

const AccuracyStat = ({ engine }: { engine: TypingEngine }) => {
  const percent = useEngineValue(engine, (snapshot) =>
    Math.round(snapshot.accuracy * 100),
  )
  return <Stat value={`${percent}%`} unit="acc" width={4} />
}

const TimerStat = ({ engine }: { engine: TypingEngine }) => {
  const seconds = useEngineValue(engine, (snapshot) =>
    Math.floor(snapshot.elapsedMs / 1000),
  )
  // The same formatter as the result, so a finished test shows one time.
  return <Stat value={formatDuration(seconds * 1000)} unit="time" width={4} />
}

export const LiveStats = ({ engine }: { engine: TypingEngine }) => (
  // Named so it can be told apart from the result announcement, which is the
  // status region that does speak.
  <div className={styles.stats} role="status" aria-live="off" aria-label="Live statistics">
    <WpmStat engine={engine} />
    <AccuracyStat engine={engine} />
    <TimerStat engine={engine} />
  </div>
)

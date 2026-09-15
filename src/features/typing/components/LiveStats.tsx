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
import { selectAccuracyPercent, selectElapsedSeconds, selectLiveWpm } from '../live-values.ts'

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

const WpmStat = ({ engine }: { engine: TypingEngine }) => {
  const wpm = useEngineValue(engine, selectLiveWpm)
  return <Stat value={wpm === null ? '—' : String(wpm)} unit="wpm" width={3} primary />
}

const AccuracyStat = ({ engine }: { engine: TypingEngine }) => {
  const percent = useEngineValue(engine, selectAccuracyPercent)
  return <Stat value={`${percent}%`} unit="acc" width={4} />
}

const TimerStat = ({ engine }: { engine: TypingEngine }) => {
  const seconds = useEngineValue(engine, selectElapsedSeconds)
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

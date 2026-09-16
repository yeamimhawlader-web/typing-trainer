/**
 * The control row: what is being typed on the left; the live figures, restart
 * and settings on the right; a word about accuracy when there is one to say,
 * and a hairline underneath.
 *
 * Everything here is the application's own. The source is the text provider's
 * name. The figures are the engine's, chosen for display by the same selectors
 * the classic screen uses, so both screens show the same number at the same
 * moment and neither computes one. Each figure subscribes to its own value, so
 * the row itself never re-renders while typing.
 */

import { ROUTES } from '@app/routes.ts'
import type { TypingEngine } from '@core/engine'
import { formatDuration } from '@features/results'
import {
  selectAccuracyPercent,
  selectAccuracyState,
  selectElapsedSeconds,
  selectLiveWpm,
  useEngineValue,
} from '@features/typing'

import { AccuracyNotice } from './AccuracyNotice.tsx'
import { IconCircle, IconLink } from '../controls/controls.tsx'
import { RestartIcon, SettingsIcon } from '../icons.tsx'

import styles from './ControlRow.module.css'

interface FigureProps {
  readonly value: string
  readonly unit: string
  readonly primary?: boolean
  /** How the figure is doing, where that is a thing it can say. */
  readonly state?: string
}

const Figure = ({ value, unit, primary = false, state }: FigureProps) => (
  <span className={styles.figure} data-primary={primary} data-state={state}>
    <span className={styles.value}>{value}</span>
    <span className={styles.unit}>{unit}</span>
  </span>
)

const Speed = ({ engine }: { engine: TypingEngine }) => {
  const wpm = useEngineValue(engine, selectLiveWpm)
  return <Figure value={wpm === null ? '—' : String(wpm)} unit="wpm" primary />
}

const Accuracy = ({ engine }: { engine: TypingEngine }) => {
  const percent = useEngineValue(engine, selectAccuracyPercent)
  // The state is the ratio's, not the rounded figure's: at 95.99% the number
  // reads 96 and the typist is still below the line.
  const state = useEngineValue(engine, selectAccuracyState)
  return <Figure value={`${percent}%`} unit="acc" state={state} />
}

/**
 * The clock: counting up through a word test, and down through a timed one,
 * where what is left is the thing worth knowing. It never reads below zero:
 * the session ends on the same clock.
 */
const Time = ({ engine, limitSeconds }: { engine: TypingEngine; limitSeconds: number | null }) => {
  const seconds = useEngineValue(engine, selectElapsedSeconds)
  const shown = limitSeconds === null ? seconds : Math.max(0, limitSeconds - seconds)
  return <Figure value={formatDuration(shown * 1000)} unit={limitSeconds === null ? 'time' : 'left'} />
}

/**
 * Words finished out of the loaded test's words. The engine only takes the text
 * on the first keystroke, so until then its snapshot still describes the
 * previous test, and nothing is finished.
 */
const Progress = ({ engine, total }: { engine: TypingEngine; total: number | null }) => {
  const done = useEngineValue(engine, (snapshot) =>
    snapshot.status === 'idle'
      ? 0
      : snapshot.status === 'completed' && total !== null
        ? total
        : Math.max(0, snapshot.currentWordIndex),
  )
  // A timed test has no total to count towards: the words are simply how many.
  return <Figure value={total === null ? String(done) : `${done}/${total}`} unit="words" />
}

export interface ControlRowProps {
  readonly engine: TypingEngine
  /** The text provider's name, "Common words", or the drill; or the mode's. */
  readonly source: string
  /** A few words on what the source is, shown beside it. */
  readonly description?: string | undefined
  /** How many words the loaded test has, by the engine's own word rule. Null when the clock ends it. */
  readonly words: number | null
  /** The seconds a timed test runs for, or null for a word test. */
  readonly limitSeconds?: number | null
  readonly onRestart: () => void
}

export const ControlRow = ({
  engine,
  source,
  description,
  words,
  limitSeconds = null,
  onRestart,
}: ControlRowProps) => (
  <div className={styles.wrap}>
    <div className={styles.row}>
      <p className={styles.source}>
        {source}
        {description !== undefined && <span className={styles.description}>{description}</span>}
      </p>

      <div className={styles.actions}>
        {/* Named so it can be told apart from the result announcement, which is
            the status region that does speak. */}
        <div className={styles.figures} role="status" aria-live="off" aria-label="Live statistics">
          <Speed engine={engine} />
          <Accuracy engine={engine} />
          <Time engine={engine} limitSeconds={limitSeconds} />
          <Progress engine={engine} total={words} />
        </div>
        <span className={styles.gap} aria-hidden="true" />
        {/* Together, so on a narrow screen they wrap as a pair. */}
        <span className={styles.buttons}>
          <IconCircle label="Restart test" onClick={onRestart}>
            <RestartIcon />
          </IconCircle>
          <IconLink to={ROUTES.settings} label="Settings">
            <SettingsIcon />
          </IconLink>
        </span>
      </div>
    </div>

    <AccuracyNotice engine={engine} />

    <hr className={styles.divider} />
  </div>
)

/**
 * The control row: what is being typed on the left; the live figures, restart
 * and settings on the right; a hairline underneath.
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
import { selectAccuracyPercent, selectElapsedSeconds, selectLiveWpm, useEngineValue } from '@features/typing'

import { IconCircle, IconLink } from '../controls/controls.tsx'
import { RestartIcon, SettingsIcon } from '../icons.tsx'

import styles from './ControlRow.module.css'

interface FigureProps {
  readonly value: string
  readonly unit: string
  readonly primary?: boolean
}

const Figure = ({ value, unit, primary = false }: FigureProps) => (
  <span className={styles.figure} data-primary={primary}>
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
  return <Figure value={`${percent}%`} unit="acc" />
}

const Time = ({ engine }: { engine: TypingEngine }) => {
  const seconds = useEngineValue(engine, selectElapsedSeconds)
  return <Figure value={formatDuration(seconds * 1000)} unit="time" />
}

/**
 * Words finished out of the loaded test's words. The engine only takes the text
 * on the first keystroke, so until then its snapshot still describes the
 * previous test, and nothing is finished.
 */
const Progress = ({ engine, total }: { engine: TypingEngine; total: number }) => {
  const done = useEngineValue(engine, (snapshot) =>
    snapshot.status === 'idle' ? 0 : snapshot.status === 'completed' ? total : Math.max(0, snapshot.currentWordIndex),
  )
  return <Figure value={`${done}/${total}`} unit="words" />
}

export interface ControlRowProps {
  readonly engine: TypingEngine
  /** The text provider's name, "Common words", or the drill; or the mode's. */
  readonly source: string
  /** A few words on what the source is, shown beside it. */
  readonly description?: string | undefined
  /** How many words the loaded test has, by the engine's own word rule. */
  readonly words: number
  readonly onRestart: () => void
}

export const ControlRow = ({ engine, source, description, words, onRestart }: ControlRowProps) => (
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
          <Time engine={engine} />
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

    <hr className={styles.divider} />
  </div>
)

/**
 * The control row: language on the left; mode, restart and settings on the
 * right; a hairline underneath.
 */

import { useShellStore, type Mode } from '../../state/shell.store.ts'
import { STUB_LANGUAGES } from '../../stub-data.ts'
import { IconCircle, SlidingTabs } from '../controls/controls.tsx'
import { ChevronDownIcon, RestartIcon, SettingsIcon } from '../icons.tsx'

import styles from './ControlRow.module.css'

const MODE_OPTIONS: readonly { readonly value: Mode; readonly label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'advanced', label: 'Advanced' },
]

export interface ControlRowProps {
  readonly onRestart: () => void
}

export const ControlRow = ({ onRestart }: ControlRowProps) => {
  const mode = useShellStore((state) => state.mode)
  const setMode = useShellStore((state) => state.setMode)
  const language = useShellStore((state) => state.language)

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        {/* A native select: the whole list, keyboard and screen-reader
            behaviour for free. Only English exists so far. */}
        <label className={styles.language}>
          <span className="visually-hidden">Language</span>
          <select className={styles.select} value={language} onChange={() => undefined}>
            {STUB_LANGUAGES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className={styles.chevron} />
        </label>

        <div className={styles.actions}>
          <SlidingTabs name="gg-mode" label="Mode" options={MODE_OPTIONS} value={mode} onChange={setMode} />
          <span className={styles.gap} aria-hidden="true" />
          <IconCircle label="Restart test" onClick={onRestart}>
            <RestartIcon />
          </IconCircle>
          <IconCircle label="Test settings">
            <SettingsIcon />
          </IconCircle>
        </div>
      </div>

      <hr className={styles.divider} />
    </div>
  )
}

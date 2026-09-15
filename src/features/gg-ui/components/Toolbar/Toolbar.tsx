/**
 * The toolbar: presets, feedback toggles, text size, test length, view.
 *
 * Every group is labelled for assistive technology; the hairlines between them
 * are decoration and drop away when the groups wrap on narrow screens.
 *
 * Text size and test length drive the shell's state. The presets and toggles
 * change only their own pressed state for now — they have nothing behind them
 * until the wiring pass.
 */

import type { ReactNode } from 'react'

import {
  PRESET_KEYS,
  STREAM_SIZES,
  TEST_MINUTES,
  useShellStore,
  type StreamSize,
  type TestMinutes,
  type Toggle,
} from '../../state/shell.store.ts'
import { IconCircle, Keycap, PillGroup, Separator, type PillOption } from '../controls/controls.tsx'
import {
  ChartIcon,
  EditIcon,
  EyeIcon,
  MuteIcon,
  SmileFilledIcon,
  SmileIcon,
  TimerIcon,
} from '../icons.tsx'

import styles from './Toolbar.module.css'

const SIZE_OPTIONS: readonly PillOption<StreamSize>[] = STREAM_SIZES.map((size) => ({
  value: size,
  label: size,
  accessibleLabel: {
    xs: 'Extra small text',
    sm: 'Small text',
    md: 'Medium text',
    lg: 'Large text',
    xl: 'Extra large text',
  }[size],
}))

const MINUTE_OPTIONS: readonly PillOption<TestMinutes>[] = TEST_MINUTES.map((minutes) => ({
  value: minutes,
  label: String(minutes),
  accessibleLabel: minutes === 1 ? '1 minute' : `${minutes} minutes`,
}))

const FEEDBACK: readonly { readonly name: Toggle; readonly label: string; readonly icon: ReactNode }[] = [
  { name: 'mute', label: 'Mute', icon: <MuteIcon /> },
  { name: 'emoji', label: 'Reactions', icon: <SmileIcon /> },
  { name: 'emojiFilled', label: 'Bold reactions', icon: <SmileFilledIcon /> },
]

const VIEW: readonly { readonly name: Toggle; readonly label: string; readonly icon: ReactNode }[] = [
  { name: 'chart', label: 'Live chart', icon: <ChartIcon /> },
  { name: 'timer', label: 'Timer', icon: <TimerIcon /> },
  { name: 'focus', label: 'Focus mode', icon: <EyeIcon /> },
  { name: 'edit', label: 'Custom text', icon: <EditIcon /> },
]

export const Toolbar = () => {
  const preset = useShellStore((state) => state.preset)
  const setPreset = useShellStore((state) => state.setPreset)
  const size = useShellStore((state) => state.size)
  const setSize = useShellStore((state) => state.setSize)
  const minutes = useShellStore((state) => state.minutes)
  const setMinutes = useShellStore((state) => state.setMinutes)
  const toggles = useShellStore((state) => state.toggles)
  const toggle = useShellStore((state) => state.toggle)

  return (
    <div className={styles.toolbar}>
      <div role="group" aria-label="Presets" className={styles.group}>
        {PRESET_KEYS.map((key) => (
          <Keycap
            key={key}
            legend={key}
            label={`Preset ${key}`}
            pressed={preset === key}
            onPress={() => setPreset(preset === key ? null : key)}
          />
        ))}
      </div>

      <Separator />

      <div role="group" aria-label="Feedback" className={styles.group}>
        {FEEDBACK.map(({ name, label, icon }) => (
          <IconCircle key={name} label={label} aria-pressed={toggles[name]} onClick={() => toggle(name)}>
            {icon}
          </IconCircle>
        ))}
      </div>

      <Separator />

      <PillGroup name="gg-size" label="Text size" options={SIZE_OPTIONS} value={size} onChange={setSize} />

      <Separator />

      <PillGroup
        name="gg-minutes"
        label="Test length"
        options={MINUTE_OPTIONS}
        value={minutes}
        onChange={setMinutes}
      />

      <Separator />

      <div role="group" aria-label="View" className={styles.group}>
        {VIEW.map(({ name, label, icon }) => (
          <IconCircle key={name} label={label} aria-pressed={toggles[name]} onClick={() => toggle(name)}>
            {icon}
          </IconCircle>
        ))}
      </div>
    </div>
  )
}

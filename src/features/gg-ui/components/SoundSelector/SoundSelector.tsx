/**
 * Sound: a glass node that takes you to the sounds.
 *
 * It used to unfold into the packs in place. The sounds are chosen in Settings
 * now — the presets first, then the built-in packs, Off and the volume, then
 * each moment on its own — so the node is a way there: pressing it opens
 * Settings at its Sound effects section, with focus on it. The node still says
 * what is on, so the choice is readable without leaving the test.
 */

import { Link } from 'react-router'

import { ROUTES } from '@app/routes.ts'
import { presetByChoice, SOUND_PACK_LIST, type SoundPreference } from '@features/sound'

import { SoundOffIcon, SoundOnIcon } from '../icons.tsx'
import unfold from '../Unfold/Unfold.module.css'

import styles from './SoundSelector.module.css'

/** Where the node leads: Settings, at its sound section. */
export const SOUND_SETTINGS_PATH = `${ROUTES.settings}#sound`

export interface SoundSelectorProps {
  /** Sound off, the pack it is on, or the preset it is (`preset:<id>`). */
  readonly value: SoundPreference
  /** Recordings changed a sound at a time: the pack is only what is under them. */
  readonly mixed?: boolean
}

export const SoundSelector = ({ value, mixed = false }: SoundSelectorProps) => {
  const on = value !== 'off'
  const chosenName = presetByChoice(value)?.name ?? SOUND_PACK_LIST.find((pack) => pack.id === value)?.name
  const label = !on
    ? 'Sound: off'
    : mixed
      ? 'Sound: your own mix'
      : chosenName !== undefined
        ? `Sound: ${chosenName}`
        : 'Sound: on'

  return (
    <span className={styles.cell}>
      <Link to={SOUND_SETTINGS_PATH} className={unfold.node} aria-label={`${label}. Choose sounds`} title={label}>
        <span className={unfold.nodeGlass}>
          <span className={unfold.nodeLight} aria-hidden="true" />
          <span className={unfold.nodeIcon} aria-hidden="true">
            {on ? <SoundOnIcon width="16" height="16" /> : <SoundOffIcon width="16" height="16" />}
          </span>
          <span className={unfold.nodeLabel}>Sound</span>
        </span>
      </Link>
    </span>
  )
}

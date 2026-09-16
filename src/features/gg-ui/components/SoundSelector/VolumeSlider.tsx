/**
 * The master volume, beside the keyboards it applies to.
 *
 * A native range input, dressed in the glass language: the track is a hairline
 * with the accent filled along it, and the value is shown as a number so the
 * setting is readable rather than guessed at. Everything GG.Typing plays goes
 * through the one gain this moves, so the packs keep their proportions exactly.
 *
 * Moving it plays a key, at the volume being set — a slider you cannot hear is
 * a slider you have to guess at — but no faster than a few times a second,
 * however quickly it is dragged.
 */

import { useCallback, useRef, type CSSProperties } from 'react'

import { FULL_VOLUME, useSound } from '@features/sound'

import styles from './VolumeSlider.module.css'

/** No more than one preview in this long, however fast the slider moves. */
const PREVIEW_GAP_MS = 140

export interface VolumeSliderProps {
  readonly value: number
  readonly onChange: (volume: number) => void
}

export const VolumeSlider = ({ value, onChange }: VolumeSliderProps) => {
  const sound = useSound()
  const lastPreview = useRef(0)

  const change = useCallback(
    (next: number) => {
      onChange(next)
      const now = performance.now()
      if (next <= 0 || sound === null || now - lastPreview.current < PREVIEW_GAP_MS) return
      lastPreview.current = now
      // At the new volume: the engine has it before this returns.
      sound.setVolume(next)
      sound.play('key')
    },
    [onChange, sound],
  )

  return (
    <div className={styles.volume}>
      <span className={styles.name} id="gg-volume-name">
        Volume
      </span>
      <input
        type="range"
        className={styles.slider}
        min={0}
        max={FULL_VOLUME}
        step={5}
        value={value}
        aria-labelledby="gg-volume-name"
        aria-valuetext={`${value}%`}
        style={{ '--gg-volume-fill': `${value}%` } as CSSProperties}
        onChange={(event) => change(Number(event.target.value))}
      />
      <output className={styles.value} htmlFor="gg-volume-name">
        {value}%
      </output>
    </div>
  )
}

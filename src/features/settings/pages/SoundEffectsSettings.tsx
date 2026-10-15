/**
 * Sound effects: a recording for each moment, or the built-in sound.
 *
 * Each moment is a row — what it is, when it plays, a list of its recordings
 * and a button to hear the one chosen. Choosing one plays it too, so the list
 * can be run through by ear. The packs on the typing screen stay as they are:
 * a moment left on "Built-in" sounds as its pack makes it.
 *
 * The credits the recordings' licences ask for are here, under the choices.
 */

import { useId } from 'react'

import { useSettingsStore } from '@features/settings/state/settings.store.ts'
import { MOMENT_DETAILS, SAMPLE_MOMENTS, SAMPLES, SOURCE_CREDITS, useSound, type SampleMoment } from '@features/sound'
import { Button } from '@shared/ui'

import styles from './SoundEffectsSettings.module.css'

const MomentRow = ({ moment }: { readonly moment: SampleMoment }) => {
  const id = useId()
  const sound = useSound()
  const chosen = useSettingsStore((state) => state.preferences.soundSamples[moment] ?? '')
  const setSoundSample = useSettingsStore((state) => state.setSoundSample)
  const { title, when, builtIn } = MOMENT_DETAILS[moment]

  return (
    <div className={styles.row}>
      <label className={styles.what} htmlFor={id}>
        <span className={styles.title}>{title}</span>
        <span className={styles.when}>{when}</span>
      </label>
      <select
        id={id}
        className={styles.select}
        value={chosen}
        onChange={(event) => {
          const next = event.target.value
          void setSoundSample(moment, next === '' ? null : next)
          if (next !== '') sound?.previewSample(next)
        }}
      >
        <option value="">{builtIn ? 'Built-in' : 'None'}</option>
        {SAMPLES[moment].map((sample) => (
          <option key={sample.id} value={sample.id}>
            {sample.label}
          </option>
        ))}
      </select>
      <Button
        aria-label={`Play the ${title.toLowerCase()} sound`}
        disabled={chosen === '' || sound === null}
        onClick={() => {
          if (chosen !== '') sound?.previewSample(chosen)
        }}
      >
        Play
      </Button>
    </div>
  )
}

export const SoundEffectsSettings = () => {
  const soundOff = useSettingsStore((state) => state.preferences.sound === 'off')

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>Sound effects</legend>

      {soundOff && (
        <p className={styles.note}>
          Sound is off. Turn it on with the Sound button on the typing screen to hear these while you type; Play works
          either way.
        </p>
      )}

      <div className={styles.rows}>
        {SAMPLE_MOMENTS.map((moment) => (
          <MomentRow key={moment} moment={moment} />
        ))}
      </div>

      <p className={styles.credits}>
        Recordings from{' '}
        {Object.values(SOURCE_CREDITS).map(({ name, url, licence }, index, all) => (
          <span key={url}>
            <a href={url} target="_blank" rel="noreferrer">
              {name}
            </a>{' '}
            ({licence}){index < all.length - 2 ? ', ' : index === all.length - 2 ? ' and ' : '.'}
          </span>
        ))}
      </p>
    </fieldset>
  )
}

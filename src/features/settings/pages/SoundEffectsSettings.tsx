/**
 * Sound effects: a preset in one choice, or each moment by ear.
 *
 * The presets come first, because they are what most people want: one choice
 * and every moment has a sound. The same presets are in the Sound menu on the
 * typing screen, under Recorded. Choosing one turns sound on.
 *
 * Under them, each moment can be tuned on its own. A moment's options are a
 * list that stays open while you go through it — choosing one plays it and
 * keeps the list where it is, so every option can be heard before settling,
 * which a dropdown that closes on every choice does not allow. Changing a
 * moment makes the sounds your own mix rather than the preset.
 *
 * ## Accessibility
 *
 * Every list is a group of real radio buttons with a visible label: the arrow
 * keys move through it, and each move plays the option it lands on. Each
 * moment's list is behind a button that says whether it is open and what it
 * opens. What has just been chosen is announced politely, so a screen reader
 * hears "Keystroke: Stamp" without moving focus. Nothing depends on colour
 * alone: the chosen option is a filled radio, and the open moment says so.
 *
 * The credits the recordings' licences ask for are at the end.
 */

import { useId, useState } from 'react'

import { useSettingsStore } from '@features/settings/state/settings.store.ts'
import {
  MOMENT_DETAILS,
  presetChoice,
  presetMatching,
  SAMPLE_MOMENTS,
  sampleById,
  sampleChoicesFromStored,
  SAMPLES,
  SOUND_PRESETS,
  SOURCE_CREDITS,
  useSound,
  type SampleMoment,
  type SoundPreset,
} from '@features/sound'
import { Button } from '@shared/ui'

import styles from './SoundEffectsSettings.module.css'

type Announce = (message: string) => void

const MomentRow = ({ moment, announce }: { readonly moment: SampleMoment; readonly announce: Announce }) => {
  const id = useId()
  const sound = useSound()
  const [open, setOpen] = useState(false)
  const chosen = useSettingsStore((state) => state.preferences.soundSamples[moment] ?? '')
  const setSoundSample = useSettingsStore((state) => state.setSoundSample)
  const { title, when, builtIn } = MOMENT_DETAILS[moment]
  const none = builtIn ? 'Built-in' : 'None'
  const chosenLabel = sampleById(chosen)?.label ?? none

  const choose = (next: string) => {
    void setSoundSample(moment, next === '' ? null : next)
    if (next !== '') sound?.previewSample(next)
    announce(`${title}: ${sampleById(next)?.label ?? none}`)
  }

  return (
    <div className={styles.row}>
      <div className={styles.head}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={`${id}-options`}
          onClick={() => setOpen((was) => !was)}
        >
          <span className={styles.chevron} aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
          <span className={styles.what}>
            <span className={styles.title}>{title}</span>
            <span className={styles.when}>{when}</span>
          </span>
          <span className={styles.current}>
            <span className={styles.visuallyHidden}>Chosen: </span>
            {chosenLabel}
          </span>
        </button>
        <Button
          aria-label={`Play ${title}: ${chosenLabel}`}
          disabled={chosen === '' || sound === null}
          onClick={() => {
            if (chosen !== '') sound?.previewSample(chosen)
          }}
        >
          Play
        </Button>
      </div>

      {open && (
        <fieldset id={`${id}-options`} className={styles.options}>
          <legend className={styles.visuallyHidden}>{title} sound</legend>
          {[{ id: '', label: builtIn ? 'Built-in (the sound pack)' : 'None' }, ...SAMPLES[moment]].map((option) => (
            <label key={option.id || 'none'} className={styles.option}>
              <input
                type="radio"
                name={`${id}-choice`}
                value={option.id}
                checked={chosen === option.id}
                onChange={() => choose(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  )
}

const PresetPicker = ({ announce }: { readonly announce: Announce }) => {
  const name = useId()
  const sound = useSound()
  const pack = useSettingsStore((state) => state.preferences.sound)
  const samples = useSettingsStore((state) => state.preferences.soundSamples)
  const setSound = useSettingsStore((state) => state.setSound)
  const current = presetMatching(pack, sampleChoicesFromStored(samples))
  const ownMix = current === null && Object.keys(samples).length > 0

  const choose = (preset: SoundPreset) => {
    void setSound(presetChoice(preset))
    const key = preset.samples.key
    if (key !== undefined) sound?.previewSample(key)
    announce(`Preset: ${preset.name}`)
  }

  return (
    <fieldset className={styles.presets}>
      <legend className={styles.subLegend}>Presets</legend>
      <p className={styles.hint}>One choice for every sound. Choosing one turns sound on.</p>
      <div className={styles.presetList}>
        {SOUND_PRESETS.map((preset) => (
          <label key={preset.id} className={styles.preset}>
            <input
              type="radio"
              name={name}
              value={preset.id}
              checked={current?.id === preset.id}
              onChange={() => choose(preset)}
            />
            <span className={styles.presetText}>
              <span className={styles.title}>{preset.name}</span>
              <span className={styles.when}>{preset.description}</span>
            </span>
          </label>
        ))}
      </div>
      {ownMix && <p className={styles.hint}>Your own mix: changed from a preset, a sound at a time.</p>}
    </fieldset>
  )
}

export const SoundEffectsSettings = () => {
  const soundOff = useSettingsStore((state) => state.preferences.sound === 'off')
  const [message, setMessage] = useState('')

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>Sound effects</legend>

      {soundOff && (
        <p className={styles.hint}>
          Sound is off. Choose a preset, or turn sound on with the Sound button on the typing screen. Play works
          either way.
        </p>
      )}

      <PresetPicker announce={setMessage} />

      <section className={styles.tune} aria-labelledby="sound-tune-heading">
        <h3 id="sound-tune-heading" className={styles.subLegend}>
          Each sound
        </h3>
        <p className={styles.hint}>
          Open a moment to go through its sounds: each one plays as you choose it, and the list stays open.
        </p>
        <div className={styles.rows}>
          {SAMPLE_MOMENTS.map((moment) => (
            <MomentRow key={moment} moment={moment} announce={setMessage} />
          ))}
        </div>
      </section>

      {/* Polite, and only ever the last choice: heard without moving focus. */}
      <p className={styles.visuallyHidden} role="status" aria-live="polite">
        {message}
      </p>

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

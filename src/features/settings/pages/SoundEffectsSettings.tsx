/**
 * Sound effects: a preset in one choice, or each moment by ear.
 *
 * The presets come first, because they are what most people want: one choice
 * and every moment has a sound. Choosing one turns sound on. Beside them are
 * Off and the volume, and under them the packs made in the browser. The Sound
 * button on the typing screen leads here (`#sound`), and arriving that way
 * puts focus on this section, so the next Tab is the first choice.
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

import { useEffect, useId, useRef, useState } from 'react'
import { useLocation } from 'react-router'

// The volume slider the Sound menu had, the same control here.
import { VolumeSlider } from '@features/gg-ui/components/SoundSelector/VolumeSlider.tsx'
import { useSettingsStore } from '@features/settings/state/settings.store.ts'
import {
  MOMENT_DETAILS,
  packsIn,
  presetChoice,
  presetMatching,
  SAMPLE_MOMENTS,
  sampleById,
  sampleChoicesFromStored,
  SAMPLES,
  SOUND_CATEGORIES,
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

/**
 * The sound in one choice: a preset, Off, or a pack made in the browser — one
 * group of radio buttons, so exactly one is ever chosen, laid out in three parts.
 */
const SoundPicker = ({ announce }: { readonly announce: Announce }) => {
  const name = useId()
  const sound = useSound()
  const pack = useSettingsStore((state) => state.preferences.sound)
  const samples = useSettingsStore((state) => state.preferences.soundSamples)
  const volume = useSettingsStore((state) => state.preferences.soundVolume)
  const setSound = useSettingsStore((state) => state.setSound)
  const setSoundVolume = useSettingsStore((state) => state.setSoundVolume)
  const preset = presetMatching(pack, sampleChoicesFromStored(samples))
  const ownMix = pack !== 'off' && preset === null && Object.keys(samples).length > 0
  const current = pack === 'off' ? 'off' : preset !== null ? presetChoice(preset) : ownMix ? null : pack
  // Shown open when a built-in pack is what is on, so the choice is in view.
  const [packsShown] = useState(() => current !== null && current !== 'off' && preset === null)

  const choosePreset = (chosen: SoundPreset) => {
    void setSound(presetChoice(chosen))
    const key = chosen.samples.key
    if (key !== undefined) sound?.previewSample(key)
    announce(`Sound: ${chosen.name}`)
  }

  const choosePack = (id: string, packName: string) => {
    void setSound(id)
    sound?.preview(id as Parameters<NonNullable<typeof sound>['preview']>[0])
    announce(`Sound: ${packName}`)
  }

  const radio = (value: string, onChoose: () => void) => (
    <input type="radio" name={name} value={value} checked={current === value} onChange={onChoose} />
  )

  return (
    <fieldset className={styles.presets}>
      <legend className={styles.subLegend}>The sound</legend>
      <p className={styles.hint}>One choice for every sound. Choosing one turns sound on.</p>

      <div className={styles.presetList}>
        {SOUND_PRESETS.map((choice) => (
          <label key={choice.id} className={styles.preset}>
            {radio(presetChoice(choice), () => choosePreset(choice))}
            <span className={styles.presetText}>
              <span className={styles.title}>{choice.name}</span>
              <span className={styles.when}>{choice.description}</span>
            </span>
          </label>
        ))}
        <label className={styles.preset}>
          {radio('off', () => {
            void setSound('off')
            announce('Sound: off')
          })}
          <span className={styles.presetText}>
            <span className={styles.title}>Off</span>
            <span className={styles.when}>No sound at all</span>
          </span>
        </label>
      </div>
      {ownMix && <p className={styles.hint}>Your own mix: changed from a preset, a sound at a time.</p>}

      <div className={styles.volume}>
        <VolumeSlider value={volume} onChange={(next) => void setSoundVolume(next)} />
      </div>

      <details className={styles.builtIn} open={packsShown}>
        <summary className={styles.summary}>Built-in sounds, made in the browser</summary>
        {SOUND_CATEGORIES.map((category) => (
          <div key={category.id} className={styles.category} role="group" aria-label={category.name}>
            <span className={styles.categoryName} aria-hidden="true">
              {category.name}
            </span>
            <div className={styles.packs}>
              {packsIn(category.id).map((choice) => (
                <label key={choice.id} className={styles.option} title={choice.description}>
                  {radio(choice.id, () => choosePack(choice.id, choice.name))}
                  <span>{choice.name}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </details>
    </fieldset>
  )
}

/** Where the Sound button leads: this section, by its id. */
export const SOUND_SECTION_ID = 'sound'

export const SoundEffectsSettings = () => {
  const [message, setMessage] = useState('')
  const section = useRef<HTMLFieldSetElement>(null)
  const { hash } = useLocation()

  // Arriving from the Sound button: brought into view, and focus put here, so
  // a keyboard or a screen reader starts at the sounds rather than the top.
  useEffect(() => {
    if (hash !== `#${SOUND_SECTION_ID}`) return
    const element = section.current
    if (element === null) return
    element.scrollIntoView({ block: 'start' })
    element.focus({ preventScroll: true })
  }, [hash])

  return (
    <fieldset
      ref={section}
      id={SOUND_SECTION_ID}
      tabIndex={-1}
      className={styles.group}
      aria-describedby={`${SOUND_SECTION_ID}-intro`}
    >
      <legend className={styles.legend}>Sound effects</legend>
      <p id={`${SOUND_SECTION_ID}-intro`} className={styles.hint}>
        Choose a sound below. Play works even with sound off.
      </p>

      <SoundPicker announce={setMessage} />

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

/**
 * A sticky note, pinned to the corner, once Golden Nuggets holds ten words.
 *
 * Ten is enough to be worth practising, so the note says so — once for each
 * ten (ten, twenty, …), and never while a test is running: it waits for the
 * test to end, and steps aside the moment another starts. It takes no focus;
 * it is a note left on the desk, not a dialog.
 *
 * Which ten was last answered is remembered in this browser. Where that cannot
 * be read or written the note still works, and may simply be seen again.
 */

import '@fontsource-variable/caveat'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'

import { ROUTES } from '@app/routes.ts'
import type { TypingEngine } from '@core/engine'
import type { GoldenNuggetService } from '@core/nuggets'

import { NUGGET_NOTE } from '../../themes/themes.ts'

import styles from './NuggetNote.module.css'

export const NUGGETS_PER_NOTE = 10
const STORAGE_KEY = 'gg.nugget-note.answered'

const answered = (): number => {
  try {
    return Number(window.localStorage.getItem(STORAGE_KEY)) || 0
  } catch {
    return 0
  }
}

const answer = (milestone: number): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(milestone))
  } catch {
    // Seen again another day; nothing worse.
  }
}

const COLOURS = {
  '--gg-note-paper': NUGGET_NOTE.paper,
  '--gg-note-pin': NUGGET_NOTE.pin,
  '--gg-note-ink': NUGGET_NOTE.ink,
  '--gg-note-shade': NUGGET_NOTE.shade,
} as CSSProperties

export interface NuggetNoteProps {
  readonly service: GoldenNuggetService
  readonly engine: TypingEngine
}

export const NuggetNote = ({ service, engine }: NuggetNoteProps) => {
  /** The ten the note is about, or null while there is nothing to say. */
  const [milestone, setMilestone] = useState<number | null>(null)

  useEffect(() => {
    let live = true
    const look = (): void => {
      service.getAll().then(
        (nuggets) => {
          if (!live) return
          const reached = Math.floor(nuggets.length / NUGGETS_PER_NOTE) * NUGGETS_PER_NOTE
          setMilestone(reached >= NUGGETS_PER_NOTE && reached > answered() ? reached : null)
        },
        () => undefined,
      )
    }
    if (engine.getSnapshot().status !== 'running') look()
    const stop = engine.on((event) => {
      if (event.type === 'started') setMilestone(null)
      // A beat after the end, so the last word kept has been written.
      if (event.type === 'finished') window.setTimeout(look, 600)
    })
    return () => {
      live = false
      stop()
    }
  }, [engine, service])

  const dismiss = useCallback(() => {
    if (milestone !== null) answer(milestone)
    setMilestone(null)
  }, [milestone])

  if (milestone === null) return null

  return (
    <aside className={styles.note} style={COLOURS} aria-label="A note about your Golden Nuggets">
      <span className={styles.pin} aria-hidden="true" />
      <p className={styles.words}>
        {milestone} Golden Nuggets! These are the words that trip your fingers up. Give them a few minutes of
        practice and your speed will climb — the tricky ones are where the seconds hide.
      </p>
      <p className={styles.sign}>— Hovertyping</p>
      <div className={styles.actions}>
        <Link to={ROUTES.ggHoverNuggets} className={styles.go} onClick={dismiss}>
          Practise them
        </Link>
        <button type="button" className={styles.later} onClick={dismiss}>
          Not now
        </button>
      </div>
    </aside>
  )
}

/**
 * Saving a typist's practice to a file, and putting it back.
 *
 * Nothing Hover Typing records leaves the browser it was typed in, which is the
 * point of it — and the reason this exists. A browser is where data goes, not
 * where it is safe: clearing site data empties it, a second computer never had
 * it, and the day the site moves to its own address every visitor arrives at
 * what the browser considers a different place, with nothing in it.
 *
 * So: one button that hands the typist a file, and one that takes it back.
 *
 * Restoring replaces everything, which is worth being asked about, so it is
 * done in two steps — choose the file, then see what is in it and agree. The
 * reload afterwards is not decoration: the preferences, history and nugget
 * stores all read their contents once, on the way up, and would otherwise sit
 * there showing the data that was just replaced.
 */

import { useCallback, useRef, useState } from 'react'

import { appConfig } from '@config/app.config.ts'
import {
  packStored,
  readTransferFile,
  restoreStored,
  storage,
  TransferError,
  type TransferFile,
} from '@core/persistence'
import { Button } from '@shared/ui'

import styles from './DataTransferSettings.module.css'

/** `hover-typing-2026-11-16.json`: sorts by date and says what it is. */
const fileName = (on: Date): string => `hover-typing-${on.toISOString().slice(0, 10)}.json`

const countOf = (file: TransferFile): number => Object.keys(file.entries).length

const savedOn = (file: TransferFile): string => {
  const when = new Date(file.savedAt)
  return Number.isNaN(when.getTime())
    ? 'an unknown day'
    : when.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

/** What the panel is doing, so that only one thing is ever on screen. */
type Stage =
  | { readonly step: 'idle' }
  | { readonly step: 'asking'; readonly file: TransferFile }
  | { readonly step: 'done'; readonly written: number }
  | { readonly step: 'failed'; readonly why: string }

export const DataTransferSettings = () => {
  const [stage, setStage] = useState<Stage>({ step: 'idle' })
  const picker = useRef<HTMLInputElement>(null)

  const save = useCallback(() => {
    void (async () => {
      try {
        const now = new Date()
        const file = await packStored(storage, appConfig.persistence.schemaVersion, () => now)
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }),
        )
        const link = document.createElement('a')
        link.href = url
        link.download = fileName(now)
        link.click()
        // The browser has read it by the time click() returns; holding the URL
        // open any longer only holds the copy in memory.
        URL.revokeObjectURL(url)
        setStage({ step: 'done', written: 0 })
      } catch {
        setStage({ step: 'failed', why: 'The copy could not be made. Your data is untouched.' })
      }
    })()
  }, [])

  const choose = useCallback((chosen: File | undefined) => {
    if (chosen === undefined) return
    void (async () => {
      try {
        setStage({ step: 'asking', file: readTransferFile(JSON.parse(await chosen.text()), appConfig.persistence.schemaVersion) })
      } catch (error) {
        setStage({
          step: 'failed',
          why:
            error instanceof TransferError
              ? error.message
              : 'That file could not be read. It may not be the one Hover Typing saved.',
        })
      }
    })()
  }, [])

  const replace = useCallback((file: TransferFile) => {
    void (async () => {
      try {
        setStage({ step: 'done', written: await restoreStored(file, storage) })
      } catch {
        setStage({ step: 'failed', why: 'The data could not be written. Nothing was changed.' })
      }
    })()
  }, [])

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>Your data</legend>

      <div className={styles.options}>
        <Button onClick={save}>Save a copy</Button>
        <Button onClick={() => picker.current?.click()}>Restore from a copy</Button>
      </div>

      <input
        ref={picker}
        type="file"
        accept="application/json,.json"
        className={styles.picker}
        // So that choosing the same file twice in a row is still a change.
        onClick={(event) => {
          event.currentTarget.value = ''
        }}
        onChange={(event) => choose(event.currentTarget.files?.[0])}
      />

      <p className={styles.hint}>
        Everything you have typed here — your history, the words you keep getting
        wrong, your settings and sounds — is kept in this browser and nowhere
        else. Clearing this browser&rsquo;s data would take it with it, and
        another computer has never had it. A copy is one file you keep, and it
        can be put back here or anywhere else the site runs.
      </p>

      {stage.step === 'asking' && (
        <div className={styles.asking} role="group" aria-label="Confirm restoring">
          <p className={styles.question}>
            That copy holds {countOf(stage.file)}{' '}
            {countOf(stage.file) === 1 ? 'item' : 'items'}, saved on {savedOn(stage.file)}. Putting it
            back replaces everything in this browser — the history here now will be gone.
          </p>
          <div className={styles.options}>
            <Button onClick={() => replace(stage.file)}>Replace everything</Button>
            <Button onClick={() => setStage({ step: 'idle' })}>Keep what is here</Button>
          </div>
        </div>
      )}

      {stage.step === 'done' && stage.written > 0 && (
        <div className={styles.asking} role="status">
          <p className={styles.question}>
            Restored {stage.written} {stage.written === 1 ? 'item' : 'items'}. Load the page again to
            see it.
          </p>
          <div className={styles.options}>
            <Button onClick={() => window.location.reload()}>Load the page again</Button>
          </div>
        </div>
      )}

      {stage.step === 'failed' && (
        <p className={styles.failed} role="alert">
          {stage.why}
        </p>
      )}
    </fieldset>
  )
}

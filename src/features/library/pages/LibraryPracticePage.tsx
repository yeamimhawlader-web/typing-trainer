/**
 * Typing one of your own texts.
 *
 * The same session, engine, score and save as any other test — only the words
 * differ, and where they came from. A passage is typed exactly as it was kept,
 * so the length and dressing controls are not offered: the text is the test.
 * A word list is drawn from at the length chosen, like ordinary practice.
 *
 * The text is read once, by the id in the path. An id that is no longer there
 * — deleted in another tab, or a link kept after the fact — says so rather
 * than showing an empty screen.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'

import { ROUTES } from '@app/routes.ts'
import {
  createLibraryProvider,
  libraryService as defaultLibrary,
  type LibraryService,
  type LibraryText,
} from '@core/library'
import type { SessionService } from '@core/sessions'
import type { TelemetryService } from '@core/telemetry'
import { GGTypingScreen, useGGDocumentTitle } from '@features/gg-ui'
import { useSettingsStore } from '@features/settings/state/settings.store.ts'

import styles from './LibraryPracticePage.module.css'

export interface LibraryPracticePageProps {
  /** Injectable for tests; default to the application's own. */
  readonly library?: LibraryService
  readonly service?: SessionService
  readonly telemetry?: TelemetryService
}

type Loaded =
  | { readonly status: 'loading' }
  | { readonly status: 'missing' }
  | { readonly status: 'ready'; readonly text: LibraryText }

export const LibraryPracticePage = ({
  library = defaultLibrary,
  service,
  telemetry,
}: LibraryPracticePageProps = {}) => {
  const { textId: raw } = useParams<{ textId: string }>()
  const textId = raw ?? ''

  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })
  useEffect(() => {
    let active = true
    library
      .get(textId)
      .then((text) => {
        if (active) setLoaded(text === null ? { status: 'missing' } : { status: 'ready', text })
      })
      .catch((error: unknown) => {
        console.warn('[library] failed to read a text to practise', error)
        if (active) setLoaded({ status: 'missing' })
      })
    return () => {
      active = false
    }
  }, [library, textId])

  const text = loaded.status === 'ready' ? loaded.text : null
  const provider = useMemo(() => (text === null ? null : createLibraryProvider(text)), [text])

  useGGDocumentTitle(text?.title ?? 'Your text')

  const initial = useSettingsStore((state) => state.preferences.practiceWordCount)
  const remember = useSettingsStore((state) => state.setPracticeWordCount)

  if (loaded.status === 'loading') return null

  if (text === null || provider === null) {
    return (
      <section className={styles.notice} aria-labelledby="missing-text-heading">
        <h1 className={styles.title} id="missing-text-heading">
          That text is not here
        </h1>
        <p className={styles.text}>
          It may have been deleted. Everything you have kept is on{' '}
          <Link to={ROUTES.ggTexts} className={styles.link}>
            your texts
          </Link>
          .
        </p>
      </section>
    )
  }

  return (
    <GGTypingScreen
      heading={text.title}
      // Your own text is its own mode: no punctuation, numbers or vocabulary
      // over it, and no clock — what was kept is what is typed.
      mode="library"
      provider={provider}
      service={service}
      telemetry={telemetry}
      // A passage is the test; a word list is drawn at the length chosen.
      fixedText={text.kind === 'passage'}
      wordCountPreference={{
        initial,
        remember: (count) => {
          void remember(count)
        },
      }}
    />
  )
}

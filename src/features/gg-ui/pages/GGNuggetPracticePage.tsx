/**
 * Golden Nuggets practice: Hover Mode, over the words that keep costing the
 * typist.
 *
 * It is Hover Mode — the same controller, the same difficulties, the same
 * repetitions — with text made of the typist's own Golden Nuggets, each met
 * mid-flow between ordinary words (see `createGoldenNuggetsProvider`). A nugget
 * that costs a mistake is focused and repeated as any word is, and how that
 * focus ends is written back to the nugget, so the Golden Nuggets page says
 * whether practising it worked: cleared last time, or still unresolved.
 *
 * The words are read once, when the page opens. With none to practise, it says
 * so and where they come from.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import { ROUTES } from '@app/routes.ts'
import { goldenNuggetService, type GoldenNuggetService } from '@core/nuggets'
import type { SessionService } from '@core/sessions'
import type { TelemetryService } from '@core/telemetry'
import { createGoldenNuggetsProvider } from '@core/text'
import { useSettingsStore } from '@features/settings/state/settings.store.ts'

import { useGGDocumentTitle } from '../layout/useGGDocumentTitle.ts'
import { GGTypingScreen } from '../screen/GGTypingScreen.tsx'

import styles from './GGGoldenNuggetsPage.module.css'

export interface GGNuggetPracticePageProps {
  /** Injectable for tests; default to the application's own. */
  readonly goldenNuggets?: GoldenNuggetService
  readonly service?: SessionService
  readonly telemetry?: TelemetryService
}

type Loaded =
  | { readonly status: 'loading' }
  | { readonly status: 'empty' }
  | { readonly status: 'ready'; readonly words: readonly string[] }

export const GGNuggetPracticePage = ({
  goldenNuggets = goldenNuggetService,
  service,
  telemetry,
}: GGNuggetPracticePageProps = {}) => {
  useGGDocumentTitle('Golden Nuggets practice')
  const initial = useSettingsStore((state) => state.preferences.practiceWordCount)
  const remember = useSettingsStore((state) => state.setPracticeWordCount)
  const difficulty = useSettingsStore((state) => state.preferences.hoverDifficulty)
  const rememberDifficulty = useSettingsStore((state) => state.setHoverDifficulty)

  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })
  useEffect(() => {
    let active = true
    goldenNuggets
      .getAll()
      .then((nuggets) => {
        if (!active) return
        setLoaded(nuggets.length === 0 ? { status: 'empty' } : { status: 'ready', words: nuggets.map((nugget) => nugget.word) })
      })
      .catch((error: unknown) => {
        console.warn('[golden nuggets] failed to read for practice', error)
        if (active) setLoaded({ status: 'empty' })
      })
    return () => {
      active = false
    }
  }, [goldenNuggets])

  const words = loaded.status === 'ready' ? loaded.words : null
  const provider = useMemo(() => (words === null ? null : createGoldenNuggetsProvider({ words })), [words])

  if (loaded.status === 'loading') return null

  if (provider === null) {
    return (
      <section className={styles.page} aria-labelledby="nugget-practice-heading">
        <h1 className={styles.title} id="nugget-practice-heading">
          Golden Nuggets practice
        </h1>
        <p className={styles.intro}>
          There are no Golden Nuggets to practise yet. A word becomes one when it costs five mistakes in a test, or
          when{' '}
          <Link to={ROUTES.ggHover} className={styles.link}>
            Hover Mode
          </Link>{' '}
          lets it go before it clears.
        </p>
      </section>
    )
  }

  return (
    <GGTypingScreen
      heading="Golden Nuggets practice"
      mode="hover"
      hoverDescription="On your Golden Nuggets"
      hoverDifficulty={difficulty}
      onHoverDifficultyChange={(next) => {
        void rememberDifficulty(next)
      }}
      goldenNuggets={goldenNuggets}
      provider={provider}
      service={service}
      telemetry={telemetry}
      wordCountPreference={{
        initial,
        remember: (count) => {
          void remember(count)
        },
      }}
    />
  )
}

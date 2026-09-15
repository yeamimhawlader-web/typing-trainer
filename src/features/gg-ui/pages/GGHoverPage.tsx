/**
 * GG.Typing Hover Mode: ordinary text, where one mistake on a word focuses it
 * for repetition before the text carries on.
 *
 * The same test as practice — the same text, the same remembered length — run
 * as Hover Mode. The rules are in GGTYPING.md.
 */

import type { GoldenNuggetService } from '@core/nuggets'
import type { SessionService } from '@core/sessions'
import type { TelemetryService } from '@core/telemetry'
import type { TextProvider } from '@core/text'
import { useSettingsStore } from '@features/settings/state/settings.store.ts'

import { useGGDocumentTitle } from '../layout/useGGDocumentTitle.ts'
import { GGTypingScreen } from '../screen/GGTypingScreen.tsx'

export interface GGHoverPageProps {
  /** Injectable for tests; default to the application's own. */
  readonly provider?: TextProvider
  readonly service?: SessionService
  readonly telemetry?: TelemetryService
  readonly goldenNuggets?: GoldenNuggetService
}

export const GGHoverPage = ({ provider, service, telemetry, goldenNuggets }: GGHoverPageProps = {}) => {
  useGGDocumentTitle('Hover Mode')
  const initial = useSettingsStore((state) => state.preferences.practiceWordCount)
  const remember = useSettingsStore((state) => state.setPracticeWordCount)
  const difficulty = useSettingsStore((state) => state.preferences.hoverDifficulty)
  const rememberDifficulty = useSettingsStore((state) => state.setHoverDifficulty)

  return (
    <GGTypingScreen
      heading="Hover Mode"
      mode="hover"
      hoverDifficulty={difficulty}
      onHoverDifficultyChange={(next) => {
        void rememberDifficulty(next)
      }}
      {...(goldenNuggets === undefined ? {} : { goldenNuggets })}
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

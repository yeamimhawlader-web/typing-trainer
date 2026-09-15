/**
 * GG.Typing Hover Mode: ordinary text, where one mistake on a word focuses it
 * for repetition before the text carries on.
 *
 * The same test as practice — the same text, the same remembered length — run
 * as Hover Mode. The rules are in GGTYPING.md.
 */

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
}

export const GGHoverPage = ({ provider, service, telemetry }: GGHoverPageProps = {}) => {
  useGGDocumentTitle('Hover Mode')
  const initial = useSettingsStore((state) => state.preferences.practiceWordCount)
  const remember = useSettingsStore((state) => state.setPracticeWordCount)

  return (
    <GGTypingScreen
      heading="Hover Mode"
      mode="hover"
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

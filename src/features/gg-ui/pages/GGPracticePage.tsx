/**
 * GG.Typing practice: a word-count test of common words.
 *
 * The length is the practice length preference the classic practice page has
 * always remembered, read once when the test loads and written back when it
 * changes. Settings are already loaded by the time this renders; the layout
 * waits for them.
 */

import type { SessionService } from '@core/sessions'
import type { TelemetryService } from '@core/telemetry'
import type { TextProvider } from '@core/text'
import { useSettingsStore } from '@features/settings/state/settings.store.ts'

import { useGGDocumentTitle } from '../layout/useGGDocumentTitle.ts'
import { GGTypingScreen } from '../screen/GGTypingScreen.tsx'

export interface GGPracticePageProps {
  /** Injectable for tests; default to the application's own. */
  readonly provider?: TextProvider
  readonly service?: SessionService
  readonly telemetry?: TelemetryService
}

export const GGPracticePage = ({ provider, service, telemetry }: GGPracticePageProps = {}) => {
  useGGDocumentTitle('Typing Test')
  const initial = useSettingsStore((state) => state.preferences.practiceWordCount)
  const remember = useSettingsStore((state) => state.setPracticeWordCount)

  return (
    <GGTypingScreen
      heading="Typing test"
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

/**
 * GG.Typing Syllable Trainer: long, common words typed as the syllables they
 * are made of, in rhythm — syllable, a breath, syllable, a breath, next word.
 *
 * The same test as practice, at the practice length the typist remembers, over
 * the trainer's own words and drawn as chunks. The screen opens with a
 * demonstration of the technique. The rules are in GGTYPING.md.
 */

import type { GoldenNuggetService } from '@core/nuggets'
import type { SessionService } from '@core/sessions'
import type { TelemetryService } from '@core/telemetry'
import type { TextProvider } from '@core/text'
import { useSettingsStore } from '@features/settings/state/settings.store.ts'

import { useGGDocumentTitle } from '../layout/useGGDocumentTitle.ts'
import { GGTypingScreen } from '../screen/GGTypingScreen.tsx'

export interface GGSyllablePageProps {
  /** Injectable for tests; default to the application's own. */
  readonly provider?: TextProvider
  readonly service?: SessionService
  readonly telemetry?: TelemetryService
  readonly goldenNuggets?: GoldenNuggetService
}

export const GGSyllablePage = ({ provider, service, telemetry, goldenNuggets }: GGSyllablePageProps = {}) => {
  useGGDocumentTitle('Syllable Trainer')
  const initial = useSettingsStore((state) => state.preferences.practiceWordCount)
  const remember = useSettingsStore((state) => state.setPracticeWordCount)

  return (
    <GGTypingScreen
      heading="Syllable Trainer"
      mode="syllable"
      provider={provider}
      service={service}
      telemetry={telemetry}
      {...(goldenNuggets === undefined ? {} : { goldenNuggets })}
      wordCountPreference={{
        initial,
        remember: (count) => {
          void remember(count)
        },
      }}
    />
  )
}

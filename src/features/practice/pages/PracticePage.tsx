/**
 * The practice page.
 *
 * Deliberately bare. The typing test is the screen — a heading, a description
 * and a card around it would all be furniture competing with the text the
 * typist is supposed to be reading.
 *
 * It supplies the one thing practice remembers between visits: how long the
 * test should be. The typing screen reads that once, when it first loads its
 * text, so this waits for settings to be ready rather than showing a test of
 * the default length and swapping it a frame later. Settings are read as the
 * application loads and are ready before the first render in practice, so the
 * wait is not something a typist can see.
 */

import { useSettingsStore } from '@features/settings/state/settings.store.ts'
import { TypingTest } from '@features/typing'
import { useDocumentTitle } from '@shared/lib'

import styles from './PracticePage.module.css'

export const PracticePage = () => {
  // Not built on Page, so it names the tab itself.
  useDocumentTitle('Practice')
  const ready = useSettingsStore((state) => state.status === 'ready')
  const initial = useSettingsStore((state) => state.preferences.practiceWordCount)
  const remember = useSettingsStore((state) => state.setPracticeWordCount)

  return (
    <div className={styles.page}>
      <h1 className="visually-hidden">Typing practice</h1>
      {ready && (
        <TypingTest
          wordCountPreference={{
            initial,
            remember: (count) => {
              void remember(count)
            },
          }}
        />
      )}
    </div>
  )
}

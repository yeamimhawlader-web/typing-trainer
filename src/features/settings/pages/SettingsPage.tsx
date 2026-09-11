/**
 * Settings page.
 *
 * Note what this component does *not* do: it never touches localStorage, never
 * serialises anything, and never reads the DOM for the current theme. It reads
 * state and dispatches an intent. Persistence is the store's business, applying
 * the theme to the document is the theme hook's business.
 */

import type { ThemePreference } from '@core/types'
import { useSettingsStore } from '@features/settings/state/settings.store.ts'
import { Button, Page } from '@shared/ui'

import styles from './SettingsPage.module.css'

const THEMES: ReadonlyArray<{
  readonly value: ThemePreference
  readonly label: string
}> = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
]

export const SettingsPage = () => {
  const theme = useSettingsStore((state) => state.preferences.theme)
  const setTheme = useSettingsStore((state) => state.setTheme)

  return (
    <Page
      title="Settings"
      description="Preferences are saved and restored automatically."
    >
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Theme</legend>

        <div className={styles.options}>
          {THEMES.map(({ value, label }) => (
            <Button
              key={value}
              selected={theme === value}
              onClick={() => {
                void setTheme(value)
              }}
            >
              {label}
            </Button>
          ))}
        </div>

        <p className={styles.hint}>
          Dark is the default: this is a tool for long, focused sessions.
        </p>
      </fieldset>
    </Page>
  )
}

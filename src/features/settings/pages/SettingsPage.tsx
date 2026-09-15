/**
 * Settings page.
 *
 * Note what this component does *not* do: it never touches localStorage, never
 * serialises anything, and never reads the DOM for the current theme. It reads
 * state and dispatches an intent. Persistence is the store's business, applying
 * the theme to the document is the theme hook's business.
 *
 * The themes listed are the GG.Typing registry's, the same ones the theme panel
 * offers, so there is one list of themes and one stored choice.
 */

import { GG_THEMES } from '@features/gg-ui/themes/themes.ts'
import { useSettingsStore } from '@features/settings/state/settings.store.ts'
import { Button, Page } from '@shared/ui'

import styles from './SettingsPage.module.css'

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
          {GG_THEMES.map(({ id, name }) => (
            <Button
              key={id}
              selected={theme === id}
              onClick={() => {
                void setTheme(id)
              }}
            >
              {name}
            </Button>
          ))}
        </div>

        <p className={styles.hint}>
          Dark is the default: this is a tool for long, focused sessions. The same
          themes are in the palette on the typing screen.
        </p>
      </fieldset>
    </Page>
  )
}

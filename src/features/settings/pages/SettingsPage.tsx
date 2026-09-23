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
 *
 * The front page's opening is here too, because it is the one thing in the
 * application that asks for something before it gives anything: it is worth
 * seeing once, and worth being able to turn off after that.
 */

import { OPENINGS, type Opening } from '@core/types'
import { GG_THEMES } from '@features/gg-ui/themes/themes.ts'
import { useSettingsStore } from '@features/settings/state/settings.store.ts'
import { Button, Page } from '@shared/ui'

import styles from './SettingsPage.module.css'

const OPENING_LABELS: Readonly<Record<Opening, string>> = {
  portal: 'Through the letters',
  direct: 'Straight in',
}

export const SettingsPage = () => {
  const theme = useSettingsStore((state) => state.preferences.theme)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const opening = useSettingsStore((state) => state.preferences.opening)
  const setOpening = useSettingsStore((state) => state.setOpening)

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
          Classic Milk is the default. The same themes are in the palette in the
          top bar, on every page.
        </p>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>The front page</legend>

        <div className={styles.options}>
          {OPENINGS.map((option) => (
            <Button
              key={option}
              selected={opening === option}
              onClick={() => {
                void setOpening(option)
              }}
            >
              {OPENING_LABELS[option]}
            </Button>
          ))}
        </div>

        <p className={styles.hint}>
          The front page opens with the name, and scrolling carries you into one of
          its letters, past what the application is for. Straight in skips it: the
          name, a line, and a button. Either way the top bar goes to a test from
          anywhere.
        </p>
      </fieldset>
    </Page>
  )
}

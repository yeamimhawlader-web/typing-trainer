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
 *
 * So are the two choices about the typing screen that are a matter of eyes
 * rather than of better and worse: what the words do at the end of a line, and
 * the shape of the caret. Both are in the toolbar's reach in the sense that
 * they change what a test looks like, and neither is in the toolbar, which is
 * for the choices a typist makes between one test and the next.
 */

import { CARETS, LINE_SCROLLS, OPENINGS, type Caret, type LineScroll, type Opening } from '@core/types'
import { GG_THEMES } from '@features/gg-ui/themes/themes.ts'
import { useSettingsStore } from '@features/settings/state/settings.store.ts'
import { Button, Page } from '@shared/ui'

import styles from './SettingsPage.module.css'

const OPENING_LABELS: Readonly<Record<Opening, string>> = {
  portal: 'Through the letters',
  direct: 'Straight in',
}

const LINE_SCROLL_LABELS: Readonly<Record<LineScroll, string>> = {
  glide: 'Glide',
  instant: 'Jump',
}

const CARET_LABELS: Readonly<Record<Caret, string>> = {
  block: 'Block',
  bar: 'Bar',
}

export const SettingsPage = () => {
  const theme = useSettingsStore((state) => state.preferences.theme)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const opening = useSettingsStore((state) => state.preferences.opening)
  const setOpening = useSettingsStore((state) => state.setOpening)
  const lineScroll = useSettingsStore((state) => state.preferences.lineScroll)
  const setLineScroll = useSettingsStore((state) => state.setLineScroll)
  const caret = useSettingsStore((state) => state.preferences.caret)
  const setCaret = useSettingsStore((state) => state.setCaret)

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
        <legend className={styles.legend}>The end of a line</legend>

        <div className={styles.options}>
          {LINE_SCROLLS.map((option) => (
            <Button
              key={option}
              selected={lineScroll === option}
              onClick={() => {
                void setLineScroll(option)
              }}
            >
              {LINE_SCROLL_LABELS[option]}
            </Button>
          ))}
        </div>

        <p className={styles.hint}>
          Finishing a line moves the words up by one. Glide travels there, so the
          eye can follow it; Jump is there on the next frame. Either way the caret
          is cut to the start of the new line rather than slid back along the old
          one. If your system asks for reduced motion, it jumps whatever is chosen
          here.
        </p>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>The caret</legend>

        <div className={styles.options}>
          {CARETS.map((option) => (
            <Button
              key={option}
              selected={caret === option}
              onClick={() => {
                void setCaret(option)
              }}
            >
              {CARET_LABELS[option]}
            </Button>
          ))}
        </div>

        <p className={styles.hint}>
          Block is a tinted square over the character you are about to type; the
          letter reads through it, but it is over it. Bar is a thin rule at that
          character's leading edge, which is what most typing tests draw and what
          covers nothing.
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

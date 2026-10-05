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
 * So is everything about how the typing screen looks rather than what the test
 * is: the typeface, the text size, what the words do at the end of a line and
 * the shape of the caret. The toolbar on the typing screen is for the choices
 * a typist makes between one test and the next — how long, which words, with
 * punctuation or without. How it is set is chosen once and then left, and both
 * of the typing tests this application is measured against keep that
 * separation: Monkeytype and 10fastfingers put the test's shape on the screen
 * and its appearance behind a settings page.
 */

import {
  CARETS,
  LINE_SCROLLS,
  OPENINGS,
  STREAM_FONTS,
  TEXT_SIZES,
  type Caret,
  type LineScroll,
  type Opening,
  type StreamFont,
  type TextSize,
} from '@core/types'
import { GG_THEMES } from '@features/gg-ui/themes/themes.ts'
import { useSettingsStore } from '@features/settings/state/settings.store.ts'
import { Button, Page } from '@shared/ui'

import styles from './SettingsPage.module.css'

const OPENING_LABELS: Readonly<Record<Opening, string>> = {
  portal: 'Through the letters',
  direct: 'Straight in',
}

/** Each typeface by the name it is published under, not by what it is for. */
const FONT_LABELS: Readonly<Record<StreamFont, string>> = {
  slab: 'Roboto Slab',
  mono: 'Geist Mono',
  sans: 'Inter',
  serif: 'Lora',
}

const SIZE_LABELS: Readonly<Record<TextSize, string>> = {
  xs: 'Extra small',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'Extra large',
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
  const font = useSettingsStore((state) => state.preferences.streamFont)
  const setFont = useSettingsStore((state) => state.setStreamFont)
  const size = useSettingsStore((state) => state.preferences.textSize)
  const setSize = useSettingsStore((state) => state.setTextSize)
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
        <legend className={styles.legend}>Typeface</legend>

        <div className={styles.options}>
          {STREAM_FONTS.map((option) => (
            <Button
              key={option}
              selected={font === option}
              onClick={() => {
                void setFont(option)
              }}
            >
              {FONT_LABELS[option]}
            </Button>
          ))}
        </div>

        <p className={styles.hint}>
          The face the words to type are set in. Roboto Slab is the default, and
          is what 10fastfingers sets the same words in; Geist Mono gives every
          letter the same width, which is what most typing tests use and what
          makes the caret travel the same distance on every keystroke.
        </p>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Text size</legend>

        <div className={styles.options}>
          {TEXT_SIZES.map((option) => (
            <Button
              key={option}
              selected={size === option}
              onClick={() => {
                void setSize(option)
              }}
            >
              {SIZE_LABELS[option]}
            </Button>
          ))}
        </div>

        <p className={styles.hint}>
          Smaller text shows more lines at once, larger text fewer; the block the
          words sit in keeps one height either way, so nothing below it moves.
          The line length stays at about sixty-five characters at every size.
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

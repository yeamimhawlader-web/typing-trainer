/**
 * The front page's opening: the name, and a way in — through a letter.
 *
 * HOVER, set large, is a window: its letters show what is inside, and scrolling
 * carries the camera into one of them until the page is inside it (Glyph
 * Portal, src/components/ui/glyph-portal.tsx). Inside is what the application
 * is for, and the way to start. Pointing at a letter before scrolling chooses
 * the one to go in by.
 *
 * The portal measures the letters' ink, so it is mounted only once their face —
 * Inter at its heaviest — has loaded: mounted with a face still on its way, it
 * holds still for good rather than let the ink move under the camera. So until
 * then the same words stand still — the name, what it is, the way in — and if
 * the face fails, or is slow past a few seconds, the portal is set in a face
 * every computer has instead. Wherever the portal cannot run at all (no layout,
 * no font loading), the still words are the opening.
 *
 * Colours are the page's own tokens, the portal's two swapped: the letters are
 * windows onto the ink colour, and inside, the page is ink with paper for text.
 *
 * ## No way in from the opening frame
 *
 * There is no button on the first screen. A button there is the whole page:
 * everyone presses it, nobody scrolls, and what the application actually does
 * is never seen. So the opening says the name and what it is for, and the way
 * on is the scroll — which arrives inside, where Hover Mode, the Syllable
 * Trainer and Golden Nuggets are named and the way in is waiting.
 *
 * Nobody is trapped by that. The top bar goes straight to a test from any
 * page; the foot of the opening keeps a plain link inside, which is also the
 * escape for a keyboard; and anyone who would rather not see it again can turn
 * the opening off in settings, which is what `opening: 'direct'` is — the same
 * still hero as a browser that cannot run the portal.
 */

import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'

import GlyphPortal, { type GlyphPortalStyle } from '@/components/ui/glyph-portal.tsx'
import { LiquidButton } from '@/components/ui/liquid-glass-button.tsx'
import { PRACTICE_PATH } from '@app/routes.ts'
import { appConfig } from '@config'
import { useSettingsStore } from '@features/settings/state/settings.store.ts'
import { cx } from '@shared/lib'

import '@fontsource-variable/inter/wght.css'
import styles from './HomeHero.module.css'

const WORD = 'HOVER'
const FACE = '"Inter Variable", "Inter", Arial, sans-serif'
/** Already on every computer, so never a face still loading. */
const FALLBACK_FACE = '"Arial Black", Arial, sans-serif'
const WEIGHT = 900
/** How long to wait for the face before setting the portal in the fallback instead. */
const FACE_WAIT_MS = 6000

/** Colourful keycaps, from Unsplash, seen through the letters and inside them. */
const INSIDE_PHOTO = 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=2000&q=70'

const PORTAL_COLOURS: GlyphPortalStyle = {
  '--gp-paper': 'var(--color-bg-base)',
  '--gp-ink': 'var(--color-text-primary)',
  '--gp-field': 'var(--color-text-primary)',
  '--gp-foreground': 'var(--color-bg-base)',
  fontFamily: 'var(--font-sans)',
}

const INSIDE: readonly { readonly name: string; readonly text: string }[] = [
  {
    name: 'Hover Mode',
    text: 'A word you miss lifts out of the line and stays there until you type it clean. You practise your mistakes instead of your strengths.',
  },
  {
    name: 'Syllable Trainer',
    text: 'The long words your hands lunge at, taken in a rhythm they can hold, until the whole word arrives in one piece.',
  },
  {
    name: 'Golden Nuggets',
    text: 'The words that keep getting away are kept, and brought back to you until they stop costing you speed.',
  },
  {
    name: 'Your own texts',
    text: 'Quotes, goals, and the words you actually use — ask your AI for them and practise those, because those are the ones you keep typing.',
  },
]

/**
 * How long after the camera lands a block waits its turn.
 *
 * The inside arrives as a sentence at a time rather than all at once, which is
 * how it is read. The delays are the only thing that varies, so they are handed
 * to CSS as a custom property instead of being animated from here.
 */
const delay = (ms: number): CSSProperties => ({ '--reveal-delay': `${ms}ms` }) as CSSProperties

/** Whether this browser can run the portal at all: layout observers and font loading. */
const portalCanRun = (): boolean =>
  typeof ResizeObserver !== 'undefined' &&
  typeof IntersectionObserver !== 'undefined' &&
  typeof document !== 'undefined' &&
  'fonts' in document

const Start = () => (
  <LiquidButton asChild size="xl">
    <Link to={PRACTICE_PATH}>Start practising</Link>
  </LiquidButton>
)

/** The same opening, standing still. */
const StillHero = () => (
  <header className={styles.still}>
    <h1 className={styles.stillTitle}>{appConfig.appName}</h1>
    <p className={styles.stillLede}>
      A practice environment built for deliberate, daily work on speed and accuracy.
    </p>
    <Start />
  </header>
)

export const HomeHero = () => {
  // The face, once it is ready to be measured; null until then.
  const [face, setFace] = useState<string | null>(null)
  const opening = useSettingsStore((state) => state.preferences.opening)
  const [canRun] = useState(portalCanRun)

  useEffect(() => {
    if (!canRun) return undefined
    let settled = false
    const finish = (value: string) => {
      if (settled) return
      settled = true
      setFace(value)
    }
    const timeout = window.setTimeout(() => finish(FALLBACK_FACE), FACE_WAIT_MS)
    document.fonts.load(`${WEIGHT} 100px "Inter Variable"`, WORD).then(
      (faces) => finish(faces.length > 0 ? FACE : FALLBACK_FACE),
      () => finish(FALLBACK_FACE),
    )
    return () => {
      settled = true
      window.clearTimeout(timeout)
    }
  }, [canRun])

  if (face === null || opening === 'direct') return <StillHero />

  return (
    <GlyphPortal
      word={WORD}
      fontFamily={face}
      fontWeight={WEIGHT}
      scrollLength={2.2}
      enterLabel="Skip inside"
      className={styles.portal ?? ''}
      style={PORTAL_COLOURS}
      background={<div className={styles.field} style={{ '--hero-photo': `url("${INSIDE_PHOTO}")` } as CSSProperties} />}
      front={
        <>
          <h1 className={styles.title}>{appConfig.appName}</h1>
          <p className={styles.support}>Practise where your hands slow down.</p>
        </>
      }
    >
      <div className={styles.inside}>
        <p className={cx(styles.eyebrow, styles.reveal)}>Why bother</p>

        <h2 className={cx(styles.insideTitle, styles.reveal)} style={delay(60)}>
          You think at the speed you type.
        </h2>

        <p className={cx(styles.lede, styles.reveal)} style={delay(120)}>
          Prompts, notes, messages, code, the reply you rewrite three times — the whole
          day goes through a keyboard now. Every word your hands fumble is a thought you
          have to think twice.
        </p>

        {/* Arithmetic the reader can check, with its assumption on the page:
            claims about hours saved are worth nothing if they cannot be. */}
        <p className={cx(styles.sum, styles.reveal)} style={delay(180)}>
          Three hours a day at a keyboard, at forty words a minute. Type at eighty and the
          same words take half as long — <strong>over five hundred hours a year</strong>,
          on your own arithmetic rather than ours.
        </p>

        <ol className={styles.features}>
          {INSIDE.map((item, index) => (
            <li key={item.name} className={cx(styles.feature, styles.reveal)} style={delay(240 + index * 90)}>
              <h3 className={styles.featureName}>
                <span className={styles.featureNumber}>{String(index + 1).padStart(2, '0')}</span>
                {item.name}
              </h3>
              <p className={styles.featureText}>{item.text}</p>
            </li>
          ))}
        </ol>

        <div className={styles.close}>
          <Link to={PRACTICE_PATH} className={styles.insideStart}>
            Start typing <span aria-hidden="true">→</span>
          </Link>
          <p className={cx(styles.terms, styles.reveal)} style={delay(760)}>
            No account, nothing to install, and the first test is fifteen words long.
          </p>
        </div>
      </div>
    </GlyphPortal>
  )
}

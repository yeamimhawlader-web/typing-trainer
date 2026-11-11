/**
 * How the Syllable Trainer works, said once and then put away.
 *
 * The demonstration shows the technique; this says why it helps, with the
 * figures behind it. For each demonstration word, two bars on one scale: how
 * far the hands go when the word is typed as a single block, and how far the
 * longest stretch is when it is typed in its chunks. The keys are the same keys
 * either way — chunking shortens the longest run without a pause, not the word
 * — and the panel says that rather than implying more.
 *
 * What it claims is what can be shown: distances measured on the layout
 * (`@core/keyboard`), and the builder's own account of how he uses it. It does
 * not say the trainer is proven to make anyone faster; the rhythm read back
 * after each test is where a typist finds that out for themselves.
 *
 * Open the first time someone arrives, and from then on only when asked for:
 * that it has been seen is remembered in this browser.
 */

import type { CSSProperties } from 'react'

import { chunkTravel, keyTravel } from '@core/keyboard'
import type { SyllableWord } from '@core/syllables'

import styles from './SyllableExplainer.module.css'

export interface SyllableExplainerProps {
  /** The demonstration's words, measured here as examples. */
  readonly words: readonly SyllableWord[]
  readonly onClose: () => void
  readonly id: string
}

export const SyllableExplainer = ({ words, onClose, id }: SyllableExplainerProps) => {
  const rows = words.map((entry) => ({
    entry,
    whole: keyTravel(entry.word),
    longest: chunkTravel(entry.syllables).longestRun,
  }))
  const scale = Math.max(1, ...rows.map((row) => row.whole))

  return (
    <section id={id} className={styles.panel} aria-label="How the Syllable Trainer works">
      <div className={styles.why}>
        <h2 className={styles.heading}>Why chunks work</h2>
        <p className={styles.text}>
          A long word typed as one block is a single long run across the keyboard, and one slip in the middle
          costs the rest of it. In chunks it is a few short runs your hands already know, with a breath between
          them to land the next.
        </p>
        <blockquote className={styles.note}>
          <p>This is how I train long words myself. My best ten-second burst is 177 wpm.</p>
          <footer>The creator</footer>
        </blockquote>
      </div>

      <div className={styles.measure}>
        <h2 className={styles.heading}>Measured on the keyboard</h2>
        <ul className={styles.rows}>
          {rows.map((row, index) => (
            <li key={row.entry.word} className={styles.row} style={{ '--gg-explain-order': index } as CSSProperties}>
              <span className={styles.word}>{row.entry.syllables.join('·')}</span>
              <span className={styles.bars} aria-hidden="true">
                <span className={styles.bar} data-kind="whole" style={{ '--gg-explain-size': row.whole / scale } as CSSProperties} />
                <span className={styles.bar} data-kind="chunk" style={{ '--gg-explain-size': row.longest / scale } as CSSProperties} />
              </span>
              <span className={styles.figures}>
                <span className="visually-hidden">As one block: </span>
                <span className={styles.figure}>{row.whole.toFixed(1)}</span>
                <span className="visually-hidden">; longest chunk: </span>
                <span className={styles.figure} data-kind="chunk">
                  {row.longest.toFixed(1)}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className={styles.legend}>
          <span className={styles.swatch} data-kind="whole" aria-hidden="true" /> one block
          <span className={styles.swatch} data-kind="chunk" aria-hidden="true" /> longest run in chunks
          <span className={styles.formula}>D(w) = Σ √(Δx² + Δy²)</span>
        </p>
        <p className={styles.small}>
          Key widths, centre to centre, on a staggered QWERTY layout. Distance is not difficulty or speed: the rhythm
          read back after each test is what shows whether it is working for you.
        </p>
      </div>

      <button type="button" className={styles.close} onClick={onClose}>
        Got it
      </button>
    </section>
  )
}

/**
 * Your rhythm: what a finished Syllable Trainer test says about the chunking.
 *
 * Two timings from the test's own keystrokes (`readRhythm`): the typical gap
 * between keys inside a syllable, and at a break between syllables — drawn as
 * two bars on one scale, so the difference is seen before it is read — and one
 * sentence saying what they show. Nothing is scored and nothing is compared
 * with anyone: it is this test, measured.
 */

import type { CSSProperties } from 'react'

import type { RhythmReading as Reading, RhythmVerdict } from '@core/syllables'

import styles from './RhythmReading.module.css'

const SAYS: Readonly<Record<RhythmVerdict, string>> = {
  chunked: 'You breathe at the breaks: the syllables are coming out as chunks.',
  emerging: 'The breaks are starting to show. Let each chunk land before the next one starts.',
  unbroken: 'Breaks and letters ran at one speed, so the words are still single blocks. Try a small pause at each dot.',
  'too-few': 'Too few syllable breaks were typed cleanly to read a rhythm. A longer test, or fewer corrections, will give one.',
}

const signed = (ms: number): string => `${ms > 0 ? '+' : ms < 0 ? '−' : '±'}${Math.abs(ms)} ms`

export interface RhythmReadingProps {
  readonly reading: Reading
}

export const RhythmReading = ({ reading }: RhythmReadingProps) => {
  const { within, breaks, differenceMs, verdict } = reading
  const longest = Math.max(within.medianMs ?? 0, breaks.medianMs ?? 0, 1)
  const share = (ms: number | null) => ({ '--gg-rhythm-share': (ms ?? 0) / longest }) as CSSProperties

  return (
    <section className={styles.card} aria-labelledby="rhythm-reading-title" data-verdict={verdict}>
      <h2 id="rhythm-reading-title" className={styles.title}>
        Your rhythm
      </h2>

      {verdict !== 'too-few' && (
        <dl className={styles.timings}>
          <div className={styles.timing}>
            <dt>Inside a syllable</dt>
            <dd>
              <span className={styles.bar} style={share(within.medianMs)} aria-hidden="true" />
              <span className={styles.value}>{within.medianMs} ms</span>
            </dd>
          </div>
          <div className={styles.timing} data-break="">
            <dt>At a break</dt>
            <dd>
              <span className={styles.bar} style={share(breaks.medianMs)} aria-hidden="true" />
              <span className={styles.value}>{breaks.medianMs} ms</span>
              {differenceMs !== null && <span className={styles.difference}>{signed(differenceMs)}</span>}
            </dd>
          </div>
        </dl>
      )}

      <p className={styles.says}>{SAYS[verdict]}</p>
    </section>
  )
}

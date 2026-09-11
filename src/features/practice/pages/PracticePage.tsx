/**
 * Practice page — the mount point for the typing engine.
 *
 * It is intentionally inert. When the engine lands, this page subscribes to an
 * engine snapshot and renders it; the keystroke handling, scoring and timing
 * stay behind the `@core/engine` boundary and never move into this file.
 *
 * What is rendered below is a static specimen of the four character states. It
 * exists to verify that the typing design tokens are legible against the real
 * background before any logic depends on them. It contains no typing logic and
 * is replaced by the engine-driven surface in the next task.
 */

import { Page } from '@shared/ui'

import styles from './PracticePage.module.css'

export const PracticePage = () => (
  <Page
    title="Practice"
    description="The typing surface will render here, driven by the engine."
  >
    <section className={styles.surface} aria-labelledby="specimen-heading">
      <h2 id="specimen-heading" className="visually-hidden">
        Character state specimen
      </h2>

      <p className={styles.specimen}>
        <span className={styles.correct}>The quick brown </span>
        <span className={styles.incorrect}>f</span>
        <span className={styles.corrected}>o</span>
        <span className={styles.caret} />
        <span className={styles.pending}>x jumps over the lazy dog.</span>
      </p>

      <ul className={styles.legend} role="list">
        <li>
          <span className={styles.correct}>■</span> correct
        </li>
        <li>
          <span className={styles.incorrect}>■</span> incorrect
        </li>
        <li>
          <span className={styles.corrected}>■</span> corrected
        </li>
        <li>
          <span className={styles.pending}>■</span> pending
        </li>
      </ul>
    </section>
  </Page>
)

/**
 * The practice page.
 *
 * Deliberately bare. The typing test is the screen — a heading, a description
 * and a card around it would all be furniture competing with the text the
 * typist is supposed to be reading.
 */

import { TypingTest } from '@features/typing'

import styles from './PracticePage.module.css'

export const PracticePage = () => (
  <div className={styles.page}>
    <h1 className="visually-hidden">Typing practice</h1>
    <TypingTest />
  </div>
)

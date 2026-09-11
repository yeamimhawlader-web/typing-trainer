/**
 * The typing test screen.
 *
 * This component renders once per test, not once per keystroke. It holds only
 * the target text and the word count — things that change when a test is
 * loaded — while everything that moves as you type is subscribed to further
 * down the tree, close to the pixels it affects.
 */

import { useMemo } from 'react'

import { toCharacters, type TypingEngine } from '@core/engine'
import { createCommonWordsProvider } from '@core/text'

import { LiveStats } from './components/LiveStats.tsx'
import { ProgressBar } from './components/ProgressBar.tsx'
import { TestConfig } from './components/TestConfig.tsx'
import { TypingSurface } from './components/TypingSurface.tsx'
import { useEngineValue } from './hooks/useEngineValue.ts'
import { useTypingSession } from './hooks/useTypingSession.ts'

import styles from './TypingTest.module.css'

/** Subscribes to status alone, so the hint line does not hold up the tree. */
const SessionHint = ({ engine }: { engine: TypingEngine }) => {
  const status = useEngineValue(engine, (snapshot) => snapshot.status)

  if (status === 'completed') {
    return (
      <p className={styles.hint}>
        <span className={styles.complete}>Test complete.</span>{' '}
        <kbd className={styles.key}>Tab</kbd> for a new test.
      </p>
    )
  }

  if (status === 'running') {
    return (
      <p className={styles.hint}>
        <kbd className={styles.key}>Tab</kbd> to restart.
      </p>
    )
  }

  return (
    <p className={styles.hint}>
      Start typing to begin. <kbd className={styles.key}>Tab</kbd> to restart.
    </p>
  )
}

export const TypingTest = () => {
  // One provider for the life of the screen. Swapping in quotes or pasted text
  // later is a change here and nowhere else.
  const provider = useMemo(() => createCommonWordsProvider(), [])
  const { engine, target, wordCount, setWordCount, restart } =
    useTypingSession(provider)

  const characters = useMemo(() => toCharacters(target.text), [target])

  return (
    <section className={styles.test} aria-label="Typing test">
      <div className={styles.controls}>
        <TestConfig
          wordCount={wordCount}
          onWordCountChange={setWordCount}
          onRestart={restart}
        />
        <LiveStats engine={engine} />
      </div>

      <ProgressBar engine={engine} total={characters.length} />

      <TypingSurface engine={engine} characters={characters} />

      <SessionHint engine={engine} />
    </section>
  )
}

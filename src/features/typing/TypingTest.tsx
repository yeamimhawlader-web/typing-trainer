/**
 * The typing test screen.
 *
 * This component renders once per test, not once per keystroke. It holds only
 * the target text and the word count — things that change when a test is
 * loaded — while everything that moves as you type is subscribed to further
 * down the tree, close to the pixels it affects.
 */

import { useMemo } from 'react'
import { Link } from 'react-router'

import { ROUTES } from '@app/routes.ts'
import { toCharacters, type TypingEngine } from '@core/engine'
import type { SessionService } from '@core/sessions'
import { createCommonWordsProvider, type TextProvider } from '@core/text'

import { LiveStats } from './components/LiveStats.tsx'
import { ProgressBar } from './components/ProgressBar.tsx'
import { TestConfig } from './components/TestConfig.tsx'
import { TypingSurface } from './components/TypingSurface.tsx'
import { useEngineValue } from './hooks/useEngineValue.ts'
import { useTypingSession, type SaveState } from './hooks/useTypingSession.ts'

import styles from './TypingTest.module.css'

interface SessionHintProps {
  readonly engine: TypingEngine
  readonly saveState: SaveState
}

/** Subscribes to status alone, so the hint line does not hold up the tree. */
const SessionHint = ({ engine, saveState }: SessionHintProps) => {
  const status = useEngineValue(engine, (snapshot) => snapshot.status)

  if (status === 'completed') {
    return (
      <p className={styles.hint}>
        <span className={styles.complete}>Test complete.</span>{' '}
        <kbd className={styles.key}>Tab</kbd> for a new test.{' '}
        {saveState === 'failed' ? (
          <span className={styles.warning}>Could not be saved.</span>
        ) : (
          <Link to={ROUTES.history} className={styles.link}>
            View history
          </Link>
        )}
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

  // No Tab hint here: while idle there is nothing to restart, and Tab is left
  // to move focus so the page stays navigable by keyboard.
  return <p className={styles.hint}>Start typing to begin.</p>
}

export interface TypingTestProps {
  /** Injectable for tests; defaults to the built-in word provider. */
  readonly provider?: TextProvider
  /** Injectable for tests; defaults to the application's session service. */
  readonly service?: SessionService
}

export const TypingTest = ({ provider, service }: TypingTestProps = {}) => {
  // One provider for the life of the screen. Swapping in quotes or pasted text
  // later is a change here and nowhere else.
  const fallbackProvider = useMemo(() => createCommonWordsProvider(), [])
  const { engine, target, wordCount, setWordCount, restart, saveState } =
    useTypingSession(provider ?? fallbackProvider, service)

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

      <SessionHint engine={engine} saveState={saveState} />
    </section>
  )
}

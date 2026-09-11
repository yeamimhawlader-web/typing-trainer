/**
 * The typing test screen.
 *
 * This component renders once per test, not once per keystroke. It holds only
 * the target text, the word count and the finished session — things that change
 * when a test is loaded or completed — while everything that moves as you type
 * is subscribed to further down the tree, close to the pixels it affects.
 */

import { useMemo } from 'react'

import { toCharacters, type TypingEngine } from '@core/engine'
import type { SessionService } from '@core/sessions'
import type { TelemetryService } from '@core/telemetry'
import { createCommonWordsProvider, type TextProvider } from '@core/text'

import { LiveStats } from './components/LiveStats.tsx'
import { ProgressBar } from './components/ProgressBar.tsx'
import { TestConfig } from './components/TestConfig.tsx'
import { TestResult } from './components/TestResult.tsx'
import { TypingSurface } from './components/TypingSurface.tsx'
import { useEngineValue } from './hooks/useEngineValue.ts'
import { useTypingSession } from './hooks/useTypingSession.ts'

import styles from './TypingTest.module.css'

/** Subscribes to status alone, so the hint line does not hold up the tree. */
const SessionHint = ({ engine }: { engine: TypingEngine }) => {
  const status = useEngineValue(engine, (snapshot) => snapshot.status)

  // Once a test is finished the results panel carries the instructions, so this
  // line gets out of the way rather than repeating them.
  if (status === 'completed') return null

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
  /** Injectable for tests; defaults to the application's telemetry service. */
  readonly telemetry?: TelemetryService
}

export const TypingTest = ({ provider, service, telemetry }: TypingTestProps = {}) => {
  // One provider for the life of the screen. Swapping in quotes or pasted text
  // later is a change here and nowhere else.
  const fallbackProvider = useMemo(() => createCommonWordsProvider(), [])
  const { engine, target, wordCount, setWordCount, restart, lastSession, saveState } =
    useTypingSession(provider ?? fallbackProvider, service, telemetry)

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

      {lastSession !== null && (
        <TestResult session={lastSession} saveState={saveState} onTryAgain={restart} />
      )}
    </section>
  )
}

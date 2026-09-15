/**
 * The typing test screen.
 *
 * This component renders once per test, not once per keystroke. It holds only
 * the target text, the word count and the finished session — things that change
 * when a test is loaded or completed — while everything that moves as you type
 * is subscribed to further down the tree, close to the pixels it affects.
 */

import { useMemo } from 'react'

import { toCharacters } from '@core/engine'

import { LiveStats } from './components/LiveStats.tsx'
import { ProgressBar } from './components/ProgressBar.tsx'
import { ResultAnnouncement } from './components/ResultAnnouncement.tsx'
import { SessionHint } from './components/SessionHint.tsx'
import { TestConfig } from './components/TestConfig.tsx'
import { TestResult } from './components/TestResult.tsx'
import { TypingSurface } from './components/TypingSurface.tsx'
import { useKeyboardInput } from './hooks/useKeyboardInput.ts'
import { useTypingScreen, type TypingScreenOptions } from './hooks/useTypingScreen.ts'

import styles from './TypingTest.module.css'

export type { DrillSettings } from './hooks/useTypingScreen.ts'

export type TypingTestProps = TypingScreenOptions

export const TypingTest = (props: TypingTestProps = {}) => {
  const screen = useTypingScreen(props)
  const {
    engine,
    target,
    wordCount,
    setWordCount,
    restart,
    lastSession,
    saveState,
    resultSequences,
    drillSequence,
    drillResult,
  } = screen

  // Keys pressed anywhere on the page. GG.Typing reads its text field instead;
  // both feed the same session commands.
  useKeyboardInput(screen)

  const characters = useMemo(() => toCharacters(target.text), [target])

  return (
    <section className={styles.test} aria-label="Typing test">
      <div className={styles.controls}>
        <TestConfig
          wordCount={wordCount}
          onWordCountChange={setWordCount}
          onRestart={restart}
          drillSequence={drillSequence}
        />
        <LiveStats engine={engine} />
      </div>

      <ProgressBar engine={engine} total={characters.length} />

      <TypingSurface engine={engine} characters={characters} />

      <SessionHint engine={engine} />

      {/* Shown only where the primary pointer is a finger and nothing hovers —
          a phone or a tablet without a keyboard — by CSS, so it costs the
          typing screen no state. See the input note in useTypingSession. */}
      <p className={styles.touchNote}>
        Typing here needs a physical keyboard. On-screen keyboards are not supported.
      </p>

      <ResultAnnouncement session={lastSession} saveState={saveState} />

      {lastSession !== null && (
        <TestResult
          session={lastSession}
          saveState={saveState}
          onTryAgain={restart}
          sequences={resultSequences}
          drill={drillResult}
        />
      )}
    </section>
  )
}

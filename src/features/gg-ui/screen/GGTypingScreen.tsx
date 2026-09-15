/**
 * The GG.Typing typing screen: control row, toolbar, word stream and input,
 * over the application's real typing session.
 *
 * It is a presentation of `useTypingScreen`, the same composition the classic
 * screen renders — one engine, one clock, one save of the session and its
 * telemetry, one drill comparison. What differs is only how it looks and where
 * keys come from: GG.Typing reads its text field, the classic screen the whole
 * window. Nothing here measures, scores or stores anything.
 *
 * Like the classic screen it renders once per test, not once per keystroke:
 * everything that moves while typing subscribes to the engine further down.
 *
 * The result is the application's own result panel, below the input — the same
 * record that went to storage, so what is shown here and what history shows
 * are one set of numbers.
 */

import { useCallback, useEffect, useMemo, useRef, type MouseEvent } from 'react'

import { PRACTICE_PATH } from '@app/routes.ts'
import { computeWordRanges, toCharacters } from '@core/engine'
import { useSettingsStore } from '@features/settings/state/settings.store.ts'
import {
  ResultAnnouncement,
  SessionHint,
  TestResult,
  useTypingScreen,
  type TypingScreenOptions,
  type WordCount,
} from '@features/typing'

import { ControlRow } from '../components/ControlRow/ControlRow.tsx'
import { InputField } from '../components/InputField/InputField.tsx'
import { Toolbar } from '../components/Toolbar/Toolbar.tsx'
import { WordStream } from '../components/WordStream/WordStream.tsx'

import styles from './GGTypingScreen.module.css'

export interface GGTypingScreenProps extends TypingScreenOptions {
  /** The page's heading, for assistive technology. */
  readonly heading: string
}

export const GGTypingScreen = ({ heading, ...options }: GGTypingScreenProps) => {
  const screen = useTypingScreen(options)
  const {
    engine,
    target,
    provider,
    wordCount,
    setWordCount,
    restart,
    inputKey,
    deleteWord,
    lastSession,
    saveState,
    resultSequences,
    drillSequence,
    drillResult,
  } = screen

  const wordTotal = useMemo(() => computeWordRanges(toCharacters(target.text)).length, [target])

  const size = useSettingsStore((state) => state.preferences.textSize)
  const setSize = useSettingsStore((state) => state.setTextSize)

  const input = useRef<HTMLTextAreaElement>(null)
  const focusInput = useCallback(() => {
    input.current?.focus({ preventScroll: true })
  }, [])

  // Ready to type on arrival.
  useEffect(() => {
    focusInput()
  }, [focusInput])

  const restartTest = useCallback(() => {
    restart()
    focusInput()
  }, [focusInput, restart])

  const changeSize = useCallback(
    (next: typeof size) => {
      void setSize(next)
    },
    [setSize],
  )

  const changeWordCount = useCallback((count: WordCount) => setWordCount(count), [setWordCount])

  // A pointer click on a control means the typist is about to type again. A
  // click the keyboard produced (detail 0) leaves focus where it is, so arrow
  // keys keep moving through the group.
  const returnFocusAfterClick = (event: MouseEvent) => {
    if (event.detail > 0) focusInput()
  }

  return (
    <>
      <h1 className="visually-hidden">{heading}</h1>

      <ControlRow engine={engine} source={provider.label} words={wordTotal} onRestart={restartTest} />

      <div onClick={returnFocusAfterClick}>
        <Toolbar
          size={size}
          onSizeChange={changeSize}
          wordCount={drillSequence === null ? wordCount : null}
          onWordCountChange={changeWordCount}
        />
      </div>

      <div className={styles.stream}>
        <WordStream engine={engine} text={target.text} size={size} onActivate={focusInput} />
      </div>

      <InputField ref={input} engine={engine} inputKey={inputKey} deleteWord={deleteWord} restart={restartTest} />

      <div className={styles.hint}>
        <SessionHint engine={engine} />
      </div>

      {/* Shown only where the primary pointer is a finger and nothing hovers,
          by CSS. The field takes what an on-screen keyboard sends, but input
          methods that compose, correct or predict are not counted faithfully,
          so they are not offered as supported. */}
      <p className={styles.touchNote}>
        Typing here needs a physical keyboard. On-screen keyboards are not supported.
      </p>

      <ResultAnnouncement session={lastSession} saveState={saveState} />

      {lastSession !== null && (
        <div className={styles.result}>
          <TestResult
            session={lastSession}
            saveState={saveState}
            onTryAgain={restartTest}
            sequences={resultSequences}
            drill={drillResult}
            practicePath={PRACTICE_PATH}
          />
        </div>
      )}
    </>
  )
}

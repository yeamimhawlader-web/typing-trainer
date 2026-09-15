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
 *
 * ## Hover Mode
 *
 * The same screen, with Hover Mode's controller between the field and the
 * session: keys go to the text, or to the focused word's repetitions, and the
 * session saves the test as Hover Mode with its focus records. The controller
 * lives for the life of the screen, like the session.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'

import { PRACTICE_PATH } from '@app/routes.ts'
import { computeWordRanges, toCharacters } from '@core/engine'
import type { Timestamp } from '@core/types'
import { createHoverController } from '@features/ggtyping'
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
import { Toolbar, type GGMode } from '../components/Toolbar/Toolbar.tsx'
import { WordStream } from '../components/WordStream/WordStream.tsx'
import { HoverHint } from './HoverHint.tsx'

import styles from './GGTypingScreen.module.css'

export interface GGTypingScreenProps extends Omit<TypingScreenOptions, 'training'> {
  /** The page's heading, for assistive technology. */
  readonly heading: string
  /** Which mode this screen is. Read once. Standard when absent. */
  readonly mode?: GGMode
}

export const GGTypingScreen = ({ heading, mode = 'standard', ...options }: GGTypingScreenProps) => {
  const [hover] = useState(() => (mode === 'hover' ? createHoverController() : null))
  const training = useMemo(() => (hover === null ? undefined : { mode: 'hover' as const, hooks: hover }), [hover])
  const screen = useTypingScreen({ ...options, training })
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

  useEffect(() => hover?.connect(engine), [engine, hover])

  // Keys reach the session through Hover Mode when it is on, and directly when not.
  const typeKey = useCallback(
    (key: string, at: Timestamp) => (hover === null ? inputKey(key, at) : hover.inputKey(key, at, inputKey)),
    [hover, inputKey],
  )
  const removeWord = useCallback(
    (at: Timestamp) => (hover === null ? deleteWord(at) : hover.deleteWord(at, deleteWord)),
    [deleteWord, hover],
  )

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

      <ControlRow
        engine={engine}
        source={hover === null ? provider.label : 'Hover Mode'}
        description={hover === null ? undefined : 'Target mistakes and repeat them'}
        words={wordTotal}
        onRestart={restartTest}
      />

      <div onClick={returnFocusAfterClick}>
        <Toolbar
          mode={drillSequence === null ? mode : null}
          size={size}
          onSizeChange={changeSize}
          wordCount={drillSequence === null ? wordCount : null}
          onWordCountChange={changeWordCount}
        />
      </div>

      <div className={styles.stream}>
        <WordStream
          engine={engine}
          text={target.text}
          size={size}
          onActivate={focusInput}
          hover={hover ?? undefined}
        />
      </div>

      <InputField ref={input} engine={engine} inputKey={typeKey} deleteWord={removeWord} restart={restartTest} />

      <div className={styles.hint}>
        {hover === null ? <SessionHint engine={engine} /> : <HoverHint engine={engine} hover={hover} />}
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

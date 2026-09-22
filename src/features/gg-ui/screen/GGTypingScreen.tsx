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
 *
 * ## Sound
 *
 * The shell's sound engine, switched on and off from the control row here, is
 * connected to the session's own events and Hover Mode's own signals. Neither
 * knows about it, and a keystroke does no extra work for it.
 *
 * ## The Syllable Trainer
 *
 * The same screen again, with a different text and one more layer over it: its
 * words come from the syllable corpus, the stream draws each as the syllables it
 * is typed in, and the page opens with what the trainer is and a demonstration
 * of it. The engine, the keys, the score and the save are ordinary practice's;
 * the test is saved as the Syllable Trainer so it can be told apart.
 *
 * ## Focus while typing
 *
 * From the first key of a test to its end, the shell's chrome steps back (see
 * layout/typing-focus.ts): the toolbar, the hints and the trainer's opening fade,
 * and the words, the field, the live figures and Hover Mode's own guidance stay.
 * One boolean is compared per keystroke; the page changes only when it flips.
 *
 * ## Pace
 *
 * A pace caret runs through the words at one of the typist's own speeds when one
 * is chosen. The speeds are read from history on arrival and after each saved
 * test; the caret keeps the test's own time and is drawn by the stream.
 *
 * Hover Mode's difficulty is the page's to choose. A change starts a new test, so a test
 * is always typed, repeated and saved at one difficulty. Every focus that ends is
 * handed to Golden Nuggets as it ends, and the way there is on this screen,
 * not in the top bar: Golden Nuggets belong to Hover Mode.
 */

import { useCallback, useContext, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router'

import { PRACTICE_PATH, ROUTES } from '@app/routes.ts'
import { computeWordRanges, toCharacters } from '@core/engine'
import { goldenNuggetService, type GoldenNuggetService } from '@core/nuggets'
import { DEFAULT_SESSION_CONTEXT, difficultyOf, sessionService } from '@core/sessions'
import { paceFor } from '@core/statistics'
import { layoutSyllables, readRhythm, type RhythmReading as Reading } from '@core/syllables'
import { createCommonWordsProvider, createSyllableWordsProvider } from '@core/text'
import type { HoverDifficulty, PaceChoice, Timestamp } from '@core/types'
import { createHoverController, keepTroublesomeWords, newTestId, recordGoldenNuggets } from '@features/ggtyping'
import { createTimedMode, SYLLABLE_MODE } from '@features/typing'
import { useSettingsStore } from '@features/settings/state/settings.store.ts'
import { playHoverSounds, playTypingSounds, useSound } from '@features/sound'
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
import { RhythmReading } from '../components/SyllableTrainer/RhythmReading.tsx'
import { SyllableIntro } from '../components/SyllableTrainer/SyllableIntro.tsx'
import { Toolbar, type GGMode } from '../components/Toolbar/Toolbar.tsx'
import { WordStream } from '../components/WordStream/WordStream.tsx'
import { TypingFocusContext } from '../layout/typing-focus.ts'
import { HoverHint } from './HoverHint.tsx'
import { usePaceTargets } from './usePaceTargets.ts'

import styles from './GGTypingScreen.module.css'

export interface GGTypingScreenProps extends Omit<TypingScreenOptions, 'training'> {
  /** The page's heading, for assistive technology. */
  readonly heading: string
  /** Which mode this screen is. Read once. Standard when absent. */
  readonly mode?: GGMode
  /** Hover Mode's difficulty. Standard when absent. */
  readonly hoverDifficulty?: HoverDifficulty
  /** Called with a newly chosen difficulty, to remember it. */
  readonly onHoverDifficultyChange?: (difficulty: HoverDifficulty) => void
  /** Injectable for tests; defaults to the application's Golden Nuggets. */
  readonly goldenNuggets?: GoldenNuggetService
  /** What Hover Mode is running over, said beside its name. */
  readonly hoverDescription?: string
  /**
   * The text is the test — one of the typist's own passages — so its length is
   * not a choice and the length control is not offered.
   */
  readonly fixedText?: boolean
}

export const GGTypingScreen = ({
  heading,
  mode = 'standard',
  hoverDifficulty = 'standard',
  onHoverDifficultyChange,
  goldenNuggets = goldenNuggetService,
  hoverDescription = 'Target mistakes and repeat them',
  fixedText = false,
  ...options
}: GGTypingScreenProps) => {
  const [hover] = useState(() => (mode === 'hover' ? createHoverController({ difficulty: hoverDifficulty }) : null))
  const syllable = mode === 'syllable'
  // The trainer's own words, unless a test hands the screen a provider of its own.
  const [syllableProvider] = useState(() => (syllable ? createSyllableWordsProvider() : undefined))

  /*
   * What ends an ordinary test: its word count, or the clock. Hover Mode and
   * drills bring their own rule, so the choice is only offered — and only
   * applied — where neither does.
   */
  const practiceMode = useSettingsStore((state) => state.preferences.practiceMode)
  const practiceSeconds = useSettingsStore((state) => state.preferences.practiceSeconds)
  const timed = mode === 'standard' && (options.drill ?? null) === null && practiceMode === 'time'
  const timedMode = useMemo(() => (timed ? createTimedMode(practiceSeconds) : null), [timed, practiceSeconds])

  const training = useMemo(
    () =>
      hover !== null
        ? { mode: 'hover' as const, hooks: hover }
        : syllable
          ? { mode: 'syllable' as const, hooks: SYLLABLE_MODE }
          : timedMode !== null
            ? { mode: 'time' as const, hooks: timedMode }
            : undefined,
    [hover, syllable, timedMode],
  )
  /*
   * Punctuation and numbers dress ordinary practice's words — words or time,
   * not a drill, Hover Mode or a trainer, whose text is theirs. A change is new
   * material, so the test starts again on it.
   */
  const dressable = mode === 'standard' && (options.drill ?? null) === null
  const punctuation = useSettingsStore((state) => state.preferences.punctuation) && dressable
  const numbers = useSettingsStore((state) => state.preferences.numbers) && dressable
  // The vocabulary is ordinary practice's too: Normal, or Advanced's wider words.
  const chosenVocabulary = useSettingsStore((state) => state.preferences.vocabulary)
  const vocabulary = dressable ? chosenVocabulary : 'normal'
  const dressedProvider = useMemo(
    () =>
      punctuation || numbers || vocabulary === 'advanced'
        ? createCommonWordsProvider({ punctuation, numbers, vocabulary })
        : undefined,
    [numbers, punctuation, vocabulary],
  )
  const setPunctuation = useSettingsStore((state) => state.setPunctuation)
  const setNumbers = useSettingsStore((state) => state.setNumbers)
  const setVocabulary = useSettingsStore((state) => state.setVocabulary)

  const screen = useTypingScreen({
    ...options,
    provider: options.provider ?? syllableProvider ?? dressedProvider,
    training,
    difficulty: difficultyOf({ punctuation, numbers }),
    textKey: `${punctuation ? 'p' : ''}${numbers ? 'n' : ''}${vocabulary === 'advanced' ? 'a' : ''}`,
  })
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
    resultShape,
    drillSequence,
    drillResult,
  } = screen

  const wordTotal = useMemo(() => computeWordRanges(toCharacters(target.text)).length, [target])
  // Where every word's syllables are: worked out once per text, never per key.
  const syllables = useMemo(() => (syllable ? layoutSyllables(target.text) : undefined), [syllable, target])

  // The Syllable Trainer's reading of the rhythm: taken from the finished test's
  // own keystrokes, once, as it ends, and gone when the next one starts.
  const [rhythm, setRhythm] = useState<Reading | null>(null)
  useEffect(
    () =>
      syllable
        ? engine.on((event) => {
            if (event.type === 'finished' && event.status === 'completed') {
              setRhythm(readRhythm(event.result.keystrokes, event.result.target.text))
            } else if (event.type === 'started' || event.type === 'reset') {
              setRhythm(null)
            }
          })
        : undefined,
    [engine, syllable],
  )

  useEffect(() => hover?.connect(engine), [engine, hover])

  // The chrome steps back while a test is typed, and comes back when it ends.
  const typingFocus = useContext(TypingFocusContext)
  useEffect(() => {
    if (typingFocus === null) return undefined
    const stop = engine.on((event) => {
      if (event.type === 'keystroke') typingFocus.typing(true)
      else if (event.type === 'finished' || event.type === 'reset') typingFocus.typing(false)
    })
    return () => {
      stop()
      typingFocus.typing(false)
    }
  }, [engine, typingFocus])

  // Sound listens to what the session and Hover Mode already announce. With
  // sound off every call is a no-op, so nothing is conditional here.
  const sound = useSound()
  useEffect(() => (sound === null ? undefined : playTypingSounds(engine, sound)), [engine, sound])
  // Repetitions are typed through Hover Mode's own engine, so keys sound like
  // keys there too; its moments are the controller's signals on top of that.
  useEffect(
    () => (sound === null || hover === null ? undefined : playTypingSounds(hover.attempt, sound)),
    [hover, sound],
  )
  useEffect(() => (sound === null || hover === null ? undefined : playHoverSounds(hover, sound)), [hover, sound])

  useEffect(
    () =>
      hover === null
        ? undefined
        : recordGoldenNuggets(hover, goldenNuggets, { language: DEFAULT_SESSION_CONTEXT.language }),
    [goldenNuggets, hover],
  )

  /*
   * A word that keeps costing mistakes is kept: five of them in one test make it
   * a Golden Nugget. One write, at the moment a word crosses the line, and never
   * while typing otherwise.
   *
   * Not in Hover Mode: there, every mistake on a focused word is already counted
   * by the focus itself, and counting it twice would say the word cost twice
   * what it did.
   */
  // One id per test, so a word kept twice in the same test is one record.
  const testId = useRef(newTestId())
  useEffect(
    () =>
      engine.on((event) => {
        if (event.type === 'started') testId.current = newTestId()
      }),
    [engine],
  )
  const currentTestId = useCallback(() => testId.current, [])
  useEffect(
    () =>
      hover !== null
        ? undefined
        : keepTroublesomeWords(engine, goldenNuggets, {
            language: DEFAULT_SESSION_CONTEXT.language,
            testId: currentTestId,
          }),
    [currentTestId, engine, goldenNuggets, hover],
  )

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
  const font = useSettingsStore((state) => state.preferences.streamFont)
  const setFont = useSettingsStore((state) => state.setStreamFont)
  const setPracticeMode = useSettingsStore((state) => state.setPracticeMode)
  const setPracticeSeconds = useSettingsStore((state) => state.setPracticeSeconds)

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

  const changeWordCount = useCallback(
    (count: WordCount) => {
      // Only ordinary practice has words and time to choose between: the
      // Syllable Trainer's length leaves that choice where it was.
      if (!syllable) void setPracticeMode('words')
      setWordCount(count)
    },
    [setPracticeMode, setWordCount, syllable],
  )

  // A time is a different shape of test: the engine's clock rule changes with
  // it, so the test starts again rather than carrying on under new rules.
  const changeTime = useCallback(
    (seconds: number) => {
      void setPracticeMode('time')
      void setPracticeSeconds(seconds)
    },
    [setPracticeMode, setPracticeSeconds],
  )

  // A new difficulty starts a new test, typed at it from the first key.
  const changeHoverDifficulty = useCallback(
    (next: HoverDifficulty) => {
      hover?.setDifficulty(next)
      onHoverDifficultyChange?.(next)
      restart()
    },
    [hover, onHoverDifficultyChange, restart],
  )
  // Outside Hover Mode the branches are only ever seen folding away, showing the
  // difficulty last chosen.
  const rememberedDifficulty = useSettingsStore((state) => state.preferences.hoverDifficulty)

  const soundChoice = useSettingsStore((state) => state.preferences.sound)
  const setSound = useSettingsStore((state) => state.setSound)
  const changeSound = useCallback(
    (next: string) => {
      void setSound(next)
    },
    [setSound],
  )
  // The pace caret: the choice, the typist's speeds, and the one it keeps now.
  const paceChoice = useSettingsStore((state) => state.preferences.pace)
  const setPace = useSettingsStore((state) => state.setPace)
  const changePace = useCallback(
    (next: PaceChoice) => {
      void setPace(next)
    },
    [setPace],
  )
  const paceTargets = usePaceTargets(
    options.service ?? sessionService,
    saveState === 'saved' ? (lastSession?.id ?? null) : null,
  )
  const paceWpm = paceFor(paceChoice, paceTargets)

  const soundVolume = useSettingsStore((state) => state.preferences.soundVolume)
  const setSoundVolume = useSettingsStore((state) => state.setSoundVolume)
  const changeSoundVolume = useCallback(
    (next: number) => {
      void setSoundVolume(next)
    },
    [setSoundVolume],
  )

  /*
   * A pointer click on a control means the typist is about to type again, so
   * focus goes back to the field. Two exceptions: a click the keyboard produced
   * (detail 0), which leaves focus where it is so arrow keys keep moving through
   * a group, and a control that is itself typed into or dragged — the custom
   * time, the volume — which keeps the focus it was just given.
   */
  const KEEPS_FOCUS = 'input:not([type="radio"]):not([type="checkbox"]), textarea, [contenteditable="true"]'
  const returnFocusAfterClick = (event: MouseEvent) => {
    if (event.detail === 0) return
    if ((event.target as HTMLElement | null)?.closest(KEEPS_FOCUS) !== null) return
    focusInput()
  }

  return (
    <>
      {/* The trainer's heading is on the page, in its opening; elsewhere it is for assistive technology. */}
      {!syllable && <h1 className="visually-hidden">{heading}</h1>}

      <ControlRow
        engine={engine}
        source={hover === null ? provider.label : 'Hover Mode'}
        description={hover === null ? undefined : hoverDescription}
        words={timed ? null : wordTotal}
        limitSeconds={timed ? practiceSeconds : null}
        onRestart={restartTest}
      />

      <div onClick={returnFocusAfterClick} data-recede="">
        <Toolbar
          mode={drillSequence === null ? mode : null}
          hoverDifficulty={hover === null ? rememberedDifficulty : hoverDifficulty}
          onHoverDifficultyChange={hover === null ? undefined : changeHoverDifficulty}
          size={size}
          onSizeChange={changeSize}
          font={font}
          onFontChange={(next) => {
            void setFont(next)
            focusInput()
          }}
          shape={
            drillSequence === null && hover === null && !fixedText
              ? {
                  mode: practiceMode,
                  words: wordCount,
                  seconds: practiceSeconds,
                  onWords: changeWordCount,
                  onTime: changeTime,
                  // Only ordinary practice runs on the clock (see `timed`);
                  // offering a time anywhere else would change nothing.
                  timeOffered: mode === 'standard',
                }
              : null
          }
          sound={soundChoice}
          onSoundChange={changeSound}
          soundVolume={soundVolume}
          onSoundVolumeChange={changeSoundVolume}
          dress={
            dressable && drillSequence === null
              ? {
                  punctuation,
                  numbers,
                  onPunctuation: (on) => {
                    void setPunctuation(on)
                  },
                  onNumbers: (on) => {
                    void setNumbers(on)
                  },
                  vocabulary,
                  onVocabulary: (next) => {
                    void setVocabulary(next)
                  },
                }
              : null
          }
          pace={paceChoice}
          onPaceChange={changePace}
          paceTargets={paceTargets}
          paceWpm={paceWpm}
        />
      </div>

      {syllable && <SyllableIntro engine={engine} />}

      <div className={styles.stream}>
        <WordStream
          engine={engine}
          text={target.text}
          size={size}
          font={font}
          onActivate={focusInput}
          hover={hover ?? undefined}
          syllables={syllables}
          pace={paceWpm}
        />
      </div>

      <InputField ref={input} engine={engine} inputKey={typeKey} deleteWord={removeWord} restart={restartTest} />

      {/* Hover Mode's hint is guidance while typing, so only ordinary practice's steps back. */}
      <div className={styles.hint} data-recede={hover === null ? '' : undefined}>
        {hover === null ? <SessionHint engine={engine} /> : <HoverHint engine={engine} hover={hover} />}
      </div>

      {hover !== null && (
        <p className={styles.nuggets} data-recede="">
          A word that does not clear is kept in{' '}
          <Link to={ROUTES.ggNuggets} className={styles.nuggetsLink}>
            Golden Nuggets
          </Link>
          .
        </p>
      )}

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
          {rhythm !== null && <RhythmReading reading={rhythm} />}
          <TestResult
            session={lastSession}
            saveState={saveState}
            onTryAgain={restartTest}
            sequences={resultSequences}
            shape={resultShape}
            drill={drillResult}
            practicePath={PRACTICE_PATH}
          />
        </div>
      )}
    </>
  )
}

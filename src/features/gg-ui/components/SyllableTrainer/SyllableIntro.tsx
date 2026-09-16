/**
 * The Syllable Trainer's opening: what it is, and a demonstration that shows
 * the technique rather than describing it.
 *
 * ## The demonstration
 *
 * A word is shown whole, comes apart into its syllables, and is typed one
 * syllable at a time — the letters of the one in hand arriving at a typing
 * pace, a breath between chunks, the finished chunk settling back — until the
 * word closes up again and the next one begins. Under the word, a rhythm line
 * marks the same thing as a timing: a bar for each syllable as it is typed, a
 * dot for each breath, and an arrow on to the next word. Beside it, four short
 * instructions light as the demonstration reaches each, so reading them and
 * watching it are the same two seconds.
 *
 * Every frame is a step of a timeline built once (`@core/syllables`); this only
 * moves from one step to the next and draws it. It plays twice by itself and
 * then rests on the first word laid out in its chunks, with a way to play it
 * again. It stops the moment a test starts — nothing moves up here while the
 * typist is typing — and with reduced motion it is only ever that resting
 * diagram, which says the same thing standing still.
 *
 * The drawing is for the eye. What it shows is also said in words, once, for
 * anyone not looking at it.
 */

import { Fragment, useEffect, useId, useState, type CSSProperties } from 'react'

import type { TypingEngine } from '@core/engine'
import {
  buildDemoTimeline,
  cueOf,
  SYLLABLE_CORPUS,
  SYLLABLE_RHYTHM,
  syllableStarts,
  type DemoCue,
  type SyllableWord,
} from '@core/syllables'
import { prefersReducedMotion } from '@features/ggtyping'
import { useEngineValue } from '@features/typing'

import { RestartIcon } from '../icons.tsx'

import styles from './SyllableIntro.module.css'

const wordOf = (word: string): SyllableWord =>
  SYLLABLE_CORPUS.find((entry) => entry.word === word) ?? { word, syllables: [word], count: 1 }

/** Two syllables, then three, then four: the same rhythm, longer each time. */
const DEMO_WORDS: readonly SyllableWord[] = ['mountain', 'important', 'information'].map(wordOf)
const TIMELINE = buildDemoTimeline(DEMO_WORDS)

const CUES: readonly { readonly cue: DemoCue; readonly text: string }[] = [
  { cue: 'chunk', text: 'Chunk the word.' },
  { cue: 'type', text: 'Type one syllable.' },
  { cue: 'pause', text: 'Pause.' },
  { cue: 'next', text: 'Type the next.' },
]

/** Where the demonstration is: a step of the timeline, or at rest on its diagram. */
interface Playback {
  readonly step: number
  readonly loop: number
  readonly playing: boolean
}

const RESTING: Playback = { step: 0, loop: 0, playing: false }

type LetterState = 'plain' | 'waiting' | 'typed'
type ChunkState = 'waiting' | 'active' | 'done'

export interface SyllableIntroProps {
  readonly engine: TypingEngine
}

export const SyllableIntro = ({ engine }: SyllableIntroProps) => {
  const status = useEngineValue(engine, (snapshot) => snapshot.status)
  const typing = status === 'running' || status === 'paused'
  const [playback, setPlayback] = useState<Playback>(() =>
    prefersReducedMotion() ? RESTING : { step: 0, loop: 0, playing: true },
  )
  // A test starting stops it, for good: back to the diagram, until it is asked for again.
  if (typing && playback.playing) setPlayback(RESTING)
  const playing = playback.playing && !typing

  useEffect(() => {
    if (!playing) return undefined
    const step = TIMELINE.steps[playback.step]
    if (step === undefined) return undefined
    const timer = window.setTimeout(() => {
      setPlayback((was) => {
        const next = was.step + 1
        if (next < TIMELINE.steps.length) return { ...was, step: next }
        const loop = was.loop + 1
        return loop < SYLLABLE_RHYTHM.demo.loops ? { step: 0, loop, playing: true } : RESTING
      })
    }, step.durationMs)
    return () => window.clearTimeout(timer)
  }, [playback.step, playing])

  const replay = () => {
    if (prefersReducedMotion()) return
    setPlayback({ step: 0, loop: 0, playing: true })
  }

  const step = playing ? (TIMELINE.steps[playback.step] ?? null) : null
  const entry = DEMO_WORDS[step?.word ?? 0] as SyllableWord
  const cue = step === null ? null : cueOf(step)
  // At rest: the word typed out and apart, nothing in hand — the technique as a diagram.
  const phase = step?.phase ?? 'diagram'
  const typed = step === null ? entry.word.length : step.typed
  const apart = phase === 'chunk' || phase === 'type' || phase === 'breath' || phase === 'diagram'
  const describedBy = useId()

  const starts = syllableStarts(entry.syllables)
  const chunks = entry.syllables.map((syllable, index) => {
    const start = starts[index] ?? 0
    const end = start + syllable.length
    const inHand = step !== null && step.syllable === index && (phase === 'type' || phase === 'breath')
    const state: ChunkState = typed >= end && !(inHand && phase === 'type') ? 'done' : inHand ? 'active' : 'waiting'
    const filled = Math.max(0, Math.min(1, (typed - start) / syllable.length))
    const letters = [...syllable].map((letter, position) => {
      const letterState: LetterState = phase === 'whole' ? 'plain' : start + position < typed ? 'typed' : 'waiting'
      // Its place in the word: what it is, whatever else is on screen.
      return { letter, state: letterState, at: start + position }
    })
    return { syllable, index, state, filled, letters, shift: (entry.syllables.length - 1) / 2 - index }
  })

  const breathing = (index: number) => step !== null && phase === 'breath' && step.syllable === index
  const onward = phase === 'rest'

  return (
    <section className={styles.intro} aria-labelledby={`${describedBy}-title`}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>High Speed Trainer</p>
        <h1 id={`${describedBy}-title`} className={styles.title}>
          Syllable Trainer
        </h1>
        <p className={styles.subtitle}>Train long words as rhythm, not as one block.</p>
      </header>

      <div className={styles.body}>
        <figure className={styles.card} aria-labelledby={`${describedBy}-label`} aria-describedby={describedBy}>
          <figcaption className={styles.cardHead}>
            <span id={`${describedBy}-label`} className={styles.label}>
              Watch the rhythm
            </span>
            <button
              type="button"
              className={styles.replay}
              onClick={replay}
              aria-label="Replay the demonstration"
              data-playing={playing}
            >
              <RestartIcon width="13" height="13" />
              <span aria-hidden="true">Replay</span>
            </button>
          </figcaption>

          <p id={describedBy} className="visually-hidden">
            A demonstration: mountain is typed as moun, a short pause, then tain, and then the next word.
          </p>

          <div
            className={styles.stage}
            data-demo-phase={phase}
            data-apart={apart}
            aria-hidden="true"
            style={{ '--gg-demo-letter': `${SYLLABLE_RHYTHM.demo.characterMs}ms` } as CSSProperties}
          >
            <div className={styles.word}>
              {chunks.map((chunk) => (
                <Fragment key={`${entry.word}-${chunk.index}`}>
                  {chunk.index > 0 && (
                    <span className={styles.gap} data-breathing={breathing(chunk.index - 1)} />
                  )}
                  <span
                    className={styles.chunk}
                    data-state={chunk.state}
                    style={{ '--gg-demo-shift': chunk.shift } as CSSProperties}
                  >
                    {chunk.letters.map((letter) => (
                      <span key={letter.at} className={styles.letter} data-state={letter.state}>
                        {letter.letter}
                      </span>
                    ))}
                  </span>
                </Fragment>
              ))}
            </div>

            <div className={styles.rhythm}>
              {chunks.map((chunk) => (
                <Fragment key={`${entry.word}-beat-${chunk.index}`}>
                  <span
                    className={styles.beat}
                    data-state={chunk.state}
                    style={{ '--gg-demo-beat': chunk.syllable.length, '--gg-demo-fill': chunk.filled } as CSSProperties}
                  />
                  <span
                    className={styles.pause}
                    data-breathing={chunk.index < chunks.length - 1 ? breathing(chunk.index) : onward}
                  />
                </Fragment>
              ))}
              <span className={styles.onward} data-lit={onward}>
                <svg viewBox="0 0 16 10" width="16" height="10" focusable="false">
                  <path d="M1 5h13M10 1.5 14 5l-4 3.5" />
                </svg>
              </span>
            </div>
          </div>
        </figure>

        <ol className={styles.steps} aria-label="How to train">
          {CUES.map((item, index) => (
            <li key={item.cue} className={styles.step} data-lit={cue === item.cue}>
              <span className={styles.stepNumber} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              {item.text}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

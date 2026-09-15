# GGTyping interaction guideline

GGTyping — Geek Gamified Typing — is the layer of feedback that reacts to how
someone is typing. This page is the standard every GGTyping effect is held to.
It starts with one effect, the word jump, and grows only when an effect earns
its place.

The typing engine, the metrics, telemetry, statistics and drills are the
serious part of this application. GGTyping sits on top of them and may never
change them.

## Principles

1. **Contextual.** Feedback happens where its cause is: on the word, not in a
   banner, a corner or a pop-up. The eye should not have to leave the text.
2. **Brief.** Over in about half a second. Nothing waits to be dismissed.
3. **Never interrupts typing.** No effect blocks a key, delays the engine,
   moves the caret's logical position, or asks for attention before the next
   keystroke. A typist at 150 WPM must be able to ignore every effect entirely.
4. **Cause → reaction.** Each effect answers one thing the typist did, and the
   link is obvious without an explanation: three misses on a word, and that
   word reacts.
5. **Polished, not loud.** Small movement with real acceleration and weight,
   rather than big movement with a stock ease. If an effect is noticeable from
   across the room, it is too big.
6. **Serious metrics stay primary.** Speed, accuracy and the text itself stay
   the most prominent things on screen. Effects never cover, restyle or delay
   them.
7. **Rewards and teaches without becoming childish.** No confetti, sounds,
   mascots or cheering. The tone is that of a well-made instrument that
   responds, not a game that performs.

## Engineering rules

- **Listen, never write.** An effect subscribes to engine events and reads the
  engine's own verdicts. It never calls anything that changes engine state and
  never defines correctness itself. A test proves the result, keystroke log and
  telemetry are identical with the effect on and off.
- **Off the React render path.** Effects drive the DOM directly (the Web
  Animations API), so no component re-renders because something moved. The
  hot-path test measures renders per keystroke with effects firing.
- **Transform and opacity only.** Nothing that changes layout: no `top`,
  `margin`, `width`, `line-height` or display switches mid-test. Surrounding
  text must not move by a pixel.
- **Parameters in one file.** Every timing, distance, scale and curve for an
  effect lives in a single motion module with its rationale beside it.
- **Deterministic.** The same cause produces the same motion. Controlled
  variation may come later, but never before an effect has been tuned without
  it.
- **Reduced motion is respected at the moment of playing.** With
  `prefers-reduced-motion: reduce`, nothing moves — and nothing informational is
  lost, because an effect never carries information the static screen lacks.
- **Nothing outlives its test.** Restart and completion clear all state and
  cancel anything in flight.
- **Tune in a real browser.** Unit tests hold the trigger logic and the motion's
  envelope; the feel is judged by pausing the real animation, stepping through
  it and looking.

## Effect 1: the word jump

**Cause.** The same word is mistyped three times in a row, by the engine's own
definition of a wrong keystroke — a wrong letter, a letter where the space
belongs, or a space part-way through the word.

**Reaction.** That word springs up about 0.43 em (12 px at desktop size), hangs
briefly, drops back and settles. 455 ms in total.

**Rules.**

| Event | Effect on the word's streak |
| --- | --- |
| Mistake on the word | +1; the 3rd, 6th, 9th… jumps |
| Correct letters or backspaces inside the word | none |
| Word completed with every letter right | reset |
| A keystroke on another word | the previous word's streak ends |
| Restart, new test, completion | everything cleared, running jumps cancelled |

Streaks are kept per word index; one word's struggle never moves another. A
jump earned while the word is still in the air lets the running jump finish
instead of restarting it.

Every third rather than every mistake after the third: a typist mashing at
speed would otherwise restart the motion several times a second, which reads as
a glitch and turns feedback into noise.

**Motion.** Anticipation (sink and squash), launch (fastest, decelerating),
apex (slowing to a stop), descent (accelerating under "gravity" 1.4× the rise),
settle (a small rebound). The rise is a single ease-out split across launch and
apex so its speed has no kink at the join. Every number and the reasoning for it
is in [`word-jump.motion.ts`](./src/features/ggtyping/motion/word-jump.motion.ts).

**Where it lives.** [`src/features/ggtyping`](./src/features/ggtyping): the
streak tracker, the motion, the controller that listens to the engine, and the
hook the typing surface uses. The only change to the typing screen is that each
word's letters sit inside an `inline-block` element the jump can move, which
was measured to leave every character's position unchanged.

## Adding an effect

Before building one, write its row in this file: the cause, the reaction, the
rules, and which principle would be most at risk. If the cause cannot be stated
in one sentence from engine events that already exist, it is not ready.

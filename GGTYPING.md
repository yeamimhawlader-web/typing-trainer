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

## Mode 1: Hover Mode

A training mode rather than an effect, and the first place GGTyping openly
indulges in motion. At `/gg/hover`, beside ordinary practice.

**Cause.** One mistake on a word, by the engine's own definition.

**Reaction.** The word jumps where it is — the word jump above, after one
mistake instead of three — and three rings appear under it. The typist finishes
the word as usual. When they leave it, the word lifts off the line and hovers,
and every key types the word again until it has gone cleanly the required
number of times. Then it settles back onto the line and the text carries on.

**Rules.**

| Event | Effect |
| --- | --- |
| A mistake, nothing focused | That word is focused: 3 clean repetitions required |
| A mistake, something already focused | Nothing — one focus at a time |
| Leaving the focused word in the text | Repetitions begin; the text pauses at the next word |
| A repetition with no mistake | One clean repetition; a ring fills |
| A repetition with a mistake | Required +3 (never beyond 12), once per repetition however many mistakes; clean ones already done are kept |
| Clean repetitions reach the requirement | Released: the text resumes where it was left |
| 20 repetitions, clean or not | Released as not completed, so no focus can hold a typist indefinitely |
| The last word focused | The test stays open until it is released |
| Restart, new text, word count change | Everything cleared |

A repetition is the word and the space after it, typed through a second instance
of the typing engine: its correctness, extras, early spaces and backspace are the
engine's, and a mistake later corrected still counts, as it does in the engine's
error count.

**What is recorded.** The session's speed, accuracy and keystroke log are the
pass through the text, by the engine's unchanged definitions: the session engine
is paused while a word is repeated, and repetitions never reach it. The session
is saved with mode `hover` and one record per focus — the word, its position,
the final requirement, clean repetitions, repetitions with a mistake, whether it
was completed or hit the limit, and how long it held the typist. Hover Mode
sessions are left out of the slow-sequence analysis and drill baselines, like
drills, because stopping at every mistake changes the rhythm those measure.

**Motion.** Parameters and rationale in
[`hover.motion.ts`](./src/features/ggtyping/motion/hover.motion.ts). In short:

- Lift-off gathers (a hair of sink), then rises 0.24 em on a curve that stops at
  the top: 730 ms.
- The hover is five loops on nested layers — float (3.4 s, 0.07 em, rising more
  slowly than it sinks), drift (6.1 s), tilt (4.7 s, under a degree), and a glow
  and a light on the line that breathe with the float. Keyframes sit only at each
  loop's extremes with a sine ease-in-out between, so every join, including the
  wrap, is smooth in position and speed; drift and tilt run on periods of their
  own, so the whole never visibly repeats.
- A clean repetition: its ring fills with a small pop, and the word dips 0.045 em
  and recovers.
- A repetition with a mistake: the word jump itself, played by its own player at
  0.26 em and 375 ms, over the hover, which carries on underneath; three new
  rings grow in.
- Release: from wherever the hover is, down to the line with a 0.018 em
  undershoot and settle, 780 ms; glow, light and rings fade on the way. The layer
  lands exactly on the word in the text, which then reappears with the original
  mistake still marked.

**How it is drawn.** The text is never rewritten or duplicated in its layout.
The focused word is drawn a second time in a layer positioned over it from the
stream's own measurements, and the word in the text is hidden with `visibility`
while the layer stands in for it, so nothing reflows. While a word is repeated
the stream keeps its line in view even if the text's cursor has moved on to the
next line. With `prefers-reduced-motion: reduce` nothing moves; the layer, its
glow, the rings and the caret are drawn still, and a status region announces the
count to screen readers in every case.

**Performance.** Measured in Chromium at 120, 150 and 240 WPM through several
focuses, with misses: no dropped keys, no layout reads, no long tasks, median
input-to-DOM 0.2 ms for the text (as in ordinary practice) and 0.5–0.6 ms for
repetitions. The only style read is the hover's pose at release, once per focus.

**Where it lives.** Rules and controller in
[`src/features/ggtyping/hover`](./src/features/ggtyping/hover), motion in
[`src/features/ggtyping/motion`](./src/features/ggtyping/motion), and the layer in
`src/features/gg-ui/components/WordStream/HoverFocus.tsx`.

## Adding an effect

Before building one, write its row in this file: the cause, the reaction, the
rules, and which principle would be most at risk. If the cause cannot be stated
in one sentence from engine events that already exist, it is not ready.

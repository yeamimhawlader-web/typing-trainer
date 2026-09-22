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
mistake instead of three — and a row of rings appears under it. The typist
finishes the word as usual. When they leave it, the word lifts off the line and
hovers, and every key types the word again, as many times as the difficulty
asks. Then it settles back onto the line and the text carries on.

A repetition is the word and the space after it, typed through a second instance
of the typing engine: its correctness, extras, early spaces and backspace are the
engine's. It is clean when the engine recorded no mistake in it, so a mistake
put right with backspace still makes it a repetition with a mistake. Several
mistakes in one repetition are still one failed repetition.

**Difficulties.** Chosen and remembered in the toolbar, where Hover Mode is a
small glass node that unfolds into three glass branches — Standard, All In,
Tired — each with its description and one to three beads for how persistent it
is. Changing it starts a new test, so a test is typed, repeated and saved at one
difficulty.

**Tests are words or time.** Fifteen, thirty or sixty words, or fifteen
seconds, thirty seconds, a minute, or a custom time between five seconds and two
minutes. Both are the same test typed the same way — one engine, one set of
measurements — differing only in which runs out first. A timed test counts every
second, including the ones spent staring at the screen; a word test still does
not charge long idle gaps to the typist's speed. The clock counts down where
there is a time to run out, and the last keystroke before it is the last one
counted. Speed has no ceiling in either.

**Tab is the way on.** When a test ends, Tab starts the next one; while one is
under way, Tab restarts it. Tab from anywhere else on the page still moves
focus, and on an untouched test it does nothing at all.

**Live accuracy.** The figure carries a state: at or above 96% nothing is said;
below it, a quiet line asks the typist to keep an eye on accuracy; below 94% it
says what it is costing. The line is always there, empty when there is nothing
to say, so words arriving move nothing on the page, and the state is carried by
a mark as well as by colour. It changes once when the state changes, not with
every keystroke.

**Sound.** Off until a sound is chosen, and then remembered. The speaker in
the toolbar is a glass node that unfolds into the sounds to type to, the same
way Hover Mode's node unfolds into its difficulties; choosing one plays it as you
choose it, because a sound cannot be read, only heard. Sounds come in four
styles, chosen beside the volume: the branches are the sounds of the style
showing, and the tree opens on the style of the sound in use.

| Style | Sound | What it sounds like |
| --- | --- | --- |
| Mechanical | Thock | Deep and dampened, like a heavy board on a desk mat |
| | Cream | Smooth and rounded, a long buttery bottom-out |
| | Click | Crisp and tactile, with a bright top to every press |
| | Hush | Barely there, for a shared room or a late night |
| | Typewriter | A hard strike with a little ring left behind it |
| Neon | Woosh | A rush of air on every key, like a neon sign flickering on |
| | Laser | A quick pew of light, pitched down as it goes |
| | Synthwave | Detuned saw plucks through a closing filter, a note of a minor scale on every key |
| | Hologram | A glassy shimmer, like light through a prism, in a bright scale |
| Soft | Bubble | A small round pop, like bubbles rising |
| | Droplet | Water dropping into a still bowl |
| | Chime | A soft glass chime, a different note on every key |
| Arcade | Blip | A tidy eight-bit blip |
| | Coin | Two quick notes, the sound of a pickup |
| | Chiptune | Square-wave notes in a major key: a tune as you type |

The styles that are not keyboards were balanced against the keyboards by ear
weighting, not by the numbers in their recipes: every voice of every sound was
rendered in Chromium and measured A-weighted, and each sits within the range the
keyboards themselves span — none louder than Cream or the typewriter.

The master volume sits beside the keyboards, from silent to the level the packs
were made at. Every sound is built in the browser rather than played from a file:
a short burst of filtered noise over a low body that falls as it decays, under a
low-pass — a key click over a dampened knock — and each pack bends those same
recipes by a handful of numbers. A space is deeper and longer,
backspace lighter, a mistake duller and lower with no click at all. Hover Mode's
moments are notes instead, the same in every pack: a word caught, lifted, and
then each clean repetition a step up a pentatonic ladder, so clearing a word
rises; a repetition with a mistake is a dull tick, and a word let go unresolved is
a soft low note rather than a buzzer. The keys of a repetition sound like keys.
The selectors' glass sounds as they open and fold. Nothing is loud, nothing lasts
longer than half a second, and no information is carried by sound alone.

**The selector unfolding.** Pressing Hover Mode gives the node a little and
flexes its light; the branches grow out of it on thin stems, one just after
another, their labels arriving last, and the chosen one lights from within.
Choosing a difficulty folds them away again — the branches are never left
sitting there, and the node says which difficulty is on — and so does pressing
the node again, pressing anywhere else, Escape, or leaving for another mode. One
spring drives it: opening is fast (90% in about 160ms), settles 1.5% past and is
at rest by 500ms; folding does not bounce, is heavier — 90% of the way home in
about 170ms — and is at rest by 440ms. Whatever sits beside the branches — the
sound style and the volume — arrives after them and leaves first, faded and lifted
towards them within the first tenth of a second of a fold, so nothing is left
hanging over the page as the row closes.

**One tree at a time.** Hover Mode's difficulties and the sound packs are two trees
of one control, and only one is ever out. Pressing Sound while Hover Mode's
branches are open folds them as the packs grow in the same row — the packs a beat
later, from the room the difficulties took — so the page moves once, and the other
way round. Closing while it opens,
or reopening while it folds, turns it around from where it is, even though the
page changes underneath. The branches can be chosen from the moment they appear.
With reduced motion it is simply open or closed. Arriving at Hover Mode any other
way — a reload, the back button — shows it already open.

| | Standard | All In | Tired |
| --- | --- | --- | --- |
| Repetitions | One cycle of 3, clean or not | Two cycles of 3, clean or not: 6 | 3 clean; +3 for each repetition with a mistake |
| A repetition with a mistake | Recorded; changes nothing else | Recorded; changes nothing else | Required +3, never beyond 10 (3, 6, 9, 10) |
| Released after | The 3rd repetition | The 6th repetition — never a third cycle | Clean repetitions reach the requirement, or 20 repetitions of any kind |
| Cleared when | All 3 were clean | The second cycle was all clean | The requirement was met before it reached 10 |
| Rings | 3, each marked clean (dot) or with a mistake (bar) | 6 in two groups, marked the same way | One per clean repetition required; a miss adds three |

**Rules at every difficulty.**

| Event | Effect |
| --- | --- |
| A mistake, nothing focused | That word is focused |
| A further mistake on the focused word, still in the text | Counted in its mistakes |
| A mistake on another word, something already focused | Nothing — one focus at a time |
| Leaving the focused word in the text | Repetitions begin; the text pauses at the next word |
| The focus is released | The text resumes where it was left; a word that did not clear goes to Golden Nuggets |
| The last word focused | The test stays open until it is released |
| Restart, new text, word count or difficulty change | Everything cleared; nothing goes to Golden Nuggets |

**Golden Nuggets.** A word is kept two ways: it costs five mistakes in one test,
anywhere in GG.Typing, or Hover Mode releases it without it having cleared —
still costing mistakes when its difficulty's repetitions ran out. Either is kept
at `/gg/nuggets`, reached
from Hover Mode's own screen (a line under the hint, and the result) rather than
the top bar, which has no room for a fourth link on a phone. One record per word per language, whose counts rise each time:
how often the word was released unresolved, the Hover Mode tests it came up in,
its mistakes, when it was first and last seen, the last difficulty, and whether
it cleared or not last time. A word that clears is never added, but a word that
is already a nugget is updated when it next comes up, cleared or not. The write
happens as the focus ends, never on a keystroke. A plain list, most recent
first: no ranking, no score.

**Practising them.** The Golden Nuggets page leads to `/gg/hover/nuggets`: Hover
Mode, at the chosen difficulty, over text made of the typist's own nuggets — one in
every other place, each met mid-flow between ordinary words, every nugget coming
round before any comes again. A nugget that costs a mistake there is focused and
repeated as any word is, and how that ends is written back to it, so the list says
whether practising it worked. Saved as Hover Mode, over Golden Nuggets.

**What is recorded.** The session's speed, accuracy and keystroke log are the
pass through the text, by the engine's unchanged definitions: the session engine
is paused while a word is repeated, and repetitions never reach it. The session
is saved with mode `hover`, its difficulty, and one record per focus — the word,
its position, the repetitions asked for, cycles, repetitions typed, clean ones,
ones with a mistake, mistakes in all, whether it cleared or hit a limit, whether
it went to Golden Nuggets, and how long it held the typist. Sessions saved before
difficulties existed are read into the same shape. Hover Mode
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

## Instruments

**Pace.** A slim line that moves through the words at one of the typist's own
speeds, to hold or to chase — chosen from a glass node beside Sound, one of the
same branch trees. Average is their typical speed (the median of their last
twenty ordinary tests), Push a little past it, Best their fastest of those; each
branch says what it is worth in words per minute, and none is offered until there
are three ordinary tests to read. Training modes do not count towards it. The
line sets off with the first key, keeps the test's own time — pausing while Hover
Mode repeats a word — glides one character's time at a time along a line, and
goes when the test ends. It is off until chosen, and costs a keystroke nothing:
one animation frame loop while a test runs, moving it by transform alone.

**Focus while typing.** From the first key of a test to its end, everything but
the words, the field, the live figures and Hover Mode's guidance steps back to a
trace. A real movement of the mouse brings it all forward at once, the next key
lets it recede again, and anything that takes the keyboard's focus comes forward
by itself. Opacity only: nothing moves and nothing is hidden from a screen reader.

**Punctuation and numbers.** Two pills beside an ordinary test's length. Punctuation
dresses the words as sentences — a capital to start, a full stop, question or
exclamation to end, commas where a breath goes, the occasional semicolon or colon —
four to twelve words long; numbers put figures in place of about one word in eight:
counts, amounts, years, decimals, percentages. The words are drawn as always and
only dressed, so a word test is still the length chosen. A change starts a new test
on the new text, and the test is recorded with it, so history names it —
"Words · punctuation & numbers" — as the harder test it is. Ordinary practice only:
Hover Mode, the Syllable Trainer and drills keep their own text.

**Advanced words.** Normal and Advanced, beside Punctuation and Numbers. Normal is
the two hundred most frequent English words; Advanced is a wider everyday vocabulary
of about eleven hundred — half as long again on average, sharing no word with
Normal — so it reaches the letter combinations the frequent words never do. The
control row names the source ("Advanced words"), the test is recorded as its own
source, so history tells the two apart, and it dresses with punctuation and numbers
like Normal. Ordinary practice only, as the dressing is.

**Typefaces.** Four "Aa"s at the start of the settings row, each set in the face it
chooses: Roboto Slab (the default — open, even letters, set light), Geist Mono,
Inter and Lora. Remembered like the size. Only the letters change: the block keeps
its height and lines, and the caret measures the new letters before the next paint.
The chrome is set in Inter, plain and light.

**Caps Lock.** Every key is compared exactly, so the field says when Caps Lock is
on — a small note in its corner, spoken once — the moment the keyboard reports it.

**The shape of a test.** Under the result's figures, the speed of every second of
the test just finished, with the mistakes marked where they happened — the
difference between a steady sixty and a ninety that fell apart at the fourth word
(ARCHITECTURE.md).

**Liquid glass.** Every control is a nearly clear lens with a rim that catches the
light, in the theme's own text colour. Buttons are always glass; a choice is glass
when chosen or pointed at, and plain text otherwise (ARCHITECTURE.md).

**The toolbar.** Two rows: the glass on the first — the modes on the left, Pace and
Sound on the right — and the test's own settings on the second. A branch tree
unfolds between them, under the nodes it grows from. On a phone the nodes stack.

## Mode 2: the Syllable Trainer

Part of the High Speed Trainer, beside Hover Mode, at `/gg/syllables`. Hover Mode
targets the words a typist gets wrong; the Syllable Trainer trains how long words
are held: not as one block, but as chunks in rhythm — syllable, a breath,
syllable, a breath, next word — until the chunks are automatic.

**Words.** Two hundred common words that are worth chunking, from two syllables to
five, split where a dictionary splits them (moun·tain, dif·fer·ent,
in·for·ma·tion), in `src/core/syllables/corpus.ts`. A test draws them at random, at
the practice length, never the same word twice in a row.

**The opening.** The page says what it is, then shows it: a word whole, pulled
apart, each syllable typed a letter at a time with a breath between, closing up
again, and on to the next — mountain, important, information — with a timing line
beneath (a bar per syllable, a dot per breath, an arrow on) and four instructions
that light as each happens. It plays twice by itself, stops the moment typing
starts, and can be played again. With reduced motion it is a still diagram of the
word in its chunks.

**Training.** Each word is drawn as its syllables with a small space between. The
syllable in hand is underlined and the rest of that word steps back. As a syllable
is finished, the dot after it breathes once — strongly for the first words of a
test, fading after, never gone — and the next syllable's line arrives a beat
later. A word typed right closes up into one block; a word with a letter wrong, or
left with a space part-way through, stays open: it is over, not done. Nothing waits
for a pause, and no pause is measured or scored.

**Your rhythm.** When a Syllable Trainer test ends, a card above the result reads it
back from the test's own keystrokes: the typical gap between keys inside a syllable,
and at a break between syllables, drawn as two bars on one scale, with a sentence
saying what they show — breaks clearly longer (chunking), a little longer (starting
to show), or the same (still single blocks). Only clean transitions count: next to
each other, both right, in the same word, never across a space. It reports and does
not grade; it is gone when the next test starts.

**What is recorded.** The same session, telemetry and Golden Nuggets as ordinary
practice, over the same engine; the syllables are drawn over the text and never
typed. The test is saved as the Syllable Trainer, a training mode, so history names
it and analyses of ordinary typing leave it out. The rhythm's durations are data,
in `src/core/syllables/rhythm.ts`.

**Where it lives.** Words, layout, progress, rhythm and the demonstration's timeline
in [`src/core/syllables`](./src/core/syllables); the opening in
`src/features/gg-ui/components/SyllableTrainer`; the syllables in the stream in
`WordStream.tsx`.

## Adding an effect

Before building one, write its row in this file: the cause, the reaction, the
rules, and which principle would be most at risk. If the cause cannot be stated
in one sentence from engine events that already exist, it is not ready.

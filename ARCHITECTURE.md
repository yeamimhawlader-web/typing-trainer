# Architecture

This document explains how the project is arranged and why. It is short on
purpose — if something here stops being true, change the code or change the
document, but do not let them disagree.

## The governing idea

The product is a pipeline, and the code is organised to match it:

```
UI  →  application state  →  typing engine  →  session data  →  persistence  →  analytics
```

Each arrow points one way. A layer knows about the one to its right and nothing
about the one to its left. The engine does not know a UI exists; persistence
does not know an engine exists.

The reason is concrete rather than aesthetic. A typing engine tangled into React
components can only be tested by simulating keystrokes against a rendered DOM,
which is slow, flaky, and quietly wrong about timing. Kept separate, it is
tested by passing in a list of keystrokes and asserting on the numbers that come
out — fast, deterministic, and exact.

## Layers

| Directory       | Role                                                 | May import                    |
| --------------- | ---------------------------------------------------- | ----------------------------- |
| `src/core/`     | Domain. Types, typing engine, persistence. Pure TS.  | `@config` only                |
| `src/config/`   | Build-time configuration and environment access.     | `@core`                       |
| `src/shared/`   | Generic UI primitives and helpers. Feature-agnostic. | `@core`, `@config`            |
| `src/features/` | Vertical slices: pages, state and hooks per feature. | `@core`, `@config`, `@shared` |
| `src/app/`      | Composition root: routing, layout, wiring.           | everything                    |
| `src/styles/`   | Design tokens and global CSS.                        | nothing                       |

**`src/core` may not import React, the DOM, or any layer above it.** This is not
a convention that relies on memory — it is enforced by `no-restricted-imports`
rules in `.oxlintrc.json`, and `npm run lint` fails if it is violated. That
enforcement is the practical difference between an architecture and a wish.

## Decisions

### Vite + React + TypeScript, strict

`strict` is on, along with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride` and `noImplicitReturns`. The Vite template ships without
`strict`; it was added deliberately.

`noUncheckedIndexedAccess` earns its keep specifically here: the engine will
index into character and keystroke arrays constantly, and this flag turns every
off-by-one into a compile error instead of an `undefined` in a statistics
column. Its one friction point is CSS Modules, whose class lookups become
`string | undefined`; `cx()` in `src/shared/lib` absorbs that at the single
place it matters.

### Zustand for application state

Chosen over Context for one reason: a 130 WPM typist generates roughly 13 state
updates per second, and Context re-renders every consumer on every change.
Zustand's selector subscriptions mean a component re-renders only when the slice
it actually selected changes. It is also plain TypeScript outside React, so
state can be driven from a test with no renderer.

**Always pass a selector.** `useSettingsStore((s) => s.preferences.theme)`, never
`useSettingsStore((s) => s)`.

### Design tokens in two layers

`src/styles/tokens.css` holds primitives (`--palette-neutral-500`) and semantic
tokens (`--color-char-incorrect`). Components reference semantic tokens only.

The light theme is the proof this works: it remaps the semantic layer and
touches no component file and no primitive.

Values live in CSS and only in CSS. `tokens.ts` mirrors token _names_ for
TypeScript consumers that CSS cannot reach — it deliberately contains no values,
because two sources of truth for a colour drift apart silently.

Typing-specific tokens (`--color-char-*`, `--font-size-typing`, `--caret`) are
first-class, not afterthoughts. They are the most-looked-at pixels in the
product.

### Persistence is an interface, not a database

`StorageAdapter` is a five-method key/value contract. Two adapters implement it
today: `localStorage` and in-memory. Both pass the same contract test suite in
`persistence.test.ts`; a future IndexedDB adapter gets added to that table and
must pass it unchanged.

Two decisions inside it:

- **Every method is async**, although `localStorage` is synchronous. IndexedDB
  and any server store are not. Retrofitting async later means touching every
  call site; paying it now costs nothing.
- **Keys are namespaced** as `typing-trainer:v1:<key>` by a decorator, so
  `clear()` cannot wipe unrelated data on the origin, and a schema migration is
  a matter of reading the old prefix and writing the new one.

### Session history

Finished tests are stored. The chain is one direction, and each link knows only
the next:

```
engine → SessionResult → sessionService → SessionRepository → StorageAdapter → localStorage
```

**The UI never touches storage.** It imports `sessionService` and the
`TypingSession` type from `@core/sessions`, and nothing else. `localStorage`
appears in exactly one file in the whole application.

**Metrics are defined once.** `SessionMetrics` is a single type, carried
unchanged from the engine's snapshot onto the result and then onto the stored
record. The screen and the history page cannot disagree about a test, because
there is no second place where speed or accuracy is worked out. A live run
verified this: the screen read 127 wpm and the stored record held 126.97.

**Why localStorage rather than IndexedDB.** A session record is a few hundred
bytes without keystrokes, so a year of daily practice is a couple of megabytes —
within the roughly 5 MB localStorage allows, but not comfortably beyond that.
IndexedDB is the right home eventually. It is not needed yet, and the
`StorageAdapter` contract already assumes asynchrony, so moving is a new adapter
passing the existing contract suite rather than a rewrite. Choosing it now would
buy schema versioning and transactions to hold data that fits in a text file.

**Layout: one key per session, plus an index.** The alternative — a single array
under one key — rewrites the entire history on every save and deserialises all
of it to show ten rows. With an index, a save writes two small values and
`getRecent(10)` reads eleven.

The index is a cache of an ordering; records are authoritative. `clear()` works
from the keys actually present rather than the index, so a record the index lost
track of is still removed — and it removes only session keys, leaving
preferences and anything else on the origin alone.

**The index is checked against the records before it is trusted.** It used to be
trusted outright, and the audit showed the cost: a corrupted index made history
read as empty while every record sat on disk, and the next save wrote a fresh
index containing only itself, orphaning all of them for good. Now every read and
write first compares the index with the session keys that exist. Records it does
not list are read, validated and put back; records that fail validation are left
out rather than guessed at, and stay on disk untouched; entries pointing at
records that are gone are dropped. When nothing is wrong this is one key listing
and no write. It also recovers sessions orphaned by the old behaviour.

**Deleting goes through one service, and can be undone.** A session lives in two
repositories — its record and its keystroke detail — and the detail page used to
delete only the record, leaving what someone typed readable in storage after they
had asked for it gone. `@core/history` is now the only way anything is deleted:
telemetry first, then the session, so a failure part-way leaves a visible session
that can be deleted again rather than invisible keystroke detail that cannot.
Every deletion returns what it removed, which is what undo restores. The history
list and the detail page both ask for confirmation before deleting — one
confirming click, with focus on Cancel and Escape to back out — and the history
page then offers Undo for the most recent deletion, whether one session or all of
them and whether made from the list or a detail page. It stays available until it
is used, dismissed, replaced by another deletion, or the app is reloaded; it is
held in memory, not storage. Confirmation is only on destructive controls, never
on the typing loop.

**Index updates are serialised.** Updating the index is read-modify-write, so
two overlapping saves would each read the same starting point and write back
their own version, losing one session from the listing while its record sat
there unreferenced. Reachable from two tabs on the same origin, so the
repository queues everything that rewrites the index.

**Saving never touches the typing path.** The write is subscribed to the
engine's `finished` event and started without being awaited. Measured in the
browser: **zero storage writes across 146 keystrokes**, two writes total after
completion, and input-to-DOM latency unchanged at 0.3 ms median.

A failure to save is reported, not thrown: the screen says the test could not be
stored and keeps the result on display. Losing a record is a nuisance; losing
the test you just typed because saving it went wrong is not acceptable.

Migrations are still not built. `schemaVersion` in `app.config.ts` namespaces
every key, so the hook for them exists.

### One result, shown in three places

A finished test appears on the practice screen, in the history table, and on its
own detail page. All three render the same stored `TypingSession`:

```
engine → SessionMetrics → TypingSession → results panel
                                        → history row
                                        → session detail
```

`SessionMetrics` is computed once, by the engine, and carried unchanged.
`SessionSummary` and the formatters in `@features/results` decide how a number
is _written_; nothing outside the engine decides what it _is_. The one piece of
arithmetic in the presentation layer turns stored counts into the width of a bar
segment, which is a fact about the picture rather than about the test.

The results panel renders the very object that was handed to storage, so the
screen and the history cannot disagree even in principle.

**The panel sits below the text rather than replacing it.** Hiding the text to
show the numbers would trade one kind of context for another: the moment a test
ends is exactly when a typist reads back which characters they got wrong.

**A missing session is an ordinary outcome.** A mistyped id, a record deleted in
another tab, and a record an older build wrote that no longer parses all reach
the detail page the same way — as "not found", with a way back. None of them is
a reason to show a broken page.

**Cross-feature imports go through a barrel.** `@features/results` is imported
by both the typing screen and the history table. That is the exception to
features being self-contained, and it is deliberate: the alternative is each
screen formatting a session its own way, which is how two screens start
disagreeing about the same test.

### Telemetry costs the typist nothing

```
keyboard → engine → Keystroke[] → telemetry record → stored → analytics
```

The engine already records the irreducible facts about every input: what was
pressed, what was expected there, which position it acted on, whether it
matched, and when. **Everything else is derived from those plus the target
text** — word index, position within the word, every latency, and which errors
were later put right.

That is the whole performance story, and it is why the engine did not change.
Telemetry adds nothing to the typing path: no extra work per keystroke, no extra
allocation, no storage write. The derivation runs once, after the last
character, over data the engine had collected anyway. Measured in the browser:
**zero storage writes across 291 keystrokes**, four after completion, and
input-to-DOM latency unchanged at 0.3 ms median. At a paced 140 WPM: no dropped
keystrokes, monotonic timestamps, median inter-key interval of 86 ms against a
target of 86.

**Latencies are named, never just "latency".** `interKeystrokeMs` is the gap
since the previous event of any kind; `sincePreviousCharacterMs` skips
backspaces. After a correction those differ by the whole time spent correcting,
so a digraph timing built from the wrong one would be quietly wrong. Corrections
carry `detectionLatencyMs` (error to first backspace — how long it went
unnoticed) and `correctionLatencyMs` (error to retype — what the mistake cost in
total). Words carry `pauseBeforeMs` and `pauseAfterMs`.

**Nothing is inferred that cannot be measured.** No finger, hand or key
geometry: the browser reports which character arrived, not which finger produced
it. Timing precision is whatever the browser gives — `performance.now()` is
deliberately coarsened — so these are milliseconds with sub-millisecond noise,
not microsecond measurements.

### The palette is checked, not just written down

```
tokens.css → parsed → OKLCH to linear sRGB → WCAG contrast → assertions
```

Colour in this application comes only from tokens: there is not one hex or
`oklch()` literal in any component stylesheet, and `src/styles/tokens.test.ts`
keeps it that way. That is what makes checking the tokens equivalent to checking
the product, and it is the reason this guard is cheap enough to be worth having.

It exists because aesthetic work pushes in exactly one direction. Contrast gets
softer, greys move closer together, and the person making the change is the last
to notice — it looks better to them. There is no console error and a screenshot
shows nothing.

**It was not hypothetical.** Running these numbers for the first time found
`--color-status-warning` at **2.65:1** in the light theme while carrying 14px
text, against a 4.5:1 bar; nobody had seen it because the application opens in
dark mode. The dark theme's caption colour was at 4.23:1. Both are fixed — the
light theme gained darker amber and green steps, since those hues have to travel
a long way down to carry text on a near-white ground, and `--color-text-tertiary`
moved one step up the neutral ramp. `--color-char-pending` stayed where it was:
it is a different semantic token on the same primitive, at 28px where the bar is
3:1, and moving it would close the gap against typed characters. That is the
semantic layer earning its keep.

Two comments in `tokens.css` already quoted measured ratios from a hand
calculation someone did once. Nothing kept them true. Now the assertions and the
comments agree, and they fail together.

Each pairing is asserted at the level its **actual usage** demands, with the
usage named — 4.5:1 for the caption text, 3:1 for the 28px typing surface. A bar
copied from a specification without looking at how the colour is used is either
too strict, and gets deleted the first time it is inconvenient, or too loose and
catches nothing.

**One shortfall is recorded rather than fixed.** A mistyped character and one not
yet typed differ by 1.01:1 in the light theme — the same lightness, different
hue. Red against grey. Anyone with red-green colour blindness is relying on the
faint tint behind the character, and peripheral vision, which is what notices an
error at speed, works mostly on lightness. It is held as a ratchet that can
improve but not slip, because no standard demands a ratio between two text
states, and the error colour is too central a decision to change as a side
effect of adding a test.

The OKLCH-to-sRGB conversion is forty lines of published matrix arithmetic
rather than a dependency. It was checked against the browser: painting each
token into a canvas and reading the pixels Chromium produces agrees with these
numbers to within 0.04, which is 8-bit quantisation.

### A word delete is one keystroke, not five

`Ctrl`+`Backspace` removes a whole word, and the engine records **one** event for
it however many characters went. The alternative — emitting one synthetic
backspace per character, all sharing a timestamp — is the obvious
implementation and it would quietly corrupt the thing this codebase exists to
measure: `interKeystrokeMs` is documented as "the raw rhythm of the hands", and
a run of zero-millisecond gaps that no hand produced is not that. A test asserts
there are no zero gaps in a session containing a word delete.

Recording one event loses nothing, because the span is already in the log. The
event's `index` is where the cursor landed, and the cursor before it is one past
the index of the event before, so "how many characters did this remove" is a
subtraction rather than a field. That is what let this ship **without a storage
format change or a version bump**: `StoredKeystroke` still stores
`[deltaMs, index, key]`, every telemetry record already on disk still decodes
identically, and a round-trip test asserts it.

One consumer did have to generalise. `deriveCorrections` credited a backspace to
an error only at exactly its index, which is correct when a deletion is one
character wide and wrong when it is five — errors inside the cleared span would
never be marked as noticed, leaving `detectionLatencyMs` null. It now credits
every position in `[index, cursorBefore)`. For a single backspace that range is
exactly one position, so the old behaviour is a special case of the new one
rather than a replacement for it; mutating it back to the equality test fails
two tests.

Word boundaries come from the **target** text, not from what was typed. The
typist is reproducing that text, so its structure is the one they are working
in, and a mistyped character does not move a word boundary.

The chord itself is claimed in the typing screen, not the engine — the engine is
given `deleteWord(at)` and knows nothing about modifier keys. It is the only
modified chord the screen takes; a test dispatches `Ctrl`+`R`, `T`, `W`, `L`,
`F`, `P` and `A` and asserts none of them were prevented, because claiming a
browser shortcut on the one screen a typist lives on would be a genuinely bad
thing to get wrong.

### Telemetry is stored apart from sessions

A session record is about 400 bytes. Its telemetry is about **12 kB per thousand
characters** — measured at 11.7 bytes per event. A 60-word test is roughly ten
times the record it belongs to; twenty tests a day is about 30 MB a year against
the roughly 5 MB `localStorage` allows.

So telemetry is not a field on `TypingSession`. If it were, the history would
cost ten times as much, `getAll()` would deserialise every keystroke of every
session to draw a list of dates, and a quota failure while saving telemetry
would take the session record down with it — losing the result over data that is
merely nice to have.

Instead it lives in its own repository, keyed by session id. **`TypingSession`
is untouched**, so every session already on disk stays valid and loads exactly as
before: a session either has telemetry or does not, and older ones do not. That
is the truth rather than a fabricated empty record.

Retention is capped at the most recent 50 sessions, which bounds storage at a
few hundred kilobytes whatever the history does. The cap is the honest
expression of what `localStorage` can hold, not a judgement about what is worth
keeping.

**Moving to IndexedDB is a change to that one layer.** Either an IndexedDB
`StorageAdapter` passes the existing contract suite, or a native implementation
satisfies `TelemetryRepository` directly. Neither touches the engine, the session
repository, or any screen — which is the point of putting the interface there.

Deleting a session deletes its telemetry, and clearing history clears it:
leaving it behind would keep a record of what someone typed after they asked for
it to be gone.

### The first analysis of telemetry is an experiment, and says so

```
SessionTelemetry → analyseSlowSequences → SequenceReport → result footnote
```

`@core/telemetry/sequences.ts` ranks the slowest two-character transitions of
one session. It defines no new timing: an observation is the second keystroke's
existing `sincePreviousCharacterMs`, counted only for a **clean** pair — adjacent
in the keystroke log, on consecutive positions, both correct, neither
whitespace. Those four conditions are what stop a backspace, a retype or a
word-gap from quietly inflating a number.

A sequence is ranked only at five or more observations, and the report keeps
**measurement separate from presentation**. `ranked` is every sequence over that
line. `slowerThanTypical` is the subset actually slower than the typist's own
median transition, and that is what the screen shows — because sorting always
produces a top entry, and a list of one will happily present a fast sequence as
the slowest. A real run did exactly that: 71 ms crowned "slowest" against an
85 ms median.

What the browser then showed is the honest result of the experiment. A 60-word
test at 130 WPM yields ~180 clean transitions over ~100 distinct sequences, of
which two to eight clear the threshold, and the survivors sit within about 7 ms
of typical — inside the run-to-run jitter. A deliberately planted 90 ms penalty
was recovered cleanly at +87 ms, so the arithmetic works; it is the sample that
is thin. **One session can detect a large effect and cannot detect a real one.**
That is a finding about the data, not a defect in the code, and the wording on
screen — "slowest observed", never "weakest" — is sized to it.

### Cross-session sequence analysis: the same question, asked of history

```
TypingSession[] → telemetry.getMany → analysePersistentSequences → statistics footnote
```

The single-session experiment above concluded that one test is too thin a
sample. `@core/telemetry/persistent.ts` asks the same question of accumulated
history. It is still an experiment and still says so on screen.

**Aggregation — sessions weighted equally, not observations.** The obvious
implementation pools every timing for a digraph and takes one median, and it is
wrong here: a session where a digraph happens to appear twelve times would
contribute twelve of the twenty numbers and decide the ranking alone. So each
session gets one vote per digraph — its own median for it — and the reported
figure is the median of those per-session medians. Pooled observations are kept
only to report a count and a spread; they are never averaged as though keystroke
intervals from one sitting were independent measurements. A unit test plants a
long slow session against three short ordinary ones and asserts the reported
median is 100 ms rather than the 200 ms pooling would give.

**Baseline — the typist's own, over the same sessions.** Each session's baseline
is the median of all its clean transitions; the report's baseline is the median
of those. Both figures are computed the same way, so the delta shown on screen
is exactly the difference of the two numbers beside it. There is no fixed
"slower than 100 ms is bad" anywhere: a 130 WPM typist and a 40 WPM typist share
no absolute scale, and one typist is slower when tired.

**Stability — slow repeatedly, not slow once.** For every session a digraph
appears in, its session median is compared against *that session's own*
baseline. Doing the comparison inside the session removes day-to-day speed
drift: a session where everything was slow moves everything together and proves
nothing. `slowSessionRatio` is the fraction of sessions in which it came out
slower.

**Thresholds — experimental parameters, not constants.** 20 observations, 4
sessions, and a 0.7 slow-session ratio. The first two are counts of evidence;
the third is the one that was actually calibrated. Eight simulated sessions with
a deliberate slowdown planted on one digraph produced the planted sequence at
+44 ms and slow in 8 of 8 — but at a 0.6 ratio two unrelated sequences also
qualified, at +4 ms and +1 ms on 5 of 8. Five of eight happens by chance 36% of
the time. Raising the bar to 0.7, which needs 6 of 8 at 14%, left only the
planted sequence standing.

**Evidence tiers — how much a row will bear.** The thresholds above make a
sequence a *candidate*, and the audit showed that is not enough: with nothing
slow at all, ordinary jitter produced candidates in every simulated history from
ten sessions on, each with the same Train button as a real +49 ms slowdown. The
more sequences are checked, the more clear a 70% bar by chance, and nothing asked
whether a difference was big enough to matter. So every candidate also gets a
tier from two questions asked together:

- **Big enough to matter?** The delta as a fraction of the typist's own baseline.
- **Consistent enough not to be luck, given how many were checked?** The exact
  one-sided sign-test probability of being slower in that many of its sessions if
  it were really no slower, multiplied by the number of sequences judged — a
  Bonferroni bound on how many sequences chance alone would produce this
  consistent.

| Tier | Relative delta | Expected by chance | On screen |
| --- | --- | --- | --- |
| Strong evidence | ≥ 20% | ≤ 0.05 | Listed first, with the Train button |
| Possible | ≥ 10% | ≤ 0.5 | "Possible — needs more tests", a quiet text link |
| — | otherwise | | Not listed; counted in "sequences with enough data" |

Calibrated against the audit's simulated typist (86 ms transitions, log-normal
jitter σ 0.3, 3% pauses, 60-word tests; forty histories per case):

| Case | Before tiers | Strong | Possible or better |
| --- | --- | --- | --- |
| Nothing slow, 10 sessions | fake rows in 40/40 | fake in 1/40 | fake in 9/40 |
| Nothing slow, 20 sessions | fake rows in 40/40 | fake in 0/40 | fake in 8/40 |
| +40 ms, 6 sessions | found in 31/40 | 0/40 | 30/40 |
| +40 ms, 10 sessions | found in 40/40 | 38/40 | 40/40 |
| +15 ms, 20 sessions | found in 37/40 | 8/40 | 27/40 |

A large persistent slowdown reaches strong at about ten sessions; a small real
one mostly stays possible; noise almost never reaches strong. Below about eight
sessions nothing can be strong, because even slower-in-every-session is too
likely by chance across all the sequences checked — the honest price of asking the
question of many sequences at once. A seeded version of this simulation runs in
the test suite. The wording is "evidence", never certainty: the sign test assumes
that a sequence which is not really slower lands on either side of its session
baseline like a coin flip, and real typing only approximately does. Nothing here
became machine learning; it is two numbers per row and two thresholds.

**Known limitations, stated rather than buried.**

- Four to about seven sessions can only ever produce possible findings. That is
  deliberate: at four sessions a sequence slow in three is 31% likely by chance.
- A slowdown that began recently is diluted by the older sessions in the 30-test
  window until it covers most of it.
- It ranks timings; it does not diagnose. A sequence can be slow because the
  movement is awkward, because it occurs in long or unfamiliar words, or because
  it is where someone pauses to think. Nothing here separates those.
- The built-in text is a common-word list, so digraph frequencies are not those
  of English prose, and a digraph can miss the threshold for being rare in the
  word list rather than rare in typing.
- Telemetry is retained for 50 sessions and at most 30 are analysed, so this is
  a window on recent practice, not a lifetime record.

**It is not on the typing path.** The analysis runs when the statistics page
loads or its range changes. The typing screen does not import it, and the hook
that drives it keeps the result paired with the session set it came from, so
changing range shows nothing rather than briefly showing the previous range's
sequences as though they were the new one's.

### The first intervention: a persistent slow transition becomes a drill

```
persistent analysis → [Train] → drill text → the ordinary typing screen → drill result
```

Everything before this measured. This acts on a measurement, and it is the
smallest thing that could: one button on the ranked list, forty words built
around one transition, and a result that says what happened without claiming
what it means.

**The text is real words from the existing corpus.** A drill for `in` is built
from the corpus words that contain it — in, into, think, find, being, going,
begin, bring and six more. Nothing is invented and no second corpus exists. A
sequence no word contains produces no drill at all, and the screen says so: a
page of invented syllables would train a movement the typist will never make.
The `Train` button is only offered for sequences with strong evidence that a
drill can be built from; a possible finding gets a quiet "Try a drill" link
instead, so a difference that may be noise is not presented as something to act
on.

**It is not all target words, and that is the point.** Roughly two in three
words carry the target and the rest are ordinary, so the hands keep changing
what they do on either side of it. "in in in in in" trains a repetition that
does not occur in real writing, and so does a page made only of `in` words. The
same word never appears twice in a row. Measured on a real run: 40 words, **27
occurrences of `in` across 13 distinct carrier words**, against about five
occurrences in an ordinary 60-word test.

**It is the same typing screen.** Same engine, same metrics, same telemetry,
same persistence — the drill is a `TextProvider` and a `SessionContext`, and the
typing screen does not know it is special. A drill records `mode: 'drill'` and
the sequence it targeted, so it is distinguishable in history without a second
format anywhere.

**Where the target is recorded, and why there.** On `SessionContext`, which is
the object describing how a session was configured. Not inside the telemetry
blob: telemetry is keyed by session id, so a keystroke log is *joined* to its
target rather than carrying a second copy that could disagree with the first.
`StoredTelemetry` is unchanged and needs no version bump.

**The baseline is captured before a key is pressed.** A drill is a session, so
the moment it is saved it becomes part of the history a baseline is computed
from; reading the baseline afterwards would compare the drill against a figure
that already included it. The page holds the drill until the baseline has
loaded, for exactly that reason.

**Earlier drills never count towards a baseline** — and not towards the ranking
on the statistics page either. Drill text is deliberately lopsided, so a few
repetitions would supply most of the observations for whatever was drilled and
drag its median towards drill performance. The comparison would quietly become
drill-against-drill and the ranking would describe the drills rather than the
typing that prompted them. The speed and accuracy figures *do* count drills,
which is a different question: a drill is real typing, and how fast it was typed
is a fair thing to record.

**What the result says, and what it refuses to say.** The drill's median for the
target, the typist's baseline, and the difference between them — three numbers
of the same weight, no colour, no percentage. A percentage of a figure this
noisy would read as precision that is not present. Two counts are shown rather
than one, because the gap between them matters: 27 occurrences and 27 clean
transitions is a different session from 27 and 18. The difference is taken from
the two rounded figures beside it, so the three always subtract on screen.

**The difference comes with its noise band.** With nothing changed, the audit saw
16 of 60 drills look at least 5 ms faster, and the screen offered nothing to
weigh that against. With four or more earlier sessions the result now also gives
the range this transition usually falls in during ordinary tests — the 10th to
90th percentile of its per-session medians — and says whether the drill landed
inside it ("within normal variation"), below it or above it. In simulation an
unchanged drill landed inside in 42 of 60 histories at four sessions and 54 of 60
at ten, and a genuine 40 ms change landed outside in at least 58 of 60. It is a
statement about where one number fell, not a test of significance, and the
existing caveat that one drill is not proof of a lasting change stays.

The browser run that verified this is worth recording, because it is the case
that could have been faked. A simulated typist with a planted 55 ms penalty on
`in` produced a ranking of `in` at 141 ms against an 87 ms baseline. Drilling it
*while still carrying the same penalty* reported **144 ms against 141 ms, a
difference of +4 ms** — the measurement declined to manufacture an improvement.
Re-typing the same drill without the penalty reported **86 ms, −55 ms**. The
comparison moves in both directions and only when something really changed.

Nothing here recommends what to practise next, scores the attempt, or says a
transition was fixed. The hypothesis under test is only whether personalised
transition detection can produce a useful targeted exercise; a drill that
congratulated the typist would be answering a different question.

### Statistics read history; they never rewrite it

```
TypingSession[] → statistics functions → derived statistics → UI
```

`@core/statistics` is plain functions over a `readonly TypingSession[]`. No
React, no storage, no clock. Nothing in it writes, reorders or amends a session:
stored sessions are historical facts, and every `sort` in the module copies
first. Two tests assert exactly that, because the failure would be silent.

**Every figure names what it is.** `average*` is the arithmetic mean, `median*`
the middle value, `best*` the maximum, `total*` a sum. A figure that cannot be
computed from the sessions given is `null` — never zero. Zero is a measurement;
null is the absence of one, and a page that shows "0 wpm" for "no tests yet" is
lying quietly.

**Sessions are weighted equally.** The average of a 15-word test and a 60-word
test is the mean of the two speeds. Weighting by characters is equally
defensible; this is the choice that was made, and it is stated in a test.

**One far-out session does not decide the average.** A mean is dominated by a
single extreme value: in the audit two implausible sessions pushed the average
to 714 WPM against a median of 115 and consistency to 0%. The average, the
average raw speed and consistency now leave out sessions far outside the
typist's own others in the range shown — Tukey's "far out" rule, more than three
interquartile ranges beyond the quartiles of net WPM. It applies only with at
least five sessions, and the spread it uses is at least a tenth of the median, so
a typist whose tests are all nearly identical does not lose a slightly different
one. **Nothing else changes**: the median, the best, every count and total and
every chart use all sessions, and no stored measurement is altered. There is no
WPM cap anywhere — a cap would be a claim about what speeds are possible, where
this is only a statement about which of *this* typist's results are unlike their
others. When a session is left out, the statistics page says so, with its speed.

**Consistency is across sessions, not within one.** `1 - (standard deviation /
mean)` of session speeds, clamped to 0..1, null below two sessions. Other typing
sites show a within-test consistency computed from per-keystroke timings — which
this application does not store, so computing it here would mean inventing it.

**Ranges are local calendar days.** A test finished at 11pm on Monday belongs to
Monday, not to Tuesday because UTC had already rolled over. Bounds come from
local getters; day keys are built by hand from `getFullYear`/`getMonth`/
`getDate`. `toISOString().slice(0, 10)` is the wrong tool and the easy mistake:
it returns the UTC date, which is a different day for much of every day.

Day arithmetic goes through `setDate`, which steps calendar days across
daylight-saving changes; subtracting `n * 86_400_000` lands an hour out on the
two days a year a local day is not 24 hours long. "Last 7 days" means the seven
calendar days ending today, so it starts at local midnight six days ago.

**Trend data is chart-agnostic.** Arrays of numbers and dates in chronological
order, with no scales, pixels or colours decided. The statistics layer returns
only days that _have_ sessions; filling the gaps is a decision about the
picture, so the activity chart makes it — otherwise a day in August would be
drawn next to a day in September and read as consecutive.

`buildStatisticsReport(sessions, range)` filters and computes once per range
rather than each figure walking the history again. It is a pure function of its
arguments, so it can be memoised, cached per range, or replaced by an indexed
query later without any caller changing.

### Branded domain types

`Wpm`, `Accuracy`, `Milliseconds` and `Timestamp` are branded, so passing a
duration where a speed is expected is a compile error rather than a wrong number
on a chart. Constructors validate invariants once — an `Accuracy` is guaranteed
to be within 0..1 everywhere it appears, so nothing downstream re-checks it.

### Time is passed in, never read inside

The engine takes a `Timestamp` on every input rather than calling
`performance.now()` internally. This makes a session replayable from its stored
keystrokes, which is what allows historical results to be recomputed if a metric
definition changes later. It also makes engine tests exact rather than
timing-dependent — there is not a single fake timer or `await` in the suite.

### The typing engine

Errors **do not block**: a wrong character is marked wrong and the cursor moves
on, rather than refusing to advance. This is what fast typists expect, and it is
the only model that measures how someone actually types instead of imposing a
correction rhythm. Backspace is how mistakes get fixed.

**An error costs one word, not the rest of the test.** Comparing position by
position has no way back into alignment, and the audit measured what that did:
one extra letter left 52 of the next 60 characters wrong, and one dropped letter
turned a 130 WPM test into 9 WPM at 7% accuracy. The space bar now
re-synchronises to word boundaries (`core/engine/input-rules.ts`):

- a letter typed where a space belongs is recorded as an extra and the cursor
  holds on the boundary;
- a space part-way through a word ends it — the letters not reached are marked
  incorrect — and the cursor moves to the next word;
- a space before any letter of a word is ignored.

Each keystroke is still recorded once, at the position it was compared against,
so raw WPM, net WPM, accuracy, corrections and telemetry keep their definitions.
Telemetry replays the same rule when it derives the cursor from a stored log, so
the live engine and the analysis cannot disagree about where a key landed. Two
errors still shift a whole word, exactly as on Monkeytype: a missed space, which
merges two words, and a space inside a word, which splits one. Both look
identical to the contained cases when the key arrives, so guessing would
misalign typists who made no error. `Ctrl`+`Backspace` recovers either.

**A pause is capped, not counted in full.** Nothing detected a typist walking
away: eight seconds mid-test saved a 130 WPM test as 80 WPM. Any single gap
between keystrokes now counts as at most `IDLE_GAP_CAP_MS`, three seconds. No
real hesitation reaches that — a keystroke gap at 130 WPM is under a tenth of a
second, a pause to find a word well under two — so ordinary typing is charged in
full and the screen never pauses on its own. After three seconds the clock stops
advancing, the hint line says "Paused — keep typing to continue", and the next
key resumes from where it left off. The most an interruption can cost is three
seconds, whatever its length. A test left and never finished is not saved,
exactly as before: only completed tests are recorded. The cap is worked out from
keystroke timestamps rather than from a timer, so it holds in a background tab
where timers are throttled, and it is an engine option rather than a rule, so a
future timed mode can leave it off.

A fixed mistake still happened. Retyping a character correctly after a backspace
marks it `corrected`: it counts toward speed (the text is right) and permanently
against accuracy (the error occurred). The metric definitions are stated in
`metrics.ts` and tested independently of the engine:

```
raw WPM  = every character typed      / 5 / minutes
net WPM  = characters currently right / 5 / minutes
accuracy = correct character attempts / all character attempts
```

Backspaces are recorded for replay but are not character attempts, so they
appear in neither metric — the elapsed clock already charges the typist for the
time they cost.

Training modes plug in through a single `isComplete(snapshot)` predicate. A
timed mode passes `(s) => s.elapsedMs >= 60_000`, a word-count mode counts
finished words. Neither requires a change inside the engine, and both are tested.

### Rendering the typing surface

The screen holds no per-keystroke state in React. Keystrokes go from a window
listener straight into the engine, and components subscribe to the engine
through `useSyncExternalStore`, each selecting only the value it displays.

Every character is its own subscriber. A keystroke changes one character's state
and moves the caret, so two components re-render and the other few hundred are
untouched. Rendering the text from a parent that re-renders per keystroke would
rebuild every element in it instead.

Two rules make this work, and breaking either is the likely cause of any future
slowdown:

- **Selectors return primitives.** Returning a fresh object or array makes React
  think the value changed on every read.
- **Selectors return the value as displayed.** The timer selects whole seconds,
  not milliseconds, so it re-renders once a second rather than ten times.

Measured in the browser with ~300 characters on screen: **1.5 DOM mutations per
keystroke**, and **input-to-DOM latency of 0.3 ms median, 0.8 ms worst** across
a run including mistakes and backspaces. The budget is 92 ms per keystroke at
130 WPM, 80 ms at 150.

A note on how _not_ to measure this. Timing the `dispatchEvent` call alone
reports near-zero, because React coalesces external-store updates rather than
flushing them synchronously — the render happens after the timed section and is
never counted. The figures above come from waiting on the `MutationObserver`
record that each keystroke produces, which measures through to the DOM actually
changing. Timer-paced measurement also needs the page to be _visible_: browsers
clamp `setTimeout` to about one second in a hidden tab.

The caret is drawn as a pseudo-element on the character it precedes, so moving
it is a class change rather than measuring the DOM and repositioning an element.
Character colours have no transition: a colour that fades in over 120 ms is a
colour that is wrong for 120 ms, and at speed the trail reads as lag.

### The reading area outranks the metrics

Two decisions that came out of measuring the screen rather than looking at it.

**Untyped text is sized for reading ahead.** At speed the typist is reading one
or two words in front of the caret, so the _upcoming_ text is the working
surface. It measured 2.76:1 against the background — below the 3:1 floor for
large text — while already-typed text sat at 16.5:1. The hierarchy was
backwards: the most legible thing in the reading area was the part already
finished with. Untyped text is now 4.25:1 and still clearly distinct from typed
text at 3.88:1.

**Numbers hold still.** The live figures are smaller than the typing text, and
each sits in a box wide enough for its widest value with tabular figures inside
it. Without the reserved width the row shuffled sideways every time a figure
gained or lost a digit — 15 px as accuracy went from 100% to 75%. Movement at
the edge of vision is exactly what a fast typist notices.

### Tab restarts, but never traps

Tab abandons a test in progress and starts a fresh one, which is the convention
typists expect. Swallowing it unconditionally turned the page into a keyboard
trap: focusable controls that no keyboard user could reach.

It is now intercepted **only while a test is actually running**. Idle, and on
the results, it moves focus as normal.

**Enter is what repeats a test.** Once results are on screen they carry their
own controls, so Tab has to be left alone there — but making the repeat loop
cost two keys would tax the thing a daily user does twenty times in a row.
Enter does nothing on an empty page, so claiming it takes no behaviour away,
and it keeps the loop to one key.

Both are given up the moment a control has focus: Enter on a focused link and
Space on a focused button belong to that control, and the handler checks the
event's target before taking either. Nothing below that check runs once a test
is over, which is what stops a stray `preventDefault` from disabling the
results' own buttons.

### Input: a physical keyboard, by decision

The typing screen reads `keydown` on the window and has no editable element, so
on a phone or a tablet without a keyboard the on-screen keyboard never opens, and
Android's IME reports `key: "Unidentified"` regardless. For now this application
is **desktop and keyboard-first**, and says so: where the primary pointer is
coarse and nothing hovers, the typing screen shows "Typing here needs a physical
keyboard." A touchscreen laptop has a fine pointer and hover, so it never sees
the note.

The boundary a touch path would plug into already exists and is the engine, not
the screen: `start`, `input(key, at)` and `deleteWord(at)` are the whole input
surface, and nothing in the engine, metrics, telemetry or persistence knows where
a key came from. The keyboard mapping is one `keydown` handler in
`useTypingSession`. Touch support would be a second small adapter reading a
hidden field's `beforeinput` events and calling the same three methods — not a
second typing system.

### GGTyping effects listen to the engine and move the DOM directly

The first GGTyping effect — a word jumps after three consecutive mistakes on it —
is built so that it cannot touch what the application measures, and so that
future effects have a pattern to copy. The conventions are in
[GGTYPING.md](./GGTYPING.md); the structural decisions are these.

- **It is a listener, not a participant.** `@features/ggtyping` subscribes to
  engine events and uses the keystroke's own `correct` verdict and position. It
  never calls into the engine. A test replays the same keystrokes through two
  engines, one with the effect connected and jumps firing, and asserts the
  results, keystroke logs and derived telemetry are identical; another wraps the
  engine in a proxy and asserts only `on` and `getSnapshot` are ever called.
- **No React state, no re-render.** A jump is played with `element.animate` on
  the word's element, found through a map filled by ref callbacks. Nothing
  re-renders because a word jumped: measured at 4.5 renders per keystroke for
  mistake-and-backspace typing with jumps firing and 4.5 with animation
  unavailable. The snapshot is read once per test and once per completed word —
  both the same cached object the screen reads anyway — and never per keystroke.
- **Words are wrapped, always.** A transform does not apply to a plain inline
  box, so each word's letters sit in an `inline-block` span. Always, not only
  during a jump, because switching display would reflow the line. Measured in
  Chromium with and without the wrappers at 1,510 px and 375 px, for 15, 30 and
  60-word tests: no character moved.
- **The motion is in em.** The typing text is 28 px on a desktop and 20 px on a
  phone. A fixed 12 px jump made the word's text box overlap the line above by
  1.3 px on a phone; at 0.43 em it clears it by about 2 px.

### GG.Typing is a second presentation of the same typing session

`@features/gg-ui` is the GG.Typing interface: a shell (top bar, theme panel) at
`/gg`, outside `AppLayout`, around a typing screen (control row, toolbar, word
stream, input), with practice at `/gg` and drills at `/gg/drill/:sequence`.
Every link to practice or to a drill leads there. The classic practice and drill
screens stay at `/practice` and `/drill/:sequence`, and history, statistics,
session detail and settings are the application's own pages, reached from the
shell rather than rebuilt in it. Its token plan is in
`src/features/gg-ui/TOKEN_PLAN.md`.

- **One session, two screens.** `useTypingScreen` composes the session, text
  provider, drill context and drill comparison once; the classic `TypingTest`
  and `GGTypingScreen` both render it. So a test is the same test — engine,
  clock, idle cap, saved session, telemetry, drill measurement — whichever screen
  it was typed on, and neither screen computes a figure: the live values are
  shared selectors over the engine snapshot, and the result is the stored record.
- **Time is the same engine, not a second one.** A timed test is the engine's
  own completion seam — `elapsedMs >= the time` — with the idle gap cap turned
  off, because a timed test charges every second whether or not anyone is
  typing. Completion is checked before a keystroke is applied as well as after,
  so a key that arrives after the time is up ends the test rather than being
  counted in it, and the tick that already drives the clock ends a test nobody
  is typing into. The shape of the test (words or time, and how much of either)
  is a preference; changing it builds a new engine, because how the clock runs
  is fixed when an engine is made, and lays out new material to match.
- **Tab is the way back into typing.** On a finished test it starts the next one
  immediately; while one is under way it restarts it. Both are read on the
  typing field alone, so Tab anywhere else on the page still moves focus — the
  result's own controls stay reachable — and Tab on an idle test moves focus
  rather than restarting nothing.
- **Live accuracy is three states, not a number.** The same accuracy the engine
  reports, read as a ratio rather than a rounded percentage, so 95.99% is below
  the line while the figure beside it still says 96. A component subscribed to
  the state re-renders when the state changes and at no other time, which is
  what keeps one warning from arriving sixty times a second.
- **Keys reach a test through commands, from one adapter per screen.**
  `useTypingSession` exposes `inputKey`, `deleteWord` and `restart` and listens
  to nothing. The classic screen's adapter is a window `keydown` listener
  (`useKeyboardInput`); GG.Typing's is its text field's `beforeinput`, with Tab
  and Enter read from `keydown` because not every source of key events turns
  them into input. What a key does to a test is decided once, in the session.
- **Drills are set up once for both screens.** `useDrillSetup` builds the drill
  and captures its baseline from ordinary sessions before anything is typed; both
  drill pages render from it.
- **Preferences are the settings store's.** The theme (a GG theme id, with the
  old `dark`/`light` values migrated to the defaults of the same scheme), the
  text size and the practice length are stored with the other preferences. The
  classic pages follow the chosen theme's scheme. A fresh installation opens in
  Classic Milk; only a preference never saved takes the default, so a theme
  someone chose — including the dark theme that used to be the default — stays.
- **The first paint is in the saved scheme.** The stylesheet on its own draws
  the page dark until the application has run. A few lines inlined into the page
  head at build time, generated from the theme registry, read the saved theme
  from storage and set its scheme first, so a fresh installation never flashes
  dark and a dark theme never flashes light.
- **Shared components are themed through a token bridge.** Inside the shell the
  classic `--color-*` tokens are mapped onto the GG theme, so the result panel
  and drill comparison are the application's own, not copies.
- **The cursor never reads layout on a keystroke.** Character positions are
  measured in one pass when they can change (new text, size, resize, fonts), and a
  keystroke only writes two transforms. A test counts layout reads and fails if a
  keystroke makes one.
- **Themes are objects of six base colours and a glass recipe.** Everything
  else is `color-mix()` in `gg-foundation.css`, so another theme is one object,
  and a test fails if a component names a theme or any GG file other than
  `themes.ts` holds a colour. Each theme is held to contrast floors by test, on
  the page and through its glass.
- **Glass is one material, defined once.** Fill, dense fill, border, highlight,
  shadow, blur, reflected tint and active tint are semantic tokens built from the
  theme; components use them and write no blur, fill or glass shadow of their
  own (a test reads the stylesheets). Glass is the chrome — the top bar, theme
  panel, input and Hover Mode's selector — never the typing text. Where
  transparency is unwanted it becomes solid surface.
- **A theme switch is instant.** Transitions are held off while the new theme
  is written and style is recalculated, so a shared component that eases its own
  colours changes on the same frame as the rest of the page. No GG stylesheet
  transitions a colour at all; touch responses are transform and opacity.
- **Sound is made, not recorded.** `@features/sound` builds every sound from a
  couple of oscillators and a burst of filtered noise, so there are no audio
  files to ship or license and every keystroke can differ slightly. It is off
  until a pack is chosen, and until then no audio context exists at all; the
  context is opened by the click that chooses one, which is the gesture browsers
  require. It listens to the events the session and Hover Mode already announce
  — neither knows sound exists — so a keystroke does no extra work for it, and a
  browser without Web Audio, or a graph that throws, is silent rather than
  broken.
- **Master volume is one gain.** Everything GG.Typing plays goes through the
  engine's single master gain, so the packs keep their proportions exactly at
  any volume. The slider is squared rather than straight, because hearing is
  not linear: half the slider is about 12 dB down, which is roughly half as
  loud, and zero is silence rather than a whisper.
- **A sound pack is a character, not a copy.** Every pack is built from one set
  of recipes bent by a handful of numbers — depth, length, brightness, hardness,
  dampening, and whether it rings — so another keyboard is one small object and
  none can drift out of proportion. Hover Mode's notes and the selector's glass
  are the same in every pack: they belong to the application, not to the keyboard.
- **One unfolding, three trees, one open.** The glass node that opens into
  branches is `components/Unfold`: Hover Mode's difficulties, the paces and the
  sound packs are the same interaction with different choices. Which tree is out
  is not any selector's state but one value in the shell (`branch-trees.ts`), so
  two trees open at once is not a state the page can be in. A branch can be
  present but not yet a choice (a pace with no history behind it), saying why. Both are temporary: a tree
  unfolds when its node is pressed and folds the moment a choice is made — the
  one already chosen included — when its node is pressed again, on a press
  anywhere outside the trees, or on Escape, which brings focus back to the node.
- **Asking for one tree while another is out is a handover, not two animations.**
  On a desktop both trees grow in the same row beneath the toolbar. The open one
  starts folding on the press; the new one starts growing 120ms later, from the
  height the old row had at the press, so the page below moves once and in one
  direction. Measured in Chromium: never two trees' branches both more than half
  visible in any frame, about 30ms in which both are faintly there, and no
  reversal in the movement of the text beneath. The shell keeps each tree's
  spring, so a tree folding as the page changes carries on folding on the new
  page. On a phone each tree hangs under its own node; the rule is the same.
- **The Syllable Trainer lays syllables over the text; it never types them.** A
  Syllable Trainer test is an ordinary engine over ordinary text — words from a
  200-word syllable corpus (`core/syllables`), joined by spaces — so every key is
  compared, recorded and scored exactly as anywhere else, and the telemetry is a
  keystroke per character typed. The stream draws each word as its syllables
  with a breathing space between them that is laid out once and never typed.
  Which syllable is in hand, and whether a word resolved clean or was missed, is
  worked out from the cursor and the engine's character states, never kept: a
  word resolves clean only when every letter is right, so a space part-way
  through or a standing mistake is shown as missed, not done. The test is saved
  as mode `syllable`, one of the training modes that analyses of ordinary typing
  leave out. The per-keystroke cost measured the same as ordinary practice's
  within a tenth of a millisecond.
- **The rhythm is data, and guidance is not a gate.** Every duration — the
  demonstration's letters, breaths and holds, and the cue at a boundary while
  training — is in `core/syllables/rhythm.ts`, handed to the stylesheet rather
  than written into it. Nothing waits for a pause and no pause is scored; the
  boundary cue fades over a test so the rhythm moves from the screen to the
  typist.
- **A word that keeps costing mistakes is kept.** Five wrong keystrokes on the
  same word in one test make it a Golden Nugget, counted in memory from the
  engine's own account of which word a keystroke acted on. Storage is touched
  once, at the moment a word crosses the line, and never again for that word;
  a test in which nothing crosses writes nothing. Hover Mode does not count
  twice: there, every mistake on a focused word is already part of the focus.
- **Physical motion is a spring solved exactly.** Each tree unfolds and folds on
  one spring whose position and speed are known at any moment, so it turns
  around mid-flight from where it is. Opening overshoots by a hair; folding is
  critically damped and a little heavier than opening, slower to get most of the
  way home. The shell keeps that state across pages, so the selector on the new
  page carries on from the old one. Every frame is sampled into Web Animations keyframes played
  on the compositor; nothing runs per frame in script, and nothing waits for the
  motion before it can be used.
- **A pace caret is the typist's own speed, and costs a keystroke nothing.** The
  paces are read from history (`core/statistics/pace.ts`: the median, the
  fastest and a 5% push over the last twenty ordinary tests, training modes left
  out) on arrival and after each save, never while typing. The caret keeps the
  test's own time from the engine's events — so Hover Mode's pause pauses it —
  and one animation frame loop, only while a test runs, moves it by transform to
  a character's already-measured box (`StreamCursor.boxOf`). Measured in
  Chromium, a keystroke's synchronous cost was the same with it on and off.
- **Focus while typing is one attribute.** The chrome is marked where it is drawn
  (`data-recede`); the shell's element carries `data-typing`, set by the typing
  screen from engine events and cleared by a real pointer movement
  (`layout/typing-focus.ts`). Per keystroke that is one boolean compared; the
  stylesheet does the rest with opacity, and `:focus-within` brings back whatever
  the keyboard reaches.
- **Golden Nuggets practice is Hover Mode, not a new mode.** A provider lays the
  typist's nuggets into ordinary text (`golden-nuggets.provider.ts`), and the
  practice page is the Hover Mode screen over it, so focusing, repetition,
  saving and writing outcomes back to the nuggets are the machinery that already
  exists. The session is Hover Mode with source `golden-nuggets`.
- **Punctuation and numbers dress words; they never change how many.** The
  common-words provider draws its words as always and `dressWords`
  (`core/text/dress.ts`) attaches marks and swaps in figures, so a word count is
  still the count chosen and the engine sees ordinary text. The choice is two
  preferences; the session records it as its `difficulty`, the field the model
  had reserved for this. A change reaches the session as a text key, which makes
  a new engine and new material the same way a change of test shape does.
- **The Syllable Trainer's rhythm is read once, after the last key.**
  `readRhythm` (`core/syllables/reading.ts`) takes the finished result's
  keystrokes and the syllable layout, keeps the clean transitions by telemetry's
  own rules, and compares the median gap inside a syllable with the median gap at
  a break. The screen asks for it on the engine's `finished` event; nothing runs
  while typing.
- **Type is Geist, self-hosted.** Geist for everything read and Geist Mono for
  everything typed or counted, as two variable fonts from `@fontsource-variable`
  whose Latin files are about 52 kB together and fetched only for the shell. The
  shell maps the application's type and weight tokens onto them — weights set
  between the usual steps, so emphasis never turns heavy — and the application's
  own components inside it follow without a change. The stream measures its
  characters again when the fonts arrive.
- **Input comes from `beforeinput`, not `keydown`**, so input methods,
  automation and multi-character insertions reach the session the same way a
  physical key does. On-screen keyboards are still not supported, as on the
  classic screen: composition, autocorrect and prediction are not counted
  faithfully.

### Accessibility fixes that cost little

- **A mistyped character is not marked by colour alone.** Its red is the same
  lightness as untyped grey (1.01:1 in the light theme), so it now also carries a
  bar along its bottom edge. An inset shadow rather than an underline, because a
  mistyped space is one of the commonest errors and an underline is not reliably
  drawn under a space at a line end; the shadow changes no layout. A test keeps
  the rule from being quietly removed.
- **Finishing a test is announced.** The live figures are `aria-live="off"` on
  purpose, and the result panel appears silently, so a screen-reader user heard
  nothing. A polite status region, present and empty while typing, now says the
  headline — speed, accuracy, and a failed save if there was one — and empties
  for the next test.
- **A skip link** is the first thing in the tab order on every page and moves
  focus to the main content.
- **Each page names its tab.** `Page` sets the document title from its heading;
  the practice and drill screens, which are not built on `Page`, set their own.
- **Focus stays visible.** New controls use the global focus ring; the only
  suppressed outline is on the main landmark the skip link lands on, which is not
  a control.

### Live speed is withheld for the first second

The clock starts on the first keystroke, so after N characters only N-1
intervals have been measured — the first character is free. A typist holding a
steady 130 WPM sees 229 on their third keystroke, falling through 176 and 153
before settling.

Over a full test the same bias is worth about 0.3%, so the engine's definition
is unchanged. The UI shows a dash until a second has elapsed, then a number that
is accurate from the moment it appears.

### Text comes from a provider

The typing screen asks a `TextProvider` for a target and knows nothing about
where the words came from. One provider exists — random common words. Quotes,
pasted text, generated and adaptive material are additions behind the same call.

`provide` is synchronous, unlike the persistence layer. A provider that needs to
load a corpus loads it when constructed, which keeps the loading concern at the
composition root rather than putting a spinner in front of every keystroke.

### Engine purity is proven, not asserted

Three independent checks, each verified by planting a deliberate violation:

| Leak                                                                  | Caught by                                         |
| --------------------------------------------------------------------- | ------------------------------------------------- |
| `import ... from 'react'`, or any `@app`/`@features`/`@shared` import | `no-restricted-imports` in lint                   |
| Naming any DOM type, **even in code that never runs**                 | `npm run typecheck:engine`                        |
| Executing DOM access at module load                                   | the `domain` test project, which runs with no DOM |

`tsconfig.engine.json` compiles the engine and domain types with the DOM type
library removed, so `window`, `document` or `HTMLElement` fail to compile even
as dead references. Runtime tests cannot catch those; the compiler can. This is
why `crypto.randomUUID` is reached through a locally declared interface rather
than the ambient `Crypto` type.

### Configuration vs preferences

Two different things, deliberately separated:

- **Configuration** (`src/config`) is fixed at build time and identical for
  everyone. `import.meta.env` is read in `env.ts` and nowhere else, so a bad
  environment fails loudly in one place.
- **Preferences** (`@core/types/preferences`) are chosen by the typist at
  runtime and persisted.

## Known concerns

Recorded honestly rather than hidden:

1. **Theme flash on load.** Preferences hydrate asynchronously, so a typist who
   chose light sees one dark frame first. This is the cost of the async-first
   persistence interface. The fix — a small inline script in `index.html` that
   reads the key before paint — duplicates key knowledge into HTML, so it is
   deferred until the theme is worth that trade.

2. **`localStorage` will not hold a keystroke archive.** It caps around 5 MB and
   is synchronous on the main thread. It is fine for preferences and adequate
   for early session summaries; full keystroke histories need the IndexedDB
   adapter. The interface already accommodates this.

3. **The layer rule is enforced by import path, not by build boundary.** The
   lint rule catches `@features/...` imports from core but not a deep relative
   path like `../../features/x`. In practice the alias is what people write.

4. **Snapshots are copied, not frozen.** Each snapshot holds fresh arrays, so a
   caller cannot corrupt engine state. They are not `Object.freeze`d: the
   `readonly` types state the contract for every caller the compiler can see,
   and freezing two arrays per keystroke to defend against code that
   deliberately casts those types away is not worth the cost.

5. **Counting is O(n) per snapshot.** Correct and incorrect characters are
   counted by scanning the state array rather than maintained incrementally.
   For a few hundred characters at ~13 keystrokes per second this is
   immeasurable, and the scan is obviously correct where incremental counters
   would need care around backspace and correction. Revisit only if a profile
   says so.

6. **No CI pipeline.** `npm run verify` is the gate, but nothing runs it
   automatically yet.

7. **Storage is never pruned.** Each session costs about 836 characters of
   `localStorage`. At a typical 5 MB limit that is roughly 6,000 sessions, after
   which saves fail — reported on screen, not silently — until something is
   deleted. Telemetry retention is already bounded; session records are not.

8. **A missed space or a split word still costs a word.** The error model contains
   extra letters, dropped letters and early spaces to one word, but a space typed
   inside a word, or a word boundary typed through, shifts alignment by one word
   until corrected, as on word-based typing sites. `Ctrl`+`Backspace` recovers it.

9. **No touch input.** Deliberate for now; see "Input: a physical keyboard, by
   decision".

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

The index is a cache of an ordering; records are authoritative. Where they
disagree, the record wins and the stale entry is skipped, so a partial write
degrades to a missing row rather than a broken page. `clear()` works from the
keys actually present rather than the index, so a record the index lost track of
is still removed — and it removes only session keys, leaving preferences and
anything else on the origin alone.

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

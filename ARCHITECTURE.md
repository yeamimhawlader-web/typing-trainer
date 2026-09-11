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

Repositories, migrations and query APIs are **not** built yet. There is no
session data to store, so there is nothing to design them against.

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

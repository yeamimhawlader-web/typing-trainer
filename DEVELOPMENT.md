# Development

How to work in this codebase. Read [ARCHITECTURE.md](./ARCHITECTURE.md) first
for why it is shaped this way.

## Commands

```bash
npm run dev          # dev server at http://localhost:5173
npm run verify       # typecheck + engine purity + lint + tests — the gate
npm run test:watch   # tests, re-running on change
npm run build        # typecheck + production build
npm run format       # prettier
```

`npm run verify` is the gate. Lint runs with `--max-warnings=0`, so a warning
fails it.

## Adding a feature

A feature is a vertical slice. Everything belonging to it lives under
`src/features/<name>/`:

```
src/features/<name>/
  pages/         route-level components
  components/    components used only by this feature
  state/         zustand store(s)
  hooks/         React hooks bridging state and UI
  <name>.test.ts
```

Steps:

1. **Put the logic in `src/core/` first if it is not about React.** Scoring,
   text generation, statistics and storage are domain code. Write them as plain
   functions with plain inputs, and test them without a renderer.
2. **Add state under `state/`** as a store factory taking its dependencies as
   arguments — `createXStore(adapter)` — with a singleton exported alongside.
   The factory is what makes the store testable without mocks.
3. **Add the page under `pages/`** and register it in `src/app/router.tsx` with
   a path in `src/app/routes.ts`. Features never register their own routes.
4. **Components read state and dispatch intents.** They do not compute
   statistics, talk to storage, or own timers.
5. **Run `npm run verify`.**

## Rules that are actually enforced

These fail the build, so they are not up for negotiation in review:

- `src/core/**` may not import React, `react-dom`, `@app/**`, `@features/**` or
  `@shared/**`.
- `src/core/engine/**` and `src/core/types/**` may not name a DOM type at all,
  even in code that never runs. `npm run typecheck:engine` compiles them without
  the DOM type library.
- `src/shared/**` may not import `@app/**` or `@features/**`.
- A feature may import another feature only through its public barrel
  (`@features/results`), never a file inside it.
- No unused locals or parameters, no implicit `any`, no unchecked index access.

## Conventions

**Imports** use aliases (`@core/...`, `@features/...`), not long relative paths.
Relative imports are fine within a single module directory. Include the file
extension — `./types.ts`.

**Barrels.** Import from a module's public entry (`@core/persistence`), not from
its internals. When adding a public export, add it to that module's `index.ts`.

**Styling** is CSS Modules colocated with the component, using semantic tokens
only:

```css
/* yes */
color: var(--color-char-incorrect);

/* no — literal value */
color: #ff5555;

/* no — primitive, not semantic */
color: var(--palette-danger-500);
```

If a value you need has no token, add a semantic token to `tokens.css` rather
than a literal to a component. Define it for both themes.

Compose class names with `cx()` from `@shared/lib`.

**shadcn/ui and Tailwind components** are the one exception, and they live in
one place: `src/components/ui`. That folder is shadcn's default (see
`components.json`), and it matters that it is exactly that path — components
added with `npx shadcn@latest add …`, or pasted from galleries built on shadcn,
import each other and their helper as `@/components/ui/…` and `@/lib/utils`,
so keeping the folder where they expect it means they work without their
imports being rewritten. The application's own UI stays in CSS Modules
(`src/shared/ui` and each feature).

Tailwind (`src/styles/tailwind.css`) is set up so it cannot touch anything
else: it generates classes only from `src/components/ui` and the pages that
place those components (add a page with `@source` there), it has no preflight
(the app's `reset.css` is the reset), and its utilities are unlayered so they
still beat the reset's element rules. So a pasted component that counts on
preflight for something — inputs with no border, say — needs that stated in its
classes (`border-0`). Colours are the app's semantic tokens, mapped to shadcn's
names (`bg-primary`, `text-muted-foreground`, `border-border`…), so these
components follow the chosen theme.

**Tests** live next to what they test (`thing.ts` → `thing.test.ts`). Vitest
globals are off — import `describe`, `it`, `expect` explicitly.

Test behaviour, not implementation: assert what a user or a caller observes.
The persistence suite is the model to follow — one contract, run against every
adapter via `describe.each`.

**Naming.** Components `PascalCase.tsx`, everything else `camelCase.ts`, stores
`<name>.store.ts`, adapters `<name>.adapter.ts`.

**Adding telemetry.** Ask first whether it is derivable. Almost everything is:
the engine records what was pressed, what was expected, where, whether it
matched and when, and word positions and every latency fall out of those plus
the target text. Derive it in `@core/telemetry`, after the session ends. Nothing
new goes into the typing path, and nothing derivable goes into storage.

Name latencies for what they measure. A field called `latency` on a keystroke
has at least two meanings, and the wrong one is silently wrong.

**Adding a statistic.** It goes in `@core/statistics` as a pure function over a
`readonly TypingSession[]`, with a name that says what it is (`average`,
`median`, `best`, `total`) and `null` — never zero — when the sessions given
cannot support it. Never sort the argument: copy first. Date boundaries use the
local calendar helpers in `range.ts`, never `toISOString`.

**Showing a stored figure.** Format it through `@features/results`; never
recompute it. Speed, accuracy and character counts are decided once, by the
engine, and everything downstream only decides how to write them down. A page
that needs a number nobody stores wants a new field on `SessionMetrics`, not a
formula of its own.

## Working on the typing engine

The engine is the one place where the rules matter most.

- It lives in `src/core/engine/` and stays plain TypeScript. No React, no DOM,
  no `setInterval` owned internally. Reach a platform API through a locally
  declared interface rather than an ambient browser type, as `engine.ts` does
  for `crypto.randomUUID`.
- **Time is a parameter.** Every method takes a `Timestamp` from its caller.
  Never call `Date.now()` or `performance.now()` inside the engine — that is
  what keeps sessions replayable and tests exact.
- It exposes an immutable snapshot and a `subscribe` callback. React binds via
  `useSyncExternalStore`; no other adapter layer is needed.
- Test it by feeding a keystroke list and asserting on the snapshot and result.
  If a test needs a rendered component, the logic is in the wrong place. Engine
  tests run in the `domain` project, which has no DOM.

**Adding a training mode** does not mean changing the engine. Pass an
`isComplete(snapshot)` predicate to `createTypingEngine`. If a mode cannot be
expressed that way, say so before widening the engine — the predicate covers
timed, word-count and stop-on-error modes today.

## Adding a design token

1. Add the primitive to the `:root` primitives block in `tokens.css` if a new
   raw value is genuinely needed.
2. Add the semantic token that names its job.
3. Add the light-theme value in the `:root[data-theme='light']` block.
4. Add the name to `src/styles/tokens.ts` only if TypeScript needs to read it.

## Extending persistence

Add an adapter by implementing `StorageAdapter` in
`src/core/persistence/adapters/`, then add it to the table at the top of
`persistence.test.ts`. If it passes the existing suite unchanged, it is correct;
if the suite needs weakening to accommodate it, the interface is wrong, not the
test.

Repositories belong on top of the adapter, not inside it. `SessionRepository` in
`@core/sessions` is the worked example: domain methods over `StorageAdapter`,
with the UI seeing neither.

Bump `schemaVersion` in `app.config.ts` when a stored shape changes
incompatibly — it prefixes every key, so old and new records cannot be confused.

## Storing something new

1. **Model it in `@core`.** If it is measured by the engine, reuse the type the
   engine already produces rather than restating its fields.
2. **Write a parser for it**, returning null on anything unexpected. Records
   come off disk and are treated as hostile: an old build, another tab, a
   half-finished write.
3. **Put a repository over `StorageAdapter`**, and serialise anything that does
   read-modify-write on shared state.
4. **Expose it through a service**, and let the UI import only that. No
   component may reference `localStorage`, `indexedDB` or any storage API.
5. **Never write on a hot path.** Persist on a discrete event — a test
   finishing — not on input.

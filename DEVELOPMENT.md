# Development

How to work in this codebase. Read [ARCHITECTURE.md](./ARCHITECTURE.md) first
for why it is shaped this way.

## Commands

```bash
npm run dev          # dev server at http://localhost:5173
npm run verify       # typecheck + lint + tests — run before calling anything done
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
- `src/shared/**` may not import `@app/**` or `@features/**`.
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

**Tests** live next to what they test (`thing.ts` → `thing.test.ts`). Vitest
globals are off — import `describe`, `it`, `expect` explicitly.

Test behaviour, not implementation: assert what a user or a caller observes.
The persistence suite is the model to follow — one contract, run against every
adapter via `describe.each`.

**Naming.** Components `PascalCase.tsx`, everything else `camelCase.ts`, stores
`<name>.store.ts`, adapters `<name>.adapter.ts`.

## Working on the typing engine

The engine is the one place where the rules matter most.

- It lives in `src/core/engine/` and stays plain TypeScript. No React, no DOM,
  no `setInterval` owned internally.
- **Time is a parameter.** Every method takes a `Timestamp` from its caller.
  Never call `Date.now()` or `performance.now()` inside the engine — that is
  what keeps sessions replayable and tests exact.
- It exposes an immutable snapshot and a `subscribe` callback. React binds via
  `useSyncExternalStore`; no other adapter layer is needed.
- Test it by feeding a keystroke list and asserting on the snapshot and result.
  If a test needs a rendered component, the logic is in the wrong place.

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

Repositories belong on top of the adapter, not inside it. When session history
lands, expect `SessionRepository` with domain methods (`save`, `listRecent`)
built over `StorageAdapter` — and bump `schemaVersion` in `app.config.ts` when a
stored shape changes incompatibly.

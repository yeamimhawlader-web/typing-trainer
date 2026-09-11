# Typing Trainer

A typing-training platform built for daily deliberate practice.

**Status: typing test, saved history and statistics.** Run a typing test —
live speed, accuracy, timer and progress, keyboard-first — see a full result
when it finishes, find every past test on the History page with its own detail
view, and track speed, accuracy and activity over time on the Statistics page.
Finished tests also record keystroke-level telemetry — timings, word positions
and corrections — and two experiments read it. The result screen shows the
slowest character transitions of the test just typed. The statistics page asks
the harder question: which transitions are consistently slower than your own
baseline across recent sessions, with the evidence for each one beside it. Both
are experiments rather than a training system, and both say so; one test turns
out to be far too thin a sample, which is why the second exists. Nothing
recommends what to practise, and training modes are not built yet.

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Commands

| Command              | What it does                                   |
| -------------------- | ---------------------------------------------- |
| `npm run dev`        | Dev server with hot reload                     |
| `npm run verify`     | Typecheck, lint and test — the pre-commit gate |
| `npm run test:watch` | Tests, re-running on change                    |
| `npm run build`      | Production build into `dist/`                  |
| `npm run format`     | Format with Prettier                           |

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — how the project is arranged and why
- [DEVELOPMENT.md](./DEVELOPMENT.md) — how to add features

## Configuration

Copy `.env.example` to `.env.local` to override defaults. All variables are
optional.

## Stack

Vite · React · TypeScript (strict) · React Router · Zustand · Vitest · oxlint

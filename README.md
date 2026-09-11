# Typing Trainer

A typing-training platform built for daily deliberate practice.

**Status: typing test, saved history and statistics.** Run a typing test —
live speed, accuracy, timer and progress, keyboard-first — see a full result
when it finishes, find every past test on the History page with its own detail
view, and track speed, accuracy and activity over time on the Statistics page.
Finished tests also record keystroke-level telemetry — timings, word positions
and corrections. The first analysis of it appears as a footnote to the result:
the slowest character transitions of the test just typed, ranked only where a
sequence was seen often enough to mean anything. That is an experiment rather
than a training system — one test turns out to be a thin sample for the
question. Training modes are not built yet.

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

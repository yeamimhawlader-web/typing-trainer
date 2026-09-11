# Typing Trainer

A typing-training platform built for daily deliberate practice.

**Status: typing test working.** You can run a typing test — live speed,
accuracy, timer and progress, keyboard-first. Statistics, history and training
modes are not built yet.

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

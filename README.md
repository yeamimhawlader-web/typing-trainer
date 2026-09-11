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

## Keyboard

The typing screen is keyboard-first: nothing needs to be clicked before typing,
and there is no text field to focus.

| Key | What it does | When |
| --- | --- | --- |
| any character | Starts the test and types | Idle or running |
| `Backspace` | Deletes one character | While typing |
| `Ctrl`+`Backspace` | Deletes back to the start of the previous word | While typing |
| `Alt`+`Backspace` | The same — the macOS binding for it | While typing |
| `Tab` | Abandons the test and loads fresh text | While typing |
| `Enter` | Starts the next test | On the results |

A word delete takes any whitespace behind the cursor first, so from just after a
finished word the space and the word go together in one press rather than two.
Pressing it repeatedly walks back a word at a time and stops at the start.

Deleting never un-makes a mistake: accuracy is measured over attempts made, so
removing the evidence of an error does not remove the error. That is the same
rule a single `Backspace` has always followed.

`Ctrl`+`Backspace` and `Alt`+`Backspace` are the **only** modified chords the
screen claims. Every other combination with `Ctrl`, `Alt` or `Cmd` held goes
straight to the browser, so reload, new tab, close tab, find and the rest keep
working. `Cmd`+`Backspace` is deliberately not claimed: on macOS it means
"delete to the start of the line", which here would throw away the whole test.

`Tab` is only taken while a test is actually running. On the idle screen and on
the results it moves focus normally, because taking it everywhere would trap a
keyboard user on the page.

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

# Hover Typing

(Named after its Hover Mode. Inside the code the typing shell is still `gg` —
`src/features/gg-ui`, `--gg-*` tokens, the `/gg` routes — and storage keys keep
the old `typing-trainer` prefix, so nothing anyone has saved is lost. The name
people see lives in one place: `appName` in `src/config/app.config.ts`.)

A typing-training platform built for daily deliberate practice.

**Status: typing test, saved history and statistics.** Run a typing test —
live speed, accuracy, timer and progress, keyboard-first — see a full result
when it finishes, find your most recent 50 tests on the History page with their
own detail views, and track speed, accuracy and activity over time — across all
of them — on the Statistics page.
Finished tests also record keystroke-level telemetry — timings, word positions
and corrections — and the analysis built on it now leads somewhere. The result
screen shows the slowest character transitions of the test just typed. The
statistics page asks the harder question: which transitions are consistently
slower than your own baseline across recent sessions, with the evidence for
each one beside it and a plain grading of that evidence — strong, or possible
and needing more tests. Where the evidence is strong, **Train** builds a short
drill from real words containing that transition, then reports how it went
against your baseline and whether the difference is within your normal
variation.

All of it is an experiment and says so. One test is far too thin a sample,
which is why the cross-session analysis exists; and one drill cannot tell a
lasting improvement from a good five minutes, which is why its result is two
numbers and a difference rather than a verdict. Nothing tells you what to
practise next.

## Keyboard

The typing screen is keyboard-first: nothing needs to be clicked before typing,
and there is no text field to focus. It needs a physical keyboard; on-screen
keyboards on phones and tablets are not supported yet.

| Key | What it does | When |
| --- | --- | --- |
| any character | Starts the test and types | Idle or running |
| `Backspace` | Deletes one character | While typing |
| `Ctrl`+`Backspace` | Deletes back to the start of the previous word | While typing |
| `Alt`+`Backspace` | The same — the macOS binding for it | While typing |
| `Tab` | Abandons the test and loads fresh text | While typing |
| `Enter` | Starts the next test | On the results |

A drill uses the same keys as ordinary practice. Restarting one re-types the
same words, which is what makes doing it twice a comparison rather than two
unrelated pieces of text.

### Mistakes and pauses

A mistake stays in its own word. The space bar is what keeps the rest of the
test aligned:

- a letter typed where a space belongs is marked as an extra, and the next word
  is untouched;
- a space pressed part-way through a word ends that word, marks the letters you
  skipped as wrong, and moves on to the next word;
- a space before you have started a word does nothing.

A missed space, which runs two words together, still shifts the text by a word
until you fix it — `Ctrl`+`Backspace` is the quick way back.

A pause is fine. Any single gap between keystrokes counts as at most three
seconds, so a hesitation is timed in full but walking away mid-test cannot wreck
the result. After three seconds the timer stops and the screen says the test is
paused; the next key carries on.

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
- [GGTYPING.md](./GGTYPING.md) — the standard for feedback effects, starting with the word jump
- [GG.Typing token plan](./src/features/gg-ui/TOKEN_PLAN.md) — colour, type, spacing and motion for GG.Typing, the primary typing screen at `/gg`

## Configuration

Copy `.env.example` to `.env.local` to override defaults. All variables are
optional.

## Stack

Vite · React · TypeScript (strict) · React Router · Zustand · Vitest · oxlint

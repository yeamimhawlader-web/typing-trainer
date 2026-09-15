# GG.Typing UI — token plan

Written before the build, then checked against the brief. Every value below
lives in exactly one place: colours in `themes/themes.ts` (the only file with
hex), everything else in `styles/gg-foundation.css`.

## Colour

Each theme is one object of six base colours. Everything else is derived in CSS
with `color-mix()`, so a seventh theme is a single object and no component knows
a theme name.

| Token | Role |
| --- | --- |
| `bg` | true page surface (no tinted near-black) |
| `surface` | base for the three glass materials |
| `fg` | text, upcoming words |
| `muted` | secondary UI text (`.TYPING`, labels, inactive controls) |
| `accent` | wordmark `GG`, active tint, cursor, focus |
| `error` | red underline on incorrect characters |

Derived (in CSS): `accent-tint` = accent 14% · `accent-tint-strong` = accent 26%
(cursor block) · `hairline` = fg 10% · `divider` = fg 8% · `glass-bg` = surface
70% · `glass-border` = fg 12% (dark: 16%) · `passed` = fg 62% toward bg.

Glass recipe per scheme, in the theme object: `saturate` 180% light / 120% dark,
top highlight white 18% light / 6% dark.

| Theme | bg | accent | fg | error |
| --- | --- | --- | --- | --- |
| Default (Light) | `#fafafa` | `#2563eb` | `#18181b` | `#d92d20` |
| Classic | `#f2ede3` | `#1f4e8c` | `#2a2622` | `#b42318` |
| Lemondrop | `#fff8d6` | `#8a5a00` | `#2b260f` | `#c0262d` |
| Default (Dark) | `#0a0a0b` | `#6cb4ff` | `#ececef` | `#ff6b6b` |
| Glow | `#060607` | `#3dffa8` | `#e4efe9` | `#ff5d6c` |
| Valentine | `#0b0a0b` | `#ff7eb0` | `#f3e9ec` | `#ff5a4e` |

Contrast floor, enforced by a test for every theme: fg, muted and accent ≥ 4.5:1
on bg and on surface; error ≥ 3:1 (a non-text mark); passed text ≥ 4.5:1; words
two lines ahead (55% opacity) ≥ 3:1, which is the large-text floor and the stream
is at least 1.9rem. Measured before writing: worst cases 4.95 (accent, Default
Light), 5.06 (muted, Classic), 4.56 (passed, Classic), 3.38 (faded, Classic).

## Type

- UI: the existing system sans stack. Mono: the existing system mono stack. No
  web fonts — the app sends nothing anywhere, and that stays true.
- Wordmark: 600, letter-spacing 0.06em — the only tracked text.
- UI sizes: 15px nav and control row, 13px pills, 11px keycap labels, 12px
  level badge. Tabular figures for the user count.
- Word stream: letter-spacing 0.02em, line-height 1.6. Sizes xs 1.3 · sm 1.9 ·
  md 2.2 · lg 2.55 · xl 2.9 rem; at ≤ 520px every size scales by 0.58 (sm ≈ 1.1rem).

## Spacing and shape

- Column: max-width 1400px, gutters `clamp(20px, 5vw, 64px)`.
- Rhythm: top bar 64 → 32 → control row → 24 → divider → 28 → toolbar → 48 →
  stream → 36 → input.
- Stream block: fixed height 9.3rem. Lines shown by size — xs 4, sm 3, md 2,
  lg 2, xl 2 — so each size shows whole lines and the block never changes height.
- Radii: logo 10, pill 8, input 14, icon circle full, keycap 6.
- Controls: icon circle 36, pill height 30, keycap 26 × 30, group separators 1px
  with 16px either side.
- Budget at 1080px tall with sm text: about 565px, inside the upper 55%.

## Motion

| Interaction | Duration | Easing | Property |
| --- | --- | --- | --- |
| Cursor step | 90ms | ease-out | transform |
| Hover / active | 150ms | ease-out | opacity of a tint layer |
| Input focus | 200ms | ease-out | opacity of a ring and glow layer |
| Tab underline | 220ms | cubic-bezier(0.32,0.72,0,1) | transform |
| Panel slide | 260ms | cubic-bezier(0.32,0.72,0,1) | transform |
| Theme cross-fade | 400ms | ease-in-out | background-color, color, border-color |
| Live dot | 2400ms loop | ease-in-out | transform, opacity |

Reduced motion: every duration 0 except the theme cross-fade (120ms).

## Checked against the brief

| Brief | Plan | Status |
| --- | --- | --- |
| Boldness only in the word stream and active pill | accent tint is the only decorative colour | ✓ |
| No motion delays a keystroke | per-keystroke colour changes never transition; cursor is one element moved by transform; stream lines re-positioned by transform without layout reads per key | ✓ |
| Single screen, upper 55% | ≈565px at 1080px tall | ✓ |
| Responsive to 380px, groups wrap, separators drop | flex-wrap, separators hidden ≤ 720px | ✓ |
| Glass in exactly three places | top bar, theme panel, input only | ✓ |
| Theme cross-fade 400ms via `:root` custom properties | properties written to `:root`; the colour transition is switched on only for the length of a switch | ✓ |
| Seventh theme is one object | derived tokens in CSS, components read tokens only | ✓ |
| No hex outside the theme file | the stylesheet guard covers the new CSS | ✓ |
| Keyboard focus visible everywhere | accent outline on every control; glow on the input | ✓ |
| Defaults: Default (Dark), sm, 1 minute, English | store defaults | ✓ |

Conflicts found in the brief, and how the plan resolves them:

1. **§8 says all motion is transform/opacity, but hover, active and focus change
   colour, and §6 asks the input border to transition.** The tint, the input ring
   and its glow are separate layers faded by opacity, so the look is the one asked
   for and the motion stays on the compositor. The theme cross-fade is the one
   deliberate colour transition, as §7 requires.
2. **§6 gives the input focus 200ms; §8's table lists no such row and says
   "nothing beyond this list".** Kept at 200ms, the more specific instruction,
   and added to the table above so the budget is complete.
3. **§3 asks for a pulsing live dot; §8 lists no looping animation.** Kept, as a
   slow transform/opacity pulse, and stopped entirely under reduced motion.
4. **§7 transitions colour on `:root`, which would also animate every character
   changing state mid-test.** The transition exists only during a theme switch.
5. **§5's fixed stream height versus five sizes.** Solved by whole-line counts per
   size (above) rather than a height that fits xl and wastes space at sm.
6. **Live users, avatar, username, level, language, F1–F4 and the view toggles
   have no behaviour behind them yet.** Rendered from a clearly marked stub, so
   the shell looks complete and the wiring pass knows exactly what to replace.

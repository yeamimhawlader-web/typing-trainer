# GG.Typing UI — token plan

Written before the build, then checked against the brief. Every value below
lives in exactly one place: colours in `themes/themes.ts` (the only file with
hex), everything else in `styles/gg-foundation.css`.

## Colour

Each theme is one object of six base colours and a glass recipe. Everything else
is derived in CSS with `color-mix()`, so another theme is a single object and no
component knows a theme name.

| Token | Role |
| --- | --- |
| `bg` | true page surface (no tinted near-black) |
| `surface` | base for the three glass materials |
| `fg` | text, upcoming words |
| `muted` | secondary UI text (`.TYPING`, labels, inactive controls) |
| `accent` | wordmark `GG`, active tint, cursor, focus |
| `error` | red underline on incorrect characters |

Derived (in CSS): `accent-tint` = accent 14% · `accent-tint-strong` = accent 26%
(cursor block) · `hairline` = fg 10% · `divider` = fg 8% · `passed` = fg 62%
toward bg · `error-trace` = error 50% (the fainter underline under a corrected
character).

## Glass

One material for all of GG.Typing's chrome — top bar, theme panel, input, Hover
Mode's selector — and never the typing text. Components use only these tokens;
a test fails if a component stylesheet writes its own blur or backdrop.

| Token | Built from |
| --- | --- |
| `--gg-glass-fill` | surface at the recipe's `fill` |
| `--gg-glass-fill-strong` | surface at `fillStrong`: the input, a chosen branch |
| `--gg-glass-border` | fg at `borderPercent` |
| `--gg-glass-highlight` | white at `highlightAlpha`: the lit top edge and inner light |
| `--gg-glass-shadow`, `-shadow-lifted` | the shade (fg on light, bg on dark) at `shadowPercent`; lifted is deeper, for hover |
| `--gg-glass-blur`, `--gg-glass-filter` | `blur` px, with `saturate` |
| `--gg-glass-surface-tint` | accent at `tintPercent`: the colour the glass reflects |
| `--gg-glass-active-tint` (`-calm`, `-deep`) | accent 13% (9%, 18%): a chosen piece lit from within |
| `--gg-glass-sheen` | highlight fading down to nothing by the middle, over the tint |
| `--gg-atmosphere` | surface at `ambientPercent` from above, and accent at a twentieth of it in one corner |

| Recipe | blur | saturate | fill / strong | border | highlight | shadow | tint | ambient |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Light | 20 | 180% | 70 / 85 | 12% | 0.18 | 10% | 4% | 0 |
| Dark | 20 | 120% | 70 / 85 | 16% | 0.07 | 60% of bg | 6% | 0 |
| Milk | 18 | 140% | 62 / 84 | 10% | 0.60 | 9% | 7% | 80% |

With `prefers-reduced-transparency: reduce`, fills are solid surface and nothing
is blurred.

| Theme | bg | accent | fg | error |
| --- | --- | --- | --- | --- |
| Classic Milk | `#f7f4ee` | `#86592f` | `#24221e` | `#b42318` |
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

Through glass, also by test for every theme: fg and muted ≥ 4.5:1 on both fills
over the page; a chosen branch's label and its quieter description ≥ 4.5:1 under
the deepest active tint; beads (a mark, not text) ≥ 3:1 chosen or not; fg, muted
and accent ≥ 4.5:1 where the page's ambient light is strongest.

Classic Milk: surface `#fefcf8` (lighter than the page, so its glass reads as
milk glass), muted `#6a655d`. Contrast 14.5 fg, 5.3 muted, 5.5 accent on the
page; 4.9 passed; 3.6 faded.

## Type

- UI: the existing system sans stack. Mono: the existing system mono stack. No
  web fonts — the app sends nothing anywhere, and that stays true.
- Wordmark: 600, letter-spacing 0.06em — the only tracked text.
- UI sizes: 15px nav and control row, 13px pills. Tabular figures for the live
  statistics.
- Word stream: letter-spacing 0.02em, line-height 1.6. Sizes xs 1.3 · sm 1.9 ·
  md 2.2 · lg 2.55 · xl 2.9 rem; at ≤ 520px every size scales by 0.58 (sm ≈ 1.1rem).

## Spacing and shape

- Column: max-width 1400px, gutters `clamp(20px, 5vw, 64px)`.
- Rhythm: top bar 64 → 32 → control row → 24 → divider → 28 → toolbar → 48 →
  stream → 36 → input.
- Stream block: fixed height 9.3rem. Lines shown by size — xs 4, sm 3, md 2,
  lg 2, xl 2 — so each size shows whole lines and the block never changes height.
- Stream overhang: the viewport reaches 0.5em above the first line, so a word
  jumping on it (0.43em at the peak) is not clipped; the line before is hidden
  while it sits in that strip.
- Radii: logo 10, pill 8, input 14, icon circle full.
- Controls: icon circle 36, pill height 30, group separators 1px with 16px
  either side.
- Budget at 1080px tall with sm text: about 565px, inside the upper 55%.

## Motion

| Interaction | Duration | Easing | Property |
| --- | --- | --- | --- |
| Cursor step | 90ms | ease-out | transform |
| Hover / active | 150ms | ease-out | opacity of a tint layer |
| Input focus | 200ms | ease-out | opacity of a ring and glow layer |
| Panel slide | 260ms | cubic-bezier(0.32,0.72,0,1) | transform |
| Touch on glass (lift, press) | 440ms | `--gg-ease-touch`: a spring, 26 rad/s, damping 0.72, sampled into `linear()` | transform, opacity of light and shadow layers |
| Hover Mode selector opening | at rest by 496ms | spring, 19 rad/s, damping 0.8 (1.5% overshoot) | transform, opacity; row height and stem dash offset |
| Hover Mode selector folding | at rest by 392ms | spring, 26 rad/s, critically damped | the same |
| Node press | 420ms | give to 0.94, flex to 1.02, settle | transform, opacity of its light |

Reduced motion: every duration 0, no unfolding, no lift or give — states change
at once.

A theme switch has no motion at all: every colour changes on the same frame, and
no GG stylesheet transitions a colour (checked by test).

## Checked against the brief

| Brief | Plan | Status |
| --- | --- | --- |
| Boldness only in the word stream and active pill | accent tint is the only decorative colour | ✓ |
| No motion delays a keystroke | per-keystroke colour changes never transition; cursor is one element moved by transform; stream lines re-positioned by transform without layout reads per key | ✓ |
| Single screen, upper 55% | ≈565px at 1080px tall | ✓ |
| Responsive to 380px, groups wrap, separators drop | flex-wrap, separators hidden ≤ 720px | ✓ |
| Glass in exactly three places | top bar, theme panel, input; Hover Mode's selector added later as the fourth, as chrome | changed |
| Theme cross-fade 400ms via `:root` custom properties | properties written to `:root`; the cross-fade was built, then removed because a switch felt better instant, and transitions are held off for the switch so nothing trails | changed |
| Seventh theme is one object | derived tokens in CSS, components read tokens only | ✓ |
| No hex outside the theme file | the stylesheet guard covers the new CSS | ✓ |
| Keyboard focus visible everywhere | accent outline on every control; glow on the input | ✓ |
| Defaults: Default (Dark), sm, 1 minute, English | Classic Milk (was Default (Dark), until the visual identity pass) and sm are the preference defaults; there is no timed test or second language in the application, so the length is the practice word count (15/30/60) and no language is offered | changed at integration |

Conflicts found in the brief, and how the plan resolves them:

1. **§8 says all motion is transform/opacity, but hover, active and focus change
   colour, and §6 asks the input border to transition.** The tint, the input ring
   and its glow are separate layers faded by opacity, so the look is the one asked
   for and the motion stays on the compositor. No colour transitions at all:
   the theme cross-fade §7 asked for was removed in favour of an instant switch.
2. **§6 gives the input focus 200ms; §8's table lists no such row and says
   "nothing beyond this list".** Kept at 200ms, the more specific instruction,
   and added to the table above so the budget is complete.
3. **§3 asks for a pulsing live dot; §8 lists no looping animation.** Built as a
   slow transform/opacity pulse, then removed at integration along with the live
   user count it sat beside, which had nothing real behind it.
4. **§7 transitions colour on `:root`, which would also animate every character
   changing state mid-test.** First built to exist only during a switch; now
   there is no theme transition at all.
5. **§5's fixed stream height versus five sizes.** Solved by whole-line counts per
   size (above) rather than a height that fits xl and wastes space at sm.
6. **Live users, avatar, username, level, language, F1–F4 and the view toggles
   had no behaviour behind them.** Rendered from a marked stub in the shell pass,
   and removed when the shell was wired to the application: an interface that
   shows a user count, a level or a language nobody can change is inventing data.

## Integration

The shell now runs on the application itself — the typing session, engine,
storage, settings and result components the classic screens use.

- **The classic tokens are bridged, not copied.** The result panel, session
  summary, drill comparison and session hint are the application's own
  components, drawn in `--color-*` tokens. `layout/GGLayout.module.css` maps
  those tokens onto the GG theme inside the shell, built from the same six base
  colours, so they take on every theme without a GG copy existing. Warnings and
  errors there are the theme's error mixed 60% towards fg, and text on the
  accent is bg; `themes.test.ts` holds both at 4.5:1 in every theme.
- **The theme is a preference.** Chosen in the panel, saved by the settings
  store with the rest, and followed by scheme on the classic pages.
- **Tokens removed with the controls they served:** keycap radius and label
  size, level badge size, the tab underline and the live-dot pulse.

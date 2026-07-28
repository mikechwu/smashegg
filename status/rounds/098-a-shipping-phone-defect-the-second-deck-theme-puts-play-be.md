> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## A SHIPPING PHONE DEFECT: the second deck theme puts Play below the fold on 95.8% of deals (2026-07-27)

### The finding

`stackStripW` is a per-THEME metric. **Both shipping themes are selectable from
the header picker at any time**, like the language switcher
(`themes/cinnabar-court/index.tsx:138` registers it; `App.tsx:80` renders it):

| theme | stackStripW |
|---|---|
| lacquer (default) | 0.42 |
| **cinnabar-court** | **0.841** |

**Every fold measurement this project has ever produced held the theme at the
default.** Measured for the first time, phone, inner 390×844, n=24 per theme:

| theme | state | fan (med/worst) | Play doc (med/worst) | below fold |
|---|---|---|---|---|
| lacquer | no shelf | 273.4 / 316.0 | 809.6 / 852.2 | **4.2%** [0.7, 20.2] |
| lacquer | one shelf | 389.6 / 432.2 | 925.9 / 968.4 | 95.8% [79.8, 99.3] |
| **cinnabar-court** | **no shelf** | **359.3 / 422.8** | **895.5 / 959.0** | **95.8%** [79.8, 99.3] |
| cinnabar-court | one shelf | 475.0 / 539.4 | 1011.2 / 1075.6 | 100% [86.2, 100] |

**A player who picks the second deck gets a phone where the primary action needs
a scroll on ~96% of deals, with no other change.** The accepted ~12.5% baseline
is a LACQUER figure and does not describe that player's product at all.

This outranks everything else in the desktop arc: it is the family's device, the
default state (no shelf), and a state the player reaches with one tap.

**Why it was missed** is the durable part: not a probe looking at the wrong
thing (practice 24) but **the gate's parameter space missing an axis entirely** —
and an axis the PLAYER controls rather than one the deal draws.

Derived, not sampled: the 2.95 spread budget caps cinnabar from depth 5, so the
theme delta is **largest at the common depths and ~zero at the rare extreme** —
depth 4 (57.6% of deals) costs +64.0px, depth 8 (0.011%) costs +0.5px. A budget
that only protects the deep tail is the wrong shape.

### The gate now varies theme, and says what it held fixed

`measure-fold.mjs` takes `FOLD_THEME` (default `lacquer`), **verifies the theme
actually took** before measuring, prints `deck theme: X | locale: zh-Hant |
varied: deal only`, and keys both its bucket baseline and its accepted-rate
baseline by `viewport@theme`. A rate for one theme is no longer comparable to a
baseline for another, structurally.

**And a provisional baseline was drafted and then deleted.** A 6-deal bucket list
for cinnabar-court immediately fired a false REGRESSION on a seventh deal —
6 deals cannot enumerate a step function. "No baseline" is the honest state, the
gate now says so, and asserting a wrong one would have made this gate a noise
source.

### Panel: both lineages, fresh and anchoring-free, converge on the structure

Artifacts: `proposals/theme-strip-A-codex.md`, `proposals/theme-strip-B-grok.md`.
Neither saw the other. **Disclosed split:** web search was ON for Grok, OFF for
Codex (`codex exec` does not enable it by default); both had the same measured
facts, and neither depended on search.

**Converged, independently:**
- **A theme must not own a layout budget.** The framework clamps; the theme
  *requests*. Grok's form: `effectiveStripW = min(theme.stackStripW,
  LAYOUT_STACK_STRIP_CAP, 2.95/(n−1))`, with the cap a framework constant rather
  than a theme field.
- **The declared `[0.3, 1.0]` range is the bug.** It presents any value as
  layout-safe when only the lower part is.
- **The fold gate must cover every selectable theme** — a picker makes each theme
  product behaviour, not an optional skin.
- **Catch it before shipping** (conformance test), with a runtime clamp only as
  defence in depth — and loud in dev rather than silent.

**They differ on the number:** Codex says **0.42**, the highest value with
measured support (4.2% ≤ the accepted 12.5%). Grok says a provisional **0.48**,
structure first and the number pinned after one sweep.

**My own earlier measurements bear directly on that split** and favour Codex's
caution: sweeping stripW on the phone gave **0.50 → 25%** below fold and
**0.647 → 79.2%**, against lacquer's 12.5% baseline. So 0.48 sits just under a
value already measured to double the rate.

### What is NOT done

The cap is a design decision and awaits owner sign-off — nothing was implemented.
The seam placement fix, the occlusion re-measurement with the carry-the-fact
strip, and the sibling-route hit box remain next, and **every collapsed-variant
number produced so far is scoped to lacquer** and will need redoing per theme if
the cap does not land first.

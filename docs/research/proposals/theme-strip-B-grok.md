I'll ground this proposal in the actual theme metrics and layout code, then write the constraint-design report without changing any code.I have enough ground truth from the theme contract, fold gate, and the stripW probe measurements. Writing the proposal.# Deck-theme metric vs layout guarantee

**Kind:** independent constraint-design proposal · **Code changes:** none  
**Binding surface:** phone INNER 390×844, zh-Hant, no-shelf baseline  
**Sources:** measured brief table; `HandFan.stackOffsetW`; `DeckThemeMetrics.stackStripW`; G-FOLD in PLAN; stripW phone probe in `docs/research/desktop-layout.md` (§7.4); cinnabar design record / STATUS strip notes.

---

## 1. The constraint itself

### Rule (not a decorative range)

Treat `stackStripW` as a **theme request**. The framework **owns** the strip actually spent on layout:

```text
effectiveStripW = min(theme.metrics.stackStripW, LAYOUT_STACK_STRIP_CAP, 2.95 / max(n - 1, 1))
```

where `LAYOUT_STACK_STRIP_CAP` is a **framework constant**, not a theme field.

### Declared conformance range (revised)

| bound | value | role |
|---|---|---|
| floor | **0.30** (keep) | “some strip exists”; already in the suite |
| ceiling | **`LAYOUT_STACK_STRIP_CAP`** | layout product budget, not art freedom |

**Provisional CAP = 0.48** until the cheap measurement in §6 confirms or tightens it. Ship the *structure* of the constraint now; pin the number only after one fold sweep (below). Do **not** leave the ceiling at 1.0.

### Facts the number is derived from (not “looks safe”)

**A. Product guarantee already on the record (G-FOLD).**  
A change must not raise the phone no-shelf below-fold rate above the accepted baseline (~12.5% [4.3%, 31.0%], n=24, lacquer-measured). That is a **product** rule, not a default-theme courtesy. A selectable shipping theme that lands at **95.8%** below-fold is a broken guarantee, not an alternate aesthetic.

**B. Vertical cost is front-loaded at common depths.**  
With `stackOffsetW = min(stripW, 2.95/(n−1))`, total extra height in card-widths is `min((n−1)·stripW, 2.95)`. The 2.95 budget already caps the *deep* tail; it does **not** protect the modal hand. Over 200k deals: depth 4 is 57.6%, depth 5 is 23.4%. Theme delta vs lacquer is **largest at 3–5** (~43–64px at 50.7px card) and ~0 at depth 8. A ceiling that only “matters when deep” is the wrong shape.

**C. Median headroom is small and not freely spendable.**  
From the brief: lacquer no-shelf med Play doc ≈ 809.6 on VH 844 → ~34px median headroom. At depth 4, each +0.01 of stripW costs `3 × 0.01 × 50.7 ≈ 1.5px`. Spending the whole 34px would allow strip ≈ 0.65 — and would park the **median** on the fold line. Worse, fold rate is a **step function of max depth**, not a smooth function of median headroom.

**D. Empirically, stripW above lacquer burns fold budget fast (already measured).**  
Desktop-layout probe on the phone: stripW **0.50 → 25%** below-fold; **0.647 → 79.2%** (from the lacquer 12.5% baseline). So:

- CAP must sit **below 0.50** if G-FOLD’s 12.5% is product-wide.
- CAP **0.55–0.65** (tempting from “half a shelf” aesthetics) is already in the disaster zone of that probe.
- CAP **0.841** is not a near-miss; it is off the chart (brief: 95.8%).

**E. Legibility floor from the theme’s own claim does not require 0.841.**  
Both themes declare `cornerIndexMinPx ≥ 10`. A vertical rank+suit pair at that floor is ~20px plus a small gap → about **0.40–0.48w** at a 50.7px phone hand card (21–24px). STATUS already records that even at 0.841 the wild **seal sits at 0.92w and is hidden in stacked strips**; covered-card identity is rank+suit, not the seal. So 0.841 is **breathing room for art**, not the minimum mark the contract claims.

**F. Provisional CAP = 0.48 — arithmetic.**

| fact | implication |
|---|---|
| Accepted product strip (lacquer) | 0.42 |
| 0.50 already doubles phone below-fold (measured) | CAP &lt; 0.50 |
| Vertical rank+suit at 2×10px + gap | ≥ ~0.45–0.48w needed for *compressed* cinnabar |
| Depth-4 extra vs lacquer at 0.48 | `3 × 0.06 × 50.7 ≈ 9.1px` expected extra — small vs 34px med headroom and far below the 64px cinnabar delta |
| E[extra] under the depth distribution | ~+10px vs lacquer at 0.48 vs ~+60px at 0.841 |

0.48 is the **highest** number that still sits under the 0.50 failure point **and** still leaves room for a two-line identity strip at the declared 10px floor. It is provisional: if measure-fold at 0.48 exceeds 12.5%, drop CAP (0.45, then 0.42) and push more compression into the face art — do not widen CAP to “save” art.

### What I am *not* deriving CAP from

- Not “halfway to 0.841.”
- Not “use all median headroom.”
- Not “match 2.95 / k for some k” alone — that only describes when the deep-cap binds; it does not protect the modal deal.
- Not a free parameter “how tall the designer likes the strip.”

---

## 2. Where it lives

Defense in depth, three layers with different failure modes:

| layer | where | on violation |
|---|---|---|
| **A. Contract** | `DeckThemeMetrics.stackStripW` comment + range **[0.30, LAYOUT_STACK_STRIP_CAP]** | Documents that the ceiling is layout-owned |
| **B. Conformance test** | `deck-theme.test.ts` (already ranges every registered theme) | **CI refuse** — theme does not ship |
| **C. Runtime clamp** | `stackOffsetW` / the single call site that reads `theme.metrics.stackStripW` | **Silent layout safety**: effective strip never exceeds CAP even if a theme bypasses tests or a future path skips the suite |

**Theme is told, not gaslit.**  
Declare CAP in the metrics contract. Prefer:

- Theme authors set `stackStripW` to what their covered mark **needs** (≤ CAP).
- If a draft theme wants more, that is a **design rejection** (fix + eyes-gate), not a runtime surprise.

Optional (nice, not required): debug/assert in dev when `theme.stackStripW > CAP` so a designer sees “your request was clamped” immediately. Production should still clamp; elderly players must not pay for a missing test run.

**Registration / gate:**  
A theme whose declared `stackStripW > CAP` fails unit conformance. Separately, **shipping** a theme requires a phone fold reading under that theme (see §4). The unit range catches arithmetic abuse; the fold gate catches “in range but still broke the page” if CAP was wrong.

**Do not rely on test-only.**  
This bug shipped because the declared range **included** the bad value. A wider range + “we’ll catch it in review” is how 0.841 passed. Runtime clamp is the layout owner enforcing its budget; the test is how authors learn the budget early.

**Constant location:** one named export next to the fan math (e.g. beside `stackOffsetW`), imported by the conformance suite — single source of truth, not a magic number copied into the test.

---

## 3. What breaks for cinnabar-court

### What 0.841 was for

Cinnabar’s identity is a **vertical rank+suit column** (plus framework wild seal below on the full face). Lacquer’s is a **one-line horizontal index**. The metric comment is honest: taller strip for a taller mark. The *number* 0.841 is not honest relative to fold: it spends ~58% of card height on a two-card pile and ~128px extra at depth 4 — more than half a shelf’s vertical cost — on the modal deal.

### If CAP = 0.48 (~24px at 50.7px card)

| still works | must change |
|---|---|
| Rank + suit at `cornerIndexMinPx` (10) with tight leading | Generous vertical padding / display-size glyphs in the strip band |
| Unambiguous level-rank heart as wild (STATUS: identity without seal on stacked cards) | Any design that assumed ~43px of strip air |
| Full-face art, court figures, seal on **top** card / lifted card | Expecting the seal in the covered strip (it never fit at 0.841 either — seal at 0.92w) |

**Does the theme still “read”?**  
Yes, if the face is redrawn so the **top ~0.48w** of the card carries rank+suit as the primary covered-card signal — same job lacquer does in 0.42w with a horizontal pair. Cinnabar stays cinnabar on the full face (courts, pips, seal, palette). What shrinks is only the **stacked reveal**, which was always a legibility strip, not a second full portrait.

### What to tell the designer

1. **Layout owns the strip budget.** Your metric is a request capped at CAP (provisionally 0.48w ≈ 24px on phone hand). Values near 0.84 break Play/Pass on ~96% of phone deals; that is a product defect, not a theme “look.”
2. **Design the covered-card mark for CAP, not for the full face.** Put rank+suit in the top band; keep seal and body art for the uncovered / top card.
3. **You already lose the seal in stacks today** (0.92w &gt; 0.841w). Compressing to 0.48w does not newly hide the seal; it forces the rank+suit column to the density the 10px floor already implies.
4. **If rank+suit cannot read at 0.48w on true 390,** options in order: tighten glyphs → drop to a lacquer-like horizontal index **only in the strip band** while keeping vertical grammar on the full face → only then ask the owner to raise CAP with a measured fold trade (not by reopening [0.3, 1.0]).
5. **Do not compensate by raising the 2.95 spread** — that lifts deep piles for everyone and buys almost nothing for cinnabar’s modal problem (delta already ~0 at depth 8).

---

## 4. Whether the fold gate should vary theme routinely

### How this was missed

G-FOLD and `measure-fold.mjs` were run against the **default** layout path. Lacquer’s 0.42 stayed inside the accepted rate. Cinnabar’s metric is a pure client preference, switchable like locale — so the product for a cinnabar player was never the thing the gate measured. Fixed-theme gates + variable layout budgets = systematic blind spot.

### Recommendation

| when | what | cost control |
|---|---|---|
| **Routine layout change** (no theme metric / fan curve change) | Default theme only, as today | Keep the slow n=24–40 path from exploding |
| **Any change to `stackStripW`, `stackOffsetW`, spread budget, fan column chrome, or cardw on phone** | **Every registered theme** | Required |
| **Registering a new theme** | Phone fold under that theme before ship | One-time |
| **Standing cheap ratchet (prefer)** | Per theme, **constructed** max-depth ladder (d = 4, 5, 6, 8) + short random sample (n=12), not 40 × themes × full random only | Depth is the decisive axis; sampling the tail is expensive and this project already knows that |

**Do not** make “per-theme n=40 every PR” the default — that multiplies an already rate-limited manual gate. **Do** make “default-only forever” illegal for vertical-budget changes.

**Policy wording worth adopting:**  
G-FOLD’s baseline is **product-wide for every selectable theme**, not “whatever the default paints.” A theme switch is a user-facing layout input. If that is too expensive to sample fully, replace sample mass with constructed depth hands (same lesson as desktop fold work), not with “skip the other theme.”

**Theme-varying baseline (accept 95% for cinnabar) is wrong.** That redefines the bug as the product. The owner accepted ~12.5% on lacquer as the phone cost of real hands — not “each skin gets its own scroll tax.”

---

## 5. The general lesson

> **An extension point may supply preferences inside a declared range only when that range is derived from the shared resource those preferences consume. If a parameter feeds a layout budget, the budget owner sets the ceiling; the plug-in does not.**

Unpacking for this codebase (and the next similar hole):

1. **Classify parameters:** *paint* (color, path art) vs *budget* (strip fraction, aspect extremes, overlap, chrome heights). Paint can be wide-open; budget cannot.
2. **Derive budget ranges from the guarantee they threaten** (here: G-FOLD + phone card geometry + depth distribution), not from “is a fraction in [0, 1].” The old [0.3, 1.0] certified **type-ish sanity**, not **product conformance**.
3. **Enforce at the consumer** (`stackOffsetW`), not only at the registry. Tests document intent; clamps protect players when process fails.
4. **Gates must close over every user-selectable axis that changes layout geometry.** Theme is already a first-class axis (header switcher, localStorage). Measuring only the default is measuring a different product.
5. **A fixed total spread (2.95) is not enough** if plug-ins can front-load the budget on the common case. Cap **per-step request** and **total spend**, both owned by the framework.

Reusable checklist when adding `metrics.*` later:

- Does this number change **pixels of shared chrome**?
- What guarantee does that chrome sit under (fold, tap, overflow, 390 eyes)?
- Is the allowed range **computed from that guarantee**?
- Does the layout function **clamp**?
- Does the gate run **for each plug-in value that can ship**?

If any answer is no, the range is theater.

---

## 6. Riskiest assumption, and the cheapest kill

### Riskiest assumption

**That provisional CAP = 0.48 simultaneously (a) keeps every shipping theme’s phone no-shelf below-fold rate ≤ the accepted ~12.5% baseline and (b) leaves cinnabar’s vertical rank+suit strip readable at true 390 without a full face redesign.**

Either half can fail:

- If (a) fails, CAP must drop (0.45 → 0.42); art takes more pain.
- If (b) fails at a CAP that still passes fold, the theme needs a **strip-specific** identity treatment (horizontal pair in the reveal band), not a higher CAP.

### Cheapest measurement that kills it

One session, no new architecture:

1. **Fold ladder (kills half a):** force `effectiveStripW ∈ {0.42, 0.45, 0.48, 0.50}` on phone 390×844, no shelf, n=24 (or constructed d=4/5/6 + n=12 random). Record below-fold rate + Wilson interval. Stop raising CAP at the first step that clearly exceeds 12.5% / leaves the accepted interval. The 0.50 → 25% probe already predicts the upper end; this only finds the last safe step.
2. **Eyes-gate (kills half b):** same CAP, cinnabar, real piles of depth 3–5 at hand size on 390, zh-Hant — can rank and suit be named from the strip alone? Seal need not appear (already doesn’t).

Total: one Playwright fold script variant + a short visual pass. That is cheaper than debating 0.55 vs 0.60 in prose.

---

## What I would not do

1. **Leave range [0.3, 1.0] and “remember to measure cinnabar.”** Process already failed once; the range invited 0.841.
2. **Theme-aware 2.95 only.** Raising spread for cinnabar makes deep piles taller for a theme that already blows the modal case; lowering spread globally punishes lacquer’s deep full-strip behavior for someone else’s metric.
3. **Viewport-reactive strip as the *first* fix.** Correct long-term for “desktop wants larger press targets, phone cannot pay,” but this project treats first width-reactive JS as a real cost. A **global phone-safe CAP** is the right default until that bill is paid deliberately (desktop research already priced higher strip as desktop-only for this reason).
4. **Derive strip solely from `cornerIndexMinPx` as a formula that replaces the theme metric.** Useful as a **lower-bound check** (`strip_px ≥ f(minPx, lines)`), not as the only control — layout ceiling and art request are different quantities.
5. **Silent clamp with no contract change.** Layout survives; authors keep shipping 0.841 and wonder why stacks look “wrong.”
6. **Per-theme accepted fold rates** (lacquer 12%, cinnabar 96%). That blesses the bug.
7. **Sticky Play as the fix for theme height.** The project already treats document position as the truth and sticky as a safety net; measuring the net is how false zeros enter the record.
8. **Only a conformance test, no runtime clamp.** The suite is necessary; it is not sufficient against future skip-paths and hand edits.

---

## Risks

| risk | severity | mitigation |
|---|---|---|
| CAP 0.48 still &gt;12.5% below-fold | high | §6 ladder; lower CAP before ship |
| Cinnabar unreadable at CAP | medium | strip-band redesign; horizontal reveal fallback; not CAP inflation without fold proof |
| Desktop press/index gains blocked by phone CAP | low–medium | accept until width-reactive JS is funded; do not re-break phone to help 1280×800 |
| Clamp without eyes-gate → “legal but muddy” stacks | medium | CAP ship gate = fold **and** 390 eyes on every theme |
| Constructed depth ladder misses multi-column / shelf interaction | low | keep a short random sample; shelf remains a separate expensive mode |
| Authors treat clamp as “framework will fix art” | medium | CI fail on declared &gt; CAP so the request cannot exceed the grant |
| Future metric (`aspect`, new chrome) repeats the hole | high | §5 checklist on every new budget parameter |

---

## Decisions (counted)

1. **Product rule:** G-FOLD is theme-wide for every selectable deck theme, not default-only.  
2. **Mechanism:** `effectiveStripW = min(theme, LAYOUT_STACK_STRIP_CAP, 2.95/(n−1))` with framework-owned CAP.  
3. **Provisional CAP = 0.48**, derived from (accepted lacquer 0.42, measured failure at 0.50, two-line 10px legibility band, modal depth-4 cost) — number confirmed by §6 before locking.  
4. **Contract range becomes [0.30, CAP]**, not [0.30, 1.0].  
5. **Enforcement = conformance refuse + runtime clamp + explicit “theme is told.”**  
6. **Cinnabar redesigns the strip band to CAP; 0.841 does not ship as effective layout.**  
7. **Fold gate:** full multi-theme on vertical-budget changes and new themes; routine default-only otherwise; prefer constructed depth ladders over n×themes×40.  
8. **General rule:** budget parameters at extension points get budget-derived ceilings enforced by the consumer.

PROPOSAL COMPLETE: 8 distinct decisions

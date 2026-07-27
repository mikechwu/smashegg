# Desktop layout — FINAL in-house design proposal

Repo read at `1dd79f9`, working tree clean, **no files changed**. Firecrawl not used (one `WebFetch` to caniuse, noted at its point of use). Tags per `docs/research/METHODOLOGY.md` practice 3: **VERIFIED** (read in the working tree this round), **EXECUTED** (I ran it this round and the output is quoted), **inference**, **UNCERTAIN**.

**Provenance, corrected.** The brief's measurements were taken at `f0103ee`. `1dd79f9` is its **direct child** — *one* intervening commit, not two, and my draft's "verified by `git log --oneline`" was a method that cannot support a claim about which files a commit touches. Correct method and result: `git diff --stat f0103ee..1dd79f9` = `STATUS.md`, `docs/research/desktop-layout.md`, `docs/research/proposals/desktop-A-codex.md`, `docs/research/proposals/desktop-B-grok.md` — **4 files, 0 source lines** (VERIFIED). The measurements therefore describe the code I read. (Critique A-F14, accepted.)

**The one-sentence version, unchanged by three critiques.** Desktop is *width* abundance and *height* scarcity. Spend the surplus by widening the exposed sliver, not by enlarging the card: it buys the same glyph legibility as a 41%-bigger card at zero vertical cost, and zero vertical cost is what makes the shipping fold defect fixable in the same round.

**What did change.** One structural item (S4) is deleted outright; one gate is rebuilt as a delta gate; two silent-failure paths are fixed structurally rather than guarded by tests; the fold gate stops sampling for its own tail and constructs it instead; and three things I asserted are now **EXECUTED** rather than reasoned.

---

## 1. The mode structure

**Four modes, admitted by viewport width — with one height condition. Card size never changes at any mode.**

| | **P — phone** | **D1 — air** | **D2 — bench** | **D3 — table** |
|---|---|---|---|---|
| admitted | `W < 720` | `W ≥ 720` | `W ≥ 960` | `W ≥ 1440` |
| hand column pitch *p* | 0.70 | 0.70 | **0.80** | **1.00** |
| card width | `clamp(2.75rem,13vw,4.25rem)` | identical | identical | identical |
| well pitch | 0.40 | 0.40 | **0.55** | **0.70** |
| ring `max-width` / tracks | none / 1:1.5:1 | **54rem** / 1:1.5:1 | **58rem** / 1:2:1 | **64rem** / 1:2.4:1 |
| hand zone `max-width` | none | **48rem** | **54rem** | **66rem** (feed rail is a *sibling*) |
| `.app-main--wide` | 72rem | 72rem | 72rem | **88rem** |
| type scale | 1.00 | 1.00 | **×1.20** | **×1.45** (top rung conditional — §7) |
| **vertical air** | n/a | **only when `min-height: 700px`** | same | same |

### Why the first breakpoint stays at 720

523px is the width at which *the card* stops responding (§3.1), not at which *the layout* should change. Keeping 719/720 also costs nothing in test churn: `seat-stack.test.tsx:1122` slices the stylesheet with the literal regex `/@media \(max-width: 719px\) \{([\s\S]*?)\n\}/` (VERIFIED) and `play-desk.test.tsx` slices from `indexOf('@media (max-width: 719px)')`.

### D1 = 720 — for fixing what ships today

At 719px the ring is `.gd-table`'s content width with `auto` side tracks. At 720px `table.css:2405-2421` imposes `max-width: 38rem` and `minmax(7rem,1fr) minmax(0,1.5fr) minmax(7rem,1fr)` (VERIFIED), so the centre track becomes `(608 − 24)/3.5 × 1.5 = 250.3px` — a ~200px contraction at the exact width where the window got bigger. Ring cap 54rem is derived from the widest legal play: 7–10 cards can only be a bomb and >10 has no interpretation (`combos.ts:468-474`, VERIFIED), so `(1 + 9×0.4) × 68 = 312.8px` of ink + 24px gutter = 337px of centre track; with 1:1.5:1, `--space-lg` gaps and side padding, `C ≥ 810` → 54rem gives centre 339.4 ✓.

### D2 = 960 — for the sliver, and for getting Play back above the fold

The structural worst case is **15 value columns** (12 non-level ranks + the level class + SJ + BJ), written down in this repo at `hand-fan.test.tsx:415` (VERIFIED). At `p = 0.80`, `(1 + 14×0.8) × 68 = 829.6px`. Usable = `W − 32` (`app.css:235`, a deliberate literal) `− 16` (`.gd-table` padding at desktop) `− 32` (gutter) = `W − 80` → `W ≥ 909.6` → **960px**, 34px slack against the 54rem zone cap.

**How often 15 columns actually occurs — computed this round, EXECUTED.** Exact inclusion–exclusion over a 108-card deck plus a 200,000-deal simulation:

```
P(15 columns) = 0.0342     P(an n=8 sample sees none) = 0.757
distribution: 10:1.90%  11:10.82%  12:28.89%  13:35.91%  14:18.89%  15:3.42%
```

This independently reproduces critique C-F3's figures (3.37% / 76.0%) to within simulation noise, and it explains §3.3's 11–14 range as exactly what an n=8 sample of this distribution looks like. **A 15-column hand must be constructed, never waited for** — that is now a stated property of every width gate below.

### D3 = 1440 — zero overlap, the real ring, and the feed

15 columns at `p = 1.00` = 1020px. At a 1440 viewport, `.app-main--wide` at 88rem caps content at 1408 − 32 = 1376, less 16px of `.gd-table` padding = **1360** of usable width; fan 1020 + 12px gap + a 17rem (272px) feed rail = 1304, leaving **56px of slack** (inference, arithmetic over VERIFIED literals; checked by G-INK).

### Discrete modes — the steer, and where I still disagree with its reason

I keep discrete modes and reject the stated reason. Modes do not remove untested widths: within a mode the layout still varies with width (flex wrap) and, decisively, **with the dealt hand** — §3.3's 544–687px range at a *fixed* 68px card is deal variation. Modes make the *stylesheet* finite, not the *rendered layout*. The real argument for them is that responsive failures are frequently single-width events (Walsh, Kapfhammer & McMinn, ISSTA 2017 — citation UNCERTAIN, not re-fetched this round), so modes **concentrate risk at labelled boundaries** and give a 1px sweep an expectation to check. Hence: discrete modes **and** a sweep.

### New: modes are admitted by width, but vertical air is admitted by height

Two critiques converge on a case my draft missed entirely (B-F4 browser zoom; A-F11 the 720–1279 band). Page zoom does not scale a fixed layout — it **shrinks the CSS viewport**. An elder pressing Cmd-+ on a 1440×900 to 150% is at **960×600 CSS px**: admitted to D2 by width, with 600px of height against a layout that is 832–860 tall. A 390×844 phone in landscape presents **844×~390** and is admitted to D1 on the same terms. In both cases the mode ladder hands a short machine the ≥720 block's *extra* 30–50px of air.

So the vertical air (`.gd-table` padding, ring padding, the ring's row-2 floor) is conditioned: `@media (min-width: 720px) and (min-height: 700px)`. Short-and-wide machines keep the compact geometry. This is a token-level change, it costs one media condition, and it is what makes WCAG 1.4.4 (200% zoom without loss of function) a statable property rather than an accident. The phone's own `@media (max-width: 719px)` block is **not** touched — its literal is pinned (`seat-stack.test.tsx:1122`) and the new condition lives in the min-width blocks only.

---

## 2. The hand

**Decision: card width does not change at any mode. Column pitch does: 0.70 → 0.80 → 1.00. The corner index row scales with the pitch. The `'10'` special case is dropped at `p ≥ 0.80`.**

### The design equation

The rank glyph is `font-size: calc(var(--gd-cardw) * 0.36)` (`table.css:617`); the suit beside it 0.34; `'10'` alone drops to 0.28 (`:625-631`). That row must fit the **exposed sliver** `p × w` — the 0.70 factor is written out as a fit budget at `table.css:1006-1011` (VERIFIED). Letting the index ratios scale as `0.36 × (p/0.70)`:

```
glyph cap ≈ 0.36 · p · w = 0.36 × sliver
fan ink (15 cols) ≈ 14 · p · w = 14 × sliver
⇒ glyph cap ≈ 0.0257 × fan ink
```

**The glyph is a fixed fraction of the fan's total ink.** Once you fix the horizontal arc the fan may occupy, index legibility is *determined*, and "bigger card" vs "less overlap" is not a legibility choice:

| variant | *w* | *p* | sliver | ink (15 col) | fan height | rank cap |
|---|---|---|---|---|---|---|
| today, desktop | 68 | 0.70 | 47.6 | 734 | 198–227 | 3.96 mm |
| **D3 (mine)** | **68** | **1.00** | **68.0** | **1020** | **unchanged** | **5.65 mm** |
| §3.3's counterfactual | 96 | 0.70 | 67.2 | 1037 | **+41%** | 5.60 mm |

The lower two rows are the same glyph; they differ only in what else they cost. A bigger card costs card height (`height: calc(var(--gd-cardw) * 1.45)`) and therefore fan height and therefore fold, on the axis that is already failing. **Zero overlap is free on the scarce axis.** Departing from prior art (6/6 keep 49–78% overlap) needs a reason and there is one: 0 of 6 groups the hand by value; their ratio buys hand-*length* independence for a flat 13-card row, and our settled fan already collapses 27 cards to 11–15 objects.

### What it buys

- Exposed sliver **47.6 → 54.4 → 68.0 px**.
- The `'10'` — the deck's worst glyph — stops being a special case at `p ≥ 0.80`, because its shrink has no reason left. One inconsistency deleted.
- Fan height, card height, lift constant, seat-stack extent, desk stage width, finder width: **all unchanged**. Nothing downstream of `--gd-cardw` moves — which is also why the eight other clamp sites do not need to be touched (see §5, S4 deleted).

### The range, and how to find its ceiling

**Useful range: fan ink 730–1050 px.** The ceiling is an angle, not a card size: horizontal shifts below ~20° are made with the eyes; past ~30° the head contributes and sustained rotation is uncomfortable (oculomotor literature via Hu et al., CHI 2026 — UNCERTAIN, not re-fetched). At 110 CSS-ppi and 60cm, 25° ≈ 1152px. D3's worst case is 1020px = 22.2°; §3.3's 110px card is 1210–1540px = 26–33° and I reject it on that basis. The angular figure is now **reported with its inputs and gated on a machine census** (§7, G-ANGLE) rather than asserted — see "What the critiques changed", B-F5/B-F6/C-F8.

**The real measurement, still not run:** within-subject task timing, 4–6 players (≥2 elderly), card-exposure as the varied axis, same 20 injected hands per condition. **Null result, diagnosed:** the older-adult size-preference literature never imposes a traversal cost, and the paradigm that does (critical-character-count, Atilgan/Xiong/Legge PNAS 2020) was never run on an older cohort. Genuinely unstudied, not un-indexed.

### New: the covered card's press target, stated rather than left implicit

A covered card in a pile exposes `stackOffsetW(n, stripW) × w` of uniquely-tappable height, where `stackOffsetW = min(stripW, 2.95/(n−1))` (`HandFan.tsx:183-185`, VERIFIED) and lacquer's `stackStripW = 0.42` (`themes/lacquer.tsx:88`, VERIFIED). At a 68px card that is **28.6px** — above WCAG 2.5.8's 24px AA floor, below this project's own 44px floor. It is 25.1px in a 9-deep column. This is pre-existing, it is a genuine standing exception to a stated invariant, and my draft did not name it (critique B-F3, accepted as a finding). It is **not** fixed by the pitch ladder, because the pitch controls the horizontal axis and the press strip is vertical — and it is **not** fixable this round: raising `stripW` needs either width-reactive JS (which decision 22 forbids) or an `!important` override of an inline style whose factor depends on pile depth, and the 2.95w spread budget defeats it for columns of 6+ regardless. Disposition: **reported by the tap gate at every mode, raised in a later round, BLOCKED ON MEASUREMENT** (§7).

---

## 3. The ring

**3a. The widest legal play stops wrapping.** 312.8px of bomb ink against a 250.3px centre track, at every viewport ≥720 and *not* at 719. `table.css:214` applies the −0.6w margin to every frame after the first *in DOM order*, so a wrapped line's leading card carries it too and sits 0.3w = 20.4px left of true centre. The hand fan hit exactly this and fixed it with a cancelling `padding-left` (`table.css:876` vs `:1024`, pinned at `hand-fan.test.tsx:315-335`, VERIFIED); **the well has no equivalent compensation.** Sizing the centre track for the widest legal play retires the class.

**3b. Opponents actually across the table.** At D3 the ring is 1024px content, so west and east plates sit ~1000px apart against today's 608px at every viewport ≥720. 1000px at 60cm ≈ 21.8° — the same arc as the fan. **Everything the player must scan lives inside a ~25° cone**; that is why the ring stops at 64rem instead of filling the screen. Two supporting fixes, both wrong-by-construction today: `.gd-ring .gd-plate__name { max-width: 5rem }` (`table.css:2034`, VERIFIED) truncates names at 80px on a 2478px screen → 9rem at D2/D3; and `.gd-seatzone--north.--flanked > .gd-plate { max-width: min(9rem, calc(50vw - 5rem)) }` (`table.css:2107`, VERIFIED) is a viewport measurement standing in for corner space, inert since 448px → replace the `50vw` term with the grid track.

**3c. Counter-clockwise, made visible.** There is no persistent statement of direction anywhere: only the deal choreography on hand 1 and the active-turn border migrating between plates. Proposal: a **static arc** on the ring's felt from the active seat toward the next. Not an animation — it changes only when the turn changes, so it survives `prefers-reduced-motion` unchanged. Third encoding of an already-doubly-encoded fact, so it never carries meaning alone; a shape with a position, so it is not colour-alone.

**3d. 接风 as a spatial event.** `derived.jiefeng = { finisher, leader }` is assigned at `GameTable.tsx:418` and never read — a write-only state whose only output is a sentence in a ~2-line feed box at the far end of the page. The arc gives it its first consumer: **the arc visibly skips the finished seat**, and that seat's plate carries a static finished mark.

**3e. Tribute, anchored.** Keep `TributePanel`'s sentences — they are the locale-parity, screen-reader-correct carrier. Add a static marker on the payer's and recipient's plates for the phase, so "A 進貢給 B" has two places on screen.

**Scope, now explicit (critique A-F7):** all of 3c/3d/3e ship **at ≥960 only**. Below that they are absent from the DOM, so the phone's rendered tree is unchanged by construction, not by a `display: none` a geometry fingerprint cannot see.

---

## 4. The rest of the surplus

**Grows.**
- **The trick well** — pitch 0.40 → 0.55 → 0.70. At 0.40 a covered card exposes 27.2px against a 47.6px index row, so ~43% of every covered card's rank and suit is hidden.
- **The event feed** — 2 lines → a right-hand rail at D3, 17–22rem, 8 lines. It is the sole carrier of jiefeng, tribute and level events and is currently the smallest, lowest, most clipped object on the page. **The rail is a sibling of `.gd-handzone`, not a child** — see S2 and critique C-F9.
- **`--measure: 46ch` on all prose.** There is no `ch`/`em` measure constraint anywhere in either stylesheet (VERIFIED by grep) because 374px of content width was one. In a wide column English binds where zh-Hant does not; an 80-character line at D3's type is ~1000px wide.
- **The play desk's `max-width`** 24rem → 26rem at D3 only.
- **The seat plate name cap**, above.

**Stays small.** The headline bar (chrome — `app.css:241-248` already records "shave the chrome, never the game"). The action buttons' **gap**: `table.css:1289-1297` fixes `gap: 2.25rem` and `min-width: 5.5rem` so "a mid-tick rerender can never move Pass under a tap aimed at Play" (VERIFIED). Bigger type grows the buttons; the gap literal stays. The toast (24rem), level-up plate (22rem), ceremony plates (22rem) — at ×1.45 type, 22rem is already ~45ch. The finder sheet (26rem) and wild chooser — transient reading objects pinned to 390/375 fit budgets.

**Must NOT grow.**
- **Sort-area shelves stay stacked.** `game.areas.putBack` is `"↓ Back into your hand"` / `"把這些牌移回下方的主手牌"` — 下方 is literally "the area below". Those strings are true only because `bandOrder` renders shelves first and MAIN last (`areas.ts:169-175`). A side-by-side band makes the arrow and the screen-reader sentence **factually false in all three locales with every CSS test green**. Separately, variant D's residual near-miss mitigation is *vertical*; bands beside each other have no band below.
- **`SEAT_STACK_MAX_ROWS` stays 2** (`helpers.ts:975`, VERIFIED). There is **zero width-reactive JavaScript in the client** (exhaustive grep: every `matchMedia` is `prefers-reduced-motion`), so a mode-dependent TS constant would be the first such code in the repo. And it does not fix the real gap: `seatStackPerRow` pins per-row at 14 for every wrapped count, so counts **14 through 27 have an identical lay extent**. "2 must look unlike 27" holds; "14 must look unlike 27" does not. Name it, measure it, do not fix it here.
- **`AREA_HARD_MAX` stays 2** (`areas.ts:618`, VERIFIED — §3.5 is correct against source). A wide hand zone makes a third band *look* available while a constant refuses it — the "control that looks available and does nothing" class this project has already fought.

---

## 5. Token vs structure, priced

### Reachable by changing token VALUES only

| # | win | note |
|---|---|---|
| T1 | The three caps: `.app-main--wide` 72→88rem (D3), `.gd-ring__table` 38→54/58/64rem, `.gd-handzone` 44→48/54/66rem | All three **unpinned** — grep of `tests/` for `72rem`/`38rem`/`44rem` is empty. Free, and *that* is the risk. Each gets a pin. |
| T2 | Vertical recovery: `.gd-table` padding `xl`→`sm`; ring padding `xl lg`→`sm lg`; ring row-2 floor `9rem`→`7rem` — **all three now inside `and (min-height: 700px)`** | The base `.gd-table` rule is untouched, so `hand-fan.test.tsx:405` and `chooser-faces.test.ts:439` (which parse the **first** `.gd-table` block) stay green and stay correct. |
| T3 | Hand pitch ladder `−0.3 → −0.2 → 0`, with `.gd-fan__stackRow` `padding-left` `+0.3 → +0.2 → 0` | Must move as a pair or every settled line shifts off the centre axis (`table.css:1012-1023`). **Written as full declarations inside the mode blocks, repeating the clamp literal** — see S4-deleted. |
| T4 | Well pitch ladder `−0.6 → −0.45 → −0.3` | Lockstep-asserted equal to the chooser's overlap at `chooser-faces.test.ts:443`. |
| T5 | Index-row ratios scaled by `p/0.70`; `'10'` dropped at `p ≥ 0.80` | `design-system.test.ts:82` permits `calc(var(--gd-cardw) …` font sizes (VERIFIED) — note it checks the *prefix*, not the factor, so T5 arrives unguarded and needs its own pin. |
| T6 | Ring track ratios, plate-name cap, north-flank fix, desk `max-width` | |
| T7 | `--measure: 46ch` | New token; no adoption guard exists for anything but `font-size` and palette hex. |

### ~~S4 — Consolidate `--gd-cardw` to one declaration~~ **— DELETED**

My draft called this "a prerequisite for the pitch ladder to be expressible at all". **That is wrong, and the critique that said so is right** (A-F4). A media query does not restate a *rule*; it restates a *declaration*. The whole pitch ladder is four declarations that repeat the clamp literal exactly as the stylesheet already does nine times:

```css
@media (min-width: 960px) and (min-height: 700px) {
  .gd-fan__stack    { margin-left:  calc(clamp(2.75rem, 13vw, 4.25rem) * -0.2); }
  .gd-fan__stackRow { padding-left: calc(clamp(2.75rem, 13vw, 4.25rem) *  0.2); }
}
```

Against a benefit that does not exist, S4 bought the round's largest phone risk, documented in the source it proposed to delete: `table.css:805-813` (VERIFIED) — *"custom properties resolve against ANCESTORS, and `.gd-card--hand`'s own `--gd-cardw` lives on a DESCENDANT of that button — invisible to it. Without this ancestor definition the calc is invalid at computed-value time and the margin silently becomes 0 (**verified live: stacked cards rendered full-height, no overlap**)."* The same warning is repeated at `:1168-1170` and `:2192-2198`. The nine sites are not duplication; five are deliberate ancestor definitions serving inline `calc(var(--gd-cardw) * F)` styles emitted by `HandFan.tsx:307-309`. Consolidating them wrong produces, **on the phone**, every column at zero overlap and 27 full-height cards — silently, because an invalid `calc()` yields the initial value with no error.

**Replacement, keeping S4's only real benefit at ~2% of its cost:** add two lockstep pins modelled on `cut-panel.test.tsx:95-108` for the two clamp copies pinned by nothing today — `.gd-desk__stage` (`:1171`) and `.gd-sf__faces` (`:2914`). Both VERIFIED unpinned (grep of `tests/` for `gd-desk__stage` returns only `play-desk.test.tsx:322,558`, neither of which reads a size).

### Needs structural change — priced by what must be verified twice, forever

**S1 — Viewport-anchored action strip at ≥720 (`position: sticky; bottom`), plus `overflow-x: hidden → clip` on `.gd-table`, inside `@supports`, with the scroll guarantee re-pointed.**

The `clip` change is a prerequisite. **EXECUTED this round** (headless Chromium 151, synthetic boxes):

```
overflow-x: hidden  → computed overflow-y: auto     sticky child bottom = 200 (the box)
overflow-x: clip    → computed overflow-y: visible  sticky child bottom = 500 (the viewport)
```

So `.gd-table` (`table.css:41`, `overflow-x: hidden`, VERIFIED) *is* already a scroll container and a sticky descendant would resolve against its box; `clip` fixes it. My draft reasoned this from the spec and asked for it to be checked before S1 was built — it is now checked.

Three amendments the critiques forced, all accepted:

1. **`@supports (overflow-x: clip)` guards both declarations.** Safari first supported `overflow: clip` at **16.0** (Chrome 90, Firefox 81) — VERIFIED via one caniuse fetch. On Safari ≤15 the declaration is dropped, the base `hidden` survives, and the sticky strip silently does nothing on exactly the old family device this product exists for. Under `@supports` those devices keep today's behaviour and today's scroll guarantee instead of a compensator that is not there.
2. **`overflow-y` must be restated.** `clip` on x with `visible` on y leaves vertical overflow painting outside the box on the element that is also `.gd-ring`, inside which both overlays fly cards and the −14px lift lives. The mode block sets `overflow-y: auto` explicitly.
3. **The elder scroll guarantee must be re-pointed, or S1 destroys it.** `ScrollActionsIntoView` (`GameTable.tsx:127-147`, VERIFIED) exists verbatim for this audience — *"an elder does not know to scroll"* — and fires on `[loud, stagedCount]`, i.e. **on every card staged**, via `scrollIntoView({block:'nearest'})` on `.gd-actionsRow`. `block:'nearest'` is a no-op when the target is already in the scrollport, which `position: sticky` guarantees permanently. **EXECUTED, and it is worse than a no-op:**

```
row NOT sticky :  scrollY 0 → 640,  staged strip visible   (stageVisible: true)
row IS  sticky :  scrollY 0 → 0,    staged strip at y=900  (stageVisible: false)
```

The thing the guarantee actually protects is the **growing staged strip above the buttons**, and sticky abandons it. Fix, also **EXECUTED**: re-point the target to the staged strip and give it `scroll-margin-bottom` equal to the stuck row's height →

```
scrollY 0 → 640,  stage fully visible ABOVE the stuck row  (true)
```

**Price:** (a) the fold gate reports **two positions per deal** forever — in-flow document bottom and painted/stuck position — because a sticky strip is a compensator in the sense of METHODOLOGY practice 11, and reading only the stuck position measures the safety net; (b) the strip-occlusion sweep must include `.gd-desk__stage` and `.gd-desk__stagedCard`, not only `.gd-fan__card`; (c) the strip's z-index is re-checked against the overlay stack on any overlay change; (d) `@supports` means two rendered behaviours exist, and the one this repo cannot observe (no engine but Chromium is ever driven; both vitest configs are `environment: 'node'`, VERIFIED) is the fallback — so the fallback must be the *unchanged* behaviour, which is why it is written as an addition and never as a replacement.

**S2 — Two-column hand zone: `[desk | actions]` at D2, `[hand zone | feed rail]` at D3, via `grid-template-areas`.**
No DOM change; DOM order stays `fan → desk → actions → bottombar`, mapping to top→bottom then left→right in both maps.
**Amendments:** (i) the **feed rail is a sibling of `.gd-handzone` inside `.gd-table`'s grid, never a child** — because `PlayOverlay`'s south flight origin is `.gd-handzone`'s own rect midpoint (`PlayOverlay.tsx:73`, VERIFIED), and a rail inside the zone moves that midpoint off the fan; keeping it outside means the origin stays correct and needs no re-derivation. (ii) **No `order` and no explicit grid-line placement that reorders content** — committed in prose, asserted in a test, because a magnifier user tabbing across a 2478px screen is the population that pays for a divergence (WCAG 1.3.2 / 2.4.3). (iii) **The D2 half is conditional on G-GAP** (§7): the Pass↔sort-pill separation is a function of the actions row's container width (`.gd-actionsRow` is `1fr auto 1fr` with `justify-self: end` on the sort cell, `table.css:2348-2374`, VERIFIED), and halving the container narrows the gap that exists specifically to prevent a mis-tap.
**Price:** every future hand-zone child needs an area name in **both** maps or it silently auto-places into a new implicit row; "tab order equals visual order" becomes a two-mode check forever. CSS `reading-flow` would retire that cost but is not Baseline.

**S3 — Ring direction arc, jiefeng skip, tribute plate anchors. New DOM inside `.gd-ring`, at ≥960 only.**
**Price:** 3 new i18n keys × 3 locales (`i18n.test.ts:25-33`), plus the containment discipline below — which S3 no longer has to carry alone, because of S6.

**S6 (new) — `DealOverlay`'s slot query is scoped to the hand zone.**
`readRects` currently does `[...table.querySelectorAll('.gd-fan__card')]` where `table = overlay.closest('.gd-ring')` (`DealOverlay.tsx:75-78`, VERIFIED), a **positional** mapping with a silent bail to `onOwnLanded(27); onDone()` at `:109-113`. The finder sheet renders `.gd-fan__card` **spans** (`HandFan.tsx:303-321`) and is rendered from `GameTable.tsx:1657` — inside `.gd-ring`, and **outside `.gd-handzone`**, which closes at `:1642` (VERIFIED). So one line —

```js
const slots = [...(table.querySelector('.gd-handzone')?.querySelectorAll('.gd-fan__card') ?? [])]
```

— makes the whole class structurally impossible, retires the census test my draft priced against S3, and closes R15's null in the process. Two critiques proposed this independently (B-F10, C-F7); both are right and a structural fix beats a maintained DOM census whose failure mode is "whoever is trying to get green edits the expected count".

**S5 — `resolveScale` becomes mode-aware.** Blocking prerequisite for the type ladder.
`tests/unit/client/css-tokens.ts:17-20` builds a **flat, media-blind, last-wins** map, and it harvests tokens **from `appCss` only** (VERIFIED). Two consequences my draft ran together: a desktop `--fs-xl` override *in `app.css`* turns the phone's compression pin (`seat-stack.test.tsx:1139`) red for a change that never touches the phone; a desktop ladder declared *on `.gd-table` in `table.css`* dodges that false red only by being invisible to every pin. **Resolved:** the ladder is declared in `app.css`, media-scoped, and `resolveScale` is made mode-aware.
**Price:** four suites assert per-mode from then on, ~2× the token assertions — the honest cost of the owner's own preferred mechanism. **Plus one control my draft omitted (A-F8): run the NEW helper against the OLD `app.css`+`table.css` and assert it reproduces the OLD token map byte-for-byte.** Changing the instrument in the same commit as the change it must detect is uncalibrated measurement; that control is the calibration and it costs one test.

---

## 6. The vertical problem — what happens to Play/Pass at 1280×800

At 1280×800 the machine is in D2. The card does not grow, so nothing in the hand zone gets taller. Four things get shorter:

| change | saving | kind |
|---|---|---|
| `.gd-table` padding `xl`(16) → `sm`(8) at ≥720 & ≥700 tall | −16 | token |
| ring padding-block `xl`(16) → `sm`(8) | −16 | token |
| ring row-2 floor `minmax(9rem,1fr)` → `minmax(7rem,1fr)` (7rem = 112px still exceeds the 98.6px well card, so the reserve holding the ring still for `DealOverlay` survives) | −32 | token |
| play desk and action row share one grid row at D2 | ≈ −62 | S2 (conditional on G-GAP) |
| **total** | **≈ −126** | |

### The model behind those numbers, and what it says that §3.4's sample could not

The critiques demanded a sample-size argument for the fold gate. Working it out changed the answer, so it belongs here rather than in the gates.

**The fold's decisive axis is not column count. It is the deepest pile in the hand.** The settled fan is one line at every desktop mode by construction, so its height is `(aspect + (d−1)·min(stripW, 2.95/(d−1))) × w` for max pile depth `d` — `HandFan.tsx:183-198` + `lacquer.tsx:88`, aspect 1.45, stripW 0.42 (all VERIFIED). **EXECUTED**, that model reproduces the brief exactly:

| max depth *d* | rate | fan height @68px + 14px lift headroom | §3.3 measured |
|---|---|---|---|
| 3 | 15.16% | 169.7 | |
| **4** | **57.44%** | **198.3** | **198** ✓ |
| **5** | **23.51%** | **226.8** | **227** ✓ |
| 6 | 3.60% | 255.4 | |
| 7 | 0.29% | 284.0 | |
| 8 | 0.01% | 312.5 | |

Two-point exact match. So §3.3's "fan height 198–227px" is not a range; it is **the n=8 sample containing depths 4 and 5 and nothing else**, and §3.4's "832–860" is the same two buckets, 28.56px apart (= 0.42 × 68, the desktop quantum). My draft's R3 said "860 is not the desktop maximum" and guessed the tail near 985. The exact answer is better and lower: the structural maximum is **946**, and the whole ladder is computable rather than sampleable.

**Predicted Play document-bottom, by construction rather than by sampling** (inference, from two VERIFIED measured anchors plus a VERIFIED quantum; falsified or confirmed by five constructed runs per mode):

| *d* | rate | today | −126 (tokens + S2) | −176 (+ own-turn reflow) |
|---|---|---|---|---|
| 3 | 15.2% | 803 | 677 | 627 |
| 4 | 57.4% | 832 | **706** | 656 |
| 5 | 23.5% | 860 | **734** | 684 |
| 6 | 3.6% | 889 | 763 | 713 |
| 7 | 0.29% | 917 | 791 | 741 |
| 8 | 0.01% | 946 | **820** | 770 |

**Against a nominal 800px fold: everything fits except `d = 8` — a predicted below-fold rate of 1 in 10,000**, where today it is 8/8. That is a far sharper claim than "0/8" and it is checkable in five runs.

The fifth lever is the existing guard-2 reflow (`table.css:2463-2465`, phone-only today) extended to short desktop windows, `(min-width: 720px) and (max-height: 900px)` — a proven pattern reused, recovering ~50px exactly while the desk is loud.

### And now the part that is not comfortable

§3.4's rows are viewport inner heights labelled as screen sizes — headless Chromium's viewport *is* the inner size, and the brief already makes this correction for phones (`scripts/measure-fold.mjs:52-56`: *"844 is an inner height no phone browser produces"*, VERIFIED). A **real** 1280×800 laptop presents roughly **660–690**. Read the last column against 670:

> **At an inner height of 800 the layout fits in flow for 99.99% of deals and the fix is structural. At the inner height a real 1280×800 laptop actually presents, the flow layout fails on ~27% of deals (every hand with a pile 5 deep or deeper), and the viewport-anchored action strip is what makes Play reachable.** If G-GAP rejects S2's D2 column share, the flow layout fails on **100%** of deals at 670 and S1 carries all of it.

Both numbers get reported, as rates, at both viewports. I am not going to claim the first and let it stand for the second.

---

## 7. Gates

Every pass condition is pre-declared (practice 8) and stated with a sample size and the axis varied (practice 12).

### G-PHONE-IDENTITY — the byte-identity gate

**Byte-identity is now defined**, because my draft used the owner's word without one: *the phone's computed style over the complete rendered tree, and its geometry, are identical before and after, at every integer width in [320, 719] plus the fractional neighbourhood of 720, over an enumerated set of game states.* Anything weaker gets a different name.

**(a) Source — reformulated as a DELTA gate.** My draft's version ("every selector inside every `@media` block is inside a `min-width ≥ 720` query or carries a mode class") fails on **unchanged code**: there are 12 `@media` blocks across the two stylesheets and only 2 satisfy it (`table.css:1797, 2405`); the other 10 are 8 motion-preference blocks and 2 `max-width: 719px` blocks (VERIFIED by grep). A pass condition that must be edited to let unchanged code pass is not pre-declared, and the grandfather list is exactly where a later leak hides. Also: the "mode class" half is dead by construction — there is **no width-reactive JavaScript**, so no mode class can exist (VERIFIED). Replacement, in three clauses against a `git show HEAD:` baseline:

1. Every `@media` block in the post-change stylesheets is **either byte-identical to a baseline block, or a `min-width ≥ 720` query.**
2. Every declaration **outside** all `@media` blocks is byte-identical to the baseline. *(This is the clause my draft was missing entirely — the phone renders `base ∪ @media(max-width:719px)`, so a base-rule edit is a phone edit and the block-scoped gate could not see one. With S4 deleted the expected delta here is **zero declarations**, which makes the clause free to state and impossible to fudge.)*
3. The scan is media-aware (the existing template `hand-areas-ui.test.ts:63-91` is anchored to column 0 and cannot see indented rules inside `@media` — the entire mechanism a desktop round uses).

Pass: **0 violations in all three clauses.** Passes on HEAD by construction.

**(a′) The scanner is self-tested.** A gate that cannot fail on a known-bad input is not a gate. `fan-tap-targets.test.ts:41` scans with `/([^{}]+)\{([^}]*)\}/g`, which binds `selectors` to an `@media` prelude and swallows the first nested rule — **16 rules are invisible to it today** (13 at-rule preludes in `table.css`, 3 in `app.css`). So each stylesheet scanner gets a fixture test: feed it a transform on `.gd-fan__card` placed **first** inside an `@media` block and assert it **flags**. Same for `narrowBlock`. This is critique C-F2 and it is better than my draft's one-time regex repair, because the hole returns at the next nesting construct.

**(b) Rendered.** A 1px width sweep, 320→719, plus `719.4 / 719.6 / 719.9` set via CDP (`min-width: 720px` evaluates false at 719.6, and browser zoom and fractional DPR produce fractional widths — a 1px integer sweep never samples the only boundary that matters). Per width, a computed-style + geometry fingerprint over the **complete** rendered tree.
Three corrections my draft needed: the sweep runs on a **seeded, injected hand** (a before/after comparison on two different deals compares two different hands — §3.3 shows fan geometry is a step function of the deal); it runs over an **enumerated state list**, not a resting table (`.gd-cut__ribbon`, `.gd-desk__stage`, `.gd-sf__faces` and the chooser are modal and a width sweep of a settled table never mounts them); and it runs at both `prefers-reduced-motion` settings.
Sample: 403 widths × 1 seeded hand × 6 states, plus 8 fresh deals each at 390 and 719.
Pass: **403/403 identical.** No confidence interval — 320–719 at 1px steps is the *population* of integer widths, not a sample from it, and printing `[0.990, 1.000]` beside "there is no threshold to hide in" **is** a threshold (critique A-F10, accepted; my draft's interval is deleted).

### G-FOLD-⟨mode⟩ — the vertical gate

`scripts/measure-fold.mjs` already has `FOLD_W`/`FOLD_H` (`:55-56`), the n=40 justification (`:33-49`) and a Wilson interval (VERIFIED). Changes:

- **Two readings per deal:** `flowBottom` (with `position: static` forced on the row) and `reachable` (is the painted rect inside the viewport at `scrollY === 0`). S1 is a compensator; reading only the stuck position measures the safety net, which is the mistake this project recorded twice.
- **A constructed depth ladder replaces sampling for the tail.** Five injected hands with max pile depth 4, 5, 6, 7, 8 — one run each per mode, deterministic, 1/1. This is the direct answer to the "n≈88 per mode, 8.8× the standing cost, 23 minutes of rate-limit waiting" objection (C-F4): the axis that decides the outcome is depth, `P(d≥8) = 0.0001` (**EXECUTED**), and 40,000 deals would be needed to sample it. **Construct it in five.** The cost of the fold gate goes *down*, and its coverage goes up.
- **`KNOWN_BUCKETS` per viewport becomes derived, not bootstrapped.** The desktop set is `{803.4, 832, 860.6, 889.1, 917.7, 946.3}` — the depth ladder above. My draft priced "one bootstrap run of 80 deals per viewport"; that is now unnecessary.
- **Mode-tagged output** so two modes' runs cannot merge.

Representative viewports, chosen as **real inner heights** and now including the two bands my draft left ungated: **844×390** (landscape phone, D1), **768×1024** (portrait tablet, D1), **960×600** (a 1440×900 at 150% zoom, D2), **1280×670**, 1440×770, 1600×860, 1920×950, 2560×1310. n = 40 fresh deals each **plus** the 5 constructed depths; axis varied = the deal, then the depth.

- **`reachable` at scrollY 0: 40/40 and all 5 constructed, at every viewport.** At n=40, 40/40 gives Wilson [0.912, 1.000]; 39/40 gives [0.871, 1.000] and **fails**. Stated so nobody mistakes 39/40 for a pass.
- **`flowBottom ≤ fold`: report the rate against the predicted per-depth table in §6; no pass threshold.** This is the diagnostic and it is the owner's number to accept, exactly as the ~8% phone rate was accepted on the record. The §6 table is the pre-declared prediction: if the constructed `d=4` run at 1280×800 does not land at 706 ± one quantum, the model is wrong and the design is re-costed.

### G-TAP-⟨mode⟩ — the selection gate, split into two different gates

My draft said "G-TAP stays a real gate at every mode". Three separate objections landed on that sentence and all three are right.

1. **`scripts/measure-fan-tap-targets.mjs` is hardcoded to 390×844 at `:86` and `:93` with no viewport knob** (VERIFIED; its only env is `FAN_SWEEP_BASE`), so "a gate at every mode" describes a script that does not exist yet.
2. **The 390 run must be *retained*, not converted.** `table.css:829-846` makes it the REQUIRED check for **any** fan or selection change, and this round changes the fan. My draft's prose said the phone run is kept; its pre-declared viewport list contained no phone viewport. That is the phantom-mitigation shape, in my own gate list.
3. **Phase 1 measures a self-relative regression on the vertical axis, which the horizontal pitch cannot move.** Running it at three more modes varies an axis that cannot change the answer — practice 12, verbatim.

So:

- **G-TAP-PHONE (unchanged, mandatory, blocking):** the existing 27 × 27 `elementFromPoint` sweep at 390×844. Pass: **0 cards lose > 100px²** against their own baseline. This is the silent-revert detector and it stays exactly as it is.
- **G-TAP-DESKTOP-⟨mode⟩ (new, and genuinely different):** (i) **strip occlusion** — the stuck action row's rect against every `.gd-fan__card`, every `.gd-desk__stagedCard`, and the bottom bar's controls; pass **0 elements lose > 100px²**; (ii) **absolute floor report** — for every card, `min(width, height)` of its uniquely-owned area against 44px and against 24px, reported as a distribution, not a pass/fail. The covered-card strip is 28.6px and will fail 44 at every mode (§2); the gate's job is to make that a number in the record rather than an exception nobody has written down. (iii) `LIFT_PX = 14` is read from the stylesheet, not from a script literal.
- **G-GAP (new, and it gates a design decision):** `passButton.getBoundingClientRect().right` vs `sortPill.getBoundingClientRect().left`, n = 8 deals per mode. Pre-declared floor: **the value measured at 390 in the same run**. If D2's `[desk | actions]` column share puts the gap below that floor, **S2's D2 half is dropped** and §6 loses its −62px (see the last column of §6's table for what that costs).

### G-INK — the width gate

- **Deterministic worst case.** The constructed 15-class hand, injected. Pass: **fan renders on 1 line, and `.gd-table` has `scrollWidth === clientWidth`, at 720 / 960 / 1440** — 1/1 each, no sampling. One critique flagged that the overflow half goes tautological under `overflow-x: clip`; **EXECUTED and refuted** — under `overflow-x: clip` Chromium 151 reports `scrollWidth 1200` against `clientWidth 400`. The assertion still measures what it claims.
- **Distribution.** n = 40 fresh deals per viewport: report the column-count distribution and the one-line rate. Pass: one-line rate ≥ 0.95, Wilson lower bound ≥ 0.85. **Pre-declared honestly: at n = 40 this half is powered for ≥14 columns (P(miss) ≈ 4×10⁻⁵) and is NOT powered for 15 (P(miss) = 0.249).** The 15-column case is covered by construction, not by sampling, and a clean 40-deal run is not evidence about it.

### G-ANGLE — the ceiling gate, now gated on a census

Read the constructed worst case's ink width and convert at a **stated** distance and CSS-ppi. Pass: **≤ 25°.** But the inputs are the problem: at 110 CSS-ppi and 60cm the ×1.45 body text is 20.1′ of cap height — the *bottom edge* of ISO 9241-303's 20–22′ band, only 1.26× its 16′ absolute minimum — and at a 13″ Retina laptop's 127 CSS-ppi it is 17.4′ (outside the band) and at "More Space" 1680×1050 it is ~14.9′ (**below the absolute minimum**). My draft attached "2.9× above the floor" to the card's `'10'` glyph and let the comfort read across to body text; that was misleading and the critique is right.

**So the type ladder is stated in rem, and the angular figure is a reported reading with its inputs — never a property.** The gate's inputs come from a **census, not from the owner's desk**: for each machine actually used by this four-player table, record (diagonal, native resolution, OS scaling, current browser zoom, seated distance) and report the resulting arcmin **as a range with n stated**. n=1 on a non-representative unit measures nothing about a claim whose deciding axis is *whose eyes and whose machine* — practice 12. The ISO 9241-303 and Frontiers 2022 figures remain **UNCERTAIN** (not re-fetched this round).

### G-LOCALE (new) — three-locale fit at desktop type

A ×1.45 ladder makes every string ~45% wider while D2/D3 narrow the column that holds them. Render all three locales at each mode with the longest actor name and assert `scrollHeight === clientHeight` on `.gd-headline__turn`, the Play/Pass labels and the desk status line. This matters beyond tidiness: a wrapped turn sentence changes the headline's height, and the headline is the row the clock lives in — a locale-dependent (or turn-dependent) wrap moves the clock. Note also that `.gd-headline__turn--echo { display: none }` is scoped `@media (max-width: 719px)` (VERIFIED), so **at ≥720 the headline sentence and the loud desk both fire**; the proposal keeps that, and G-LOCALE is where "two own-turn signals 700px apart" gets looked at.

### G-DIRECTION — the ring gate

DOM assertion at ≥960, both motion settings: the active seat's identity is carried by **three** independent encodings (plate border, turn sentence, direction arc) and the arc is present under `prefers-reduced-motion: reduce`. Pass: **3/3 at both settings**, plus 0 `animation`/`transition` declarations on the arc. Plus: the arc's DOM is **absent** below 960 (one assertion, and it is what makes §3's structural work compatible with byte-identity by construction).

### G-FLIP (new, small) — motion comfort on the sort beat

`SORT_BEAT_MS = 420` (`deal.ts:32`, VERIFIED) drives the FLIP re-lay on two beats: the deal→sorted transition and the **asc/desc sort-pill toggle** — an elder-facing control. The toggle's displacement scales with the fan's ink span, which goes 734 → 1020px at D3, so the extreme column's travel rises ~1.39× at a fixed 420ms. The effect already computes `dx`/`dy` per card (`HandFan.tsx:263-264`); log `max(|dx|)` per mode over n=8 deals and pre-declare a px/s ceiling. No new instrumentation.

### Order of work

The two evasion holes, the scanner self-tests, and the first-occurrence pin audit (below) land **before** any mode block is written. `fan-tap-targets.test.ts:41` and `seat-stack.test.tsx:1122` both fail **open**, and the direction that matters is the invisible one: new CSS is appended at the bottom of these files, and a *later* duplicate `@media (max-width: 719px)` block is invisible to `narrowBlock` while an earlier one merely goes red.

---

## 8. My riskiest assumption, and the cheapest measurement that kills it

**Unchanged: that a 27-card hand at zero column overlap — 11 to 15 fully-exposed 68px cards in one row — is scanned at least as fast by an elderly player as today's overlapped band.**

Everything else here is arithmetic over measurements that exist. This is a perceptual claim; it contradicts 6/6 of the observed prior art, and I overrule that on the grounds that 0/6 of them group by value — a reason, not a proof.

**Cheapest measurement that kills it.** Within-subject A/B, 4 players (≥2 elderly), the **same 20 dealt hands** injected in both conditions, one fixed 1440 viewport, condition = column pitch 0.80 vs 1.00. Measure time-from-turn-start to first card selected, and the stage-then-unstage rate. **Pre-declared kill condition: if mean time-to-first-selection at p=1.00 is not at least 10% lower than at p=0.80, or if the unstage rate rises at all, the pitch ladder stops at 0.80** and D3's surplus goes to the ring and the feed. n = 4 × 20 × 2 = 160 turns. One afternoon; the only measurement here that needs a human.

**Second riskiest, and it is cheaper.** That §3.4's desktop rows are inner heights while their labels are screen sizes. One `window.innerHeight` reading in a maximised browser on a real 1280×800-class machine settles it, and it decides whether §6's structural recovery is sufficient alone or whether S1 is load-bearing for ~27% of deals.

**Third, promoted by the critiques.** That the machine census returns a CSS-ppi near 110. At 127 the ×1.45 body text leaves ISO's recommended band; at ~148 ("More Space" on a 13″ Retina — precisely what a younger relative sets on a parent's laptop) it falls below the absolute minimum. Five one-line readings settle it.

**No longer risky, because I ran it:** R9's `overflow-x: clip` mechanism, and the sticky-vs-`scrollIntoView` interaction. Both EXECUTED above; one confirmed my reasoning, the other refuted it.

---

## What I would not do

1. **Not a bigger card.** At a fixed angular budget the glyph is determined, so a 96px card buys the same legibility as zero overlap while costing 41% more fan height on the axis that is already failing — and it drags nine clamp sites, the lift constant, the seat-stack extent, the desk stage, the finder sheet and the cut ribbon's arithmetic with it. (This is also why critique B-F15's ordering objection does not apply: it assumes a 90px card this proposal explicitly refuses.)
2. **Not zero overlap below 960px, and never on the phone.**
3. **Not filling a 2478px screen.** The ladder stops at 1440 and the page column at 88rem: 45.2% → ~55% utilisation, then stop. Past ~1050px of fan ink and ~1000px of opponent separation the player is recruiting head movement to read their own hand. Utilisation is the wrong objective, and filling the screen is an ad-revenue artefact in the prior art — cardgames.io's fixed board makes its **desktop hand measurably worse than its mobile one** (pitch 35→18px when you cross 731px).
4. **Not per-seat trick wells.** The pooled well is the one place the eye must return every turn; four wells turn one fixation into four, and the visual-search age effect is on **set size**, not physical extent. Provenance is already spatial via the play flight's origin; a static edge tab on the well is the cheaper answer.
5. **Not side-by-side sort bands** — the three-locale `putBack` string and variant D's vertical mitigation.
6. **Not `SEAT_STACK_MAX_ROWS = 3`, and no width-aware JavaScript of any kind.**
7. **Not `AREA_HARD_MAX = 3`.**
8. **Not container queries or style queries as the mechanism** — `style()` reached Baseline newly-available 2026-05-19, too new for this audience, and a container cannot query itself. **Correction to my draft:** I wrote that the useful idea is to "set one `--gd-mode` name in one media query and key every rule to the name". That is not possible — custom properties are not selectable without `@container style()`, the very feature being rejected (critique A-F13, accepted). What a custom property *can* do is parameterise **values**: `--gd-p: 1.00` consumed by `calc()`, which covers T3/T4/T5 and nothing structural. The claim that this reduces the phone gate to a one-token proof is withdrawn; the phone gate is the three-clause delta gate in §7 and there is no shortcut.
9. **Not a 90° scene rotation in portrait.** Coherent design; incompatible with "keep the current design at small viewports" and with byte-identity.
10. **Not a looped pulse on the active seat.**
11. **Not a screenshot diff as the phone gate.** It needs a threshold, and a threshold is a place for a compensated failure to hide. (Which is why my own Wilson interval on an exhaustive enumeration had to go — same objection, turned on me.)
12. **Not `--gd-cardw` consolidation.** New to this revision; see §5.
13. **Not a DOM-census guard for the deal overlay.** New to this revision; a structural scope fix beats a maintained expected-count.

---

## Risks

**R1 — §3.3's counterfactual ink widths are a sample of 11–14 columns.** 748 = 11×68, 952 = 14×68, 990 = 11×90, 1260 = 14×90. The structural worst case is **15** columns, at 3.42% of hands (EXECUTED). Every "becomes possible at ≥X px" line in §3.3 is 68–90px optimistic; every threshold here is derived from 15.

**R2 — "the fan fits one line at every viewport from 719px up" is the same sample.** A 15-column hand is 734.4px against the 44rem (704px) hand cap — it wraps at **every** viewport today, because the cap binds before the viewport does.

**R3 — §3.4's desktop sample spans exactly two step-function quanta, and the tail is computable.** Superseded and sharpened by §6: the decisive axis is max pile depth; 832–860 is depths 4 and 5 (80.9% of hands); the structural maximum is **946**, not 860, and not the ~985 my draft guessed. The model reproduces §3.3's measured fan-height range to the pixel.

**R4 — the desktop rows are inner heights labelled as screen sizes.** The shipping defect is wider than 8/8 at two rows; it covers essentially every 800- and 900-class laptop.

**R5 — "the trick well is at most 149.6 × 98.6px" is a sample maximum written as a property.** 149.6 = a 4-card play. The widest legal play is 10 cards = 312.8px against a 250.3px centre track, so it **wraps at every viewport ≥720 and not at 719**.

**R6 — the 45.2% utilisation figure is a real reading and the wrong objective.** What moves instead: sliver 47.6→68px; opponent separation 608→~1000px; the widest legal play from wrapping to one line; the feed from 2 lines to 8 with a measure cap; the `'10'` glyph out of its special case.

**R7 — "several hard-won constraints disappear with overlap" is not supported by the code.** Corner-index-in-a-sliver, the wild marker's home, the joker corner budget and the seal's position are governed by the **flat fan's −0.6 overlap** (`table.css:858`) and its consumers — a *different quantity* from the settled column pitch (`:1024`). And hit/paint decoupling is a **pile** artefact: the victim is "the card DIRECTLY ABOVE it in its own pile", and `stackOffsetW` is untouched by any horizontal change.

**R8 — the angular arithmetic's two inputs are unmeasured, and the census is the fix.** See §7 G-ANGLE. The ×1.45 ladder is stated in rem; the arcmin figure is a derived reading with its inputs, and the top rung is **BLOCKED ON MEASUREMENT** until the census lands.

**R9 — the sticky strip's mechanism.** **Retired: EXECUTED.** `overflow-x: hidden` → `overflow-y: auto` (scroll container, sticky trapped); `overflow-x: clip` → `overflow-y: visible` (sticky resolves against the viewport). The fix direction is right. Replaced by **R9′**: the mechanism is right *in Chromium*, and Safari ≤15 drops `clip` silently (Safari 16.0 first support, VERIFIED via caniuse) on a device class this audience actually owns — hence the `@supports` guard, and hence a permanent honest statement that **no measurement in this repo can observe the fallback path**: every measurement script is `chromium.launch()`, and both vitest configs are `environment: 'node'` (VERIFIED), so no layout is computed anywhere in the automated suite on any engine.

**R10 — two evasion holes sit directly in this round's path**, both reproduced by execution in two independent critiques. Understated in my draft in two ways: the `fan-tap-targets.test.ts:41` swallow hole is not a prospective desktop hazard, it is **live today** — 16 rules across the two stylesheets are already invisible to it, including the first rule of every `prefers-reduced-motion` block; and `narrowBlock`'s two failure directions are asymmetric, with the likely one (a later block) being the invisible one. Fixed first, and **self-tested** (§7 (a′)).

**R11 — the mode-scoped overrides escape the existing lockstep pins, in my favour, which is a hazard.** Corrected and enlarged: the first-occurrence hazard is not three pins. `grep` of `tests/unit/client/*.ts*` for `.match(/` returns ~116 call sites, ~55 of them run against stylesheet text, plus the shared helpers in `css-tokens.ts` used by four more files. **And there is a fourth explicit lockstep pin my draft did not name:** `seat-stack.test.tsx:923-940`, whose hardening clause scans **globally** (`seatstackRules` uses `matchAll`) and asserts `expect(declarations).toHaveLength(1)` (VERIFIED). It behaves *opposite* to the other three — a desktop `.gd-seatstack` override goes **red**, not green. (That clause would have broken S4 outright, which is a fifth reason S4 was wrong.) Disposition: T3/T4/T5 each get their own mode-aware pin — desktop pitch pair cancels, desktop well overlap equals desktop chooser overlap, index ratios equal `0.36 × p/0.70` — and the pin audit is part of the pre-work in §7.

**R12 — S2 changes what "the hand zone" is.** Half of my draft's R12 was wrong and is withdrawn. (a) *Withdrawn:* "one assertion that `.gd-handzone` is a descendant of `.gd-ring`" — `GameTable.tsx:1361` opens `<section className="gd-table gd-ring">`, so **`.gd-table` and `.gd-ring` are the same element** (VERIFIED), the hand zone is inside it, and no `grid-template-areas` value can reparent anything. The assertion is green before, after, and after a version that breaks the overlay. (b) *Withdrawn:* "`PlayOverlay`'s south origin is true only because `.gd-handzone` is `margin: 0 auto`" — `PlayOverlay.tsx:73` returns `r.left + r.width/2` on the element's **own** rect (VERIFIED), which is correct wherever it sits. The real hazard is narrower and survives: at D3 a feed rail *inside* the hand zone would move the zone's midpoint off the fan. **Fix: the rail is a sibling, not a child** — cheaper than re-deriving the origin from `.gd-fan`, whose rect is deal-dependent and absent in some phases. (c) *Kept and replaced by structure:* the positional slot query, now S6.

**R13 — the deal choreography's constants are distance-blind, and there are four of them.** `DEAL_FLIGHT_MS = 320` (`deal.ts:12`), `PLAY_FLIGHT_MS = 420` / `STAGGER = 70` (`PlayOverlay.tsx:47-48`), **and `SORT_BEAT_MS = 420` (`deal.ts:32`)**, which my draft omitted and which drives the beat an elder triggers by hand (the sort pill). The ring going 608→1000px raises apparent flight speed ~1.6×; the sort toggle's extreme travel rises ~1.39×. Out of scope, in-consequence, now gated (G-FLIP). The freshness window `now - playFx.at < 2000` (`GameTable.tsx:1184`, VERIFIED) is coupled to those durations and must move with them.

**R14 — the elderly type band I am not reaching, on an honest baseline.** My draft framed this as "ISO band comfortably met, elder band not reached". Corrected: **ISO's recommended band is met only at its bottom edge on the reference machine and missed on plausible real ones** (R8/§7). And my stated reason for stopping — that a bigger ladder would re-open the vertical budget — does not survive scrutiny: the vertical budget is dominated by the fan, whose height is `--gd-cardw`-driven, not font-driven. Raising **only** the turn sentence and the clock toward the ~28–32px the older-adult literature suggests at 60cm costs a few tens of px in two rows. **BLOCKED ON MEASUREMENT:** one `measure-fold.mjs` run at 1280×800 with those two strings at 28px, n ≥ 40 plus the constructed depth ladder, converts a judgement call into a number. Until then the ×1.45 top rung is provisional.

**R15 — a null result I could not close.** **Closed, adversely, by reading one file further.** The finder's held result is cleared by a **parent** effect with no dependency array (`GameTable.tsx:798-814`, VERIFIED), while `DealOverlay` reads its slot array in a **child** effect (`DealOverlay.tsx:99-113` → `readRects` at `:74-86`). React runs child effects before parent effects in a commit, so on the commit where a new hand arrives the sheet's `.gd-fan__card` spans are still in the DOM when `querySelectorAll` runs, the positional mapping shifts, and 27 flights land on wrong rects — silently. Tagged **inference** on one link only: I did not confirm by execution that `DealOverlay` mounts in the same commit the hand changes. Retired structurally by S6, which makes the class impossible rather than detected.

**R16 (new) — the covered card's press strip is 28.6px against this project's own 44px floor**, and this round does not fix it. See §2. Reported at every mode by G-TAP-DESKTOP; the remedy is **BLOCKED ON MEASUREMENT** (the post-recovery vertical budget per mode, from G-FOLD's constructed ladder) and is a named follow-up decision, not something the owner should discover later.

**R17 (new) — page zoom is a persistent accommodation and it demotes a user out of the mode that carries the fold fix.** A 1440×900 at 150% is 960×600. Mitigated by the height-conditioned air (decision 2) and gated by adding 960×600 and 844×390 to G-FOLD; not fully solved, because a px-keyed ladder and page zoom are structurally in tension. Named so it is argued about, not discovered.

---

## What the critiques changed

**Critique A — phone regression (15 findings)**

| # | claim | disposition |
|---|---|---|
| A-F1 | Gate (a)'s domain is `@media` blocks, so it cannot see the 9 base declarations S4 rewrites | **Accepted.** VERIFIED: 9 clamp sites, 0 inside any `@media`. Gate gains clause (2) (base declarations byte-identical to baseline); with S4 deleted the expected delta is zero. |
| A-F2 | Gate (a)'s pre-declared pass fails on unchanged code → an unenumerated allowlist | **Accepted.** VERIFIED: 12 blocks, 2 qualify. Gate rebuilt as a three-clause delta gate against a `git show HEAD:` baseline. |
| A-F3 | S4's "price: negative" is wrong three ways (`--sliver-w` is a different token; topology drops the value; two sites are `calc()` usages the pin parses literally) | **Accepted**; sub-claims (1) and (3) VERIFIED at `cut-panel.test.tsx:101` and `hand-fan.test.tsx:324-325`. Moot in effect — S4 deleted. |
| A-F4 | S4 is not a prerequisite; a media query restates a *declaration*, and consolidation risks a silent zero-overlap phone regression | **Accepted, decisive. S4 DELETED.** The single largest change in this revision. |
| A-F5 | G-TAP's pre-declared viewport list omits 390, contradicting the proposal's own prose | **Accepted.** Split into G-TAP-PHONE (retained, blocking) and G-TAP-DESKTOP. |
| A-F6 | R12's "cheapest possible guard" is a tautology — `.gd-table` and `.gd-ring` are the same element | **Accepted.** VERIFIED at `GameTable.tsx:1361`. R12(a) withdrawn; budget moved to the structural fix S6. |
| A-F7 | "Byte-identical" never defined; S3 never width-scoped; a `display:none` node passes a geometry fingerprint | **Accepted.** Byte-identity defined in §7; S3 scoped to ≥960 with an absence assertion. |
| A-F8 | `css-tokens.ts` reads `appCss` only, so the executed false-red and the proposed `.gd-table` placement describe different experiments; no calibration control | **Accepted.** VERIFIED at `css-tokens.ts:17-20`. Placement resolved (app.css, media-scoped); calibration control added to S5. |
| A-F9 | G-PHONE-IDENTITY(b) unrunnable: unseeded deal, one deal, no game states | **Accepted.** Seeded hand + enumerated state list + both motion settings. |
| A-F10 | A Wilson interval on an exhaustive enumeration is a category error and re-introduces a threshold; fractional widths unsampled | **Accepted.** Interval deleted; 719.4/719.6/719.9 added. |
| A-F11 | 720–1279 has four token changes and zero gates; landscape phones and portrait tablets live there | **Accepted**, and it produced a new design decision (height-conditioned vertical air) plus 844×390 and 768×1024 in G-FOLD. |
| A-F12 | R10's swallow hole is a standing *phone-side* hole, and `narrowBlock`'s two directions are asymmetric | **Accepted.** R10 restated; the likely direction (a later block, invisible) is the one named. |
| A-F13 | A rule cannot be keyed to a custom property's value; and there is no mode class because there is no width-reactive JS | **Accepted.** "What I would not do" #8 corrected; gate (a)'s dead clause removed. |
| A-F14 | Provenance line: wrong commit count, and `git log --oneline` cannot support a claim about files | **Accepted.** Corrected in the header with `git diff --stat`. |
| A-F15 | (1) G-INK's overflow clause goes tautological under `clip`; (2) `clip` un-clips the other axis; (3) Safari ≤15 drops `clip` | (1) **Rejected — refuted by execution:** `scrollWidth 1200` vs `clientWidth 400` under `overflow-x: clip`, Chromium 151. (2) **Accepted** — `overflow-y` restated. (3) **Accepted** — VERIFIED Safari 16.0 via caniuse; `@supports` guard added. |

**Critique B — the elderly player and accessibility (15 findings)**

| # | claim | disposition |
|---|---|---|
| B-F1 | Sticky permanently satisfies `scrollIntoView({block:'nearest'})`'s condition, retiring the guarantee written for elders — and abandons the staged strip above it | **Accepted, and VERIFIED BY EXECUTION** (`scrollY 0→0`, staged strip at y=900 off-screen; the non-sticky control scrolls 0→640 and shows it). S1 amended: target re-pointed to the staged strip + `scroll-margin-bottom`; fix also EXECUTED. The single most valuable finding of the three critiques. |
| B-F2 | G-TAP is hardcoded to 390×844 and is a self-relative detector, not a 44px floor check | **Accepted.** Converges with A-F5 and C-F1. |
| B-F3 | The covered card's press target is 0.42×cardw = 28.6px; the pitch spends surplus on the non-binding dimension | **Finding accepted** (new risk R16, new gate clause). **Framing rejected:** the horizontal sliver is the binding dimension for *index legibility*, a different objective; and the vertical remedy is not expressible without width-reactive JS or an `!important` override of a depth-dependent inline style, and the 2.95w spread budget defeats it for deep columns anyway. Remedy **BLOCKED ON MEASUREMENT.** |
| B-F4 | Discrete px-keyed modes fight browser zoom; 150% on a 1440×900 lands at 960×600 and demotes out of the fold fix | **Accepted.** New design decision (height-conditioned air), new G-FOLD viewport, new risk R17. |
| B-F5 | R8 understates its own Retina case; body text, not the card glyph, leaves the band first, and falls below ISO's minimum at "More Space" | **Accepted.** §7 G-ANGLE and R14 rewritten; the adjacency that let one claim's headroom read across to the other is removed. |
| B-F6 | R8's fix is n=1 on the wrong person; the deciding axis is which family member's machine | **Accepted.** Replaced with an enumerable census reported as a range with n stated. |
| B-F7 | R11's inventory misses a fourth pin whose global scan behaves oppositely (`seat-stack.test.tsx:923-940`) | **Accepted** as an inventory correction — VERIFIED, and it is a fifth reason S4 was wrong. **Rejected** in its scenario: "hand grows to 90–110px while seat stacks stay at 68" cannot arise, because the card size never changes at any mode. |
| B-F8 | The clamp literal appears 8 times; `.gd-desk__stage` is unpinned, so a desktop card enlargement shrinks the card at the desk | **Count rejected** — it is **9**; the critique missed `.gd-sf__faces:2914` (VERIFIED). **Scenario rejected** — it requires enlarging the card, which decision 3 refuses. **Underlying observation accepted** — `.gd-desk__stage` and `.gd-sf__faces` are unpinned and now get lockstep pins (the surviving benefit of the deleted S4). |
| B-F9 | R13's constant list is short by one: `SORT_BEAT_MS = 420` drives the sort-pill toggle | **Accepted.** VERIFIED at `deal.ts:32`. **Multiplier corrected:** the critique's 2.65× assumes a 90px card; at a fixed 68px card the toggle's extreme travel rises ~1.39× (ink 734→1020). New gate G-FLIP. |
| B-F10 | R15's null is closeable adversely: child effects run before the parent effect that closes the finder | **Accepted.** Structure VERIFIED (finder at `GameTable.tsx:1657` is inside `.gd-ring` and **outside** `.gd-handzone`, which closes at `:1642`), so the proposed scope fix works. Converges with C-F7 → S6. |
| B-F11 | Target *spacing* is ungated, and S2 changes the quantity the Pass↔pill gap depends on | **Accepted.** VERIFIED at `table.css:2348-2374` + `GameTable.tsx:1560-1566`. New gate G-GAP, and **S2's D2 half is now conditional on it** — which puts −62px of §6's recovery at risk and is stated as such. |
| B-F12 | Nothing addresses focus order and S2 is a grid change | **Accepted.** Prose commitment (no `order`, no reordering grid placement) + assertion. |
| B-F13 | A ×1.45 ladder inside a narrowed column with zh-Hant binding is unpriced; the headline carries the clock | **Accepted.** New gate G-LOCALE, including the two-own-turn-signals question at ≥720. |
| B-F14 | R14 asks for sign-off against an inflated baseline, and its stated reason does not survive | **Accepted.** R14 rewritten; the targeted turn-sentence/clock raise is BLOCKED ON MEASUREMENT with the exact run named. |
| B-F15 | The card enlargement makes the vertical problem worse and the absorbing fix is unrun | **Rejected on its premise** — no card enlargement is proposed at any mode; the fan's height is unchanged by every change here. **Ordering demand accepted** and now discharged: R9's reading was run first (EXECUTED). |

**Critique C — maintenance cost and measurement drift (10 findings)**

| # | claim | disposition |
|---|---|---|
| C-F1 | G-TAP: (a) cannot run at a desktop mode, (b) is not in CI, (c) its pass condition is satisfied structurally so re-running it per mode varies an axis that cannot change the answer | **All three accepted.** (c) is the sharpest and it changed the gate's design: desktop modes get strip occlusion + an absolute-floor report, not a repeat of a vertical self-relative sweep. |
| C-F2 | The regex repair is one-time against a permanent hole; add a self-test that feeds a known-bad fixture | **Accepted.** Gate (a′). Also VERIFIED: 16 rules are invisible to the scanner today, including the first rule of every reduced-motion block. |
| C-F3 | The ladder under-provisions by one column; P(15 columns) = 3.37% and n=8 misses it 76% of the time | **Number accepted and independently reproduced** (EXECUTED: 3.42% / 75.7%). **Attack rejected:** the rungs it attacks (≥1024/≥1280/≥1440-at-90px/≥1728) are §3.3's, not mine; my thresholds are derived from 15 columns (R1) and I lift `.app-main--wide` to 88rem, which is the cap the critique says would otherwise bind. |
| C-F4 | The fold gate is under-powered for a 3.37% event; honest n ≈ 88 per mode → 8.8× the standing manual cost | **Rejected on the axis, accepted on the principle.** The fold's decisive axis is **max pile depth**, not column count — EXECUTED, and the model reproduces §3.3's measured 198–227px fan height exactly as depths 4 and 5. `P(d≥8) = 0.0001`, so sampling would need ~40,000 deals. **Remedy: construct the tail (5 hands per mode) instead of sampling for it.** The gate's cost goes *down*, its coverage goes up, and `KNOWN_BUCKETS` becomes derived rather than bootstrapped. |
| C-F5 | R9's diagnosis is right (executed), but the prescription is a one-time reading against a permanent fail-open hazard; and Safari ≤15 plus `environment: 'node'` mean the failure is unobservable here | **Accepted.** Independently EXECUTED by me. `@supports` guard, `overflow-y` restated, and the unobservable-fallback fact stated permanently (R9′). |
| C-F6 | The lockstep surface is ~9 sites and ~55 stylesheet `.match` call sites, not three; and file order decides which rule a pin reads | **Accepted.** R11 rewritten; the pin audit is pre-work. |
| C-F7 | R15's census guard is the wrong shape; scope `DealOverlay`'s query instead | **Accepted.** → S6. Converges with B-F10. |
| C-F8 | The angular ladder creates a permanent obligation this repo cannot discharge; state it in rem or take the reading | **Accepted.** Ladder stated in rem; the arcmin figure is a reading with its inputs, gated on the census; ISO/Frontiers citations left **UNCERTAIN**, flagged not refuted. |
| C-F9 | R12's origin claim is a misdiagnosis — `r.left + r.width/2` is the element's own rect — and re-deriving from `.gd-fan` costs more than it buys | **Accepted.** VERIFIED at `PlayOverlay.tsx:73`. R12(b) withdrawn; the narrower real hazard is solved by making the feed rail a sibling of `.gd-handzone`. |
| C-F10 | "G-TAP" is presented as an established gate name but appears only in a sibling lineage's proposal; and the 700→350px² figure is the **pre-fix** number, not the live gate's result | **Both accepted.** VERIFIED: `PLAN.md`/`METHODOLOGY.md` name only G-COMPOSE/G-ALARM/G-WSMETER, and `G-TAP-D` appears at `docs/research/proposals/desktop-B-grok.md:245` — a file committed to this repo at `1dd79f9`, so the convergence is shared-source, not cross-lineage contamination; either way the name is mine and is now defined inline with an explicit pass condition. And `fan-tap-targets.md:32` records 700→350 as the **"Current (solo −14 lift)"** defect row while variant D shipped with **"zero loss"** — my rebuttal cited the bug's magnitude as the gate's result. Corrected throughout. |

### The decisions, enumerated

1. Four modes, width-admitted at 720 / 960 / 1440, thresholds derived from the 15-column worst case.
2. The ≥720 vertical air is admitted by **height** as well as width (`and (min-height: 700px)`), and the guard-2 reflow extends to short desktop windows.
3. Card width is constant at every mode.
4. Column pitch ladder 0.70 / 0.80 / 1.00, with the cancelling `.gd-fan__stackRow` padding moving in lockstep.
5. Index-row ratios scale as `0.36 × p/0.70`; the `'10'` shrink is dropped at `p ≥ 0.80`.
6. Ring caps 54/58/64rem and track ratios 1:1.5:1 → 1:2:1 → 1:2.4:1, sized for the widest legal play.
7. Trick-well pitch ladder 0.40 / 0.55 / 0.70.
8. Ring direction arc + jiefeng skip + tribute plate anchors, at ≥960 only.
9. Event feed rail at D3, as a **sibling** of `.gd-handzone`.
10. `--measure: 46ch` on all prose.
11. Type ladder ×1.20 / ×1.45, declared in `app.css`; the top rung provisional pending the census.
12. Vertical token recovery: table padding, ring padding, ring row-2 floor.
13. **S1** sticky action strip + `overflow-x: clip`, inside `@supports`, with the elder scroll guarantee re-pointed at the staged strip and `scroll-margin-bottom`.
14. **S2** two-column hand zone — D3 unconditional, D2 conditional on G-GAP; no `order`, no reordering grid placement.
15. **S6** `DealOverlay`'s slot query scoped to `.gd-handzone`.
16. Plate-name cap 5rem → 9rem, and the north-flank `50vw` term replaced.
17. `.app-main--wide` 72 → 88rem at D3.
18. No `--gd-cardw` consolidation; two new lockstep pins (`.gd-desk__stage`, `.gd-sf__faces`) instead.
19. **S5** `resolveScale` becomes mode-aware, with the old-CSS calibration control.
20. The gate suite and its pre-declared pass conditions: G-PHONE-IDENTITY (delta form + scanner self-tests), G-FOLD (constructed depth ladder), G-TAP-PHONE / G-TAP-DESKTOP, G-GAP, G-INK, G-ANGLE, G-LOCALE, G-DIRECTION, G-FLIP.
21. Test-infrastructure repairs land **before** any mode block: two evasion holes, two scanner self-tests, the first-occurrence pin audit.
22. `SEAT_STACK_MAX_ROWS` stays 2, and no width-reactive JavaScript of any kind.
23. `AREA_HARD_MAX` stays 2.
24. Sort-area shelves stay stacked, never side by side.
25. The covered card's 28.6px press strip is **reported** this round and raised in a later one.

Three decisions carry an explicit **BLOCKED ON MEASUREMENT** flag rather than a value: the type ladder's top rung (machine census + one constructed-depth fold run at 28px turn/clock), S2's D2 column share (G-GAP against the 390 floor), and the covered-card press strip remedy (post-recovery vertical budget per mode).

PROPOSAL COMPLETE: 25 distinct design decisions
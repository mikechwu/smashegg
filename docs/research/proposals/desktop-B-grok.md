# Desktop layout design proposal

**Lineage:** independent (this pass only).  
**Scope:** presentation only — no engine, protocol, redaction, or timing change.  
**Code:** none. Artifact is this report.  
**Tooling:** Firecrawl disabled per owner note; external prior art taken from the brief’s §3.6 observation of `guandan.app` rather than re-scraped.

**Reading of the problem (before the design):**  
Phone work in this repo is a scarcity program: forced overlap, corner-index survival, hit/paint decoupling, wrap arithmetic. Desktop is not “phone with bigger rem.” Surplus width does not automatically buy surplus *vertical* budget — and today the ≥720 “desktop air” block **spends** height (padding + `minmax(9rem, 1fr)` centre) while **capping** width (ring 38rem, hand 44rem, cards frozen from 523px). Abundance must be spent on the things scarcity made ugly (full faces, real table geometry, elder type), and must **not** be spent on making the stack taller than a 800px laptop fold.

---

## 1. Mode structure

**Three discrete width modes**, plus one **orthogonal short-height budget** that can apply inside Desk/Wide. No continuous `vw` growth past today’s phone clamp. Breakpoints are taken from §3’s measured thresholds, not Bootstrap conventions.

| Mode | Media | What it is FOR |
|---|---|---|
| **P — Phone** | default (`max-width: 719px`) | Scarcity layout. Forced overlap, wrap discipline, existing loudness hierarchy. **Byte-identical to current ship** below the first breakpoint. |
| **D — Desk** | `min-width: 720px` | “Stop pretending 720+ is phone-with-margins.” Fix the **shipping vertical defect** (§3.4), modest type/card growth, ring no longer locked at 608px, hand still **may** overlap. |
| **W — Wide** | `min-width: 1280px` | The design space actually changes: **zero column overlap** becomes reliable with room for gaps and larger cards; ring becomes a real table; hand/app caps stop starving the fan. |

### Why these cuts, not others

- **720** is already the project’s desktop-air cut (table + shell). Keeping it as Mode D’s floor avoids inventing a fourth family below the first place air already exists — but Mode D **must reverse** the current air block’s vertical cost rather than inherit it.
- **523** is the point card width freezes today. It is **not** a mode boundary; it is the diagnosis that continuous `clamp(..., 13vw, 4.25rem)` already hit a ceiling. Modes replace that ceiling with **discrete token values**, not a new vw ramp from 523.
- **1024** is the first width where zero-overlap at 68px fits one line every deal (§3.3). I deliberately **do not** start Mode W there:
  - 1024×768 is the worst measured fold case (8/8 scroll). Growing cards / dropping overlap *raises* fan ink width and can raise staged-desk height; Mode W should not land on the shortest common laptop height.
  - 1024 is often a *short* window; Mode D’s job is fit. Zero-overlap at 68px on a 27″ monitor is still small in visual angle.
- **1280** is where zero-overlap **with gaps** fits at today’s card size, and where used-fraction is still high enough (~87% at 1280 today only because of caps — once caps lift, this is the first common width with real surplus).
- **1440** (90px zero-overlap every deal) and **1728** (110px) are **token steps inside Mode W**, not new modes. A finite mode set stays finite; card size can still step 80 → 90 → (optional) 100 inside W via additional min-width media that only touch tokens.

### Short-height budget (not a fourth layout mode)

When `(min-width: 720px) and (max-height: 900px)` (or the measured fold of the mode’s representative viewport, once gated):

- Compress ring centre min-row, ring padding, and table padding.
- Do **not** shrink Play/Pass below 44px, do not shrink card rank glyphs below Mode D floors, do not hide the desk.

This is a **vertical budget switch**, same spirit as phone’s existing `.gd-table--acting` ring reflow — one discrete snap, not continuous scaling.

### What each mode is *not*

- **P** is not a scaled-down W.  
- **D** is not “W with overlap.” It is the mode that makes **1280×800 playable without scroll** while hand geometry is still scarcity-adjacent.  
- **W** is not “fill the ultrawide.” Caps still exist; they just move up.

---

## 2. The hand

### Decision: zero overlap when the mode can pay for it; do **not** copy `guandan.app`’s bigger-sliver path for this product

| Mode | Column pitch | Card width (hand) | Rationale |
|---|---|---|---|
| **P** | today’s 0.7×cardw (30% overlap) | `clamp(2.75rem, 13vw, 4.25rem)` unchanged | Scarcity; proven |
| **D** | **keep ~25–30% overlap** (token: `--gd-stack-overlap: 0.25–0.30`) | **discrete 4.5rem (72px)** or hold 68px if 72 fails fold | Surplus is mostly vertical/ring; ink width at 72 with overlap still fits under a raised ~48–52rem hand cap |
| **W** | **zero overlap + 4–6px gap** | **5rem (80px) from 1280; 5.625rem (90px) from 1440** | §3.3: 90px zero-overlap needs ≤1260px ink and stays one line; 80px is the bridge where 1280 still has margin |

**Useful full-face range:** roughly **75–95px** at typical laptop/monitor viewing distance (~50–70cm, ~2× phone). Below ~70px, monitor distance undoes the elder gain of “no overlap.” Above ~100px, 11–14 columns of full faces force horizontal eye/head travel across >1/3 of the visual field without buying more combination-reading accuracy (you already see rank+suit).

**Why not `guandan.app` (bigger card + ~70% overlap)?**  
That design optimises a **landscape fixed scene** and a **sliver-as-index** reading style. This product’s hard-won work (wild 配 in the sliver, hit/paint decoupling, ~12px silhouette) exists *because* overlap is forced. On desktop, that machinery is optional debt. Elder gain is **whole face + larger type**, not a taller strip of the same occlusion. Take §3.6 as a real alternative, not a target.

**Why not 110px as default?**  
§3.3 needs ≥1728 for one-line every deal. That abandons 1440×900 and most 15–16″ laptops. Optional later token step only if ceiling measurement (below) says 90px is still short.

### What I would measure to find the ceiling

1. **Task time (primary):** n≥24 real deals, fixed viewing distance ~55cm, tasks: “select all level cards,” “build any legal bomb,” “find both jokers.” Card widths 70 / 80 / 90 / 100 / 110. Ceiling = first size where median time does not improve ≥5% vs previous step **and** 95th percentile does not improve.
2. **Error rate:** mis-taps / wrong-card selects (especially twins and wilds).
3. **Fan ink vs head-turn:** if fan ink width > ~1200px at 55cm, log subjective “had to turn head” (cheap pilot); treat >1400px as presumptively too wide for W default.
4. **Still one line, every deal:** re-run §3.3 counterfactual recipe (hand cap lifted, n=8 minimum, prefer n=24) at the chosen (mode, cardw, gap) triple.

### Deal vs settled

- **Dealing FLAT path stays P’s geometry rules** inside each mode’s card size (arrival order, ≤2 rows on phone). Do not invent a third deal layout.
- **Settled stacks:** Mode W columns are full faces bottom-aligned; selection lift still non-colour (translateY + ring). Hit/paint decoupling can **remain** (cheap to keep one path) even if burial risk drops — do not delete it in the first W ship.

---

## 3. The ring

### What “genuine table geometry” means here

Not a photoreal felt. Four readable seats with **spatial turn order**:

- You south (hand zone), partner **north**, opponents **west/east**.
- Counter-clockwise turn is a path you can point at: west → north → east → you, with **enough arc** that “left opponent” and “right opponent” are not two labels 608px apart on a 2478px screen.
- **Trick well** is the table’s centre of mass — large enough that a 5–8 card play is a *thing on the table*, not a 150×99 stamp.
- **Tribute / 接风** read as **from-seat → to-seat** events in that geometry (flight origin/destination already conceptual in play FX); surplus width makes the flight path legible. Reduced motion: static start/end seats + copy, never motion-only meaning.

### What surplus width buys that a 608px ring cannot

| Buy | Why 608px fails |
|---|---|
| West–east separation ≥ ~900px in D, ≥ ~1100–1400px in W | Physical “across” vs chrome column |
| Well max edge ~2× today’s linear size in W (order-of: ~280–320px wide plays) | Bombs/full houses readable without only relying on the hand |
| Larger remote mini-fans / stacks | Value-dependent length stays structural (2 ≠ 27) **and** glyphs stay elder-legible at distance |
| Room for tribute pairings without crushing the centre | Centre is currently the starved cell |

### Concrete caps (token / max-width level)

| | Ring max-width | Notes |
|---|---|---|
| P | (current unbounded-in-column behaviour) | unchanged |
| D | **52rem (~832px)** incl. padding intent | ~ +35% vs 38rem; still a table, not full bleed |
| W | **min(90vw, 72rem)** (~1152px content, more with vw) | Opponents can sit near the hand’s width; well scales with `--gd-cardw` already used for hand-size trick cards |

**Raise or drop `.app-main--wide`:** Mode W must lift **72rem** or the hand/ring fight the shell. Propose **90rem** at W only; keep 72rem at D so mid widths do not become a sparse void.

**Do not** grow the ring’s **minimum row height** with width. Today’s 9rem min is the wrong spend of abundance. Mode D/W default centre min should be **≤ phone’s 6.5rem**, and **lower** under the short-height budget (phone already snaps to 3.25rem when acting — desktop can reuse that idea without being phone-only).

---

## 4. The rest of the surplus

### Deserves space

| Element | How it grows |
|---|---|
| **Hand** | Primary consumer in W (faces, gaps) |
| **Ring / well** | Secondary consumer (geometry, play readability) |
| **Type on turn sentence, seat names, Play/Pass** | +1 step on the `--fs-*` ladder in D; +1 more on Play/desk title in W if fold allows |
| **Play desk** | Slightly wider max (today 24rem) so staged hand-size cards + set-aside pill don’t crowd; **not** taller chrome |
| **Remote seat stacks** | Scale with a seat-stack card token, still length-encoding count |

### Stays small / quiet

| Element | Why |
|---|---|
| **Event feed** | During play it is a **2-line tail**, not a sidebar novel. Growing it steals fold and attention from the turn. Optional: in W only, allow max-height 3 lines — still not a history panel. |
| **Sort pill / SF trigger** | Secondary; hit ≥44px but don’t become primary chrome. |
| **Headline bar** | Compact facts; don’t recreate a level rail. |
| **Bottom bar plate** | Identity + log; plate need not become a dashboard. |

### Must NOT grow

- **Goldleaf use** — still level / jiefeng / victory only.  
- **Motion loudness** — no new loops; urgent ≤10s clock remains the only pulse.  
- **AREA_HARD_MAX** as a silent side effect of width (§3.5). Width does not create a free third shelf; a third band is a **vertical** cost (sort-areas measured +150px at phone). Desktop may remeasure; it does not auto-raise.  
- **Margins filled for their own sake** — a 2478px window should still show lacquer void outside a deliberate table column. Empty margin is correct; a 700px column is the bug.

### Sort-area shelves

- Keep **band-above-MAIN** structure (one tree).  
- In W, a shelf’s flat run can use the same zero-overlap/gap tokens as MAIN so set-aside groups don’t reintroduce phone occlusion.  
- **Do not** switch to side-by-side areas (refuted at 390; on desktop it would be a second interaction map forever).

---

## 5. Token vs structure

### Reachable by token / CSS-only mode blocks (preferred)

| Win | Mechanism |
|---|---|
| Card size steps | `--gd-cardw` discrete per mode on `.gd-card--hand`, `.gd-fan`, `.gd-desk__stage` (and lockstep trick if still hand-sized) |
| Overlap → gap | `--gd-stack-overlap` (negative margin factor) → `0` + `column-gap` |
| Ring / hand / shell caps | `max-width` on `.gd-ring__table`, `.gd-handzone`, `.app-main--wide` |
| Type / space ladder | Override `--fs-*`, `--space-*` on `.gd-table` or `:root` inside mode media |
| Ring min row / padding | grid `minmax(...)`, padding tokens — **the vertical fix** |
| Well breathing room | centre column fraction + well `max-width` |
| Play/Pass min size | already ≥44px floor; bump padding/`--fs-lg` → `--fs-xl` |

Most of Mode D and a large part of Mode W are **token + max-width** work. Components (`HandFan`, `GameTable`, `PlayDesk`) stay one tree.

### Needs structure (price each)

| Change | Why tokens aren’t enough | Forever cost (verify twice / extra gates) |
|---|---|---|
| **Overlap-aware layout assumptions in JS** (if any hard-coded pitch, wrap, or measurement probes assume 0.3) | Fan geometry comments and measure scripts encode 30% overlap | Update `measure-fan-tap-targets`, hand-fan tests, any ink-width gates for **P vs W** |
| **Hit/paint simplification** (optional later) | Burial only matters under overlap | If you *delete* decoupling, you must prove W never reintroduces burial (selection lift, multi-select) — **don’t delete in v1** |
| **Sticky / docked action row** (I recommend **not** as primary fix) | Compensator class (practice 11) | Gate must disable sticky when claiming fold fit |
| **Side-by-side areas / second hand component** | Different interaction map | Full second product surface — **decline** |
| **guandan.app-style rotate landscape shell** | Different app chrome | Every feature × orientation — **decline** |
| **Raising `AREA_HARD_MAX`** | Constant is behavioural, not layout | Merge path, third seam, fold rates with 2 shelves, progressive disclosure tests |

**Steer agreement:** discrete modes + token-first matches this repo’s measurement discipline. I do **not** argue for continuous clamp scaling of the whole table.

**Steer push-back (narrow):** one structural exception I accept is **mode class on the table root** (`gd-table--mode-d` / `gd-table--mode-w`) set by matchMedia or pure CSS if possible — only if some rules cannot be expressed as pure descendant media without specificity wars. Prefer pure `@media` blocks first (easier phone byte-identity proof: “no mode rules outside these blocks”).

---

## 6. The vertical problem (§3.4)

**Target:** at **1280×800**, Play/Pass **document** bottom ≤ **780px** on ≥95% of deals (n≥40), with `scrollY === 0` at measurement and `ScrollActionsIntoView` **accounted for** (practice 11: record scrollY; prefer measuring with loud desk without relying on auto-scroll for the pass).

### Why today’s desktop is taller

The ≥720 block adds:

- `.gd-table { padding: var(--space-xl) }`  
- ring padding + felt treatment  
- centre row `minmax(9rem, 1fr)` vs phone `6.5rem`  
while the fan is already **shorter** (one line). Net: chrome grows, content doesn’t need it.

### Mode D/W vertical plan (primary = shorter stack, not compensators)

1. **Invert ring min-height:** D/W centre `minmax(5rem, auto)` default; when desk loud, allow the phone-like snap down (reuse acting reflow on desktop, not phone-only).  
2. **Cut desktop padding tax:** table padding and ring padding step **down** under short-height budget; at 1280×800 they should be ≤ phone’s 0.5rem vertical contribution, not `space-xl`.  
3. **Do not grow desk vertically** when growing cards — staged strip may grow with card height (`1.45 × cardw`); that is the main risk of 90px cards on short laptops. Therefore: **90px only from 1440 wide, and only if short-height gate still passes at 1440×900**; at 1280×800 stay ≤80px.  
4. **Refuse sticky Play as the definition of success.** Sticky may be a progressive enhancement for extreme zoom / OS chrome, but fold gates measure **document** position of Play without treating sticky as fit.  
5. **Feed stays 2 lines.** A taller log is how vertical budgets die quietly.

### What happens to Play/Pass at 1280×800 under this proposal

- Layout mode: **W** (width) + **short-height budget** (height 800 ≤ 900).  
- Cards: **80px, zero overlap + gap** (not 90).  
- Ring: wider but **shorter** than today’s 9rem-min desktop ring.  
- Expected Play doc bottom: **~740–780px** band (to be measured; pre-declared pass below).  
- If measurement misses: drop W card size to 72–76px before re-adding overlap; if still short, pull ring further — **never** “accept scroll on every deal” as Mode W success.

### 1024×768

Stays **Mode D** (not W). Same vertical program, overlapped hand, smaller ring than W. Pass condition can be slightly looser than 1280 if needed, but **must beat today’s 8/8 scroll** — target ≤20% deals needing scroll (n≥40), documented as rate, not binary.

---

## 7. Gates

Phone byte-identity and per-mode rates. Pre-declared; practice 8 + 12.

### G-PHONE-IDENT — phone does not regress

- **How:** (1) CSS scan test: no Mode D/W selectors or token overrides appear outside `@media (min-width: 720px)` / `1280px` (and short-height) blocks — same spirit as zero-area fan emitting no split/seam class. (2) True-390 iframe recipe (METHODOLOGY): screenshot hash or computed-style pin for `--gd-cardw`, stack `margin-left`, `.gd-handzone` max-width, ring max-width, headline turn font-size.  
- **Pass:** byte-identical computed layout tokens for the pinned set at **390×844** and **390×664** vs baseline commit before desktop work; n/a to deals for token pin; for fan geometry, n=8 deals only to confirm wrap still 2 lines and ink width within existing bands (334.6px class).  
- **Fail:** any phone computed token drift, or new class on fan without areas.

### G-FOLD-D — Mode D fold (representative **1024×768**)

- **Script:** extend `measure-fold.mjs` (`FOLD_W`/`FOLD_H` already knobs).  
- **Axis varied:** deal seed / hand composition (fan height step function).  
- **n:** ≥40 deals (MIN 24).  
- **Metric:** rate of deals with Play **document** bottom > 768, with `scrollY` recorded; Wilson 95% CI.  
- **Pass:** below-fold rate **≤ 20%** (CI upper bound reported; do not claim “fits” if only point estimate is low). Improvement vs baseline 8/8 on n=8 is necessary but not sufficient — re-baseline n=40 on current main first.  
- **Compensators named:** `ScrollActionsIntoView`, any sticky, browser URL chrome (use fixed inner height).

### G-FOLD-W — Mode W fold (representative **1280×800**)

- **n:** ≥40 deals.  
- **Pass:** below-fold rate **≤ 5%** (Play doc bottom > 800). Stretch goal 0/40; do not claim 0 without n≥40.  
- **Secondary viewport:** **1440×900** with 90px card token — below-fold ≤5%, n≥24.

### G-TAP-D / G-TAP-W — tap targets

- Extend fan tap-target sweep + action controls.  
- **Pass:** every press target ≥44×44 CSS px; fan card hit box ≥44px on the smaller axis **or** (if full-face cards) full card ≥44 on both axes.  
- **n:** ≥8 deals × mode (column counts 11–14 represented).  
- **zh-Hant** locale for ActionBar labels (length-binding).

### G-FAN-W — zero-overlap one-line property

- **Metric:** fan lines === 1 and no horizontal page overflow for settled hand.  
- **n:** ≥24 deals at 1280 and at 1440.  
- **Pass:** 24/24 one-line; ink width ≤ handzone content box − 8px.  
- **Varied axis:** deal (column count 11–14).

### G-RING-W — geometry smoke

- Measure west plate centre to east plate centre ≥ **1000px** at 1440 viewport; well bbox ≥ **2×** baseline area of today’s ~150×99 (or linear ≥1.5× on width).  
- n=1 layout probe is enough for distances (not deal-dependent); recheck with long bomb play staged in well (deal-dependent) n=8.

### G-LOUDNESS — unchanged hierarchy

- Existing headline/desk tests: own turn+clock loudest; no new loops; reduced-motion still shows pass/selection/wild.  
- Locale parity smoke en / zh-Hans / zh-Hant on headline + Play string no clip at mode min widths.

---

## 8. Riskiest assumption

**Assumption (named):**  
Reclaiming ~80–120px by **inverting the ≥720 ring/padding tax** is enough that Mode W can ship **80px zero-overlap cards** at 1280×800 without Play falling below the fold on more than 5% of deals — i.e. the vertical defect is mostly **self-inflicted desktop chrome**, not an unavoidable cost of a one-line fan + desk.

**Cheapest kill experiment:**  
On current build, inject **only** CSS: (a) `@media (min-width:720px)` set ring `grid-template-rows` min to `5rem`, table+ring padding to phone levels; (b) do **not** change cards/overlap. Re-run `measure-fold.mjs` at 1280×800, n=24.  

- If below-fold rate is already ≤5%, vertical fix is token-cheap and the assumption lives.  
- If still ~100% below fold, the deficit is elsewhere (desk, fan, headline, app chrome) and Mode W card growth must wait on a deeper cut or accept Mode D-only until solved — **do not** ship larger cards on top of a still-broken fold.

---

## What I would not do

1. **Continuous `vw` scaling of cards/type past 523** — infinite untested widths; ceiling already proved useless.  
2. **guandan.app’s single landscape + rotate** — fights phone-first; second layout forever; this audience includes elders on phones in portrait.  
3. **Two React trees / parallel `DesktopHandFan`** — every feature verified twice; tokens claim most of the value.  
4. **Bigger cards with *more* overlap as the desktop answer** — spends surplus on the constraint we can finally drop.  
5. **110px default / edge-to-edge 2478px hand** — scan cost and ultrawide fatigue; table metaphor dies.  
6. **Growing the event feed into a sidebar** — attention and fold.  
7. **Raising `AREA_HARD_MAX` “because desktop”** without a dedicated multi-shelf fold gate — merge is a product decision, not a free layout bonus (§3.5).  
8. **Sticky Play as the fold fix** — compensator that falsifies gates (practice 11).  
9. **Side-by-side sort areas** — different mental model; phone path stays bands.  
10. **Keeping 38rem / 44rem / 72rem caps while only bumping font-size** — that is how 2478px still looks like a 700px app.  
11. **Starting Mode W at 1024** — couples zero-overlap ambition to the worst laptop fold.

---

## Risks

| Risk | Mitigation |
|---|---|
| Larger full-face cards raise desk staged height and re-break fold | 90px only ≥1440; kill experiment before card growth |
| Zero-overlap makes 14 columns feel sparse / hard to scan as groups | Keep value **stacks** (vertical multiplicity); only horizontal overlap goes away |
| Visual jump at 720 / 1280 while resizing | Accepted cost (owner steer); play doesn’t resize mid-trick often |
| Measure scripts bake 0.3 overlap | Update gates in same PR as W tokens |
| Producer≠auditor if this lineage later implements | Gate audit by other lineage (METHODOLOGY) |
| Remote seats look tiny next to huge hand | Seat-stack token step in W |
| Short-height + width modes combinatorial | Only two short-height rules (padding + ring min); no third card size |

### Notes on §3 measurements / interpretation

- **§3.1 (523 freeze)** — measured right, interpreted right: the product stopped responding to width.  
- **§3.2 caps** — measured right; the *interpretation* to stress is that “desktop air” was **width starvation + height spend**, not neutral polish.  
- **§3.3 counterfactuals** — trust them as live DOM injections; they correctly open a design space phone never had. One nuance: ink width bands depend on **11–14 columns**; gates must vary deals, not one golden hand.  
- **§3.4** — the load-bearing finding. A wider layout that stays ~860px tall has failed. I treat this as **P0 for Mode D**, not a Wide-only concern.  
- **§3.5 `AREA_HARD_MAX`** — correct correction of a tempting false premise; this proposal does not smuggle a third shelf.  
- **§3.6** — valid prior art; wrong fitness function for *this* elder phone-first product once surplus exists.  
- **Possible misread to avoid:** “fan already one line at ≥719 ⇒ desktop is done.” One line with 30% overlap at 68px is still a **scarcity hand** inside abundance chrome.

---

### Design decisions requiring owner sign-off

1. **Three modes (P/D/W) at 720 and 1280**, not a mode at 1024 or 1440.  
2. **Mode W = zero overlap + gaps; Mode D keeps overlap.**  
3. **Card sizes: P unchanged; D ~72px optional; W 80px @1280, 90px @1440 — not 110 default.**  
4. **Reject bigger-card+more-overlap (`guandan.app`) as the desktop strategy.**  
5. **Spend surplus on hand + ring geometry; starve feed growth.**  
6. **Invert ≥720 vertical tax; short-height budget ≤900px.**  
7. **Lift caps: ring ~52rem D / up to ~72rem+ W; hand free of 44rem in W; `.app-main--wide` → 90rem in W.**  
8. **Token-first; one component tree; no rotate-landscape shell.**  
9. **Do not raise `AREA_HARD_MAX` in this work.**  
10. **Fold/tap gates as rates with n≥40 (fold) / n≥8 (tap); phone identity CSS-scan + true-390 pin.**  
11. **Kill experiment on padding/ring-only before shipping larger cards.**

PROPOSAL COMPLETE: 11 distinct design decisions

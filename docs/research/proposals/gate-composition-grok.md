I'll review the design questions from the repo sources only—reading the reachability note, PLAN §9, the cardW sweep, and the holdout validation.Checking a few more details on capacity, three-line degradation, and the current gate rule.I have enough from the docs, holdout, and the live sweep numbers. Assessment only — no repo changes.

### 1. GATE COMPOSITION

**Yes — demote R from gate predicate to ordinal context.** That is the right call for a *binary* rule, not a claim that R is noise.

What the holdout actually earned (`prereg-descending-holdout.md`): the lattice, the single-ordering line assignment, and the **mass bins** with expected count ≥ 5 (through 316.0). That is a validated *mechanism*. R at the current gate magnitudes — P ≈ 0.08% vs 0.74% under R(10) — sits **two orders below any validated bin**. Using those numbers as a hard cut grants a precision the sample never bought.

What pure geometry *has* earned: span terms decomposed to **0 px residual**, margin in fanH-space as distance to the nearest fitting lattice bin, and setback in cardW-space as distance to capacity/tooth discontinuities the height margin cannot see (`cardw-sweep.mjs`, STATUS G1). Those quantities are measured or structural, not tail-fitted.

So:

| Role | Quantity | Why |
|---|---|---|
| **Gate** | `margin ≥ X`, setback `≥ Y` from nearest discontinuity in `cardW`, no interval that straddles a capacity jump | Earned precision; fails closed when the knife-edge appears |
| **Context / tiebreak** | R(0), R(5), R(10), R(21.3) as ordinal columns | Still real information about *relative* risk ordering of plateaus; not calibrated absolute rates at 0.1% |

Demoting R does **not** throw away the mechanism. It refuses to treat an unvalidated tail probability as if it were a measured 9.17%. The project has already paid for that mistake once (max-over-orderings 13.14%, cardW 47 on rate alone with 0.16 px margin).

**“Capacity identical across all supported widths” as a third hard term is too strict as written.** Capacity is structurally `floor(contentWidth / pitch)`: **8 @ 320, 9–10 @ 390, 14 @ 768, 18 @ 1366** (PLAN §9 / STATUS F4). A single card-scale rule cannot keep capacity constant from 320 through 430 without lying. The *intent* is right and already covered if restated as:

1. **At a fixed design width (390), the qualifying `cardW` interval must not straddle a capacity discontinuity** (setback already does this), and  
2. **Rates and margins must be reported per width rung, never pooled across capacity classes** (G2: 320 and 430 not swept is still open for that reason).

Do not gate on “one capacity everywhere.” Gate on “no silent capacity flip inside the chosen plateau,” and treat multi-width as a matrix, not a scalar.

---

### 2. WHAT A GEOMETRIC GATE LOSES

What is lost is **ordinal discrimination among candidates that share the same geometric envelope** — especially under large unmeasured height drift — not the ability to reject today’s layout or the knife-edge.

Concrete pair from the live sweep (200k deals, timed, following, staged, joker desk path as the script’s worst case):

| candidate | capacity | margin | R(10) | R(21.3) |
|---|---:|---:|---:|---:|
| **45.95** | 10 | **10.64 px** | 0.08% | **0.74%** |
| **44.00** | 10 | **10.19 px** | 0.01% | **0.08%** |

Both pass a pure geometric gate of `margin ≥ 10` with comfortable setback from the ~46.8 capacity crossing. A largest-`cardW` tiebreak (correct for elder legibility) picks **45.95**. R(21.3) says **44.00 is roughly 9× more robust** if something eats a full lattice step of budget.

That is exactly the information geometry drops: **how much failure mass sits just above the fitting bin** when two layouts have similar clearance. The script’s own rationale for R over margin alone still holds as *context* — “same margin, different ride share” — but it does not justify a 0.1% absolute ceiling that the holdout never validated.

Other pairs geometric already separates without R (e.g. 46.20 at 8.29 px / R(10)=0.74% vs 45.95 at 10.64 px / R(10)=0.08%). The loss is real but narrow: **inside a qualified geometric band, R ranks residual tail risk; it should not veto the band.**

Also lost if you over-read “pure geometric”: any claim that 0.08% is a *measured field rate*. That claim was never legitimate; demoting R makes the documentation honest rather than weaker.

---

### 3. JUSTIFYING X AND Y

X and Y must come from **measured residual drift and implementability**, not from shoe simulation.

**Measured drift sources on record**

| Source | Size | Status for the budget |
|---|---:|---|
| Desk content variation (title / clock / staged composition class) | **~5 px** | Still a real residual class; the old 156.5↔161.5 joker path was a baseline defect and is fixed, but 5 px remains the only *content* height wobble on record |
| Wrapped desk title | **~27 px** | **Prevented** (C4); do not size X for a defect you already forbid — that double-counts and forces needlessly small cards |
| Timed countdown bar | **8 px** | **Configuration, not drift.** The default product is timed; the threshold model already includes it. Do not put 8 px into margin *and* into the timed desk term |
| K constancy inside pinned config | **0.1 px** | Negligible |
| LINE / WeChat in-app inner height | **unknown** | Explicitly **out of budget** until measured (`cardw-sweep.mjs`); that measurement decides whether R(21.3) ever becomes gate-relevant |

**X (margin floor in fanH-space)**  
Justify as **cover for residual measured content drift, with a small instrument headroom**, not as a rate proxy:

- Floor from measurement: **5 px** (desk content class).  
- Recommended gate: **X = 10 px** ≈ 2× that residual — enough that ordinary title/clock variation cannot walk you onto the wrong side of a bin, without pretending a full lattice step (≈19–21 px at these `cardW`s) is already measured.  
- **X = 5 px** is the honest minimum and too thin if any second 5 px source appears.  
- **X ≥ 15 px** is not drift-justified; it is a preference for deeper teeth and systematically smaller cards (STATUS F3). Reject unless a new measured source appears.

Do **not** set X from “R(10) jumps at this margin.” That re-imports the unvalidated tail through the back door.

**Y (setback in cardW-space)**  
Justify from **discontinuity geometry and implementability**, not from R:

- Capacity is discontinuous in `w` near **~46.7–46.8**; tooth boundaries jump margin by many px while height-margin still looks fine.  
- Implementation is a `clamp(..., Xvw, ...)`, so real devices present subpixel widths and slight content-width drift (row `padding-left: 0.3·cardW`).  
- **Y ≥ 0.75 px** (script default) is a lower bound against landing *on* the crossing; STATUS’s robust pick 45.95 sits at **0.88 px** setback — barely enough.  
- Stronger, measurement-shaped rule: **Y = half the width of the smallest cardW step you are willing to treat as distinct in production** (if the clamp is effectively quantized to 0.25–0.5 CSS px of card width under real viewports, Y should be at least that). Prefer **Y ≥ 1.0 px** once the vw coefficient is fixed, so the high endpoint of a qualifying interval is never “inside the setback” the way 46.45 / 46.70 were.  
- If the qualifying interval is narrower than **2Y**, the gate should say **NO ROBUST CHOICE** (already correct in the sweep) rather than return an endpoint.

**What must not justify X or Y:** simulated P(fanH > T − δ) at δ larger than measured drift; elder preference for bigger cards (that is a *tiebreak*, not a floor); the 27 px wrapped title (prevented).

---

### 4. BELOW 310px — THE RANKING

Two lines need capacity ≥ 8 for 15 value classes ≈ **310 CSS px** at a 44 px card (STATUS F4: cross 7→8 between 305 and 310). Below that, three lines are structural. 200% page zoom on a 390 px phone → **195 CSS px** — reachable, and the users who zoom are exactly the elders this product is for. Legibility floor and fit ceiling are incompatible; a clamp only chooses the collision point.

Ranked for **elderly, zh-Hant, phone-first, room code in family chat** (WeChat/LINE webviews):

| Rank | Option | Why |
|---:|---|---|
| **1** | **Detected compact mode: keep card size, one (or two) line band, horizontal scroll of columns, loud affordance** | Protects rank readability (why they zoomed). Protects vertical budget for desk / well / Play·Pass. Makes the state *named*, not silent. |
| **2** | **Hard stop UI when even that cannot show a useful must-see set** (“畫面過窄：請關閉放大或改橫向”) with room code still visible | Honest failure beats a playable-looking lie. Family chat users can rotate or un-zoom once. |
| **3** | **Accepted third line + reduced must-see (drop non-panel facts first; never drop desk/actions)** | Only as a brief transitional layout while compact mode engages. Third line spends ~one more `lineH` (~70+ px) and usually destroys panel simultaneity at 664-class heights. |
| **4** | **Different wrap policy past the crossing** | Cannot create horizontal capacity. Depth-min wrap fixes sort asymmetry, not 15 columns into 7 slots. Do not sell it as the sub-310 answer. |
| **5** | **Internal vertical scroll inside the fan** | Nested scroll on a phone, easy to miss, partial hand invisible mid-decision — worst interaction pattern for elders holding bombs/tubes they cannot see. |
| **6** | **Silently shrink below the legibility floor** | Fights the reason they zoomed; reintroduces unreadable faces. |
| **7** | **Silent three-line degrade (today’s pre-detector behaviour)** | Undetected invalidation of every span/lattice/cardW derivation. Detector-only is necessary but not sufficient. |

**What the player should see (rank 1, concrete):**

- At detect (`lines > 2` or `innerWidth` below capacity-8 threshold): a compact hand strip at the **same** card floor, columns in a horizontal scroller.  
- Edge fades + short zh-Hant cue, e.g. **「左右滑動看全部牌」**, not a buried icon.  
- Optional pin: jokers / level wild always peek at the strip end so the wild is never only off-screen.  
- Desk title, stage, well, Play/Pass stay in the vertical must-see stack; fan no longer grows a third line into that budget.  
- If they un-zoom or rotate back above ~310, leave compact mode without a settings dig.

**Costs of shipping rank 1:** not all 15 value classes on screen at once; must teach one gesture; horizontal scroll + page zoom can still confuse — mitigated by the cue and by not nesting a second *vertical* scroll. **Costs of rank 2:** some zoomed sessions cannot play until layout changes — painful but rare and explicit. **Costs of rank 3 alone:** more infeasible turns under G-SIM; auto-scroll thrashes; elders lose the table while hunting the hand.

---

### 5. WHAT I WOULD SHIP

**Gate (cardW choice)**  
Ship a **geometric gate**:

- `margin ≥ 10 px` (X from 2× measured ~5 px desk residual),  
- setback `Y ≥ 1.0 px` (or 0.75 px interim) from any capacity/tooth discontinuity,  
- qualifying interval width ≥ 2Y or **NO ROBUST CHOICE**,  
- among robust points, **largest `cardW`** (elder legibility),  
- R(*) printed as context; **R(21.3) only becomes a tiebreak after LINE/WeChat inner height is measured** and shown to be a real ~20 px class source.

Do **not** ship `R(10) ≤ 0.1%` as a hard cut. Do **not** ship “capacity identical at all widths.” Do ship **per-width capacity/margin tables** for 320 / 390 / 430 before calling the plateau product-wide (G2 still open).

**Sub-310 behaviour**  
Ship **detect → named compact horizontal hand** (rank 1), with **hard-stop copy** (rank 2) only if the panel set still cannot co-exist. Keep the three-line containment check as a **CI fail for unsupported viewports you claim to support**, and as a **runtime mode switch** in product — never as a silent log line alone.

I would **not** ship vertical fan scroll, silent shrink, or “wrap policy fixes zoom.”

---

### 6. WHAT I AM UNSURE OF

1. **Whether residual desk drift is still ~5 px after the joker baseline fix** — the holdout and early notes saw 156.5 vs 161.5; PLAN withdraws the joker-aspect story. If post-fix deskH is single-valued under zh-Hant titles, X = 10 may be slightly fat; re-measure title/clock extrema and set X = max(5, 2× observed residual).  
2. **LINE/WeChat in-app CSS viewport heights** — the largest unmeasured term, and the one that could legitimately promote R(21.3) from context to gate. Without it, preferring 45.95 over 44.00 on legibility is defensible; with a 20 px chrome tax, the geometric band may need to move.  
3. **Whether horizontal-scroll compact is discoverable enough for the least technical elder in a four-person family table** without a one-time coach mark — that is an elder-session question (E5), not a geometry one.  
4. **Exact product support floor:** if “supported” means ≥310 CSS px only, rank 2 can be the whole answer and compact mode is polish; if page-zoom 200% is in-scope (I believe it is for this audience), rank 1 is mandatory. That product boundary is not locked in the docs I read.  
5. **Desktop / 768 double-line ceiling** (PLAN: 768 can be *worse* than phone) is out of scope of this brief but may dominate field complaints before 195 px zoom does.

REVIEW COMPLETE: 6 sections

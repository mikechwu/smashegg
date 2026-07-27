I'll define "reachable" from the code and methodology, starting with the table layout files and the practices that constrain measurement.Next I'll read the layout components and the fold-measurement scripts so the definition matches how this project already measures the table.I have enough from the layout, auto-scroll compensator, and methodology practices to define the replacement property without changing the repo.

### 1. THE DEFINITION

**Post-scroll decision co-visibility:** on a turn where the desk is loud and `ScrollActionsIntoView` has already fired `scrollIntoView({ block: 'nearest', behavior: 'auto' })` on `.gd-actionsRow` and that scroll has settled, the interface is adequate if and only if every element of the decision set *D* has a non-empty intersection with the viewport rectangle in **viewport coordinates** (`getBoundingClientRect()` against `[0, innerHeight]`), at the **same** `scrollY` the compensator left. Auto-scroll already guarantees the control is *reached*; this property says the remaining facts needed to decide correctly are still *seen with it*, not only reachable by a second scroll or by memory. Falsification is direct: name an element in *D* whose post-scroll viewport rect has `bottom ≤ 0` or `top ≥ innerHeight` (or is fully covered by an opaque overlay whose box covers that rect). The structural form of the same claim is preferred when it binds: if the **document-space** height of the axis-aligned bounding box of *D* exceeds `window.innerHeight`, no scroll position can co-present *D*, so the layout fails without sampling.

### 2. THE SET

*D* is tiered. Tier 1 is the hard co-visibility set on a loud play turn (empty or staged). Tier 2 is required only while the player is still composing a selection from the fan.

**Tier 1 — confirm set (must co-present after auto-scroll)**

| Element | Selector / component | Why a player who cannot see it cannot decide correctly | Tier |
|---|---|---|---|
| Trick top (what to beat) | `.gd-well .gd-well__cards` (not the covered underlay) inside `TrickWell` | Following play is defined against the table top; without those faces, “beats / cannot beat” is only prose on the desk and cannot be checked against cards. | 1 — load-bearing for every follow; on a pure lead the well may be empty, in which case this member is absent and the predicate skips it. |
| Loud play desk | `.gd-desk.gd-desk--play` (`PlayDesk`) | Owns turn identity, own clock, staged faces, combo name, and beat verdict — the facts `state-visibility.md` moved out of micro-chrome so a confirm is not a blind press. | 1 — design already requires desk and Play together (§2d). |
| Staged faces + status (when selection non-empty) | `.gd-desk__stage`, `.gd-desk__status` | Dual-render: the desk answers “what am I about to play”; without it the player confirms a multiset they cannot re-read at full face size under pile occlusion. | 1 when `staged.length > 0`; empty-desk form still needs `.gd-desk` title/status for lead / canBeat / cannotBeat. |
| Play / Pass | `.gd-actionsRow__bar` (`ActionBar`) | The act itself; already the auto-scroll target. Included so co-visibility is “with the control,” not “somewhere near it.” | 1 — reached by definition after scroll; still in *D* so a scroll that clips half the bar fails. |

**Tier 2 — compose set (must co-present while building a selection; may be partially off-screen once staging dual-renders the selection)**

| Element | Selector / component | Why | Tier |
|---|---|---|---|
| Fan press surface | `.gd-fan` / `.gd-fan__card` (`HandFan`) | Selection is built by tapping hand slots; if the fan is entirely above the viewport after auto-scroll and nothing is staged yet, the player can only Pass or scroll again mid-decision. | 2 — required when `selected.size === 0` and the legal action is not forced-pass; once faces are on `.gd-desk__stage`, tier 1 carries the selection and tier 2 may drop. |

**Deliberate exclusions (and why)**

1. **`.gd-headline` / team level badges (`TableHeadline`)** — on phone, when `deskOwnsTurn` is true the own-turn sentence is already demoted (desktop-only echo under 720px). Levels are match-scale context, not turn-local decision inputs; a player who scrolled past them still knows the wild from card seals and prior play. Including them would force *D* to swallow the whole column and recreate the dead “everything above the fold” metric.
2. **Opponent / partner seat plates and stacks (`.gd-ring__seat`, `SeatPlate` / `SeatStack`)** — card counts and identity matter for long strategy, not for the single press “play this staged set or pass.” They sit beside the well; co-visibility of the well is enough for the centre story.
3. **Event feed / bottom log** — historical, not required to form the current action.
4. **Sort pill (`.gd-actionsRow__sort`)** — secondary preference; the layout already keeps it off the primary decision path.
5. **Set-aside control (`.gd-desk__setAside`)** — optional organisation, not required to play or pass this trick. Its *presence* is a separate gate (`measure-setaside.mjs`); its *height* only matters here insofar as it lengthens the tier-1 band (see §6).
6. **Covered underlay (`.gd-well__cards--covered`)** — flight decoration; the live top is the decision fact.

### 3. THE MEASUREMENT

Headless Playwright against a real dealt hand, same driver shape as `scripts/measure-fold.mjs` (create room, four seats, advance until seat 0 has hints, inject token, open room).

**Viewport (practice 15):** set `viewport: { width: 390, height: H }` with **H ∈ {664, 748}** as INNER sizes (toolbars present / minimized). Print literally: `inner ${W}x${H}; browser chrome EXCLUDED`. Require `FOLD_W`/`FOLD_H`-style env knobs with **no default of 844**. Theme is a knob (`pref:deckTheme`); print theme in every line — pile height is theme-dependent.

**Compensator (practice 11):** do **not** disable `ScrollActionsIntoView`. Name it in the probe output. Wait until the loud desk is mounted (`.gd-desk--play` or `--tribute`) and until `scrollY` is stable after the effect (e.g. rAF double + short settle, or `waitForFunction` on action-bar viewport bottom ≤ innerHeight + ε). Record `scrollY` on every row so a later reader can tell “co-visible because the layout fits *D*” from “co-visible only because scrollY is large.”

**Moment:** after auto-scroll on a loud turn, at two content states per deal if both exist: (a) empty selection / empty desk form, (b) after lifting a small legal selection so `.gd-desk__stage` grows (stagedCount change re-fires the effect). Optional third: one open shelf (`.gd-desk__setAside` press must **fail loudly** if missing — practice 11).

**Coordinate space:**

| Quantity | Space | Why |
|---|---|---|
| Co-visibility of each member of *D* | **Viewport** (`getBoundingClientRect().top/bottom` vs `0` / `window.innerHeight`) | This *is* the post-compensator claim: “is it on screen now?” Viewport coords are correct here; they were wrong only when used to claim “layout fits at scroll 0.” |
| Structural band height | **Document** (`rect.top + scrollY` … `rect.bottom + scrollY`) | Compensator-invariant. `bandH = max(docBottom) − min(docTop)` over *D*. If `bandH > innerHeight`, co-visibility is impossible under any scroll. |
| Always print both | `scrollY`, viewport bottoms, document bottoms | Same discipline as `measure-fold.mjs` so the safety net cannot be misread as a fit. |

**Query (illustrative probe):** for each selector in *D* that exists in the DOM this state, collect `{sel, vTop, vBottom, docTop, docBottom, visible: vBottom > 0 && vTop < innerHeight}`. Print **examined N elements: [list]** (practice 24 — a clean zero with empty scope is a failed probe). Action bar missing ⇒ exit non-zero, not “all visible.”

**Statistic (practice 16, not 12’s median trap):**

- Per viewport@theme@state: **violation rate** `k/n` of deals where any tier-1 member fails `visible`, with Wilson 95% CI; **minimum** viewport intersection height over tier-1 members across deals (floor property → min, never median).
- Separately print **structural failure rate**: fraction where `bandH > innerHeight` (impossible co-visibility).
- Prefer a **constructed worst band** before sampling rates (practice 14): max desk form (staged faces up to `DESK_STAGE_MAX_FACES`, status + set-aside row) + tallest fan step the layout allows + well with a long top play. Bound vs sample: the bound answers “can it ever fit?”; n≥24 answers “how often does a real deal break it?” (practice 12/14/25). Do not claim equivalence between layouts from n that cannot separate rates.

### 4. WHAT MAKES IT FAIL

**Primary predicate (post-scroll, per deal state):**

```
pass ⇔ ∀ e ∈ D_active: e.vBottom > 0 ∧ e.vTop < innerHeight
         ∧ (if e is a press target in D: e.vBottom − e.vTop meets the existing 44px floor where the product already requires it)
```

where `D_active` is tier 1 always on a loud turn, plus tier 2 when `selected.size === 0` and the seat is not in a forced-pass-only window.

**Structural short-circuit (no sampling needed for the bound):**

```
if bandH(D_active) > window.innerHeight → FAIL for that layout@viewport
```

That is a **structural property** of the CSS/content heights: once proved on the constructed worst case, the layout cannot be adequate at that inner height regardless of deal luck.

**Sampled rate (when bandH is deal-dependent via fan height / shelf):**

- Report `P(tier-1 co-visibility fails)` at n≥24 (default 40 if hunting rare pile depths), Wilson interval, scoped `390×H@theme`.
- Question this n answers: **detection** of a layout that is worse than “almost always co-visible after scroll,” or separation from 100% failure — **not** fine equivalence between two near rates without a pre-declared margin (practice 25).
- Pass/fail for a *change*: must not raise the tier-1 violation rate above a measured baseline for that `viewport@theme` (same shape as restated G-FOLD, but the quantity is co-visibility failure after scroll, not “Play below fold at scroll 0”). At real phone heights the old G-FOLD quantity is identically 100% and cannot gate; this one still can.

### 5. WHAT IT DOES NOT CATCH

- **Press-target quality and occlusion inside the fan** (strip width, pile steal, seam vs MAIN) — owned by tap-target / containment probes; co-visibility only asks whether the fan box intersects the viewport, not whether a 7-deep pile is tappable.
- **Legibility** (type size, contrast, lens yellowing, reduced-motion urgency carried only by colour) — geometry can pass while elders still cannot read the desk title.
- **Wrong decision content** (combo mis-name, stale beat verdict, redaction bugs) — visibility ≠ correctness of the words/faces shown.
- **Motion and practice-20 reach hazards** — an unbidden mid-reach scroll is a different defect; this property samples a settled frame after auto-scroll, not during a six-card selection sequence.
- **Affordances that should exist but are absent** (historical set-aside disappearance) — absence is not a co-visibility miss; `measure-setaside.mjs` still owns presence.
- **Time pressure and cognitive load** — whether 3s left is enough to use a co-visible desk.
- **Anything that genuinely needs a real device and person:** thumb reach with one hand while holding the phone; Safari URL-bar show/hide mid-turn changing innerHeight after the measurement; glare/brightness; whether an elder *understands* the desk copy; whether `scrollIntoView` on real iOS matches Playwright’s; network-jitter turn arrival while the player is mid-scroll. Headless settles geometry at a frozen inner size; it cannot settle comprehension or one-handed motor performance.

### 6. HOW IT RANKS THE PENDING DECISIONS

**24px vs 44px “cards set aside” indicator**

- If the indicator sits **in** the tier-1 band (on or under `.gd-desk`, in flow), the two heights differ by **+20px of `bandH`**. The property ranks them in the same currency: compute `bandH_24` and `bandH_44` (structural) and the post-scroll violation rates (sampled).  
  - If both keep `bandH ≤ innerHeight` on the constructed worst case at 390×664, **this property does not separate them** — they are equal for co-visibility; the 44px choice then wins or loses on the **separate** press-target floor (already a product rule elsewhere), not on reach/co-visibility.  
  - If `bandH_44 > H` and `bandH_24 ≤ H` (or only 44 raises the violation rate), **44 loses under this property** at that inner height.  
- That separation is exactly what “Play below fold at scroll 0” could no longer do: both heights still put Play below the fold at scroll 0 on every deal.

**Modal overlay vs inline collapsed strip**

- Put both in **one currency** by treating co-visibility as intersection with the **unoccluded** viewport: an opaque overlay’s box subtracts from visibility (element covered ⇒ not visible), same as being scrolled off-screen.
- **Overlay over the table:** document `bandH` of the base decision set is unchanged (no push). It fails this property **if and while** it covers any tier-1 member (well, desk, or actions). A transient overlay the player opened deliberately may be acceptable under practice 20 (movement after their own press) but still fails co-visibility *during* the cover — so the ranking question becomes “does the secondary task require tier-1 facts underneath?” If yes, overlay fails; if the secondary task fully replaces the decision (e.g. a chooser that re-states the combo), tier-1 may be temporarily redefined to the overlay’s own controls.
- **Inline collapsed strip:** increases in-flow `bandH` (push). Fails when the push makes `bandH > innerHeight` or pushes a tier-1 member above the viewport after auto-scroll to the action row.
- **Comparable:** both are judged by the same post-scroll (or post-open) co-visibility predicate. **Not a free lunch either way:** overlay trades scroll-budget for occlusion risk; strip trades occlusion-free layout for vertical budget. The property ranks a *concrete pair of designs* by measured `k/n` and structural `bandH`; it does not declare a universal winner without those numbers.

**Plain finding:** the replacement property restores discriminating power the fold-at-scroll-0 rate lost at real phone inner heights, ranks vertical chrome by its effect on decision-band height and post-scroll visibility, and puts overlay vs strip in the same units — but **24 vs 44 only separates when the extra 20px crosses the co-visibility budget**; otherwise the property honestly reports a tie and defers to the press-target rule.

PROPOSAL COMPLETE: 6 sections

I'll study the hand-fan layout code and sort-order behavior first, then answer whether a wrap policy can make both orderings the same height.Comments disagree on whether settled stacks wrap — checking CSS geometry and the height model next.PLAN and fan-height scripts look central — reading those next for the wrap model and sort-order effects.Running a height-impact simulation of candidate policies against the deal model.### 1. IS IT POSSIBLE

**Yes.** There is an implementable wrap policy that makes ascending and descending produce the **same multiset `{d1, d2}`**, hence the same `fanHeight`.

**Why today’s layout fails.** Settled mode is one `.gd-fan__stackRow` with CSS `flex-wrap: wrap` (`table.css`). At inner 390, pitch arithmetic fits **9** columns per line (`widthFor(9)=334.6 ≤ 342`, `widthFor(10)=370.1` overflows). Columns are value-runs from `groupHandColumns`; descending is a full-array reverse of the ascending index order (`HandFan.tsx`), so column *order* reverses and greedy wrap assigns a **different set** of columns to line 1. About half of two-line deals get a different multiset under reverse (simulated on the same 15-class shoe model as `scripts/fan-height-distribution.mjs`).

**Why a pure position rule is not enough.** Let display order be depths `c[0..C-1]`, cut after `k` columns (`k ≤ 9`, `C−k ≤ 9`).

| Ordering | Line maxes |
|---|---|
| Asc, cut `k` | `max(c[0..k))`, `max(c[k..C))` |
| Desc, cut `k` | `max(c[C−k..C))`, `max(c[0..C−k))` |

These partitions are swaps of each other for **all** depth vectors **iff** `k = C−k`, i.e. **even `C` and `k = C/2`**. For **odd `C`**, any fixed `k` leaves a middle column that changes lines under reverse; counter-example `C=11`, `k=6`, depths `[8,1,1,1,1,7,1,1,1,1,1]` → asc `{8,1}`, desc `{8,7}`. So balanced `ceil(C/2)` / `floor(C/2)` is direction-symmetric only for even `C` unless the odd-`C` tie-break depends on **content**, not display position.

**Existence.** Restrict to sequential cuts (reading order preserved). Choose

\[
k^\* = \arg\min_k \bigl(d_1(k)+d_2(k),\; \max(d_1,d_2),\; \ldots\bigr)
\]

over legal `k`. Under reverse, cut `k` maps to cut `C−k` with the **same** multiset `{d1,d2}`. The pair `(S, M) = (d1+d2, max(d1,d2))` uniquely determines that multiset (`{M, S−M}`). The optimised `(S,M)` is reverse-invariant, so **both orderings get the same multiset** even if the cut is computed separately on each display order. Equivalently: cut once on **ascending value order** (canonical partition), then only reverse presentation.

Height only needs equal `d1+d2` (because `lineH` is linear in depth); equal multiset is the stronger property the question asked for, and the policy achieves it.

---

### 2. THE POLICY

Name: **depth-minimising sequential wrap** (optional elder floor on line length).

Let `CAP = 9` at the phone geometry in the question (derive from pitch × content width in code; do not hardcode forever). Let `columns` be the display-order list of stacks (already ascending or descending via existing `order` + `groupHandColumns`).

**`C ≤ CAP` (today’s one-line case, including mid-hand when classes drop out):**  
One line. No wrap. `d1 = max depth`, no `d2`. Reverse only reorders columns on that line → height unchanged.

**`CAP < C ≤ 15` (always two lines at this CAP):**  
Legal cuts: `k ∈ [C − CAP, CAP]` (both lines ≤ CAP).

1. For each legal `k`, let  
   `d1 = max(depth of columns[0..k))`,  
   `d2 = max(depth of columns[k..C))`.
2. Pick `k` minimising lexicographically:  
   `(d1 + d2,  max(d1, d2),  |k − (C−k)|,  k)`  
   (last keys only break ties; any fixed total order works).
3. **Elder floor (recommended product default):** also require `k ≥ L` and `C−k ≥ L` with **`L = 4`**. If that set is empty (only possible near edges of the legal band), drop to `L = 1`.

Render: line 1 = first `k` columns L→R; line 2 = the rest L→R — same reading rule as text wrap, both sort directions.

**Odd / even `C`:** one rule. No separate odd branch. The odd “extra” column is placed by whichever legal cut wins the depth objective (content), not by “always longer line first.”

**Equivalent canonical form** (same heights, easier to prove in tests):  
Always compute `k` on **ascending** columns; partition into low-side `A` and high-side `B`.  
- Ascending: line1=`A`, line2=`B`.  
- Descending: line1=`reverse(B)`, line2=`reverse(A)`.  
Same multiset; descending still reads high→low L→R.

**What not to ship as the symmetry fix**

| Policy | Direction-symmetric? | Notes |
|---|---|---|
| CSS greedy fill (today) | No (~50% multiset mismatch) | Desc worse on feasibility |
| Balanced `ceil(C/2)` after reverse | No (~5.7% residual, odd `C`) | Also raises height |
| Balanced + content odd tie-break | Yes | Equalises **above** desc |
| Depth-min sequential (`L=1` or `L=4`) | Yes | See §4 |

**Implementation constraint (from this repo, not optional):**  
Do **not** implement as two sibling `.gd-fan__stackRow` bands. `docs/research/sort-areas.md` measured two bands at `[9,4]` as **+14px** vs one wrapping row (extra lift `padding-top`). That would tax every two-line hand. Prefer one row plus a zero-height flex break (`flex-basis: 100%`) before column `k`, or an explicit width budget on line 1 — same chrome as today (`13.9 + lineH + 6 + lineH`).

Dealing-mode `splitIndexRows` already balanced-splits **flat** cards; settled mode currently does not — this policy is the settled-mode analogue, depth-aware rather than `ceil(n/2)`.

---

### 3. WHAT IT COSTS

**Reading order.** Sequential wrap keeps monotonic value order L→R on each line and continues across the seam (low→high or high→low depending on pref). No interleaving, no “deep piles pulled out of sequence.” Matches how elders already scan a wrapped hand.

**Visual balance.**  
- Pure min-sum (`L=1`) can open **1+9 / 2+8 / 3+9** (~13% of deals with a side ≤3). That is the real elder risk: a lonely column on line 1 looks like a glitch, not a hand.  
- **`L = 4`** removes sides ≤3 entirely; splits cluster around 5–7 / 6–7 / 7–7 / 9–4 — closer to today’s 9+remainder, without forcing a full greedy 9.

**Seam between lines.** Seam stays a single value boundary (between column `k−1` and `k` in display order). It is no longer “always after the 9th column”; it moves with the hand. That is slightly less predictable than greedy, but still one clean break in sorted order — not a scrambled second row.

**Short / long lines.** With `L=4`, neither line is uncomfortably short; neither exceeds CAP=9. Worst visual length imbalance is 4 vs 9 (only when `C=13` and the optimiser wants it), still readable.

**Interaction with the toggle.** Sort still reverses column order; only the **cut** is depth-driven. FLIP-on-toggle (`HandFan` sort beat) still makes sense.

---

### 4. WHAT IT DOES TO HEIGHT

`fanHeight = 13.9 + lineH(d1) + 6 + lineH(d2)` with `lineH(d) = 73.5 + 21.3(d−1)` depends only on **`d1 + d2`** (linear). Symmetry is worthless if both sides move to the worse of today’s two orderings.

Simulated on 200k deals (same shoe/geometry model as `fan-height-distribution.mjs`; timed-follow style threshold `fanH > 308.9` ≈ lattice bin ≥316):

| Policy | Mean height | P(fail) | Multiset asym. |
|---|---:|---:|---:|
| Greedy asc (default today) | 273.2 | **7.65%** | — |
| Greedy desc | 276.7 | **9.37%** | vs asc ~50% |
| Max(asc, desc) (bound) | 282.1 | 13.14% | — |
| Balanced size (content odd tie) | 279.7 | **11.5%** | 0% |
| Depth-min, `L=1` | 269.5 | **6.39%** | 0% |
| Depth-min, `L=4` (recommended) | 273.2 | **8.16%** | 0% |

**Balanced split equalises at the worse side** — mean `d1+d2` rises (≈7.00 → 7.30). Greedy parks as many columns as possible on line 1; line 2 is a short tail that is often shallow. Balancing moves mid-hand depth onto line 2 more often than it relieves line 1, so **`d2` tends to rise** and total height rises. Fail rate exceeds even descending. Reject as the symmetry fix.

**Depth-min** equalises at **min achievable sequential height**, not at max(asc,desc). With `L=1` it **beats** default ascending on both mean and fail rate. With **`L=4`** it is nearly neutral vs ascending (+0.5pp fail) while removing short-line ugliness — and it **removes the desc penalty** (no more 9.4% vs 7.7% gap; both prefs share one distribution).

So: symmetry need not mean “both as bad as the worse.” Use depth-min, not balanced counts.

---

### 5. THE ALTERNATIVE ANSWERS

If a wrap change is rejected (implementation risk, elder testing fails on moving seams), product options ranked:

1. **Keep the toggle; default ascending; do not treat desc as a layout “fix.”**  
   Asc is already better (~7.7% vs ~9.2% fail). Document that sort is display preference and can change fit. Lowest product risk; leaves the silent feasibility coupling in place for desc users.

2. **Keep the toggle; warn when the other ordering is shorter / fits.**  
   Honest, elder-visible. Cost: chrome, copy, and teaching a second concept (“sort changes height”). Only helps the ~3.8–5.5% of deals where orderings disagree on feasibility (`reachability.md` §10.4: P(at least one fails) was the mistaken 13% bound). Worth less than fixing wrap if engineering is available.

3. **Remove the toggle.**  
   Forces everyone onto ascending height. Net feasibility improves vs a desc population, but **removing a control elders may already rely on is a real cost** — many players learn one direction and never re-learn. The pref is local-only (`pref:handSort`), already shipped, and audits treat reverse as intentional. **Do not remove** unless research shows almost nobody uses desc; preference removal is worse than a quiet wrap fix.

Ranking: **wrap policy (depth-min, L=4) ≫ keep+default asc ≫ warn ≫ remove.**

---

### 6. WHAT YOU ARE UNSURE OF

- **Forced-break chrome:** sort-areas proved two `stackRow`s cost +14px; a zero-height flex break inside one row is believed free of that tax but was not measured in this pass.
- **`L=4` vs `L=3`:** trade-off is design taste; not validated with elder eyes.
- **Non-390 widths:** `CAP` is 8 at 320, 9 at 360–390, higher on desktop (`PLAN.md` / geometry sweep). Policy is CAP-relative; rates above are 390/lacquer only.
- **Themes:** height step `21.3 = 0.42 × 50.7` is lacquer `stackStripW`; cinnabar-court’s taller strip changes `lineH` and possibly the fail lattice.
- **Shelves / `areas` split path:** MAIN still uses `groupHandColumns` inside a band; policy should apply per column row there too — not re-simulated.
- **Live n=120 rates** (7.7% / 9.2% / 3.8%) vs this offline model (7.65% / 9.37% / max-bound 13.14%) agree on direction; the exact L=4 fail 8.16% is model-only until re-measured in-browser.
- Stale comment at `HandFan.tsx` L39 (“settled never wraps”) contradicts CSS and tests — layout truth is the stylesheet.

PROPOSAL COMPLETE: 6 sections

I'll review the gate definition from the repository artifacts only—no file changes—and start by reading the cited model, validation, scripts, and methodology sections.Verifying tooth boundaries and how the gate treats margin versus bin index against the model formulas.# Gate definition review — measurement design only

No files modified. Arithmetic re-derived from `status/MODEL.md` / `scripts/cardw-gate.mjs` formulas; held-out scope from `status/VALIDATED.md`.

---

## Q1

**The diagnosis is right about the mechanism, incomplete about the table.**

### What is real

`margin` is not “slack of the layout in general.” It is

\[
\operatorname{margin}(s^\*, w) = T(w) - \operatorname{fanH}(s^\*, w),
\]

where \(s^\*\) is the **largest depth that still fits** at that card width. That quantity is local to the currently marginal lattice step.

Across a tooth boundary the identity of \(s^\*\) jumps down by one. Immediately after losing bin \(s\),

- \(\operatorname{margin}(s-1, w)\) jumps **up** by about one strip step \(\approx 0.42\,w \approx 20\,\mathrm{px}\),
- while failure mass becomes \(P(s \ge s)\) instead of \(P(s \ge s+1)\), so modelled \(R(0)\) jumps **up**.

Verified closed form (script aspect \(73.5/50.7\)):

| \(w\) | marginal bin | \(\operatorname{margin}(s^\*)\) | note |
|---|---|---|---|
| 47.50 | 10 | 0.96 px | late in better band |
| 47.60 | 10 | 0.04 px | on the tooth |
| 47.70 | 9 | 19.16 px | early in worse band |
| 46.80 | 10 | **7.37 px** | previous @360 |
| 48.15 | 9 | **15.23 px** | shipped |

So over a band edge, **floating** \(\operatorname{margin}(s^\*)\) is anti-correlated with the failure ordinal. That is not a weak proxy that happens to mis-rank; it is the wrong object for ranking across plateaus.

Within a band (fixed \(s^\*\), fixed capacity), \(\operatorname{margin}(s^\*, w)\) **falls** as \(w\) rises, and \(R(0)\) is essentially constant (failure is still \(s > s^\*\)). So the anti-correlation is a **discontinuity artifact**, not a smooth within-band law. The brief states that correctly.

### What the 360 table also contains

At inner width 360 the two options do not differ only by tooth:

| | \(w\) | marginal bin | capacity@360 | modelled \(R(0)\) |
|---|---|---|---|---|
| previous | 46.80 | 10 | **9** | 0.15% |
| shipped | 48.15 | 9 | **8** | 1.78% |

`fan-height-distribution.mjs` already records that an 8-column line cap changes the split of columns across lines and therefore the distribution of \(s = d_1+d_2\). Part of the 0.15% → 1.78% jump is **capacity-driven mass movement**, not only “one more depth bin becomes infeasible.”

### What I would check

1. **Decompose the \(R\) jump** at fixed \(w\) vs fixed capacity: hold LINE_CAP=9 and only cross the 47.60 tooth; then hold \(w\) and only drop cap 9→8. Price each contribution separately (practice 30: which term changed).
2. **Within-band constancy of \(R\)** at fixed capacity — if it is not flat, something other than the tooth is moving.
3. **Confirm the gate evaluates \(\operatorname{margin}\) of the marginal bin**, not of a fixed \(s\) — `cardw-gate.mjs` does the former (`mb.margin >= MIN_MARGIN`).
4. **Do not treat the 360 pair as a pure geometry vs \(R\) experiment** while capacity co-moves.

**Verdict on Q1:** anti-correlation is real and correctly named for the tooth; the shipped table is tooth **plus** capacity. Same qualitative preference, two levers.

---

## Q2

**A bin-index floor is the right *kind* of term; `>= 10` is a product threshold, not a validation theorem — and as currently sold it is partly post-hoc.**

### Principled case

At fixed capacity, modelled failure rate is

\[
R(0) = P(s > s^\*(w)).
\]

So \(s^\*\) is the **sufficient ordinal statistic** for \(R\) under that deal law. Gating on “\(s^\* \ge K\)” (equivalently \(\operatorname{margin}(K, w) \ge 0\)) is pure geometry, width-independent for vertical terms, and does not need a probability estimate.

The repo already adopted this shape once: I0’s \(\operatorname{margin}(s{=}9) \ge 0\) is exactly “marginal bin \(\ge 9\)” / “last held-out height bin must still fit.” The proposal is not a new species of term; it is **raising \(K\) from 9 to 10**.

### Post-hoc case

- The number 10 is the bin the *previous* 46.80 card lived in, and the one the *shipped* 48.15 card left. The term is shaped so that the currently awkward comparison flips.
- Validation does **not** force \(K=10\). Held-out coverage is “bins with expected count \(\ge 5\), i.e. \(s \le 9\)” (`VALIDATED.md`). That justified I0’s \(K=9\) as “do not abandon the last checked height bin.” It does **not** justify \(K=10\): requiring bin 10 is a stricter product claim (“depth-10 hands must fit”), not an earned statistical bound.
- Geometry of \(\operatorname{fanH}(s,w)\) for \(s=10\) is still lattice arithmetic (definitional/measured constants). Frequency mass in the \(s=10\) *rate* bin remains thin; that is why one must not gate on \(P(s=10)\). Feasibility of depth 10 is still a legitimate geometric predicate.

### Which I believe

- **Form:** principled. Prefer fixed-bin feasibility over floating marginal slack for the failure-rate axis.
- **Threshold \(K=10\):** **fitted to the present dispute** unless the owner states a product rule such as “depth-10 hands are in-scope for feasibility.” It is not forced by the holdout, and it is not “more validated” than \(K=9\).

If you keep a bin term, write it as product policy:

> Require \(\operatorname{margin}(K, w) \ge \varepsilon\) for chosen \(K\), with \(K\) and \(\varepsilon\) named and justified separately.

Do not write “validated bins force \(\ge 10\).” They force at most the existing \(K=9\) story.

---

## Q3

**Direct object, without re-gating on the unvalidated tail:**

\[
\text{require depth } K \text{ to fit (with tolerance } \varepsilon\text{):}\quad
\operatorname{margin}(K, w) \ge \varepsilon.
\]

Then every failing hand has \(s > K\). You have capped the **support** of the failure set. You have not estimated its measure.

### Is “bin index” the honest ordinal form of \(R\)?

| | what it is | what it is not |
|---|---|---|
| Marginal bin \(s^\*\) | Step-function skeleton of \(R\) **at fixed capacity** | A probability; a continuous risk; a substitute for cap-driven \(s\)-law changes |
| Modelled \(R(0)\) | Estimated measure of \(\{s > s^\*\}\) | Validated below ~0.5–1% (holdout bins need expected count \(\ge 5\)) |
| \(\operatorname{margin}(s^\*)\) | Slack of the currently marginal step | An ordinal for \(R\) across teeth |

So bin index is **not** a third unrelated quantity, and **not** \(R\) itself. It is the **ceiling coordinate** of the failure event. Honest language: “we require \(K\)-deep fans to fit,” not “we bound failure probability at \(x\%\).”

### What would reintroduce \(R\) by the back door

- Thresholds on modelled \(0.15\%\) vs \(1.78\%\) as pass/fail (already rejected under H1; still correct).
- “Bin \(\ge 10\) because that keeps \(R\) under …” — same precision claim with different spelling.
- Using thin-bin simulation mass to *choose* \(K\).

What does **not** reintroduce \(R\): choosing \(K\) from product scope (which depths must remain feasible) or from the last height lattice step you trust geometrically, then reporting modelled \(R\) only as **context** (as `cardw-gate.mjs` already claims for H1).

### Capacity is a second coordinate of \(R\)

Even a perfect bin gate at fixed \(w\) does not pin \(R\) if LINE_CAP moves. The honest two-axis form is:

1. **Depth floor:** \(\operatorname{margin}(K, w) \ge \varepsilon\) (vertical / tooth).
2. **Capacity floor:** \(\operatorname{capacity}(W, w) \ge 8\) (already present), and when *comparing* rates, hold or report LINE_CAP.

Bin index alone is the ordinal of \(R\) only after capacity is controlled.

---

## Q4

**What \(\operatorname{margin}(s^\*) \ge 10\) rewards that it should not**

1. **Early position in a worse band** over **late position in a better band** — the defect in the brief. Maximizing floating marginal slack prefers “I just dropped a bin, so I have ~20 px of slack on the new marginal hand.”
2. **Larger cards that sit just above a tooth** over **slightly smaller cards that still clear one more depth** — anti-correlated with the failure ordinal across teeth.
3. **A false sense that 15 px “is safer than” 7 px** when those figures are slacks of *different hands* (\(s=9\) vs \(s=10\)). Comparing them as if they were the same manufacturing surplus is a unit error.

**What it can still mean within one band**

Inside a fixed \(s^\*\) plateau, \(\operatorname{margin}(s^\*, w)\) shrinks toward 0 as \(w\) approaches the next tooth. A floor there is “stay off the cliff for this lattice step.” That is a manufacturing / constant-error budget, not a cross-band ranker.

At these card sizes the lattice step is \(\approx 0.42\,w \approx 20\,\mathrm{px}\); **10 px is ~½ step**. That is a defensible ε **if** attached to a **fixed** depth, e.g. \(\operatorname{margin}(K, w) \ge 10\), not to the floating marginal identity.

**Defensible meaning of a floating 10 px floor?**  
Only as “setback from the local tooth, after the band is chosen.” As a global conjunct that can admit \(s^\*=9\) with 15 px and reject \(s^\*=10\) with 7 px, it has **no** defensible meaning for the quantity the project actually cares about (how often the fan overflows). It should be **replaced or subordinated**, not merely supplemented.

**Cleaner replacements**

| formulation | meaning |
|---|---|
| \(\operatorname{margin}(K, w) \ge \varepsilon\) | Fixed-depth fit + tolerance (recommended primary vertical term) |
| setback in **cardW** to nearest tooth | Manufacturing tolerance in the space where \(w\) is chosen (gate already computes teeth) |
| \(\operatorname{margin}(s^\*, w) \ge \varepsilon\) alone | Within-band only; never the ranking key across bands |

Supplementing floating margin with `bin ≥ 10` **masks** the bug for the current pair but leaves the same reward structure inside every band the bin floor still allows (e.g. still prefers early \(s^\*=11\) slack over late \(s^\*=10\) slack unless you also rethink the margin term).

---

## Q5

**What I would not do**

1. **I would not stack another patch** (`bin ≥ 10`) on an unchanged floating `margin(s*) ≥ 10` and call the composition “the fix.” That is how this project keeps growing gates that fight their own axes (H0 disjoint segments, H1 delete R, I0 re-add bin-9, now bin-10). Fix the **definition** of the vertical term.
2. **I would not reintroduce continuous \(R\) thresholds** for selection. H1 was right; practice 25 applies: you lack power and validation to discriminate sub-percent tails as gate law.
3. **I would not claim validation forces \(K=10\).** That over-claims the holdout and trains the next round to “earn” thresholds by narrative fit.
4. **I would not treat the 360 previous-vs-shipped table as a pure natural experiment** without partialling capacity. Practice 12/30: the deciding axis must be the one you name.
5. **I would not keep maximizing card width under a gate that secretly rewards dropping bins.** Segment-3 “optimum” 48.15 is what you get when the objective and the failure ordinal disagree at a tooth.

**What I would do instead (measurement-design, not implementation)**

1. **Primary vertical predicate:** \(\operatorname{margin}(K, w) \ge \varepsilon\) for an owner-chosen \(K\) (product: which depths must remain feasible) and \(\varepsilon \approx\) half strip or a named constant budget — **fixed \(K\)**, not floating \(s^\*\).
2. **Keep** `capacity ≥ 8` as the two-line structural floor.
3. **Rank / select** inside the feasible set by the product objective (legibility ⇒ larger \(w\), or setback, etc.), with modelled \(R\) only as a **context column** stratified by capacity.
4. **If the owner wants “no worse than the old 360 card on failure ordinal,”** say that as \(K \ge 10\) (or \(\operatorname{margin}(10,w)\ge 0\)) **explicitly as a product freeze**, not as a discovery from validation.
5. **Drop or demote** floating \(\operatorname{margin}(s^\*) \ge 10\) as a global pass bit; keep tooth setback in cardW-space if you need manufacturing clearance.

The over-engineering is not the geometry model (that is earned). It is **multiple pass/fail terms that measure related but non-aligned objects** (floating slack, fixed validated bin, capacity) without a declared lexicography, so the gate can prefer a higher failure plateau while printing a greener margin.

---

## Checked clean

| item | result |
|---|---|
| `T(w)`, `fanH`, `margin`, `toothBoundary` formulas in `MODEL.md` | Consistent with `cardw-gate.mjs`; band edges 45.52 / 47.60 / 49.89 / 52.41 reproduce as roots of \(\operatorname{margin}(s,w)=0\) |
| Brief’s 46.80 / 48.15 margin and bin figures | Reproduce (7.37 px @ bin 10; 15.23 px @ bin 9) under script aspect |
| Shipped gate text vs `cardw-gate.mjs` J0 | Matches: `margin ≥ 10` AND `margin(s=9) ≥ 0` AND `capacity ≥ 8` |
| I0 term as bin-index form of “last validated height bin feasible” | Correct reading of holdout \(s\le 9\); not an \(R\) threshold |
| H1 removal of \(R\) from the gate | Still correct under `VALIDATED.md` (tail unvalidated; \(R\) only modelled) |
| Width-independence of vertical margin | Confirmed; \(W\) enters only via capacity / maxS (saturated for cap ≥ 8) |
| Practices 14, 16, 25, 28 as applied here | 14: bound/feasibility before sampling rates; 16: report violation rate not median slack; 25: no equivalence claims from underpowered tail discrimination; 28: gate must not smuggle an unsettled “what \(R\) means” definition as a false precision reading |
| Half-strip ≈ 10 px at these \(w\) | True; supports ε≈10 **only** when attached to a fixed depth or as local setback, not as floating cross-band score |
| Desktop / non-lacquer / root≠16 scope | Out of this gate’s validated envelope; not re-litigated here |

---

GATE VERDICT: 5 recommendations

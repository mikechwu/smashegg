> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Side-by-side areas shipped: a shelf now costs zero vertical on desktop (2026-07-27)

### What shipped

Inside `@media (min-width: 720px)` only. The phone keeps its bands.

| inner 1280×800, n=12 deals, shelf sizes 3/5/10/12 | fan height | Play doc | below fold |
|---|---|---|---|
| no shelf | 198.3 | 693.2 | 0/12 = 0.0% [0.0, 24.2] |
| shelf as a BAND (the counterfactual) | 378.9 | 873.8 | **12/12 = 100%** [75.8, 100] |
| **shelf SIDE BY SIDE (shipped)** | **198.3** | **693.2** | **0/12 = 0.0%** [0.0, 24.2] |

Identical to having no shelf at all, at every shelf size measured. 1440×900
goes 8.3% → 0/12; 1920×1080 was already clean. **The phone is unchanged at every
shelf size** (banded and side read identically at 390×844, because the rule is
min-width 720) — its gap stays open and is the next piece of work.

### The cap is derived from a bound the previous one did not cover

The 906.1px an n=12 sweep produced was a SAMPLE. The structural bound is
**1143.6px** — 1.56× the single-area one — because **the 15-class bound does not
survive splitting**: a value can be a column in MAIN and also sit on the shelf,
so the two areas are not partitioned by value. Maximised over shelf size, the
worst case is a 12-card shelf in 6 recorded groups beside a 15-column MAIN.

The sample understated the bound by **237.5px**. The cap is `74rem` = 1184px,
and it is applied only while a shelf is open (`:has(.gd-fan--split)`, verified
by execution) so the ordinary hand keeps its chrome close to the fan. Pinned by
DERIVATION in `desktop-mode.test.ts`: the bound is recomputed from the
stylesheet's own clamp ceiling, stack pitch and run overlap, so it breaks if any
of the three moves.

### The containment gate caught a bug in the very next feature built after it

At inner **720×900** — a mode boundary, not a size anyone would sample — a shelf
card overflowed `.gd-table` by 6.7px, invisibly, because the table's own
`overflow-x: hidden` suppresses the scrollbar. Cause: **side-by-side had no wrap
fallback**, and whether two areas fit is a property of the DEAL, so no static
breakpoint can guarantee it. `flex-wrap: wrap` now degrades a pair that does not
fit back to stacking — the banded layout it came from — paying the vertical
again only when the horizontal genuinely is not there. Clean afterwards across
10 viewports × 2 deals × 2 shelf states: **2770 element boxes, 0 violations**.

### The manual-gate decision, made explicitly

Split by the NATURE of the property, not by convenience:

- **Containment is deterministic** — a box that escapes its container escapes on
  every deal at a given viewport. So `scripts/check-containment.mjs` now runs
  **in CI on every push**, sweeping all ten mode boundaries at 1 deal each,
  against `wrangler dev` (which CI already boots for E2E).
- **The fold rate is deal-dependent** — a step function needing n≥24 per
  viewport, i.e. minutes. Sampling it in CI would report a number too small to
  mean anything (practice 12), which is worse than not running it. It stays
  **manual**, at the sample sizes `measure-fold.mjs` enforces.

The script prints its own limit rather than leaving it implicit: at 1 deal it
catches STRUCTURAL violations, not ones needing a rare hand.

### Interaction, verified beyond the fold numbers

- **The seam still clears the 44px floor on both axes**: 68×44 on desktop (it
  becomes the divider between the two areas), 342×44 on the phone. Measured, not
  assumed.
- **MAIN moves when a shelf opens — but so does it in bands, and the comparison
  matters.** Side-by-side shifts MAIN 93.6px at a 3-card shelf against banded's
  47.6px (worse), and 144.6px at a 12-card shelf against banded's 166.7px
  (better). So this is **not a regression introduced by side-by-side**; it is a
  pre-existing property of re-centring a shrinking MAIN, which side-by-side
  makes worse for small shelves and better for large ones. Flagged for the elder
  session rather than resolved — the fix (keeping MAIN centred by taking the
  shelf out of the centring) is a design decision, not a bug fix.
- Still needing the elder session and NOT settled by measurement: whether the
  seam still reads as "close this shelf" as a vertical divider, the recall
  direction, drag becoming horizontal, and whether the two areas are
  distinguishable at a glance without the band separation.

### Timeline for the fold-gate provenance claim, as asked

My previous "every run before this round was 390-wide" was imprecise. Precisely:

- `186b2b9` (07-25) added the `FOLD_W`/`FOLD_H` knobs — the gate became runnable
  at any viewport.
- `6a40d5f` (07-26) introduced `KNOWN_BUCKETS` — **the baseline defect**.
- `1dd79f9` / `e358f0c` (07-26) — the desktop-layout study, **inside the defect
  window**, and it did measure at 1024×768, 1280×800 and 1440×900.
- `e581f25` (07-26) — the repair.

**So there were non-390 measurements inside the window — but none from the
defective instrument.** The study's numbers came from scratch probes with their
own rate arithmetic and no bucket baseline at all; it never cites
`measure-fold.mjs`. The repo gate's first non-390 run was in the repair commit
itself, and the reported 0/24 was re-confirmed post-repair. The defects touched
the regression baseline and the verdict wording, never the rate.

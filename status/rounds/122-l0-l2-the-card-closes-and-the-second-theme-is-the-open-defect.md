> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## L0-L2: the card closes at 46.51, and the arc's excluded axis is the open defect

**Routing.** L1's appearance question — is a cinnabar card at 35px still cinnabar, is a per-theme card scale acceptable — went to **Grok** (`docs/research/proposals/second-theme-{brief,grok}.md`). It is a judgement about identity and product surface, not arithmetic, and the arithmetic was already closed-form and reconstructed. L0's two corrections needed no external lineage: both are algebraic identities checked two ways in the same run.

### 1. [L0 SHIPPED] The card is 46.51px

Option D. The reason is not the rate — 1.31% and 0.08% modelled are both unobservable — but that **D makes no width worse than before this arc**, which under ship-and-iterate is worth more than 2mm of card because it means the next complaint points at something new.

Verified after shipping, at `lacquer`: containment PASS across 320/333/360/390/430 (30 probes, 5,220 element boxes, desk title clean at 30 titles, joker staged on 10). The ink cap re-measured at the new box: first escape 60px against 62px at the old one, a ratio of 0.968 against the box ratio 0.966, so the clip point scales with the box as assumed and 56px keeps the same 4px of setback.

### 2. [L0a.1 CONFIRMED] The B/D choice was the K choice, and K is a policy

`w <= 47.60` IS `margin(K=10, w) >= 0`. Under the `K = 9` the held-out test earns, `w <= 49.89` and B passes. So "the corrected gate excludes the shipped card" restated a policy choice; it was not an independent finding, and the previous round's write-up did not make that visible.

Stated as a percentile so it can be ruled on — modelled, `lacquer`, over per-line capacities 8 to 10:

| K | claim | share of hands covered |
|---|---|---|
| 9 | depth <= 9 must fit | 98.2% - 99.3% |
| 10 | depth <= 10 must fit | 99.8% - 99.9% |

The brief estimated ~98.2nd and ~99.6th; the second is nearer 99.8-99.9%.

### 3. [L0a.2 CONFIRMED, with one correction] Setback belongs in span, not in card

A tooth sits at `w = 436.0/c(s)` and 436.0 is the span budget, so a card setback times `c(s)` is the span growth the card tolerates. Computed both ways in the same run and agreeing to 0.01px:

| card | bin | setback | span tolerated | and then the rate is |
|---|---|---|---|---|
| 48.15 | 9 | 1.74px | **15.2px** | 7.65% |
| 46.10 | 10 | 1.50px | 13.8px | 0.74% |
| 46.51 | 10 | 1.09px | 10.0px | 0.74% |
| 47.10 | 10 | 0.50px | 4.6px | 0.74% |

**The brief's B figure was 16.0px; it is 15.2px.** Its point stands unchanged: B's setback is the largest and the previous round's table showed setbacks only for D variants, which made B look strictly worse than it was.

**And this column is `margin(s*, w)`, the quantity K0 removed from the gate.** That is not a contradiction — it is K0's own distinction used correctly. `margin(s*, w)` measures robustness to span growth at the current bin and does not measure the failure rate, because across a band edge it moves the other way. Ranking options by it is the bug; breaking a tie with it among options that already pass the depth floor is what it is for. The half the brief did not state: **a setback is only half a risk.** B tolerates the most span and lands in the worst place when it runs out — the shipped card's degraded state is B's current state.

### 4. [L1] The second deck theme, and the cross-check the brief asked for could not be run as stated

`stackStripW: 0.841` is live, aspect matches lacquer's 1.45, and the theme is a `<select>` in the app header on every screen. Verified from source.

Substituting the strip into the model's own `c(s)`:

| at the shipped 46.51px card | lacquer | cinnabar-court |
|---|---|---|
| deepest hand that fits | 10 | **6** |
| hands that do not fit, modelled | 0.1% | **51.3%** |
| card needed to fit depth 10 | 47.60px | **34.81px** |
| strip needed to fit depth 10 here | 0.42 | **<= 0.447** |

**The proposed corroboration does not work.** The round-098 figure of 95.8% below fold at cinnabar was measured at inner 390x**844** — the height this project later declared void — and with the fold metric rather than the span metric. It corroborates the direction and no number, and saying two methods agree on the strength of it would have been manufacturing agreement out of incomparable things.

A first attempt at a live replacement was also confounded: two separate 24-deal sweeps, one per theme, showed cinnabar's spans 60-100px larger but the panel profile fitting in **both** arms, because the runs mixed leading and following turns and K differs by 132.5px between them. That run tests nothing about the rate.

**So it was done as an intervention** — same page, same deal, same scroll state, same turn, the theme toggled through the picker a player uses:

| lacquer -> cinnabar-court, same hand | |
|---|---|
| panel span growth | 59px to 118px |
| deals going feasible -> infeasible | **6 of 12** |
| the same quantity, modelled | 51.3% |
| control drift | 0px on 12/12 |

Two methods at one configuration, agreeing. **The model extends to the theme.**

Building that revealed a gap in the intervention harness worth recording: it counted improving flips, both-feasible and both-infeasible, and had no counter for **feasible -> INFEASIBLE**. The direction that matters here had to be inferred by subtracting the other three from n. Both intervention scripts now name it.

### 5. [L1] Grok's ranking, and a correction to the options as posed

**Withdraw the theme from the picker**, and treat a redesigned re-entry as the only path back. Broken since it shipped with no report: silence licenses removal, not neglect. Reversible, client-local, no protocol or room state.

- **Per-theme card scale: reject.** `--gd-handcardw` is one root constant the fan pitch, staged card, seat stacks and cut geometry all hang off. Two theme-local widths are two products to gate, theme switching becomes a layout reflow rather than a repaint, tap geometry changes with a cosmetic, and one player's staged king would be physically larger than another's at the same table.
- **"Set the strip to 0.42" is NOT the cheap fix, and the brief mis-specified it.** A 0.42 strip at this card is 19.5px against a vertical rank-over-suit index that wants 30px or more, so the suit hides under the next card on every stack. It trades a fold failure for unreadable stacks. Only viable with a redesigned covered mark.
- **Its own fan layout** is the right investment in a validated theme and the wrong way to clear an unreported ship defect.

**And a repair the four options skip:** `stackStripW` is declared as art freedom over `[0.3, 1.0]` while it spends a shared vertical budget. The theme should request a strip and the framework should own the cap. That is durable whatever happens to this theme.

Nothing was built. The ruling is the owner's.

### 6. [L1] The reporting fix, which stands whatever is ruled

`prose-figures.test.ts` now requires that **any section quoting a rate names the theme it is a rate for**. Card widths are theme-independent and are exempt by construction; rates are not. It fired on two sections immediately. `CURRENT.md` carries the qualifier at the top and per table.

### 7. [L2] What this arc fixed, and what it did not touch

Fixed, **all at `lacquer`**:

| | before | after |
|---|---|---|
| width 430, never swept until J0 | 66.93% modelled | 0.02% |
| width 390 | 7.65% modelled | 0.08% |
| width 320 | worked, then broke in J0, then restored in K2 | as before the arc |
| the joker baseline descender | 5.0px on most deals | 0px |

Not touched, and now stated rather than implied: **the second deck theme** (open, above), **elder legibility** (no session run; nothing here says the card is legible to anyone, only what it costs in pixels), and **every figure at a non-default root font-size** except the ink cap, which is the one quantity measured across a ramp.

The card decision is closed.

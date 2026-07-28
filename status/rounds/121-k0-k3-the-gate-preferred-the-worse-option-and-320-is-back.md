> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## K0-K3: the gate preferred the worse option, and 320 is supported again

**Routing.** K0 is a question about what a gate MEASURES, which is definitional, so it went to **Grok** (`docs/research/proposals/gate-monotonicity-{brief,grok}.md`). Its arithmetic half is closed-form and got practice 33's substitute — a numerical sweep that emits the band edges from where the marginal bin actually changes, asserted against the closed form, with a non-vacuity mutant. K2 and K3 needed no external lineage and say so: K2 is a one-declaration restoration of what already ships at 320, verified by the containment gate at that width; K3 is a documentation contract with a test.

### 1. [K0 CONFIRMED] The gate rewarded the worse option, and the mechanism is structural

`margin(s, w) = 436.0 - c(s)*w` is linear in `w` with a per-`s` coefficient, so the marginal bin is a step function of the **card alone** — the viewport width does not appear. Band edges, closed form and confirmed by exhaustive reconstruction:

| marginal bin | card-width band |
|---|---|
| 11 | w <= 45.52 |
| 10 | 45.52 < w <= 47.60 |
| 9 | 47.60 < w <= 49.89 |
| 8 | 49.89 < w <= 52.41 |

At width 360:

| card | marginal bin | margin | old gate | R(0) modelled |
|---|---|---|---|---|
| 46.80 (previous) | 10 | 7.37px | **fails** | **0.15%** |
| 48.15 (shipped) | 9 | 15.23px | **passes** | **1.78%** |

`margin` is the slack of the marginal bin ITSELF; `R` is the mass ABOVE it. Growing the card past a band edge raises the first and raises the second, so across an edge they are anti-correlated. The gate preferred twelve times the failure rate.

### 2. [GROK] The brief's fix was the right kind of term and the wrong way to apply it

Three corrections from the review, all adopted:

- **The 360 table is confounded.** Capacity also moves there (9 -> 8), so the pair is not a clean tooth experiment. Decomposed at pinned capacity: the tooth alone takes 0.15% -> 1.31% (a factor of **8.7**), capacity alone takes it to 0.21% (a factor of **1.4**). The diagnosis survives, and its attribution is now earned rather than asserted.
- **Do not SUPPLEMENT the floating term — REPLACE it.** Adding `bin >= 10` alongside `margin >= 10px` fixes the pair that was noticed and leaves the same reward structure inside every band the bin floor still admits. The vertical term is now a fixed-depth floor `margin(K, w) >= 0`, and the floating one is gone.
- **`K = 10` is a PRODUCT POLICY, not a validation result.** The held-out test validated bins with expected count >= 5, i.e. `s <= 9`; that earns I0's `K = 9` and does not earn `K = 10`. Requiring depth-10 hands to fit is a stricter scope claim, and writing it as a discovery would be the precision claim H1 removed, respelled. `VALIDATED.md` gained a `product policy` status row so this cannot be cited as evidence later.

Grok also named the unit error underneath: 15.23px and 7.37px are the slacks of **different hands**, so comparing them was never merely a mis-ranking.

### 3. [MINE] The floating term was also one-sided, which is this project's own error class

Within a band, `margin(marginal bin, w)` falls to zero only at the UPPER edge, so the 10px floor constrained the distance to one cliff and said nothing about the other. That is exactly the shape H0a diagnosed in the discontinuity scan and fixed there, left standing in the gate itself.

The replacement setback is stated in card width and is **directional**, which is a correction to H0a rather than a retreat from it: teeth are ordered in `w` and the bin index falls as `w` grows, so crossing the tooth above loses a depth bin and crossing the one below gains one. A two-sided minimum rejected the 44.00px floor value — which ships today — for sitting 0.39px above a tooth it would be harmless to cross. Both distances are reported; only the degrading one gates.

The old 10px vertical floor turns out to be **1.09px of card width** below the tooth: the same tolerance, in the units the choice is actually made in.

### 4. [K1] Every cell recomputed, and 46.10 is not forced

| option | 320 | 360 | 375 | 390 | 430 | card at 390 |
|---|---|---|---|---|---|---|
| today's clamp | 0.02% | 0.15% | 1.31% | 7.65% | 66.93% | — |
| A: 48.15, no floor | three lines | 1.78% | 1.31% | 1.31% | 0.74% | -5.0% |
| B: 48.15 + floor | 0.02% | **1.78%** | 1.31% | 1.31% | 0.74% | -5.0% |
| C: 46.10, no floor | 0.21% | 0.15% | 0.15% | 0.08% | 0.02% | -9.1% |
| D: 46.10 + floor | 0.02% | 0.15% | 0.15% | 0.08% | 0.02% | -9.1% |

All modelled, 200,000 deals per cell. **D has no regression at any supported width**; B regresses only at 360, and only there. The brief's derived figures hold with one refinement: at 430 the D row is 0.02%, not the ~0.08% it estimated.

**And D's value is not forced.** 46.10 was the largest card fitting 8 columns at 320; K2's floor serves 320 directly, so that constraint no longer binds the constant. The band admits up to 47.60 and R is flat inside it, leaving a one-dimensional trade between card size and setback. 46.51 keeps exactly the tolerance the old floor bought, on a larger card than 46.10. Recommended, but B remains shippable and the choice is the owner's.

### 5. [K2 SHIPPED] 320 is supported again

`@media (max-width: 332px) { :root { --gd-handcardw: 44px; --gd-handglyphw: min(2.75rem, 53px); } }`

Naming the shared token, not `--gd-cardw`, which drives none of the nine sites. The glyph basis has to follow the box down: the 58px cap is sized for a 48.15px card and would render ink 9.4% oversized over a 44px one, on the narrowest screen the game supports.

Verified at 320 after the change: containment PASS, 6 probes, desk title clean, joker staged on 2, **the capacity detector no longer fires**. At 333, the first width above the floor, also clean. The arc now has zero regressions at any supported width.

The brief's own reasoning for this is the part worth keeping: **"no cardW breakpoint" was a proxy for "do not make everyone pay for 320", and that goal is fully met by a floor at the bottom edge.** A proxy is not the objective.

**K2a.** The telemetry point is recorded and closed: the detector is a build-time gate, so J0's "ship and let it report who is at 320" would have reported nothing — but with the floor landed there is no longer anything to learn, and no telemetry should be built.

### 6. [K3] The folder's own contract broke on day one

`README.md` said `CURRENT.md` carries no measurement tables; `CURRENT.md` carried three. The rule was too blunt rather than wrong — a decision page that cannot show what it is choosing between forces a two-file read for the commonest question, which is the cost the folder exists to remove. The line now falls between **decision** tables (options against consequences) and **measurement** tables (quantity, n, configuration, validity range), with a test: no provenance columns in CURRENT, and every section carrying a table must link to VALIDATED or MODEL. It found two sections with no route on its first run.

`PLAN.md` is dropped from the entry document's load table. Its header still reads "M0 in progress" from 2026-07-13; it is accurate as architecture and is not a status document, and it now says so at the top.

`scripts/prepare-audit.mjs` closes the audit-tree hole: it refuses a dirty working tree, asserts the clone's HEAD and tree hash match the working tree's, optionally asserts the diff under audit is non-empty, and writes a fingerprint the report must echo. The failure it prevents produced four confident findings last round and did not error.

### 7. Open

The B-versus-D card choice is the owner's and is the only thing left on the card. Everything else in `CURRENT.md`'s work table is parked, downgraded or recorded-not-resolved, unchanged by this round.

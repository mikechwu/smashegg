> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## The remedy re-priced against the marginal bin; the registry was wrong on day one (2026-07-27, W9-W14)

### 1. [W9a CONFIRMED] The failure is one lattice bin, 7.1px deep

`slack = 664 - 156.5 (deskH, timed+staged) - 198.6 (K, following) - fanH = 308.9 - fanH`.
Verified against the raw n=120 log: **all 11 infeasible deals are exactly the deals at
fanH 316.0 (ten, slack -7.1) and 337.3 (one, slack -28.3)**. Nothing else failed.

So **7.1px removes 91% of the failure mass**; 28.4px removes all of it. The owner's
catch is upheld: reachability.md section 9.4's "the 20.3px cannot be found in spacing"
priced the remedy against the WORST OBSERVED hand at n=24 — a 1-in-120 event. Same
bound-versus-rate error the model made, applied to the remedy side.

### 2. [W9b] The remedy priced — and the lattice makes partial recovery worthless

| recovery | threshold | infeasible (model) | margin to nearest bin |
|---|---|---|---|
| none | 308.9 | 7.74% | — |
| seat-plate band, ~8px | 316.9 | **1.35%** | **0.9px** |
| fan->desk 10 + desk->actions 15 (25px) | 333.9 | **1.35%** | 17.9px, collapses Play/Pass onto the desk |
| both (33px) | 341.9 | 0.16% | 4.6px |
| **card scale to the 2.75rem floor** | **318.6** | **0.01%** | **4.8px** |

**25px buys exactly what 8px buys.** Between lattice steps extra pixels are wasted;
only crossing a boundary counts. This is a general property of the layout and it
should govern every future remedy proposal.

**Card-scale coefficients verified against the owner's estimate.** `d(fanH)/d(cardW) =
2*aspect + 0.42*(d1+d2-2)`: 4.58 px/px at the 252.1 bin, 5.84 at 316.0. The 6.7px of
travel to the floor saves **30.7px** and **39.1px** (owner estimated 31 and 36 —
confirmed). It also shrinks the desk's staged card row (threshold +9.7px) and raises
per-line capacity 9 -> 10, so the distribution changes rather than merely shifting.
**cardW 47 — a 7.3% reduction — already reaches 0.16%**, beating the full 33px of
spacing recovery without removing anything. The owner's "~10% buys ~45px" is closer to
**~37px** counting the threshold move; the conclusion holds, the figure does not.

**The 8px band alone is NOT enough** despite removing 91% of failures: 0.9px of margin
is under ordinary text-metric variation, and an en title that wraps costs 27px.

### 3. [W11] The axis registry was wrong on its first day

**The product default is ASCENDING** — `readHandSortDescending` returns true only when
localStorage holds `'desc'` (`GameTable.tsx:201`), so a fresh player is ascending. The
registry recorded `descending`, and **every one of the nine drivers copied the error**,
so each MATCHED the wrong default and the justification rule never fired.

**A registry with a wrong default silently excuses every driver that shares it.** That
is a new failure mode for this class and it was invisible to the checks built last
round. Corrected in the registry and all nine drivers.

### 4. [W12a] The registry now derives from the product surface

`gate-axes.test.ts` additionally: enumerates every persisted player preference the
client writes (`pref:handSort`, `pref:deckTheme`, `locale`, `pref:playerName`) and
requires each to map to a registered axis or to an explicit null-with-reason; and
cross-checks `productDefault` against the code that implements it (the `=== 'desc'`
comparison, and `DEFAULT_ROOM_TIMING`). Mutant-verified: reverting the default to
`descending` goes red, and adding an unregistered `pref:cardDensity` toggle goes red.

### 5. [W12c] G-SIM no longer pins UNTIMED

`measure-simultaneity.mjs` now defaults to the standard 45s/90s preset. Recording the
deviation as "justified" was what practice 26 says is not a fix. (The previous entry
said "three known gaps" while listing four drivers — corrected.)

### 6. [W13a] The W4 gate, run at last — and it passes on its pre-registered condition

Timed, 390x664, n=24, staged: panel **infeasible 1/24 = 4.2%** and **not-all-visible
1/24 = 4.2%**. The **feasible-but-not-shown gap is 0**, against 8.3% before (12.5% vs
4.2%). Containment PASS, 48 probes, 3306 element boxes.

**Residual, stated as a bound not a point (W9c):** the `minimal` profile shows 1/24
not-all-visible against 0/24 infeasible — a residual whose 95% upper bound at n=24 is
~20%. Not resolved; needs a larger n.

### 7. [W14b] The structural-worst-slack column is deleted

fanH = 465.1 needs two value classes at all 8 copies in one 27-card hand: **1 in
5.0 billion** (2.0e-10), ~25,000x rarer than the "<1 in 200,000" the simulation could
bound. Owner's order-of-magnitude estimate confirmed. The column sat beside the rates
and anchored remedy sizing twice.

### 8. [W14a] reachability.md corrected, and a mechanism so it cannot drift again

Section 9's rates, distribution table and desktop rows are marked WITHDRAWN in place
with a new section 10 carrying the corrections. New
`tests/unit/client/withdrawn-numbers.test.ts` fails if a withdrawn figure appears
anywhere under `docs/` outside a section that marks it withdrawn. Mutant-verified.
It immediately found a live 13.14% in METHODOLOGY.md that the round-3 corrections had
missed — the same "the fix lands where it was noticed" drift, caught by mechanism this
time.

**One exemption, on principle:** the pre-registration is immutable. Editing it to match
the outcome would destroy the only thing that makes it evidence, so it carries an
appended OUTCOME banner and is exempt by kind, not by convenience.

### 9. NOT REACHED — listed rather than dropped

- **W10** the held-out validation. The single-ordering refit is still a FIT on the
  discovery sample, not a validation. **The round-3 wording "7.65% is consistent with
  the measured 9.17%" is corrected in section 10.5**: that interval also accepts the
  13.14% that was rejected, so the defensible claim is the distribution match only.
- **W11's panel question** (is the sort toggle an affordance or an accident, ~5.5% of
  deals) — not sent to the lineages.
- **W12b** allowlist with owner and expiry; a `justification: "TODO"` still passes.
- **W13b** scroll-delta distribution, and the lexicographic sacrifice ordering.
- **W14c** 768's rate. **W14d** the capacity 14->15 bisection. **W14e** the rem-floor
  text-scale sweep.
- **W15/W2b** cinnabar-court and one-shelf G-SIM cells. **W2c**, **W5b**, **W6**, **W7**.

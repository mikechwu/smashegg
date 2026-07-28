> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Confirmed by construction — and cap 0.46 + spread 1.88 removes the baseline entirely (2026-07-27)

### 1. The diagnosis is now demonstrated, and my predicate was slightly wrong

Constructed pile depths 3→8 in-page (rather than waiting for a 3.89% hand) and
measured, phone 390×844, lacquer, no shelf:

| depth | fan height | Play doc | fits |
|---|---|---|---|
| 3 | 252.1 | 788.4 | yes |
| 4 | 273.4 | 809.6 | yes |
| 5 | 294.7 | 830.9 | yes |
| **6** | **316.0** | **852.2** | **NO** |
| 7 | 337.3 | 873.5 | no |
| 8 | 358.5 | 894.8 | no |

Exactly +21.3px per card, flipping at depth 6 — the within-page contrast the
diagnosis lacked.

**CORRECTION to my own predicate.** A second deal, constructed the same way,
passed at depth 6 (fanH 294.7) and failed at 7. So **the invariant is
`fanH > 307.8`, not "deepest pile ≥ 6"** — depth is the dominant term but the
rest of the hand contributes, so the depth at which a given deal crosses is
deal-dependent. The threshold on fan height is exact; the threshold on depth is
not. Consequently the failure rate is **not simply P(depth ≥ 6) = 3.89%** — it is
that plus deals whose other piles push them over, which is consistent with the
pooled 4/72 = 5.6% sitting above 3.89%.

### 2. The 536.2px offset is CONSTANT — swept, not asserted

The linchpin held across **all twelve configurations**: both themes × three
locales × shelf open/closed. Every single reading gave **536.2**.

| | lacquer | cinnabar-court |
|---|---|---|
| no shelf | fanH 273.4 → Play 809.6 | fanH 380.1 → Play 916.4 |
| one shelf | fanH 410.9 → Play 947.1 | fanH 517.6 → Play 1053.9 |

Identical in zh-Hant, en and zh-Hans. **Held fixed and NOT swept:** viewport
390×844, and the desk in its own-turn (loud) state — which is the only state in
which Play/Pass exists at all, so the scope is the meaningful one, but it is
stated rather than implied.

### 3. The owner's coupling catch was right, and re-deriving is much better than expected

The 1.68 candidate was derived from `1.68/4 = 0.42` — today's stripW exactly — so
the cap moving to 0.46 voids it. Re-derived against 0.46:

- depths ≤5 untouched → `spread/4 ≥ 0.46` → **spread ≥ 1.84**
- depth 6 must fit (`fanH ≤ 307.8`) → **spread ≤ 1.94**

Taking **spread = 1.88** and verifying by construction rather than arithmetic:

| depth | offset | fan height | Play doc | fits |
|---|---|---|---|---|
| 3 | 0.460 | 256.2 | 792.4 | yes |
| 4 | 0.460 | 279.5 | 815.7 | yes |
| 5 | 0.460 | 302.8 | 839.0 | yes |
| 6 | 0.376 | 304.9 | 841.1 | **yes** |
| 7 | 0.313 | 304.7 | 841.0 | **yes** |
| 8 | 0.269 | 304.9 | 841.2 | **yes** |

**Every depth fits. The phone's below-fold baseline goes to ~0 — the defect is
removed rather than targeted.**

And the cost profile is *better* than the owner's already-favourable framing:

| depth | share of deals | strip today | strip after |
|---|---|---|---|
| 3–5 | ~96% | 21.3px | **23.3px (BETTER)** |
| 6 | 3.6% | 21.3px | 19.1px |
| 7 | 0.26% | 21.3px | 15.9px |
| 8 | 0.011% | 21.3px | 13.6px |

**~96% of deals get a better strip; only the ~4% that currently fail the fold pay
anything, and they pay strip to gain Play on-screen.** Deep piles are already
exempt from the 44px press floor (the formula cannot reach it there), so that
range already ships at reduced strip quality.

Margin note: Play lands at 841.1 against an 844 fold — **2.9px**, which by this
project's own repeated lesson is not a margin. Spread 1.84 buys more (fanH 303
at every deep depth) and still satisfies both constraints; the value should be
picked for margin, not for the middle of the range.

### 4. On making the fold gate analytic

The owner is right that pass/fail is now computable, and right about the hazard:
**a model drifts more silently than a script, because it does not even have to
run.** So if the analytic path is adopted, both assumptions must be pinned as
tests — fan height linear in depth, and the 536.2 offset — with a periodic
empirical re-validation. Given the predicate correction above, the analytic form
is `fanH > 307.8`, and `fanH` itself still has to be measured or modelled from
depth AND column count.

### Not done

Cap + uniform derivation, the spread change, the analytic gate with drift
protection, and the elder session. Nothing was implemented this round.

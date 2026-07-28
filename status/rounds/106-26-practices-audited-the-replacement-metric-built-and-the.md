> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## 26 practices audited, the replacement metric built — and the base layout PASSES (2026-07-27)

### 1. The practice-26 sweep: 0 of 26 practices are fully enforced

Its own diagnostic — *"if this finding is real, what currently-passing thing should
now fail?"* — run across all 28 entries (26 at the time), seven agents, every
citation a file and line.

| grade | count | meaning |
|---|---|---|
| ENFORCED | **0** | — |
| PARTIAL | 19 | a mechanism exists on one axis and not another |
| UNENFORCED | 7 | practices 1, 3, 5, 6, 7, 9, 10 — nothing fails at all |

**Disclosure that matters for reading this:** the rubric told the auditors to
prefer PARTIAL whenever coverage was uneven, so the boundary is deliberately
conservative and "0 ENFORCED" is partly a grading choice. The distinction that
survives that bias is UNENFORCED vs has-some-mechanism, and the recurring shape
underneath it, which is not a grading artifact:

**the fix lands in the file where the finding was written, and not in its
siblings.** That is practice 26 one level up, and three live instances were
confirmed by reading the code, not by trusting the report:

- **`measure-fan-tap-targets.mjs` hardcoded `390x844` at two `newContext` sites**
  — directly beneath its own comment saying a 390x844 *screen* presents ~664 of
  inner height. The REQUIRED gate for any fan change, measuring a fan the phone
  never renders, with the correction written above it. `measure-fold.mjs` got the
  fix; its sibling did not.
- **The theme-coverage test was satisfied by PROSE.** `stripComments` stripped
  only `/* */`, so `FOLD.includes('@cinnabar-court')` was matched by the `//`
  line *saying* cinnabar-court had no baseline. The test written to replace "a
  list someone must remember to update" was itself passing on a sentence — and
  the theme it was protecting is the one with the 95.8% defect.
- **G-FOLD's rate comparison is printed and never enforced**; an unbaselined
  scope prints "this is not a pass" and exits 0.

**Fixed, and each fix mutant-tested rather than cited (practice 13):**
`TAP_W`/`TAP_H` required with no default (exit 2, verified); the theme check now
demands **syntax** — a key matching `'<W>x<H>@<theme>':` — with absences recorded
as `null` in code; the void phone baseline carries `void: true` + `voidReason` in
the data and the gate **exits 4** rather than reporting against it. Four new tests
assert that *no* gate script hardcodes a viewport, *none* supplies a fallback
dimension, and *all* print the chrome assumption. Re-adding `FOLD_H ?? 844` goes
red; demoting the cinnabar key to a comment goes red. 1265 tests green.

One nuance the new test surfaced immediately: `check-containment.mjs`'s driver
page is legitimately fixed-size. Rather than exempt it in the test, it became a
named `DRIVER_VIEWPORT` constant — an exemption is a hole someone later widens, a
named constant is a hole with a label on it.

### 2. [CATCH accepted] "Collapsed-44 is free" was reasoning in a vacuum

The owner is right and the claim is withdrawn. It argued from a metric declared
void, and a void metric prices nothing. The 20px did not vanish — it moved from
the fold ledger to the simultaneity one. Recorded as **METHODOLOGY practice 27**,
with the owner's general rule: *when a metric is retired, every decision taken on
it is OPEN, not resolved.* Its positive half is the owner's other observation —
a replacement can make previously incomparable options comparable — with one
qualification the panel supplied: overlay and collapsed share a currency only
while the overlay leaves Play/Pass live underneath.

### 3. [VERIFY FIRST] The base case, measured — and the answer is the opposite

`scripts/simultaneity.mjs` + `measure-simultaneity.mjs`. The structural core:
`slack = innerH - span`, where span is the union DOCUMENT extent of the must-see
facts. Negative slack means **no** scroll offset works, which is derivable rather
than sampled (practice 14). Grok derived the same test independently.

**The definition decides the verdict, so the instrument reports three of them**
(new practice 28). Asked the question blind, Codex and Grok both **excluded** the
team level badges and the seat counts the in-house set called critical, and both
**included** the play desk the in-house set had missed entirely.

Worst-case slack, lacquer, no shelf:

| inner | in-house | panel (Codex + Grok) | n |
|---|---|---|---|
| 390x664 | **-113.2px**, infeasible 87.5% | **+55.0px**, 0% | 24 |
| 390x748 | -50.5px, infeasible 33.3% | +117.7px, 0% | 24 |
| 1366x681 | +26.3px, 0% | +179.1px, 0% | 16 |
| 1440x813 | +158.3px, 0% | +311.1px, 0% | 16 |

**The base layout PASSES under the panel definition**, with 55px to spare at 664.
The predicted failure — ring and well cut off at the top — is not what happens:
the scroll pulls the well and desk *into* view. What it trades away is `levels`
(24/24) and `counts` (12/24), which is precisely the pair both lineages had
already excluded. An early 3-deal in-house reading suggested a catastrophic base
failure; at n=24 under the converged set it is clean.

**The shelf is the real casualty.** One open set-aside costs ~137px of span
against 55px of slack: at 390x664 the shelf state is infeasible on **58.3%**
[38.8, 75.5] of deals under the panel set, and 70.8% cannot show the decision at
the settled scroll. The fold metric scored base and shelf identically at 100%.

### 4. Desktop re-checked at the realistic floor — rung 0 survives

At **1366x681** (maximized on a 1366x768 laptop, worse than the 1024x768 rung 0
was validated at) the layout passes under **every** definition, 0/16. Carried as
"likely survives"; now measured. **Thin-margin note:** +26.3px under the strictest
set is a worst-observed value over n=16, not a structural minimum.

### 5. G-SIM added; G-FOLD void for phone, live for desktop

PLAN.md section 9. Slack has a gradient in pixels where the fold rate is saturated
at 100%: the 24->44px indicator costs **exactly +20px of span**, derivable. So it
fits the base layout (35px left) and worsens an already-failing shelf state — the
decision depends on the shelf work, not on the indicator. Pass/fail is gated on
the WEAKEST profile until the owner rules, because failing that cannot be argued
away by re-litigating the set.

Full write-up: `docs/research/reachability.md`. Panel artifacts:
`docs/research/proposals/reachable-{brief,A-codex,B-grok}.md`.

### 6. Open, and needing the owner

- **D1: which must-see set does G-SIM gate on?** Adopting the panel set means
  accepting a decision made without the level badges on screen. It changes the
  base verdict from *passes with 55px* to *fails 87.5%*. Not mine to rule.
- **D2/D3:** collapsed height and overlay-vs-collapsed, re-derived above.
- **The elder session** now blocks three of the four replacement properties, not
  one decision: whether the player perceives the view moved, whether anything
  moves under a finger, and absolute legibility. Both lineages named the same
  class independently.
- Still open five-plus rounds: the collapsed indicator must answer *"N cards set
  aside"*, not merely "tappable here".
- METHODOLOGY practices renumbered into numeric order (they had run 1-20, 26, 24,
  25, 23, 21, 22); no wording changed by the reorder.

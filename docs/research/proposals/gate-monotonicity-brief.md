# Brief: a geometric gate that rewards the worse option

You are advising on the DEFINITION of a decision gate, not on its implementation. Answer as
a measurement-design reviewer. **Do not modify any files** — produce a report only.

Tooling note: Firecrawl is disabled (credit limit reached 2026-07-13). Do not attempt to use
it. Web search is off for this run; reason from the repository and from first principles.

## The system, in the smallest terms that make the problem visible

A card game renders the player's 27-card hand as a fan of columns, one column per value
class, wrapped onto two lines. A column of `d` cards is drawn as a stack whose height grows
with `d`. The quantity that decides whether the player can see everything at once is the
fan's HEIGHT, and that depends on the hand only through `s = d1 + d2`, the summed depth of
the deepest column on each of the two lines.

Two derived quantities, both in `status/MODEL.md` (generated from `status/model.json`):

- `T(w) = 455.9 - 2.90w` — the tallest fan that still fits, at card width `w`.
- `fanH(s, w) = 19.9 + 2*aspect*w + 0.42*w*(s - 2)` — the fan's height for depth `s`.
- `margin(s, w) = T(w) - fanH(s, w) = 436.0 - c(s)*w`, where `c(s) = 4*aspect + 0.42*(s-2)`.

Because `margin` is linear in `w` with a per-`s` coefficient, the **marginal bin** — the
largest `s` that still fits — is a STEP FUNCTION of `w` alone, independent of viewport
width. Measured band edges:

| marginal bin | card width band |
|---|---|
| 11 | w <= 45.52 |
| 10 | 45.52 < w <= 47.60 |
| 9 | 47.60 < w <= 49.89 |
| 8 | 49.89 < w <= 52.41 |

`R(0)` is the modelled probability that a dealt hand's `s` exceeds the marginal bin, i.e.
the failure rate. It is a validated model: pre-registered and confirmed against held-out
data for bins with expected count >= 5, which is `s <= 9`.

## The defect

The shipped gate is:

    margin(marginal bin, w) >= 10px   AND   margin(s=9, w) >= 0   AND   capacity >= 8

At viewport width 360, the value shipped last round and the value it replaced compare like
this:

| | card width | marginal bin | margin | R(0) modelled |
|---|---|---|---|---|
| previous | 46.80 | 10 | **7.37px — fails the 10px floor** | **0.15%** |
| shipped | 48.15 | 9 | **15.23px — passes** | **1.78%** |

**The gate prefers the option with roughly twelve times the failure rate.** The proposed
diagnosis: `margin` measures the SLACK OF THE MARGINAL BIN ITSELF, while `R` measures the
PROBABILITY MASS ABOVE it. Growing the card pushes the marginal bin down one index, which
simultaneously increases that bin's own slack and increases the mass sitting above it. So
`margin` is not merely a weak proxy for `R` — over a band boundary it is anti-correlated
with it. The third term, `margin(s=9) >= 0`, bounds only the extreme and says nothing about
the gradient.

The proposed fix is to add a term on the marginal bin's INDEX: require `marginal bin >= 10`,
equivalently `w <= 47.60`. This is pure geometry, width-independent, and uses only bins the
held-out test validated.

## Read before answering

`status/MODEL.md`, `status/VALIDATED.md`, `scripts/cardw-gate.mjs`,
`scripts/fan-height-distribution.mjs`, and `docs/research/METHODOLOGY.md` practices 14, 16,
25 and 28.

## Questions

**Q1. Is the diagnosis right?** Is the anti-correlation real and is it stated correctly, or
is there a different mechanism producing the same table? Say what you would check.

**Q2. Is a bin-index term the right fix, or a patch that happens to work here?** In
particular: it is chosen so that it excludes the currently shipped value. Argue both that
this is principled and that it is post-hoc, then say which you believe. If a bin-index term
is right, is `>= 10` the right threshold or is that also fitted?

**Q3. Is there a formulation that measures the intended thing directly** — the probability
mass above the marginal bin — without gating on an unvalidated model tail? Earlier rounds
removed `R` from the gate specifically because discriminating 0.08% from 0.74% granted a
precision two orders below the smallest validated bin. A term that reintroduces `R` by the
back door would repeat that. Is "bin index" the honest ordinal form of `R`, or is it a third
thing?

**Q4. What else does `margin >= 10px` reward that it should not?** The 10px floor was
introduced as a manufacturing tolerance. Given the step structure, does a floor on the
marginal bin's slack have any defensible meaning at all, or should it be replaced rather
than supplemented?

**Q5. What would you NOT do here.** Name the part of this you think is over-engineered or
wrong, and what you would do instead. We would rather hear that than agreement.

## Report format (mandatory)

Markdown, sections `## Q1` … `## Q5`, then `## Checked clean` listing what you examined and
found no problem with. End with a literal final line:

`GATE VERDICT: <N> recommendations`

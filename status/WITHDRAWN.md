# WITHDRAWN

> **Answers:** which figures and claims have been retracted, and what replaced each.
> **Before quoting any number from a round file, check here.** The values now in force:
> `MODEL.md`. What they are good for: `VALIDATED.md`.

This is the **registry**, not a note. `tests/unit/client/withdrawn-numbers.test.ts` parses
the table below and fails if any pattern appears on a line of a mutable document without a
withdrawal marker on it or in its enclosing section. It lived inside the test file until
2026-07-28; a human owner and a fresh agent both need a document rather than a fixture, and
leaving the only copy in Vitest reproduces the original drift in reverse — tooling knows,
docs do not.

**Citing a withdrawn figure is allowed and often necessary** — provenance matters and
deleting history makes the record unreadable. It is allowed on a line that says it is
withdrawn.

## Scope

| in scope | out of scope, and why |
|---|---|
| `docs/**` | `docs/research/prereg-*.md` — a pre-registration is immutable by construction; its outcome is appended in a banner, never edited in |
| `status/*.md` (the live files) | `docs/research/proposals/**` — panel artifacts are RECEIVED verbatim from another lineage and are only evidence because they are unedited |
| `PLAN.md` | `status/rounds/**` — history, moved verbatim and never edited (see `rounds/INDEX.md` for the hash that pins it) |

The `status/rounds/**` exemption is the same *kind* as the pre-registration one: a document
whose value depends on not being rewritten. It has a cost, stated rather than hidden — an
agent reading a raw round file will see live-looking wrong numbers, and the protection
against that is the pointer block at the top of every round file plus the two-file load
discipline in `README.md`, not a scanner.

## Registry

Each row's `pattern` is a JavaScript regular expression source, parsed from this table.

| pattern | what it was | replaced by |
|---|---|---|
| `cannot be found in spacing` | the claim that the deficit cannot be recovered from spacing | It priced the remedy against the WORST OBSERVED hand at n=24 (20.3px) rather than the marginal bin (7.1px), which ~8px of seat-plate band does reach. |
| `extra pixels buy nothing` | the claim that intermediate recovery buys nothing | It contradicted its own margin column: extra pixels buy no RATE improvement between lattice steps, but they do buy MARGIN. |
| `sort choice \*?decides\*? feasibility.{0,40}5\.5` | attributing the sort-choice-decides share to 5.5% | The symmetric difference is 9.27%. 5.42% is "descending has COST the player feasibility"; 3.85% is "the default failed and toggling would rescue". |
| `13\.14\s*%` | the modelled 13.14% infeasible rate at inner 390x664 | Measured 9.17% [5.2, 15.7] at n=120. The model scored each deal at the taller of its two sort orderings, which is right for a bound and wrong for a rate. |
| `structural worst slack` | the "structural worst slack" column | The marginal-bin deficit. The 465.1px case needs two value classes at all 8 copies in one 27-card hand: 1 in 5.0 billion. It anchored remedy sizing twice. |
| `1 deal in 8\b` | "1 deal in 8", the headline drawn from 13.14% | Measured 9.17%, i.e. roughly 1 deal in 11 — and only among FOLLOWING turns. |
| `K 125\.1.*Also exact` | the claim that K's decomposition has zero residual | Its parts sum to 125.0 against a stated 125.1: the residual is **0.1px**, not 0. Found by putting the parts and the total in one machine-checked place (`status/model.json`). The 0.1px moves no decision; the word "exact" was the problem. |

## What does not belong here

A **scoping caveat is not a withdrawal**, and putting one here would both produce false
positives and dilute what a row means. "-5.0% of card" is a correct figure at width 390 and
a wrong one as a statement about phones generally (the constant is +2.9% at 360 and -13.9%
at 430) — that is a range that must travel with the number, so it lives in `MODEL.md` and
`VALIDATED.md`, not in a retraction list. Rows here are for claims that are **wrong**, not
claims that are **narrower than they sound**.

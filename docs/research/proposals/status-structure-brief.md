# Brief: restructure a 7,900-line append-only STATUS.md into a folder

You are advising on the information architecture of an engineering repository's research
record. Answer as a documentation-architecture reviewer, not as a coder. **Do not modify
any files** — produce a report only.

Tooling note: Firecrawl is disabled (credit limit reached 2026-07-13). Do not attempt to
use it. Web search is disabled for this run; reason from the repository and from your own
knowledge of documentation practice.

## The situation

- `STATUS.md` is **7,895 lines**, one `## ` section per round, **reverse-chronological**
  (newest at the top). Roughly 25 rounds.
- A reader — human owner, or an AI agent starting a fresh session — needs the **top one or
  two entries**. The remaining ~7,000 lines are loaded, or grepped, on every single round.
- `PLAN.md` (470 lines) is a signed-off architecture plan, separate and stable.
- `docs/research/*.md` hold per-topic research; `docs/research/METHODOLOGY.md` holds 33
  numbered practices; `docs/research/proposals/*.md` hold external-lineage answers.
- History here is **immutable by convention**: an old entry records what was believed at
  the time, including things later withdrawn. Retro-fitting corrections into old entries
  would destroy the record.

## What the owner has already decided (these are constraints, not options)

1. **A canonical MODEL file is the single highest-value artifact.** Quantities like
   `T(w) = 455.9 - 2.90w`, `fanH(s, w)`, decomposed constants (deskH 83.0 = 27+4+24+12+14+2;
   K 125.1 = 59+10+15+41), `capacity = floor((W - 48.0 - 0.3w) / (0.7w))`, the card aspect
   1.45, and a segment structure over cardW **have no authoritative location today**. They
   are scattered across five rounds' tables and get re-derived by grep every round.

2. **Generate it, do not write it.** A `model.json` consumed by both the scripts and the
   doc build makes drift impossible, and turns "claims must match code" from a convention
   into a mechanism.

3. **A VALIDATED file, one line per quantity**: measured or modelled, n, configuration, and
   the range over which it was validated. Three recurring error classes — a sampled bound
   worded as structural, a model tail used as a gate, a constant measured in one pinned
   configuration — are all the same missing field.

4. **CURRENT**: what is decided, what is open, what blocks what. One page, always true.

5. **WITHDRAWN, folder-wide.** A retracted figure once survived in `METHODOLOGY.md` after
   being withdrawn in STATUS. A scanner's scope must be the whole folder.

6. **Round files are append-only and moved VERBATIM.** The split must not become a rewrite.

7. **Every file opens with a pointer line**: what it answers, and where deeper detail
   lives. That is the property that lets a reader load two files instead of seven.

## What we want from you

Read `STATUS.md` (at least its top ~400 lines and a sample of older entries),
`docs/research/METHODOLOGY.md`, `tests/unit/client/prose-figures.test.ts`, and
`tests/unit/client/withdrawn-numbers.test.ts`. Then answer:

**Q1. The file tree.** Give the concrete structure: exact paths and filenames, and one
line each on what question that file answers. Say explicitly which TWO files a fresh
reader loads for (a) "what is the state of the project", (b) "what is the value of
constant X and can I trust it", (c) "why was decision D made".

**Q2. Where the seam falls between MODEL, VALIDATED and CURRENT.** These three overlap.
A constant has a value (MODEL), a provenance and validity range (VALIDATED), and may be
load-bearing for an open decision (CURRENT). Where exactly do you cut, and what is the
rule that keeps a future writer from putting a fact in the wrong one?

**Q3. The generated-file boundary.** If `model.json` is the source of truth and a prose
doc is generated from it, what is the failure mode of generated documentation, and how
should the generated/hand-written boundary be marked so a human never edits the generated
half? Consider that some of the model's constants carry multi-sentence provenance
paragraphs that are genuinely prose.

**Q4. The scanner's new scope.** Today a test asserts "every px/% figure in prose is
backed by a table in the same section", scoped to the TOP entry of STATUS.md only, with a
17-entry allowlist at its ceiling. After the split, what should the scope be? Note that
round files become immutable history — a scanner that checks them all will either freeze
forever or force retro-edits that constraint 6 forbids. Give the rule, and say what it
costs.

**Q5. What you would NOT do.** Name the parts of this plan you think are wrong or
over-engineered, and say what you would do instead. We would rather hear this than a
polished agreement.

## Report format (mandatory)

Markdown. Sections `## Q1` … `## Q5`. Then a section `## Checked clean` listing what you
examined and found no problem with. End with a literal final line:

`STRUCTURE VERDICT: <N> recommendations`

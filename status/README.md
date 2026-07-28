# status/ — the research record

> **Answers:** which two files to open for which question. Read this one first and then
> exactly two more; that is the property this folder was built for.

The root `STATUS.md` was 7,895 lines in reverse-chronological order, and a reader needed
the top one or two entries. The other 7,000 were loaded or grepped every round, by a human
owner and by every fresh agent session. The split exists to make that cost optional.

## Load two files, not seven

| Your question | File 1 | File 2 |
|---|---|---|
| What is the state of the project? | `CURRENT.md` | `../PLAN.md` |
| What is the value of constant X, and can I trust it? | `MODEL.md` | `VALIDATED.md` |
| Why was decision D made? | `CURRENT.md` (it cites the round) | `rounds/<that round>.md` |
| Is this figure I found still live? | `WITHDRAWN.md` | `VALIDATED.md` |
| How do we work — what are the practices? | `../docs/research/METHODOLOGY.md` | — |

**Do not load `rounds/` by default.** It is the transcript. `rounds/INDEX.md` is the way
in when `CURRENT.md` names a round or the question predates it.

## What each file is

| file | speech act | contains | does not contain |
|---|---|---|---|
| `CURRENT.md` | *"we will / will not / cannot yet"* | Decided, open, blocked. Owner decisions still pending. One page, always true. | Formulas as authority; measurement tables; long provenance |
| `model.json` | machine source of truth | Values, formulas, decompositions, and for each one the file and literal where it physically lives | Prose provenance; anything a script would not import |
| `MODEL.md` | *"the system uses…"* | **Generated** from `model.json`. Never edit it. | Evidence, n, ranges, open questions |
| `VALIDATED.md` | *"we may use this because…"* | One row per quantity: measured or modelled, n, configuration, validity range | The formulas themselves; open decisions |
| `WITHDRAWN.md` | *"do not quote this"* | The registry of retracted figures and claims, and what replaced each | Scoping caveats — a narrow figure is not a wrong one |
| `rounds/*.md` | historical belief | What was believed and decided in one round, verbatim | Anything edited after the fact |

## Where does a new fact go?

Three questions, in order. If two answers are yes, **split the sentence** rather than
picking one.

1. Would a script import this to compute a layout quantity? → `model.json` (then
   regenerate `MODEL.md`).
2. Would a reader need the n, the configuration or the range to know whether quoting it is
   honest? → `VALIDATED.md`.
3. Would deleting this sentence change what we do next week, rather than what the geometry
   *is*? → `CURRENT.md`.

Never promote a validity range into `MODEL.md` prose by calling it "structural" to avoid
writing a row. Never park an open decision in `VALIDATED.md` as a note. Never re-derive a
constant in `CURRENT.md` because `MODEL.md` felt far away — link the id.

## The mechanisms, so none of this depends on discipline

| property | enforced by |
|---|---|
| `MODEL.md` matches `model.json` | `tests/unit/client/model-drift.test.ts` runs `scripts/gen-model.mjs --check`; a hand-edit is red |
| `model.json` matches the CODE | the same test asserts each entry's `source.literal` is still present in the file it names, and that a perturbed literal is *not* — so the search discriminates |
| A retracted figure does not reappear | `tests/unit/client/withdrawn-numbers.test.ts` parses `WITHDRAWN.md` and scans every mutable doc |
| A prose figure has a table behind it | `tests/unit/client/prose-figures.test.ts`, scoped to the mutable live files |
| History is not edited | `tests/unit/client/status-structure.test.ts` pins the SHA-256 of the concatenated round bodies |

## Rounds

118 files, one per `##` section of the former `STATUS.md`, moved **verbatim** and numbered
oldest-first. Each opens with a pointer block saying it is history and what to check before
quoting it. See `rounds/INDEX.md`.

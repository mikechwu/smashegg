> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## J0-J3 audit response: six findings, all adopted

**Routing.** The J0-J3 change was produced in-house, so it was audited by **Codex** — the mechanical/invariant lineage, which is the right one for cascade resolution, arithmetic reproduction and "name a blind spot in this mechanism". Grok had already taken J1's design question and could not audit the structure it proposed. Artifacts: `docs/research/proposals/j0-audit-{brief,codex}.md`.

**A void first attempt, recorded because it is the cheaper lesson.** The first audit run cloned `file://$PWD`, which clones **HEAD** — and the change was staged, not committed. Codex therefore audited the pre-change tree and returned four HIGH/MED findings all of the form "the described change is not present". The one useful thing it produced was independent arithmetic from the brief alone, which reproduced every capacity ceiling. **An auditor pointed at the wrong tree returns confident findings, not an error**, and the only tell was that all four said the same thing. Clone from the committed state, or check the auditor's HEAD before reading its verdict.

### The six findings, and what each cost

| # | severity | finding | adopted as |
|---|---|---|---|
| 1 | MED | `CURRENT.md`'s "one-line alternative" for width 320 named `--gd-cardw`, which after this round's own token migration drives **none** of the nine sites. The fix as written would not have worked. | The note now names `--gd-handcardw`, and the two "what shipped" rows were corrected the same way. |
| 2 | LOW | The CSS comment's `15.23px` margin is the figure the SCRIPTS produce (aspect 1.44970); at the authoritative CSS aspect 1.45 it is `15.17px`. | The comment now gives both and says which is which. This is the `aspect` disagreement the model already records, showing up where it was predicted to. |
| 3 | MED | `model-drift` checked CONSTANTS only. Changing `0.7 * w` to `0.8 * w` in `capacityFor` leaves every constant literal in place and makes `MODEL.md`'s capacity formula silently wrong. | Every formula in `model.json` now names the code fragment implementing it, checked the same way — with the same perturbation guard. |
| 4 | LOW | The history hash lives in `rounds/INDEX.md`, which is mutable, so editing a round and updating the hash in one commit passes. It enforced "matches the current manifest", not immutability. | A second pin: the **migration baseline** for rounds 001-118, hardcoded in the test rather than in a document, which no append can change and no manifest update can launder. |
| 5 | LOW | The withdrawn-registry parser silently skipped rows it could not parse. | An unparseable row is now an error — a registry row that stops parsing stops protecting anything, invisibly, which is this mechanism's own failure shape one level up. |
| 6 | MED | `prose-figures` says "in the same section" and was comparing against the two live files **concatenated**, so a stale figure in CURRENT could be backed by an unrelated row in VALIDATED. | Split per file and per `## ` section, as the name always claimed. **It immediately found seven orphans the concatenated version had passed**, all of them real. |

Finding 6 is the one worth dwelling on: the scanner had been re-scoped in the same round that split the files, and the re-scoping quietly widened what counted as "the same section" from one entry to two whole documents. The test name did not change and stayed true-sounding. Nothing else in the suite could have caught that.

### What the audit checked clean, which is the other half of it

Codex independently reproduced the five capacity ceilings, the 332.1px crossover, the per-width capacities at the shipped card, `T(48.15) = 316.265`, and that `3.009375rem` is exactly `48.15px` at root 16. It walked the cascade for `--gd-handcardw` and `--gd-handglyphw` and found no resolution error, confirmed the token is used at exactly nine sites in `table.css`, confirmed trick/mini/ghost keep the default glyph basis, and confirmed `--gd-pipw` drives only the pip's size while its position and the wild seal's clearance stay on the box basis.

It also named a behaviour rather than a bug: below root 16px the ink shrinks below the fixed box, since `min()` has no lower bound. That is intended — a user who reduces text size gets smaller card text — and it is now stated rather than implied.

### Open, unchanged by this round

The two owner decisions from J0-J3 stand: whether to keep 320 (the constant withdraws support that today's rem floor provides), and that the compact-mode feedback loop described in the brief does not exist, because the capacity detector is a build-time gate and the client carries no telemetry.

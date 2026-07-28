I'll review the existing research-record layout and the two figure/withdrawn scanners first, then produce the architecture report only.Next I'll sample older STATUS rounds and read METHODOLOGY plus the model-related research docs for how constants are currently recorded.Checking how scripts hold model constants and how older STATUS entries are structured so the seam recommendations stay concrete.# Documentation architecture review: splitting STATUS.md

Review stance: information architecture only. No files modified.

Evidence base: top ~400 lines of `STATUS.md` (I0–I4 through F0–F5), samples of E1 / C0–C5 / Round 1 / milestone tracker (~25 `##` sections, 7,895 lines, reverse-chronological); `PLAN.md` header + layout; `docs/research/METHODOLOGY.md` (practices 1–33); `docs/research/reachability.md` header (withdrawal banners); `scripts/cardw-gate.mjs` (hardcoded `ASPECT`, `K_MINUS_CARD=125.1`, `ROW_CHROME=48.0`); `tests/unit/client/prose-figures.test.ts`; `tests/unit/client/withdrawn-numbers.test.ts`.

---

## Q1

### Recommended tree

Keep `PLAN.md` at repo root (signed-off, stable). Replace the single `STATUS.md` with a root-level `status/` folder so the PLAN/status pairing survives, and leave `docs/research/*` as topic research (not round logs).

```
status/
├── CURRENT.md                 # decided / open / blocked — always true
├── model.json                 # machine source of truth for quantities + formulas
├── MODEL.md                   # GENERATED from model.json — nominal model a human can read
├── VALIDATED.md               # one row per quantity: provenance + validity range
├── WITHDRAWN.md               # folder-wide registry of retracted figures/claims
├── README.md                  # map of this folder; load order for fresh sessions
└── rounds/
    ├── INDEX.md               # reverse-chron TOC; one line per round + one-line outcome
    ├── 2026-07-27-I0-I4.md    # verbatim former ## section
    ├── 2026-07-27-H0-H3.md
    ├── …                      # one file per former ## heading, moved not rewritten
    └── 2026-07-13-round-1.md
```

**Root stub (optional but useful):** a short `STATUS.md` that only says “moved to `status/`” and points at `status/CURRENT.md` + `status/README.md`. That preserves old mental paths and agent habits without reloading 7,900 lines.

| Path | Answers |
|---|---|
| `status/README.md` | Where do I start, and which two files for each common question? |
| `status/CURRENT.md` | What is decided, open, and blocked *right now*? |
| `status/model.json` | What numbers/formulas do scripts and the doc build import? |
| `status/MODEL.md` | What is the current geometric/layout model in prose tables (generated)? |
| `status/VALIDATED.md` | For quantity X, measured or modelled, under what config, over what range, with what n? |
| `status/WITHDRAWN.md` | Which figures/claims must never be re-quoted as live, and what replaced them? |
| `status/rounds/INDEX.md` | Which round decided what, in reverse chronological order? |
| `status/rounds/<id>.md` | What was believed and decided in that round, including later-wrong claims? |
| `PLAN.md` (unchanged) | What is the signed-off product/architecture plan? |
| `docs/research/METHODOLOGY.md` | What research practices govern how we measure and record? |
| `docs/research/<topic>.md` | What is the deep research on topic T? |
| `docs/research/proposals/*` | What did an external lineage answer (received verbatim)? |

### Pointer line (constraint 7)

Every file in `status/` opens with one or two lines of the form:

> **Answers:** \<question\>. **Deeper:** \<path\>. **Do not quote numbers from rounds without** `WITHDRAWN.md` / `VALIDATED.md`.

Example for a round file:

> **Answers:** what was believed and decided in I0–I4. **Historical.** Check `../WITHDRAWN.md` before quoting any figure. Live state: `../CURRENT.md`.

### Fresh reader: exactly two files

| Question | File 1 | File 2 |
|---|---|---|
| **(a)** What is the state of the project? | `status/CURRENT.md` | `PLAN.md` |
| **(b)** What is constant X, and can I trust it? | `status/MODEL.md` (or `model.json` if you are code) | `status/VALIDATED.md` |
| **(c)** Why was decision D made? | `status/CURRENT.md` (which must cite the round id) | `status/rounds/<that-id>.md` |

Do **not** tell a fresh session to load `STATUS.md`, `reachability.md`, or “the last five rounds.” Those are how the 7,000-line tax returns.

`rounds/INDEX.md` is the escape hatch when CURRENT’s citation is missing or the decision is older than CURRENT’s horizon — not a default load for (a)/(b).

---

## Q2

These three overlap because a constant is simultaneously a **value**, a **claim about evidence**, and sometimes a **load-bearing premise of a decision**. Cut on *speech act*, not on subject matter.

### The cut

| File | Speech act | Contains | Does not contain |
|---|---|---|---|
| **MODEL** | “The system uses…” | Named quantities, formulas, decompositions, units, symbols (`T(w)`, `fanH(s,w)`, `capacity(W,w)`, aspect, segment structure over `cardW`, deskH/K part sums as *definitional* identities) | n, intervals, viewport pins, “open”, “owner must choose”, withdrawal history |
| **VALIDATED** | “We may use this *because*…” | One line (or tight row) per quantity: `id`, status (`measured` / `modelled` / `structural` / `unvalidated-tail`), n, configuration (viewport, timed/untimed, sort, staged…), validity range (widths, locales, states), pointer to round or script | The formula itself (cite MODEL id); open decisions; narrative arc of discovery |
| **CURRENT** | “We will / will not / cannot yet…” | Decided, open, blocked-by; owner choices still pending; which MODEL ids a decision depends on | Restating `T(w)=…` as authority; measurement tables; long provenance |

### Worked example (your constants)

- **MODEL:** `deskH_parts = {titleRow:27, bar:4, …}` summing to `83.0`; `K_parts` → `125.1`; `aspect = 1.45`; `capacity = floor((W - 48.0 - 0.3w)/(0.7w))`; `T(w) = 455.9 - 2.90w` if that is still the working threshold form; segment boundaries as model objects.
- **VALIDATED:** row for `row_chrome=48.0`: measured, four widths, residual 0.04px, range *this* chrome model; row for `R(0)` at today’s card: measured ascending n=…, measured descending holdout, *modelled* counterpart marked `unvalidated-tail` where appropriate — the three recurring error classes (sampled bound as structural; model tail as gate; constant from one pinned config) are all “VALIDATED row missing or mis-tagged,” not “wrong MODEL file.”
- **CURRENT:** “constant vs breakpoint is the owner’s”; “G2: 320/430 not swept”; “F5b improvement withdrawn as *effect claim*, fix still correct where joker staged” — decisions and blocks, citing VALIDATED ids when the block is “not validated outside config C.”

### Rule that keeps a future writer honest

**One question test before writing a sentence:**

1. Would a script import this to compute a layout quantity? → **MODEL** (`model.json`).
2. Would a reader need n, config, or range to know whether citing it is honest? → **VALIDATED**.
3. Would deleting this sentence change what we do next week, not what the geometry *is*? → **CURRENT**.

If two answers are yes, **split the sentence**: value in MODEL, evidence in VALIDATED, implication in CURRENT. Never “promote” a VALIDATED range into MODEL prose (“structural”) to avoid a row. Never park an open decision inside VALIDATED as a note. Never re-derive a constant in CURRENT because MODEL felt far away — link the id.

**Stale-CURRENT rule:** when a VALIDATED status changes (e.g. unvalidated tail → held-out), CURRENT must be edited the same change-set if any open item depended on the old status. MODEL only changes when the *working* formula or nominal value changes.

---

## Q3

### Failure mode of generated documentation

Generated docs do not fail by being slightly wrong; they fail by **looking authoritative while being orphaned or double-sourced**.

Concrete failure modes for this repo:

1. **Edit the pretty file.** Someone “fixes” `MODEL.md` after a measurement; next generation or next agent overwrites it, or CI never regenerates and prose/code diverge the other way.
2. **Two truths.** `model.json` says 1.45, `table.css` still has `1.45`, `cardw-gate.mjs` still has `73.5/50.7`, and MODEL.md is generated from only one of them. Generation without a single import path is theatre (practice 26 / 29 shape: the record of a source of truth without the mechanism).
3. **Prose-shaped metadata in the wrong layer.** Multi-sentence provenance (“bar=4 is timed-only; remove bar+gap → 148.5 untimed”) is not a JSON number. Stuffing essays into `model.json` makes the machine file unreadable; leaving them only in generated markdown makes them uneditable without regeneration hacks.
4. **Silent skip.** Generation is a manual script; one round updates `model.json` and forgets to run it → MODEL.md lies.
5. **False completeness.** Generated MODEL lists every key; readers treat absence of a VALIDATED row as “fine” because the number looked official in MODEL.

### Boundary design

**Hard split: numbers/formulas vs evidence narrative.**

| Layer | Authority | Edit by hand? |
|---|---|---|
| `model.json` | Scripts + doc build | Yes (with schema / tests) |
| `MODEL.md` | None — pure projection | **Never** |
| `VALIDATED.md` | Human evidence ledger | Yes |
| Round files | Historical belief | No (append-only new files only) |

**Marking so humans never edit the generated half:**

1. **Filename and banner.** `MODEL.md` starts with:

   ```markdown
   <!-- GENERATED from status/model.json. DO NOT EDIT. Regenerate: npm run status:model -->
   # MODEL (generated)
   **Answers:** nominal layout/geometry model. **Evidence:** VALIDATED.md. **Source:** model.json.
   ```

2. **CI / test pin.** A unit test reads `model.json`, runs the same renderer the build uses (or hashes canonical serialization), and asserts `MODEL.md` byte-matches. Mutant: edit MODEL.md by hand → red. That is the generated-doc analogue of practice 29 rung 4 (“run the thing”).

3. **Provenance paragraphs do not live in MODEL.**  
   - `model.json` may carry short machine fields: `unit`, `formula`, `parts`, `source_script`, `validated_id`.  
   - Multi-sentence provenance lives in **VALIDATED** (and/or the round that earned it).  
   - Generated MODEL.md renders at most a one-liner + link: `deskH 83.0 — see VALIDATED#deskH-f5a`.  
   That keeps generation dumb and stable: it never has to typeset essays.

4. **Schema discipline.** Prefer:

   ```json
   {
     "id": "row_chrome",
     "value": 48.0,
     "unit": "px",
     "formula": "contentW = W - row_chrome - 0.3*cardW",
     "validated_id": "row_chrome"
   }
   ```

   over free-text blobs. If a constant needs a paragraph, that is evidence that it is not “just a model atom” yet — VALIDATED owns the paragraph until the model is boring.

5. **Code boundary (necessary, or generation is a doc-only comfort).** Long term, `cardw-gate.mjs` (and siblings) import `model.json` (or a generated `model.mjs`). Until CSS/`--gd-cardw` aspect is either generated or checked against the same file, treat “model.json is source of truth” as **aspirational for product CSS** and **mandatory for gate scripts + MODEL.md**. State that gap in CURRENT so it is not mistaken for done.

---

## Q4

### Today (as implemented)

- **`prose-figures.test.ts`:** top `##` entry of `STATUS.md` only; px/% in prose must appear in a table in that section; allowlist with reasons; ceiling 17; history deliberately out of scope.
- **`withdrawn-numbers.test.ts`:** all of `docs/**/*.md`; occurrences need a withdrawal marker in the enclosing section; exemptions only for pre-reg immutability and received proposals.

### After the split

**Prose-figure scanner (claims need tables)**

| In scope | Out of scope |
|---|---|
| `status/CURRENT.md` | `status/rounds/**` (immutable history) |
| `status/VALIDATED.md` | `status/MODEL.md` (generated; checked by model-render pin instead) |
| Optionally: a single `status/rounds/_DRAFT.md` if you write the new round in-tree before rename | `docs/research/proposals/**`, prereg files (different document kinds) |
| | Topic research already closed (same immutability logic as rounds, unless actively edited) |

**Rule:** *Table-backing applies only to files that are allowed to change when a claim is wrong.* Round files record what was believed; fixing an old orphan figure would be a rewrite (constraint 6). The allowlist ceiling stays on the **mutable** surface only; it should drop over time as CURRENT stays short and VALIDATED is tabular by nature.

**Cost of that rule:** old rounds keep the four historical failure shapes (prose figure contradicting its table). Readers must treat rounds as court transcript, not encyclopedia. Mitigate with the pointer line + `WITHDRAWN.md`, not with retro-tables.

**Do not** expand prose-figures to “all rounds once.” That either freezes the suite on permanent orphans or forces forbidden rewrites.

**Withdrawn scanner (retracted claims must not look live)**

| In scope | Exempt (with stated reason, same shape as today’s EXEMPT) |
|---|---|
| Entire `status/` **except** `rounds/` | `status/rounds/**` — immutable historical belief (like prereg) |
| Entire `docs/` (as today) | `docs/research/prereg-*.md`, `docs/research/proposals/**` |
| `PLAN.md` if it can re-quote layout rates | — |
| `status/WITHDRAWN.md` itself | N/A — it is the registry; markers optional if every entry is definitionally withdrawn |
| `METHODOLOGY.md` | In scope — this is where a retracted figure already survived once |

**Rule:** *Withdrawal hygiene tracks re-quotability, not existence.* History may contain 13.14% as a then-live claim. Live surfaces may only mention it on a marked line. The registry of *what counts as withdrawn* moves from the test’s private `WITHDRAWN` array into **`status/WITHDRAWN.md`**, with the test importing or parsing that file (one list, folder-wide).

**Cost:**

- Agents reading a raw round file will still see live-looking wrong numbers; discipline is “two-file load,” not “history is safe.”
- You lose automatic detection of unmarked withdrawals *inside* old rounds (already true for STATUS history in practice for prose-figures; withdrawn-numbers currently *does* scan only under `docs/`, not root `STATUS.md` — so rounds at root-equivalent status were never fully covered). Making the exemption explicit is honest, not a regression.
- Someone must update WITHDRAWN when retracting; the cost of forgetting is the same class as today’s drift into `reachability.md` / `METHODOLOGY.md`, which is exactly why the scanner’s live scope must stay folder-wide on **mutable** docs.

**MODEL.md:** not a prose-figure target. Assert generation fidelity + that every MODEL id has a VALIDATED row (or an explicit `status: definitional` / `structural` tag). That replaces “figure in prose ↔ table in section” for the generated surface.

---

## Q5

What I would **not** do, even though it fits the mood of this repo:

### 1. I would not invent a fourth live narrative file

Resist `status/JOURNAL.md`, `status/OPEN.md` separate from CURRENT, or a generated “digest of last three rounds.” CURRENT is the one-page always-true surface. Extra live files re-create the “which file did the correction land in?” bug that `withdrawn-numbers` exists to kill.

### 2. I would not put multi-paragraph provenance in `model.json`

Constraint 2 (“generate, don’t write”) is right for **values**. Stretching JSON into a CMS for essays will produce either unreadable JSON or a custom template language nobody wants to maintain. Provenance is VALIDATED + rounds. MODEL stays boring.

### 3. I would not require every historical `##` to become a separate file *without* `rounds/INDEX.md`

Twenty-five files with no TOC makes “why was D made?” worse than grepping one STATUS.md. The split’s payoff is **not loading** history; the index is mandatory infrastructure, not polish. Early five-line rounds can still be one file each (verbatim constraint) — INDEX absorbs the navigation cost.

### 4. I would not scan all round files for prose-figures “for completeness”

That is the over-engineered purity move. It fights constraint 6 and freezes CI on frozen sins. Completeness belongs to WITHDRAWN + pointer lines, not to perfect tables in 2026-07-13 text.

### 5. I would not leave the withdrawn list only inside the Vitest file

Today `WITHDRAWN` lives in `withdrawn-numbers.test.ts`. After the split, a human owner and a fresh agent both need a **document**, not a test fixture. If the test remains the only registry, METHODOLOGY-style drift returns in reverse: tooling knows, docs don’t. Parse WITHDRAWN.md; don’t maintain two lists.

### 6. I would not claim `model.json` is product source of truth until CSS/scripts import it

A generated MODEL.md that disagrees with `table.css` / hardcoded script constants is a prettier form of the 9.20px-vs-14.20px bug. Minimum viable mechanism: gate scripts import JSON **or** a test asserts script literals match JSON. Doc-only generation is half a mechanism.

### 7. I would not merge VALIDATED into MODEL to “reduce files”

The seam is the whole point of the three error classes. Collapsing them recreates STATUS tables where a modelled tail and a measured cell share a column and the word “structural” does the rest. Two files for question (b) is the correct tax.

### 8. I would not auto-generate CURRENT from open sections in rounds

CURRENT must be curated and falsifiable by reading one page. Generated “open items” from heading scrapes will reintroduce ghost tasks and practice-26 documentation-without-action. Hand-maintained CURRENT, updated every round close, is cheaper than a smart aggregator that lies.

### 9. Mild pushback on folder depth

`status/rounds/` is enough. Nested `status/2026/07/...` or per-milestone trees help nobody at ~25 entries. Revisit only if rounds exceed ~100.

### What I would do instead (minimal set)

1. `status/{CURRENT,MODEL.md,model.json,VALIDATED,WITHDRAWN,README}` + `rounds/` + INDEX.  
2. Move each `##` section **verbatim** into one round file; root `STATUS.md` becomes a stub.  
3. Generate MODEL.md in CI; test pins it; scripts (at least gates) read `model.json`.  
4. Scanners: prose-figures → CURRENT + VALIDATED (+ draft only); withdrawn → all mutable docs + status live files, exempt `rounds/` and existing prereg/proposals.  
5. Every file’s first lines are the pointer contract so agents load two files, not seven.

---

## Checked clean

| Examined | Finding |
|---|---|
| `STATUS.md` shape | Reverse-chron `##` rounds; dense tables + open lists; ~25 sections; milestone tracker at end is CURRENT material, not round narrative |
| Top entries I0–I4, H0–H3, G0–G4, F0–F5 | Confirm owner’s constant list is real and scattered; G0/F5b withdrawal pattern; prose-figure allowlist origin in F1b |
| E1 / D1 sample | Withdrawal of aspect 1.548; deskH 156.5 vs 161.5 arc — shows why VALIDATED range/config fields matter |
| C0–C5 sample | Held-out confirmation pattern; pre-reg as separate document kind (already exempt in tests) |
| Round 1 + milestone tracker | Early rounds are short; tracker is stale relative to top of file — argument for CURRENT not “latest round” |
| `PLAN.md` | Stable architecture; must stay out of the status folder |
| `METHODOLOGY.md` | Practices 26/29/31–33 align with generated pins, withdrawal scope, and intervention claims; folder-wide WITHDRAWN is justified by practice 26’s sibling-sweep rule |
| `reachability.md` header | Existing withdrawal-banner pattern is a template for WITHDRAWN + round pointers |
| `prose-figures.test.ts` | Top-entry scope and ceiling-17 ratchet are sound; should re-aim at mutable live files, not all history |
| `withdrawn-numbers.test.ts` | Correct diagnosis (correction stops where noticed); exemptions for prereg/proposals are the right *kind*; registry should graduate to WITHDRAWN.md; extend live scope to `status/*` and keep rounds exempt like prereg |
| `scripts/cardw-gate.mjs` | Constants already duplicated in scripts — model.json without import path would not finish the job |

---

STRUCTURE VERDICT: 9 recommendations

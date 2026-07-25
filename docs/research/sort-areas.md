# Manual sort areas — front-end design study

Dated 2026-07-24. Owner mission: the MODEL is decided; this round designs the
INTERACTION, as a multi-lineage design study. No code was changed this round.

## 1. Decided premises (owner — not re-litigated here)

- **A sort area is a PARTITION of the hand.** Every card belongs to exactly one
  area; a default main area to start. Areas are a purely VISUAL grouping of the
  same hand. Invariant: union of all areas === the full hand, intersections
  empty, no card duplicated or lost, **by card IDENTITY** (two-deck twins stay
  distinct).
- **Front-end only.** The back end never learns areas exist. A sort-area bug may
  only mis-ORGANIZE, never mis-PLAY — committed cards stay server-validated.
- **Two ways to group, both required:** drag between areas, AND select-then-press.

## 2. What was run

Three INDEPENDENT design proposals against one brief (the brief is the
scratch artifact `sort-areas-brief.md`; its content is reproduced by §3 below):

| Lineage | Mechanism | Artifact |
|---|---|---|
| Codex | `codex exec` in a throwaway clone | `codex-proposal.md` |
| Grok | `grok --prompt-file` in a throwaway clone | `grok-proposal.md` |
| Claude (in-house) | workflow: 4 code-map + 4 prior-art agents → proposer → 3 adversarial critiques | `inhouse-proposal.md` |

Neither external lineage saw the other's answer or the in-house map/research;
each read the repo itself. Per METHODOLOGY practice 6 this is proposal
diversity, not an audit — the audit panel comes at the gate.

**Panel-integrity note (carried honestly):** the owner's mission assigns BOTH
lineages a proposal role now AND an audit role at the gate. That is in tension
with the producer≠auditor policy (METHODOLOGY, 2026-07-15): whichever proposal
is adopted, that lineage is anchored for the gate audit of the thing it
designed. This is flagged, not resolved unilaterally — see decision 7.

## 3. MEASUREMENTS (the part that decided things)

All figures measured on the CURRENT build (`b1ed999`), **true 390×844**,
zh-Hant, real dealt 27-card hands, via headless chromium driving a fresh
untimed local dev room in-page (the `scripts/measure-fan-tap-targets.mjs`
driver, reused verbatim; probes in scratch, not committed).

These are VERIFIED measurements, not estimates. They disqualified parts of two
proposals, and corrected a hypothesis of my own.

### 3.1 The fan already wraps — there is no horizontal slack

| Quantity | Measured |
|---|---|
| `--gd-cardw` at 390px | **50.7px** (`clamp(2.75rem, 13vw, 4.25rem)` → 13vw) |
| Hand container (`.gd-handzone`) width | **342px** (not 390 — 24px inset each side) |
| 27 cards → distinct value-columns | **12–13** (deal-dependent) |
| Columns that fit one line | **9** |
| Widest line's ink width | **334.6px of 342** |
| **Horizontal slack on a full line** | **7.4px** |
| Fan lines at 27 cards | **2** (e.g. 9 + 4) |
| Document horizontal overflow | none |

**Consequence:** a 50.7px column does not fit in 7.4px. **Side-by-side areas
inside the fan row are not possible at 390px.** This refutes the layout of the
Codex proposal (which placed areas in one row separated by gutters, and named
this its own riskiest assumption — correctly).

### 3.2 Column count → fan height (the real layout engine, not arithmetic)

Measured by detaching trailing columns from the live fan and re-measuring:

| Columns | Lines | Fan height |
|---|---|---|
| 13 / 12 / 11 / 10 | 2 | **252.1px** |
| 9 / 8 / 7 / 6 / 5 | 1 | **130.1px** |
| 4 / 3 | 1 | 108.8px |

**The second line costs 122px.** The wrap threshold is exactly 9 columns.

### 3.3 "Areas as bands" — what a split actually costs

Measured by redistributing the SAME real columns into N sibling
`.gd-fan__stackRow` bands (same classes, same CSS, same cards):

| Split | Total fan height | Δ vs today |
|---|---|---|
| 13 cols, auto-wrap (today) | 252.1px | — |
| 2 bands [9,4] | 266.1px | **+14px** |
| 2 bands [8,5] | 287.4px | **+35px** |
| 2 bands [6,7] | 287.4px | **+35px** |
| 3 bands [5,5,3] | 402.2px | **+150px** |
| 3 bands [4,5,4] | 402.2px | **+150px** |

A standalone band of k single-card columns (a small aside) measures **87.5px**
for every k in 2..7 — one line is one line.

**Consequence, and a correction of my own hypothesis:** I expected splitting to
be *free* (the fan already pays for a second line). It is not — each band
carries its own 14px lift padding and its own row gap. But it is **cheap for
the second area (+14 to +35px) and expensive for the third (+150px)**. That
lands exactly on the owner's escalation ladder: the second area is affordable,
the third is a real budget decision.

### 3.4 The vertical budget is already overdrawn

| Band | Idle | Staged (5 selected, desk loud) |
|---|---|---|
| `.gd-fan` | 375.7 → 649.1 (273.4px) | 375.7 → 606.6 (230.8px) |
| `.gd-desk` | 659.1 → 753.6 (94.5px) | 616.6 → 765.1 (148.5px) |
| `.gd-actionsRow` | 759.6 → 818.6 (59px) | 771.1 → 830.1 (59px) |
| Play/Pass bottom | **809.6** | **821.1** (a second deal measured **835.4**) |
| `.gd-bottombar` bottom | **860.1** | **871.6** |

The fold is 844. **The bottom bar is already below the fold today**; Play/Pass
clears it by 9–34px depending on the deal.

### 3.5 A new pill in the secondary column is NOT affordable

Both external proposals put the "set aside" control in `.gd-actionsRow__sort`
(today: 54×23px sort toggle, 66×32px SF trigger). Measured by cloning the SF
pill into that column and reading the delta:

| Effect | Measured |
|---|---|
| `.gd-actionsRow` height | 59px → **95px (+36px)** |
| Play button bottom edge | **+18px** |

With the desk loud, Play's bottom was already 821.1px in one deal and 835.4px in
another. **+18px puts it at 853.4 — below the 844 fold.** The claimed cost of
"+32px" is wrong in both direction and consequence: the row grows by 36px and
the regression class this project treats as serious (Play/Pass below the fold)
is reachable on a normal deal.

### 3.6 Tap targets, current state (context for the open owner item)

| Control | Measured |
|---|---|
| Sort toggle 「小→大」 | 54 × **23px** |
| SF trigger 「找同花順」 | 66 × **32px** |
| Play / Pass | 88 × 37px |
| Fan card hit box (min) | 50.7 × 73.5px |

## 4. Where all three proposals AGREE

These converged independently and are treated as settled unless the owner says
otherwise:

1. **The play desk is NOT an area.** Areas organize; the desk commits. Keeping
   `selected → selectionCards → matchSelection → Play → server` untouched is
   what preserves "a sort-area bug can only mis-organize".
2. **Selection stays global across areas** — one selection model, no mode
   switch. Selecting across areas is just selecting.
3. **"Commit a whole area" is bulk SELECTION**, not a second commit pipeline.
4. **One-tap clear clears the SELECTION only**, never the areas. ("Put the cards
   down" ≠ "scatter my piles.")
5. **Descending sort stays whole-hand**, applied within each area.
6. **A fresh deal or a seat switch resets to zero areas** — the same context
   comparison `reconcileSelection` already uses.
7. **The SF finder unifies onto the area mechanism** — its "pull these out"
   sends cards to an area rather than adding a second staging path.
8. **Per-card finger drag is the wrong primary mechanic** at 390px; the
   non-drag path must be complete on its own.

## 5. The three proposals side by side

| | Codex | Grok | In-house (Claude) |
|---|---|---|---|
| **Layout** | Areas side-by-side in the fan row, separated by gutters | A "tray" band of up to 3 pockets ABOVE the fan | "Shelves": horizontal bands above the main hand, each closed by a **seam** |
| **Verdict vs §3** | **Refuted** — 7.4px slack, a column is 50.7px | Right family; its own "+88px fixed tray" cost estimate was close (measured 87.5px) but its pessimism was misplaced | Right family, and it derived §3.1–§3.3 independently and correctly |
| **State** | `Map<AreaId, number[]>`, validated | `membership: ShelfId[]` parallel to hand | `areaOf: AreaId[]` parallel to hand |
| **Invariant** | Validated by constructors | Structural (total function) | Structural (total function) |
| **`selected`** | Wrapped in a `single \| areas` union | **Unchanged**, orthogonal | **Unchanged**, orthogonal |
| **Area cap** | 3 + main | 3 + main | **2** (main + 1), budget-derived |
| **Drag** | Ghost + pointer capture, drop on area backgrounds | Finding: per-card drag unworkable; selection-payload drag onto regions | **Finding: not workable at card level**, with citations |
| **Desk** | Distinct from areas | Distinct from areas | Distinct from areas |
| **Create control** | Off-table menu + 32px rail | New pill in the secondary column | Actions-row left cell |
| **Verdict vs §3.5** | rail cost unmeasured | **Refuted** (+36px, Play below fold) | **Refuted** (see §6.1) |

The in-house proposal is the strongest of the three: it independently derived the
390px arithmetic that §3 measured, and it is the only one whose area cap follows
from a budget rather than from a round number. It is also the one taken apart
hardest below.

## 6. Adversarial critique of the in-house proposal (40 findings)

Three xhigh adversarial lenses were run against the in-house proposal (progressive
disclosure; non-drag sufficiency + 390px; invariant/purity). Verdicts: **11, 13
and 16 findings**. The ones that change the DESIGN, not just the code:

### 6.1 There is no room in the actions row — in EITHER cell

Two independent routes reach the same place:

- **Right cell (a new pill beside the sort toggle):** measured here — `.gd-actionsRow`
  59px → 95px (**+36px**), Play's bottom **+18px**. With the desk loud, Play's
  bottom was already 821.1px in one deal and 835.4px in another; +18px puts it at
  **853.4px, below the 844 fold**.
- **Left cell (the `aria-hidden` spacer, the in-house placement):** the critique
  read two literals the proposal did not — `.gd-actions__slots { gap: 2.25rem }`
  (36px) and `.gd-actions__slots button { min-width: 5.5rem }` (88px). The middle
  track's min-content is therefore **88 + 36 + 88 = 212px**; with 2×8px column
  gaps and a 72px "Set aside" button the row needs **390px of a 342px box**.
  `.gd-table { overflow-x: hidden }` means it does not scroll — it **clips**, and
  `.gd-actionsRow__sort` is `justify-self: end`, so what gets clipped is the
  straight-flush trigger. A third lens measured the same thing dynamically: Play/Pass
  shifted **20.6px** and Pass stole **12.6px** of the SF trigger.

**Conclusion: the create-area affordance cannot live in `.gd-actionsRow` at 390px.**
The proposed home is the play desk's stage row beside `.gd-desk__clear` — which
already renders exactly when the selection is non-empty and already carries a
44px pill.

### 6.2 The twin-remap defect (the most serious finding of the round)

`remapAreasByIdentity` (the first-unclaimed-slot idiom) is **identity-blind between
twins that sit in different areas**.

Scenario: the hand holds two `5S`, one in MAIN and one on a shelf as part of a
straight flush. The player plays the MAIN `5S`. The remap walks old slots in
ascending order; the MAIN slot claims the one surviving `5S`, and the shelf's slot
finds nothing and drops. **The surviving `5S` lands in MAIN and the shelf is
silently dismantled** — the straight flush the feature exists to protect. The next
step of the design's own pitch ("tap the seam, Select all, press Play") then stages
four cards and Play is dead.

This is not exotic: two decks make twins common, and "set aside a straight flush"
is the flagship flow. An earlier research pass had concluded the twin swap was
"unobservable because each area's multiset is unchanged" — that is true only when
the twins share an area, and it is exactly the reasoning the critique overturned.

**The fix is available and clean:** the client already knows precisely which slots
it committed (`selected` at submit time), so on a play it should **drop those exact
slots** from the partition rather than re-deriving membership by identity. The
identity remap is then needed only for hand changes the client did not cause.

### 6.3 `AREA_MAX = 2` costs the owner two things they asked for

At a cap of 2 (main + one shelf):
- **Merge is unreachable** — merging needs two shelves.
- **The escalation ladder has one rung**, not the "used one → offer a second →
  used two → offer a third" the owner specified.

Raising the cap to 3 costs **+150px measured** (§3.3), against a column whose
worst case is already at the fold (§3.4). This is a genuine three-way trade the
owner has to make; it is not resolvable from the code.

### 6.4 Other design-level findings

- **`Set aside` is a silent no-op** on a strict subset of the last shelf at the
  cap — a house-rule violation, reachable in 3 presses.
- **The SF-finder rewire inverts its own label**: picking the same group twice
  falls back to `MAIN_AREA`, so a button reading 「放一邊」 un-sets-aside and
  deletes the band.
- **The seam sits in the 14px strip variant D reserves for the selection lift of
  the band below it.** The documented near-miss (a tap at the top of a lifted card
  landing on the neighbour above) now lands on a **destructive area control**
  instead of a benign wrong selection — and the required tap-target sweep never
  measures this state.
- **`reconcileAreas` cannot return the same instance** while `areaOf` is a total
  map over a hand whose length changes, so the "never-user allocates nothing"
  claim is false on the commonest wire message. Fix: represent "no areas" as
  `null` (absence), not as `singleArea(n)`.
- **The zero-area tap-target baseline cannot be built as specified**: the sweep
  script creates a fresh room per run and the deal seed is server-side random
  (`game-room.ts:1416`), so there is no stable geometry artefact to diff. A
  deterministic deal would be a server change, which the brief forbids. The honest
  pin is a same-run two-state comparison instead.

## 7. Where they DIVERGE (the owner's decisions)

See the numbered decision list delivered with this round.

## 7b. UI-PHASE MEASUREMENTS (2026-07-24) — the third-area answer

Measured end-to-end on the BUILT UI at true 390×844, zh-Hant, by driving the
real controls (select cards → press the create control) across 8 real dealt
hands. Formula-free on purpose: the probe reads what the UI OFFERS, so it cannot
agree with the implementation by sharing its arithmetic.

| deal | columns | 1 shelf: bands / fan h / Play bottom | 2 shelves | refused? |
|---|---|---|---|---|
| 0 | 13 | 2 / 432.2 / 835.4 | 2 | yes |
| 1 | 11 | 2 / 368.3 / 834.6 | 2 | yes |
| 2 | 13 | 2 / 453.5 / 834.7 | 2 | yes |
| 3 | 12 | 2 / 432.2 / 835.4 | 2 | yes |
| 4–6 | 14 | 2 / 410.9 / 835.1 | 2 | yes |
| 7 | 15 | 2 / 389.6 / 834.9 | 2 | yes |

- **Second band reached: 8/8. THIRD band reached: 0/8.** The budget refused it on
  every deal, at every column count from 11 to 15, and showed the reason.
- **Play stayed above the 844 fold in 8/8** (834.6–835.4) — but by only ~9px.
- **A shelf is NOT the cheap +14px case in practice.** The earlier split
  measurement (§3.3) assumed a split that keeps both bands under the 9-column
  wrap; pulling a few cards typically leaves MAIN still over it, so the shelf
  adds a whole line: fan 294.7 → 432.2, i.e. **+137px**. §3.3's +14px is the
  best case, not the common one. This is the honest correction.

**Consequence, taken under the owner's standing authorisation** ("if the window
is rare or erratic, report it and fall back to a clean two-area version"):
`AREA_HARD_MAX` is **2**. A rung that never opens is worse than an absent one.
The costs are stated rather than hidden: **merge needs two shelves, so merge is
unreachable at this cap, and the ladder has one rung.** The allowance machinery
is retained — it still refuses the FIRST shelf when even that will not fit, and
it still carries the monotonicity guarantee.

**Nuance the owner may want to revisit:** the allowance reads `window.innerHeight`,
so on a desktop viewport the third band WOULD open. The cap makes the model one
thing everywhere instead of a feature that exists on desktop and never on the
reference device; that is a judgement call, and it is flagged rather than buried.

### The seam, measured (fix 1's second half)

`scripts/measure-fan-tap-targets.mjs` — the REQUIRED visual gate — now sweeps the
seam state too, so the destructive control cannot hide in unmeasured geometry:

```
baseline px^2 min/median/max: 700 / 1000 / 3750
PASS: seam state swept — 0 stolen points, seam-to-card gap 20px > 14px lift
PASS: zero victims across the full sweep
```

The baseline spread is **identical to the documented variant-D baseline**
(700/1000/3750, `docs/audits/fan-variant-d.md`), i.e. the fan's geometry is
unchanged. The seam sweep grid-samples `elementFromPoint` over every card in
every single-selection state and fails on any point that resolves to a seam.

## 8. House-style findings that constrain the build

- **No property-testing library.** `tests/unit/engine/obligations.property.test.ts`
  states the house idiom explicitly: a custom seeded playout harness, no
  property-testing library, with replayable failures emitted as a single
  `{seed, config, actions}` JSON line for `scripts/replay.ts`. Both external
  proposals sketched `fast-check` (`fc.commands` / `fc.assert`) tests — adopting
  that would be a new devDependency and a new idiom, which is a separate
  argument to win. The partition property test should follow the existing
  harness style.
- **The fan tap-target sweep is a required gate** for any fan/selection change
  (`scripts/measure-fan-tap-targets.mjs`), and two silent-revert vectors are
  source-pinned: re-attaching a transform to the button, and dropping
  `pointer-events: none` on the face. Any drag mechanism that needs either is
  disqualified by ratchet, not by taste.

## 9. Null results

- **No named prior-art pattern for a "cut-point partition" in front-end UI
  literature.** Diagnosis: it is a combinatorial identity (compositions of *n* ↔
  subsets of the *n−1* interior gaps), not a UI pattern with a canonical
  write-up. The strongest available evidence is that this repo already
  implements the shape twice (`HandFan.tsx:123-139` `groupHandColumns`,
  `helpers.ts:516` `handRows`).
- **No `fast-check` idiom documented for "duplicate values that must remain
  distinct."** The docs cover the converse (`uniqueArray` + selector)
  thoroughly and are silent here. Diagnosis: it is a modelling concern, not a
  library capability.

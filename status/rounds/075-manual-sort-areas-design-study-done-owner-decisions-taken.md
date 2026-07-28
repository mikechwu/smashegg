> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Manual sort areas — DESIGN STUDY done, owner decisions taken (2026-07-24)

Owner mission: the MODEL is decided (a sort area is a client-only PARTITION of the
hand by card identity); this round designs the INTERACTION as a multi-lineage
design study. **No code changed** — the owner's sequencing is proposals → owner
picks → build the partition model + invariant FIRST → UI after. Record:
docs/research/sort-areas.md.

THREE INDEPENDENT PROPOSALS against one brief, none seeing another's answer, each
reading the repo itself: Codex (`codex exec`, throwaway clone), Grok
(`grok --prompt-file`, throwaway clone), and in-house Claude (a 12-agent workflow:
4 code-map + 4 prior-art agents → proposer → 3 adversarial critiques).

MEASUREMENTS DECIDED IT (true 390x844, zh-Hant, real dealt 27-card hands, headless
chromium driving a fresh untimed local dev room in-page — the
scripts/measure-fan-tap-targets.mjs driver reused verbatim; probes in scratch):
  • **The fan already wraps and has NO horizontal slack.** 27 cards = 12-13
    value-columns; **9 fit per line**; the widest line's ink is **334.6px of a
    342px** container — **7.4px slack** against a **50.7px** column. Side-by-side
    areas inside the fan row are IMPOSSIBLE at 390px. This refuted the Codex
    layout (which had named this its own riskiest assumption — correctly).
  • **Column→height curve:** 10-13 columns = 2 lines = 252.1px; ≤9 columns = 1
    line = 130.1px. **The second line costs 122px.**
  • **Areas as bands** (same real columns redistributed into sibling stack rows):
    2 bands **+14px** ([9,4]) to **+35px** ([8,5]); **3 bands +150px**. A
    standalone single-card-column band is 87.5px for every k in 2..7.
    This CORRECTED my own hypothesis that splitting would be free — each band
    carries its own 14px lift padding and row gap. Cheap for the second area,
    expensive for the third.
  • **The vertical budget is already overdrawn.** Bottom bar bottom = 860.1 idle /
    871.6 staged against an 844 fold — already below it today. Play/Pass clears by
    9-34px depending on the deal.
  • **A new pill in the secondary column is NOT affordable:** actions row 59→95px
    (**+36px**), Play's bottom **+18px**. Staged Play measured 821.1px in one deal
    and 835.4px in another; +18 puts it at **853.4 — below the fold**. This refuted
    the Grok placement.

CONVERGENCE (all three, independently) — treated as settled: the play desk is NOT
an area (areas organize, the desk commits, `selected → matchSelection → Play →
server` untouched, so a sort-area bug can only mis-organize); selection stays
global across areas with no mode switch; "commit a whole area" is bulk SELECTION,
not a second commit pipeline; one-tap clear clears the SELECTION only; descending
sort stays whole-hand; a fresh deal or seat switch resets to zero areas; the SF
finder unifies onto the area mechanism; and per-card finger drag is the wrong
primary mechanic at 390px.

THE IN-HOUSE PROPOSAL IS THE STRONGEST and is the one recommended: it derived the
390px arithmetic independently and correctly (9 columns/line, 342px content,
50.70px card, 73.52px height, already-wrapping fan — all matching the measurements
above, which were taken separately), and its area cap follows from a budget rather
than a round number. Its three adversarial lenses returned **11, 13 and 16
findings**. The ones that change the DESIGN:
  • **NO ROOM IN THE ACTIONS ROW, IN EITHER CELL.** Right cell: +36px, Play below
    the fold (measured here). Left cell (the in-house placement): the critique read
    two literals the proposal did not — `.gd-actions__slots{gap:2.25rem}` (36px) and
    its `button{min-width:5.5rem}` (88px) — so the middle track's min-content is
    **88+36+88 = 212px**; with gaps and a 72px button the row needs **390px of a
    342px box**. `.gd-table{overflow-x:hidden}` means it CLIPS, and
    `.gd-actionsRow__sort` is `justify-self:end`, so what gets clipped is the
    straight-flush trigger. A third lens measured Play/Pass shifting 20.6px with
    Pass stealing 12.6px of that trigger. Proposed home instead: the desk's stage
    row beside `.gd-desk__clear`, which already renders iff the selection is
    non-empty and already carries a 44px pill.
  • **THE TWIN-REMAP DEFECT (most serious finding of the round).** The
    first-unclaimed-slot idiom is IDENTITY-BLIND BETWEEN TWINS IN DIFFERENT AREAS.
    Two 5S, one in MAIN and one on a shelf inside a straight flush; play the MAIN
    one; the remap walks old slots ascending, MAIN claims the survivor, the shelf's
    slot finds nothing and drops — **the surviving 5S lands in MAIN and the shelf
    is silently dismantled**, i.e. the exact holding the feature exists to protect.
    An earlier research pass had called this swap "unobservable because each area's
    multiset is unchanged" — true only when the twins SHARE an area; the critique
    overturned it. Fix available and clean: the client knows exactly which slots it
    committed, so drop THOSE SLOTS from the partition instead of re-deriving
    membership by identity.
  • **`AREA_MAX = 2` costs two things the owner asked for**: merge needs two
    shelves so it is unreachable, and the escalation ladder has one rung instead of
    three. Raising the cap to 3 costs +150px measured against a fold that is
    already breached. A genuine owner trade.
  • Also: `Set aside` is a silent no-op on a strict subset of the last shelf at the
    cap; the SF-finder rewire's `?? MAIN_AREA` makes a button labelled 「放一邊」
    DELETE the band; the seam sits in the very 14px strip variant D reserves for
    the lift of the band below, so the documented near-miss turns from a benign
    wrong selection into a DESTRUCTIVE area move; `reconcileAreas` cannot return the
    same instance while `areaOf` is total over a changing hand (fix: represent "no
    areas" as `null`, not `singleArea(n)`); and the zero-area tap-target baseline
    CANNOT be built as specified — the sweep makes a fresh room per run and the deal
    seed is server-side random (game-room.ts:1416), so no stable geometry artefact
    exists and a deterministic deal would be a server change the brief forbids.

HOUSE-STYLE FINDINGS: there is **no property-testing library** in the repo —
obligations.property.test.ts states the idiom explicitly (custom seeded playout
harness, replayable `{seed, config, actions}` failure lines for scripts/replay.ts).
Both external proposals sketched fast-check; that would be a new devDependency and
a new idiom, a separate argument to win.

PANEL INTEGRITY (flagged, not resolved unilaterally): the mission gives both
external lineages a PROPOSAL role now and an AUDIT role at the gate, which is in
tension with producer≠auditor. Recommending the IN-HOUSE model keeps both external
lineages unanchored on authorship; Codex is the cleanest (its layout differed most
and was refuted), Grok is mildly anchored (its membership-vector + band structure
is close to the in-house one).

OPEN: the owner's pick of the interaction model, plus the numbered decisions
(area cap vs merge + ladder; where the create control lives; whether drag ships at
all given that all three lineages independently found per-card drag unworkable
against variant D — which contradicts the decided premise "two ways to group, both
required").

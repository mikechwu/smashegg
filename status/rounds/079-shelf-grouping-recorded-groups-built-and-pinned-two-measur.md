> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Shelf grouping — RECORDED groups built and pinned; TWO MEASURED DEFECTS OPEN (superseded above)

Real-player finding: a shelf holding two straight flushes rendered as one flat
pile. **The model half is done and gated; the layout half is NOT clean and I am
reporting that rather than shipping past it.**

DIAGNOSIS FIRST (arithmetic from already-MEASURED constants — card 50.7px,
column pitch 35.5px, flat pitch 20.3px, container 342px):
  • The cause was value-COLUMNS: two set-aside flushes share the same values, so
    `groupHandColumns` stacks them into one interleaved pile. That IS the defect.
  • Giving each group its own value-columns needs **370.1px vs a 342px box — it
    wraps** (+122px a line). Unaffordable, exactly as the owner's brief warned.
  • A FLAT overlapped run per group (the fan's own -0.6 ratio, already measured
    and shipped in the finder panel) spans 271.6px for two 5-card flushes.
  • Mixed (groups flat, leftovers as columns) wraps at just 2 leftover columns
    (346.6px), so the whole SHELF is laid flat; MAIN keeps its value-columns
    because it is the hand you scan by value.

BUILT — the model, which follows the twin-remap precedent exactly:
  • `HandAreas` gains `groupOf` (parallel to `areaOf`, remapped in the SAME walk
    so the two can never disagree) and `groupSize` (each group's size AT SEND).
  • **RECORDED, never re-derived.** `applyMoveAsGroup` records exactly the slots
    the player sent. Decompositions are not unique, so recomputing "what forms a
    flush" from shelf contents could regroup the same cards differently for no
    visible reason.
  • **DEGRADES, never lies** — an explicit ladder: `intact` (every recorded
    member present) is the ONLY state that may name the combination; `broken`
    (>=2 remain) still draws a group, because "these were set aside together" is
    still true, but carries NO combination claim; below two members the group
    DISSOLVES and survivors rejoin the loose cards. Splitting a group across
    bands also ends it.
  • **Twin-safe by construction**: membership is a SLOT label, not rank+suit, so
    it rides the same identity-exact remap. Pinned: playing the MAIN twin leaves
    a shelved flush whole and still `intact`.
  • **Non-authoritative**: the annotation holds no card list that could disagree
    with the hand; legality still comes only from the committed set.
  • Selection: each group's control selects exactly that group, or clears it if
    already exactly selected — always a change, never a dead press.
  • Ordering resolved: groups render in the order their first member appears in
    the CURRENT display order, so the descending toggle reverses groups and
    their contents together — one rule, both directions.

GATE: typecheck (4 tsconfigs) + unit **1225/1225 (51 files)** + lint:hooks +
build. Bundle 445.92 kB.

### TWO OPEN DEFECTS, MEASURED AT TRUE 390x844 (zh-Hant, real deals)
1. **A two-group shelf can still wrap.** The group controls are 44px each (the
   elder floor), so two runs plus two controls is ~350px against 342px. Removing
   the runs' inline padding bought 16px and fixed the common cases — 5+1 and 5+2
   card shelves now sit on ONE line — but **5+4 cards still wraps** (measured
   342.3px, lines=2, shelf 87.5 -> 167px). The honest reading: the per-group
   control on the same line does not fit at the top of the range. The owner's
   pre-authorised null result ("no separator fits without a wrap") applies to
   that band of cases, not to all of them.
2. **Play/Pass measured BELOW the 844 fold in every shelf case this round**
   (846.4 / 883.3 / 904.6 / 925.9 / 967.1), against 834.6-835.4 measured LAST
   round for a desk-made shelf. **I have not isolated the cause** — the shelf
   band itself measures the same 87.5px, so it is not simply the new layout —
   and I am recording it as a reproducible measurement rather than guessing.
   This is the project's serious regression class and needs a decision before
   this round ships.

NOT DONE THIS ROUND (stated, not implied): the panel was not run; the elder
session item ("can they see which cards form which flush without explanation")
is added but not run; no desktop verification; the fan tap-target sweep was not
re-run after the final CSS change.

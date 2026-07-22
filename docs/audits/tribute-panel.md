# Tribute-panel sizing round — audit (2026-07-21)

Scope: uncommitted diff moving the tribute/return panel's revealed cards
(paid/returned pairings, anti-tribute jokers, own staged card) from the
smaller dormant 'trick' size to hand size — post-M5 human-feedback item 2,
the chooser round's consistency precedent. Presentation-only, so per the
round's policy either external model may implement or audit; Claude
produced, Codex audited an isolated clone (producer≠auditor held). The
round's design-panel budget went to item 1 (see
docs/research/hand-interlude.md), so item 2 ran a single-auditor pass.

Pre-audit verification (zh-Hant stated, per the visual gate): a first-hint
bot drove a real local room through hand 1 to the hand-2 return-tribute
reveal; the tribute card measured EQUAL to the fan card at TRUE 390px
(50.7px) and desktop (68px), zero horizontal overflow, screenshots on
file. A DOM probe settled the one visual question honestly: the sparse
joker face (corner emblem, blank body) is the active lacquer theme's
designed look — identical on a fan joker, no `.gd-ccourt__body` svg in
either — pre-existing and untouched.

## Codex (isolated clone, patch applied, reasoned-only — sandbox EPERM on
## vitest/build as every round)

**No HIGH or MED.** Confirmed: no overlooked trick/mini consumer under
src/client/table; all three reveal sites hand-size; the wrap rules cover
the double-tribute two-pairing and anti-tribute two-joker widths (separate
wrapping rows). Two LOWs, both fixed on the spot:

1. The "no component ships trick/mini" pin was a hand-maintained file list
   omitting EventFeed/ResultOverlay (no live regression — they render no
   faces — but the claim outran the sweep). Fixed: the pin now enumerates
   `src/client/table/*.tsx` from the directory, with a floor count, so new
   components are swept automatically.
2. Three stale mini-era comments (ActionBar header, lacquer.tsx body-pip
   comment, a deck-theme test title) still described the chooser as
   rendering mini faces. Reworded to the dormant-size story.

Post-fix gate: 935/935 (39 files), typecheck, lint:hooks, build clean.

## Verdict

**Clean.** One card size everywhere is now pinned as a directory-swept
invariant, not a site-by-site convention.

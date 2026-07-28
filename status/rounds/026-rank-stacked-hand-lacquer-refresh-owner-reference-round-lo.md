> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Rank-stacked hand + lacquer refresh (2026-07-16) — owner reference round — local, unpushed

The owner supplied two mainstream-Guandan reference screenshots and asked for: same-value
cards stacked into columns (each card's index revealed), less overlap, LARGER cards, the
classic-lacquer look brought toward the refs, and classic lacquer as the APP DEFAULT.

Built (Sonnet workflow, three-lens review; 802/802 green, typecheck + lint:hooks clean):
- HandFan settled mode groups the sorted hand into runs of equal levelValue — natural ranks,
  ONE level column (the wild heart level card lands inside it, exactly like the refs' marked
  level pile), SJ/BJ their own piles; worst case is PROVABLY 15 columns (engine-derived pin
  over buildDeck for every level). Single bottom-aligned row; base card of each pile shows
  its full face; stacked cards expose their index strip (offset 0.841w, compressing for
  piles >4 so an 8-copy pile stays ~4.4 card-widths tall, degrading to rank-only strips).
  DEALING mode is untouched: flat arrival-order rows, revealed/undealt slots, and the
  deal-overlay rect measurements all as before; the FLIP sort beat now slides arrival rows
  INTO the stacks (keys unchanged).
- Cards GREW: hand clamp 2.25-3.25rem/11vw -> 2.75-4.25rem/13vw = 50.7px at 390 (+18%,
  +39% area) and 68px desktop (+31%); column pitch -0.6 (0.40w visible per column keeps the
  whole identity column visible for every strip).
- Classic lacquer faces gained the refs' big center suit pip (serif glyph, 0.48w, left 66%,
  hand/trick only — mini untouched, chooser arithmetic intact); jokers stay wordless.
- DEFAULT flipped back to lacquer per the owner's "(app default)" — cinnabar-court stays in
  the drop-down; registry + non-default-switch tests updated honestly.

Workflow review caught TWO HIGHs before I ever saw the tree, both verified with real numbers
or a real browser: (1) the 390 worst-case pin assumed a 374px budget but the actual nested
content width is 342px (.app-main 32px + .gd-table 16px padding) — 15 columns at the -0.55
pitch would have CLIPPED on every phone; fixed by tightening pitch to -0.6 AND rewriting the
pin to DERIVE the budget from both stylesheets. (2) The first pip placement (center, 0.55w,
sans font by inheritance) measurably overlapped the corner suit glyph on EVERY card and the
wild seal on wilds (getBoundingClientRect evidence at 36/44/50.7/68px) — fixed (0.48w,
left 66%, --font-card pinned) and re-measured to zero overlaps. Plus one stale-comment MED.

MY visual gate then caught what DOM-free tests structurally cannot: the inline stack margin
calc(var(--gd-cardw) * F) computed to 0px — the custom property lives on a DESCENDANT of the
card button, out of var() scope, so stacked cards rendered full-height with no overlap.
Fixed by defining the clamp on the fan CONTAINER; the lockstep pin now also requires that
declaration (comments stripped). Verified live after fix: strips overlap exactly like the
refs.

Visual verification (locale stated with width): desktop 1260 [en] + true 390 iframe
[zh-Hant]; lacquer AND cinnabar-court on the same live hand (theme switch over stacks is a
pure re-render); 14-column fresh 27-card hand fits 390 with scrollWidth 375 and ZERO
overflowing elements; mid-pile selection lifts with a z-bump above its pile; asc/desc
toggle mirrors column order (jokers lead in desc, like the refs); a LIVE double re-cut
fired during setup (two uncountable flips in a row, ~0.3%) — re-cut loop + wordless mini
joker flip card verified live as a bonus. Honest note: a STACKED wild's strip hides the
seal band (the seal sits at 0.92w, below the 0.841w strip); identity is still unambiguous —
the strip shows rank+suit and "heart of level rank" IS the wild definition — and the seal
shows in full whenever the wild is the pile's base card or lifted.

Suite 802/802; typecheck clean; lint:hooks clean. Committed locally; push only on the
owner's word.

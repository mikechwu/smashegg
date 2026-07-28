> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Packed stacks + horizontal lacquer index (2026-07-16) — owner refs round 2 — local, unpushed

Owner refinements on the stacked hand (two reference images + one follow-up): (1) the corner
suit moves BESIDE the rank (horizontal index) at ROUGHLY THE RANK'S SIZE — clarity over
compactness (follow-up message; the first build had it at 60%); (2) piles compress so covered
cards show ONE index line; (3) the big body pip re-balances toward the bottom-right.

Built (Sonnet workflow + three-lens review incl. real-browser measurement; my same-size-suit
delta applied on top; final 812/812 green, typecheck + lint:hooks clean):
- Lacquer horizontal index: .gd-card__index--row (lacquer-scoped modifier; GhostFace and
  cinnabar-court keep the generic vertical column) — rank 0.36w, suit 0.34w beside it,
  two-glyph '10' rank at 0.28w. Gated OFF at mini (review finding: the first build leaked the
  row layout into the decl-chooser's pinned mini faces — fixed + regression).
- Pile strips are now a PER-THEME metric: DeckThemeMetrics.stackStripW (required, conformance
  range [0.3, 1.0]) — lacquer 0.42 (one line), cinnabar-court 0.841 (its vertical index,
  unchanged); stackOffsetW/stackMarginTopW take stripW + the theme aspect (magic 1.45 gone).
- Pile pitch -0.30 (0.70w visible: the full index row incl. suit for single-glyph ranks,
  ~92%+ for '10') with flex-wrap on the stack row: the worst-case 15-class fresh hand wraps
  to two centered lines at 390; the wrap pin re-derives the REAL 342px content budget from
  both stylesheets and requires >=8 piles per line.
- Pip: left 64% / top 66% / 0.55w — implementer measured pip vs index vs wild seal vs edge in
  a real Chrome render at 36/44/50.7/68px (tightest clearance 4.23px, pip<->seal at trick).

Review findings (both MED, both fixed + pinned): (a) the wrapped second line rendered
8.9px off-center — the sibling-selector negative margin fired across flex line breaks;
fixed by moving the overlap margin onto every stack with an equal compensating row
padding-left (algebraically identical single-line math, symmetric under wrap) + a
padding/margin lockstep pin; verified live post-fix: an 8+3 wrap at true 390 has BOTH lines
centered at exactly the same axis. (b) The mini leak above.

Visual verification (locale stated with width): desktop 1260 [zh-Hant] + true 390 iframe
[zh-Hant], lacquer + cinnabar-court on the same live hand. Verified: strips read
rank+near-equal-suit ('10♥/10♦/10♣' piles fully legible); pip bottom-right on base cards;
the wild 2H base shows seal + pip together; mid-pile selection lifts with the ring;
descending mirrors pile order; theme switch keeps piles intact (no row-modifier leak into
cinnabar-court); 390 zero overflow (scrollWidth 375) with the 8+3 wrap centered. My delta's
first pass also broke one factor-pin regex (caught by the suite immediately, restored with
the correct -0.3 pattern).

Suite 812/812; typecheck clean; lint:hooks clean. Committed locally; push only on the
owner's word.

Owner follow-up (2026-07-16): the body pip grew 1.3x (0.55w -> 0.715w). Re-measured in the
round's own harness (real stylesheet, getBoundingClientRect, 36/44/50.7/68px, A and '10',
wild seal present): zero overlaps with the index row / wild seal / card edge at every size;
tightest clearance 2.87px (pip<->seal at hand-min 44px). No position change needed. Suite
812/812, typecheck + lint clean.

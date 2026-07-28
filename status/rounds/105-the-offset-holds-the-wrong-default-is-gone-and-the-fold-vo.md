> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## The offset holds, the wrong default is gone, and the fold void FREES three decisions (2026-07-27)

### 1. The 536.2px offset IS height-independent — verified, since it carries everything

`vh` is in use (`.app-shell { min-height: 100vh }` plus two overlay max-heights),
so this was not safe to assume. Same deal, theme and locale; only height varies:

| inner height | 1000 | 900 | 844 | 800 | 748 | 700 | 664 | 659 | 600 |
|---|---|---|---|---|---|---|---|---|---|
| fan height | 252.1 | … | … | … | … | … | … | … | 252.1 |
| Play doc | 788.4 | … | … | … | … | … | … | … | 788.4 |
| **offset** | **536.2** | 536.2 | 536.2 | 536.2 | 536.2 | 536.2 | 536.2 | 536.2 | **536.2** |

**One distinct value across nine heights.** `.app-shell`'s `100vh` tracks the
viewport but never moves Play. The recalculation stands.

### 2. The wrong default is REMOVED, not warned about

The owner's correction is right and my first response was the round's own failure
mode: **a known-wrong default plus a warning is what already failed here** — the
comment saying 844 is fictional had sat above the 844 default for weeks.

`measure-fold.mjs` now **requires** `FOLD_W` and `FOLD_H` and exits 2 without
them, printing the real phone heights and the 100% finding. There is no value to
inherit, and every recorded figure names the height it used, so the history stays
interpretable. Verified: bare invocation exits 2 with the explanation.

### 3. METHODOLOGY 26 — recording a defect is not fixing it

The inverse of practice 23. There, a source comment SAVED a simplification from
deleting a safety property. Here a comment recorded a defect and **discharged the
obligation to act on it**: practice 15 was written, everyone moved on, and the
default kept steering every measurement at the fiction it described.

It is the compensating-mechanism class one level up — `ScrollActionsIntoView` hid
the 100% rate in the PRODUCT, and the comment hid the same problem in the
PROCESS by making it look addressed.

**The diagnostic that would have caught it:** *if this finding is real, what
currently-passing thing should now fail?* If the answer is "nothing", it has been
documented rather than acted on.

### 4. What the void FREES — three decisions revert to their real grounds

The owner's point, and it is the finding's positive half: the entire phone shelf
arc compared fold rates against a baseline that was **already 100%**. A shelf's
marginal contribution to a bottomless hole is zero.

- **Collapsed-44 becomes free.** 24px won only because 44px cost 16.7% below fold
  against 0%. At real heights both are 100%, the difference vanishes, and **44px
  takes this project's own press floor at no cost.** A two-round decision now has
  a different answer.
- **Overlay vs collapsed** (6.3% vs 12.5%) was likewise an artifact. That reverts
  to occlusion grounds alone — the overlay hides an opponent's plate and count,
  the collapsed indicator hides nothing.
- **The cap/spread work re-scopes** to what it is actually for: the theme defect
  and index clipping, **both height-independent**, and both still real.

### 5. What replaces the metric — owner's reading, and the instrument already exists

Not a ruling to take unilaterally, but the arithmetic points one way: at 664 the
layout admits fanH ≤ 127.8 and the smallest possible fan is 252.1 — **deleting
the fan's entire second line (122px) still leaves it 2.3px short.** Fitting is
geometrically impossible, not merely hard.

The fold existed to protect "the player can reach Play". Under auto-scroll that
becomes four checkable properties, and **the containment gate is already most of
the instrument** — run post-scroll-settle at real heights it checks the fourth
almost directly:

1. auto-scroll reliably brings Play into view **on a real device** (dynamic
   toolbar; `100vh` vs `innerHeight`);
2. it never moves a target between committing to a reach and completing it;
3. the player perceives the view moved;
4. **nothing else the player must see scrolls OUT as Play scrolls in** — at 664
   with a 252–316px fan plus the desk, the ring and trick well could leave the
   top, i.e. "what I must beat" and opponents' counts absent at the decision
   moment.

### 6. Carried forward, unresolved

**The desktop viewports need the same yardstick.** Inner 1280×800 corresponds to
a SCREEN of roughly 1280×890-920, which is not a standard size; real screens of
1280×800 / 1440×900 / 1920×1080 present inner heights near 680-710 / 780-810 /
960-990. Rung 0's improvement was large (95.8% → 0/24) so the conclusion probably
survives, but the specific viewports do not correspond to real machines and that
is now a known-unchecked claim rather than an assumed-safe one.

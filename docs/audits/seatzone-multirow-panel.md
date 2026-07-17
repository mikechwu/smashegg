# Seat-zone multi-row compaction — cross-model panel (2026-07-17)

Scope: uncommitted working-tree diff wrapping the three remote-seat card-back
blocks into two partially-overlapping rows (owner mobile-compaction follow-up).
Producer: Claude. Auditors: Codex + Grok, each on an isolated clone with the
identical brief, gate re-run by each. Producer did not audit its own change.

## Round 1

### Grok — no HIGH; 3 MEDIUM + 3 LOW

- **MED 1 — grow-on-play at the wrap boundary.** Balanced `perRow =
  ceil(count/rows)` made the block's lay-axis extent reflow on every play and
  JUMP UP at 15→14 (2 rows of 8, lay 1.63 cardw → 1 row of 14, lay 2.17). Every
  hand crosses this in play; `reserve` only covers the deal. **ACCEPTED.**
- **MED 2 — T10 pins miss the aspect factor on the row step.** The east/west
  `left` pins required only `(rows-1-row) * linefrac` / `row * linefrac`, not
  `* var(--gd-stack-aspect)` nor the `(aspect-1)/2` recentre — a dropped aspect
  factor (the exact regression class this change introduced) would still pass
  yet stop the rows tiling flush. **ACCEPTED.**
- **MED 3 — stale "3 rows of 9 / a third of the length" comments** in table.css
  + SeatStack.tsx contradict the shipped 2-row policy; a future tuner would
  "restore" 3 rows and re-crush the centre. **ACCEPTED.**
- **LOW 4 — reserve suite asserts only `--gd-stack-n:27`** though layout now
  sizes off rows/perrow. **ACCEPTED.**
- **LOW 5 — the mid-deal reservation test overclaims mapping coverage** (checks
  shape + count, not the `(i,pos,row)` tuples). **ACCEPTED.**
- **LOW 6 — intro comment / `--gd-stack-n` still described as a layout var.**
  **ACCEPTED** (comment; `--gd-stack-n` kept as the reserve/test signal).

Grok verified clean: full-row geometry tiles for arbitrary (rows, perRow,
aspect); east/west mirror on both axes; R10 partial rows are correct right→left
fill; deal reservation freezes both axes. Gate: 43/43, typecheck, lint, build
all pass. Agreed 2 rows is right for 390px.

### Codex — 1 MEDIUM + 2 LOW

- **MED — west's partial-row reversal (`perRow-1-pos`, not the actual row
  length) breaks the east/west mirror.** **REJECTED.** West's partial row is the
  exact VERTICAL MIRROR of east's: for a full hand (27 = 14 + 13, perRow 14) the
  last row omits one slot — east leaves the gap at the strip BOTTOM (its cards
  occupy tops `[0 … 12e]`), west at the TOP (`[1e … 13e]`); reflecting east
  top↔bottom yields exactly west's occupancy, and the newest card sits one step
  from the extreme end on BOTH sides. Codex's suggested fix (reverse over the
  actual row length) would flush west's partial row at the TOP like east and
  DESTROY the mirror. Grok independently reached the same conclusion ("using
  perRow, not cards-in-this-row, is the right choice"). Kept perRow-based
  reversal; pinned by T10.
- **LOW — the direction test only pins the formula text, not a partial row.**
  Addressed via the round-1 test-strengthening (tuple + reserve-shape pins).
- **LOW — comment says "3 rows of 9".** Same as Grok MED 3. **ACCEPTED.**

Codex's gate was blocked by its read-only sandbox (EPERM mkdir), not a failure.

## Fixes applied (producer)

1. `seatStackPerRow` pins `perRow` at the cap (14) whenever wrapped — a full top
   row + the remainder, not balanced — so the lay-axis extent is constant across
   every wrapped count 15…27, the 15→14 unwrap is continuous on the lay axis, and
   the wrapped block box matches the deal reservation (always 2×14). (Grok MED 1)
2. T10 east/west/north row-step pins now require `* var(--gd-stack-aspect)` and
   the `(aspect-1)/2` recentre. (Grok MED 2)
3. All "3 rows of 9 / a third" comments corrected to "2 rows of 14/13 / about
   half"; `--gd-stack-n` documented as a non-layout reserve/test signal.
   (Grok MED 3 / LOW 6, Codex LOW)
4. Reserve suite pins `--gd-stack-rows:2` + `--gd-stack-perrow:14`; the mid-deal
   test asserts the exact `(i,pos,row)` tuples; new `seatStackPerRow` unit test
   pins the constant-perRow property. (Grok LOW 4/5)

## Round 2 (fix re-audit)

Both auditors re-checked the 5 fixes on refreshed clones with the identical brief.

- **Grok — CLEAN, no remaining findings, no new regressions.** Re-derived item 1
  (capacity `14×2 = 28 ≥ 27` → no overflow; box invariant across 15…27; unwrap
  continuous on the lay axis; matches the deal reservation) and item 2 (offset
  tables for 15/20/27 confirming east↔west is an exact vertical mirror under the
  now-larger fixed-cap gaps; the actual-row-length counterfactual flushes both at
  the same end and destroys the mirror). Gate: **880 tests, typecheck, lint,
  build all PASS.**
- **Codex — CLEAN, no remaining findings; CONCEDED its round-1 MED.** It
  re-derived count=20 itself ("east leaves the gap at the bottom; west uses
  `perRow-1-pos` so row 1 occupies 13…8, gap at the top — that is the vertical
  mirror. Using actual row length 6 would put west at 5…0, flush with east's top,
  breaking the mirror") — i.e. it now agrees the rejected fix would have been
  wrong. Confirmed items 1, 3, 4, 5. Its gate could not run (the clone refresh's
  `git clean` removed the node_modules symlink — environment, not code);
  `git diff --check` clean.

**Verdict: clean.** Two independent models converge — the change tiles, the
east/west mirror holds on both axes including partial rows, the wrapped block box
is constant and matches the deal reservation, and the tests pin the load-bearing
invariants. Gate green locally and in Grok's clone (880/880 + typecheck + lint +
build).

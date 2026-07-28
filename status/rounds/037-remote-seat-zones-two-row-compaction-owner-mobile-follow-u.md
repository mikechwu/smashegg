> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Remote seat zones: two-row compaction (2026-07-17) — owner mobile follow-up — local, unpushed

Owner directive (screenshot of the ring on a phone): the remote card-back blocks are now
realistic but the full-hand SIDE strips are tall — compact them into "two or three rows,
partially overlapping"; test the n-row arrangement + the name overlay for the optimal
mobile presentation; collaborate with Grok and Codex (review code or UI snapshots).

Tested 1/2/3 rows from one deal (in-page override of the row vars, both widths). Finding:
the ring HEIGHT barely moves with row count (the ring is a fixed grid; the side strips fit
their cells), but the horizontal CENTRE GAP collapses — at 390px 3-row sides run ~2.9
card-widths across each and leave only ~48px between opponents (trick area crushed), while
2 rows keep ~120px and turn the tall strip into a tidy near-square. **Chose 2 rows** (3
stays desktop-viable if the owner prefers). Kept the name/count/block vertical stack (the
decoupling from last round); the compaction comes from the cards, not the overlay.

Built: SeatStack wraps its backs into `rows` rows of `perRow` (helpers.seatStackRows /
seatStackPerRow) — ≤14 cards one line, 15+ two rows. Geometry generalised to TWO axes in
table.css off per-slot --gd-stack-pos (lay, step --gd-stack-exposure) and --gd-stack-row
(cross, step new --gd-stack-linefrac × --gd-stack-aspect). R10 holds within each row
(north/east straight, west reverses over perRow) AND rows grow inward toward the centre
from each seat's own edge (east reverses the row index, west straight) — the two sides
mirror on BOTH axes. perRow is pinned at the cap once wrapped (full top row + remainder,
NOT balanced), so the lay-axis extent is CONSTANT across every wrapped count 15…27 (no
grow-on-play, the 15→14 unwrap continuous on the lay axis) and the wrapped block box equals
the deal reservation (always 2×14). rows/perRow derive from the SIZED count, so `reserve`
shapes the block for its final 2×14 from the deal's first frame — the extent never reflows
as cards land.

Cross-model panel (Codex + Grok, isolated clones, identical brief, each re-ran the gate;
producer≠auditor). Grok: no HIGH; confirmed the calcs tile, the mirror holds on both axes,
the deal freezes both axes; raised balanced-perRow grow-on-play (accepted+fixed via the
constant-perRow policy), a pin missing the aspect factor (tightened), stale comments
(fixed), + LOW test strengthening (done). Codex flagged west's partial-row reversal as a
mirror break — **REJECTED**: west's partial row is the exact vertical mirror of east's
(both leave the gap one step from the extreme end, at mirrored ends; Grok independently
concurred and re-derived the offsets for 20=14+6). Fix RE-AUDIT — Grok CLEAN (re-derived
item-1 no-overflow 28≥27 + constant box + item-2 mirror under the larger fixed-cap gap;
gate 880/880 + typecheck/lint/build); Codex confirmatory. Record: docs/audits/
seatzone-multirow-panel.md.

Gate 880/880; typecheck, lint:hooks, build clean. Live-verified 390 + 1456 [en] + 390
[zh-Hant], settled and mid-deal: 2-row blocks, mirrored side columns, "27 cards"/「27 張」,
one-by-one growth in the reserved 2×14, R10 per-row order measured in both states.
Committed locally; push only on the owner's word.

Known pre-existing (NOT this change): all three blocks translate down ~23-28px together at
the deal→play transition (headline gains a "turn" line + the active pill gains its timer) —
a shared-ancestor settle, orthogonal to the per-block wrap; the block box itself is frozen
by `reserve` through the deal.

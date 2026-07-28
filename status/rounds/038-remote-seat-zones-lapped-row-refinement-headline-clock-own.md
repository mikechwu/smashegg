> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Remote seat zones: lapped-row refinement + headline clock (2026-07-17) — owner follow-up — local, unpushed

Owner directive (six items on the approved two-row build): (1) deal realism — cards fill
the two rows ALTERNATING column by column (2nd card row 2, 3rd card row 1 col 2), not row
1 first; (2) deeper overlap between the rows; (3) flip the row order — 1st row paints ON
TOP of the 2nd; (4) with row 1 on top it shows whole cards, so ride it partly OUTSIDE the
block boundary showing only ~half its height; (5) relocate name tag + count into the freed
space; (6) move the countdown out of the seat pill into the headline area with best UI
practice. Collaborate with Grok and Codex.

Built: helpers.seatStackSlot — DEALING maps alternating (row = i mod 2, col = ⌊i/2⌋, the
owner's exact description), SETTLED maps row-major (so play-time shrinkage peels the
mostly-hidden inner row and the lay extent never moves); the two occupy IDENTICAL slot
sets at the deal's final 27 (= 2·cap − 1), the only count where `dealing` flips, so the
swap never repaints a pixel (unit-pinned). Geometry: --gd-stack-linefrac 0.5 → 0.36 (with
the front row on top this IS the inner row's visible sliver), new --gd-stack-peek 0.5 and
derived --gd-stack-clip = (rows−1)·(1−peek) subtracted from every cross-axis size and from
north/west row offsets (their outer edge is coordinate 0; east's crop falls out of its
clip-narrowed width — same mirror, expressed at whichever edge is outer);
.gd-seatstack--wrapped { overflow: hidden } crops ONLY wrapped blocks; slot z-index
(rows−1−row) carries ONLY the row flip, DOM order still resolves within a row (R10
newest-on-top intact). A wrapped block is now 0.86 of ONE card deep — shallower than a
single card (was 1.5) — the 390px centre gap grew 122 → 215.6px. Item 5: the count chip
moved INTO the pill (tiers/aria/"—" intact, deal-time counting suppressed tiers) and the
pill goes ABSOLUTE, lapping the block's outer edge (zone --stacked modifier; stack z 0
seals slot z; width: max-content after a live find — see below); a zone without a block
(finished/hidden/pre-deal) keeps the in-flow pill. Item 6: SeatPlate lost every timing
prop; TableHeadline's turn line carries ONE clock chip at its far end (planning word
inside the chip, urgent fill+pulse only when yourTurn ∧ ≤10s — the old own-seat rule
relocated intact), bound to the seat the sentence NAMES (yours on your turn, else the
named actor), minus concealed leader, ceremony/deal suppressed.

Live-verified (390 + 1456 [en], 390 [zh-Hant]; mid-deal + settled): alternating fill per
slot, row-major settled, ring-relative reserve stability (size AND position), peek/sliver/
box measured 0.5/0.36/0.86, z-flip live, pill laps block with "27 cards"/「27 張」chip,
headline "Planning time 80"/「起手思考 80」chip, zero .gd-plate__timer nodes. One live
find, pinned then fixed: the absolute pill's shrink-to-fit width is CAPPED at the zone box,
squeezing a partner-tagged CJK name to an ellipsis (zh-Hant 390) → width: max-content on
the lapping pill (+ T3 pin); re-probed clean in both locales, partner tag included.

Cross-model panel (Codex + Grok, isolated clones, identical brief BRIEF-REFINE.md;
producer≠auditor): CONVERGED on one real defect — the headline clock's soonest-of-
concurrent-deadlines pick could pin another payer's grace-clamped clock (and its urgency)
on "Your turn"/the named actor's line, since per-seat budgets genuinely diverge (server
disconnect-grace clamps; both auditors cited room-helpers.ts; my "same duration" comment
was wrong). Fixed: the chip binds to the seat the turn sentence NAMES (yours on your turn,
else actorSeats[0]), reading that seat's own deadline; + three concurrent-unequal-deadline
integration pins; + the swap-equality claim bounded (identical sets iff columns full:
n ≤ 14 or 27/28 — pinned with the 20-count inequality; skip path = count jump to settled);
+ the planning word regained its `connected` gate. Two Grok LOWs acknowledged-kept (the
6.5rem long-name cap is policy; string-level CSS pins are the DOM-free technique's known
depth, live probes cover the algebra). Full record: docs/audits/seatzone-refine-panel.md.
Gate 901/901 (55 seat-stack + 10 headline-clock); typecheck, lint:hooks, build clean.
Committed locally; push only on the owner's word.

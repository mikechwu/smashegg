> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Seat zones: flank layout, pass fade, split clocks, unified card sizes (2026-07-17) — owner follow-up — local, unpushed

Owner directive (five items on the lapped-rows build): (1) no name overlay ON the cards —
the name moves to each player's RIGHT-HAND side; (2) the count on the cards' OTHER side,
and PASS leaves the pill: it fades in over the passer's cards and fades off after ~2s;
(3) the countdown sits directly beside the turn sentence, and on YOUR turn an additional
countdown shows above the High→Low sort pill; (5) the ceremony/cut/deal cards use the same
size and style as the playing cards.

Built: SeatPlate is identity-only again (dot/name/tags/badge/committed chip); the count is
a standalone SeatCount chip (tiers/aria/"—"/deal count-up intact); the zone's DOM is always
[pill, cards, count] and CSS turns it into each seat's handedness (the R10 translation):
north a row (pill left = north's right hand, count right), east a column (pill above),
west column-REVERSE (pill below) — with NORTH's flanks position:absolute at right:100%/
left:100% + width:max-content over the ring's empty corner cells, after two dead ends at
390 (track-sized row pushed EAST off the viewport; a flex squeeze crushed the pill to a
bare dot — both caught live, pinned, fixed). Pass: .gd-seatzone__pass keyed per seat,
gd-passfade 2.8s fill-forwards (in by 8%, hold to 71% ≈ 2s, out to 0), base opacity 0 so
reduced-motion never shows it; the feed stays the durable record. Clocks: the headline
chip lost margin-left:auto (8px after the sentence); new .gd-handclock in the actionsRow
sort cell when yourTurn ∧ !concealed ∧ dueSeconds ≠ null, same ≤10s urgency. Sizes:
CutPanel ribbon+flip, CeremonyOverlay faces, DealOverlay deck/template/marker all
size="hand" (were mini/mini/trick); the cut ribbon's --sliver-w carries the .gd-card--hand
clamp (lockstep-pinned), ribbon max-width 18→20rem; .gd-seatstack base rule gained
z-index:0 (seals slot z under the pass fade); the whole --stacked lap CSS is deleted.

Live-verified (390 + 1456 [en], 390 [zh-Hant]; full drive cut → ceremony → deal → play →
pass): flank rects correct and on-screen; fade 1 → 0 on the passer's block only; headline
chip 8px from the sentence ("Planning time 80" / 「起手思考 81」); handclock on the actor's
tab; card widths unified 50.7 @390 / 68 @1456 across cut/ceremony/deal/fan.

Cross-model panel (Codex + Grok, isolated clones, identical brief BRIEF-FLANK.md;
producer≠auditor): see docs/audits/seatzone-flank-panel.md. Gate 910/910; typecheck,
lint:hooks, build clean. Committed locally; push only on the owner's word.

> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Remote seat zones: realistic hands (2026-07-17) — owner redesign + direction follow-up — local, unpushed

Owner directive (screenshot of the in-game ring): the seat overlay should sit ONLY under
the name, decoupled from the cards and the count; the cards should be REALISTIC — one
card back per card, the same back presentation the deal uses, accumulating one by one
during the dealing animation; side players' cards rotate 90° (top view); backs at the
same size as face-up hand cards but much more overlapped; pick the name/cards/count
arrangement by UX best practice; the count needs a UNIT. Follow-up: placement direction
must be consistent per player — each lays cards from THEIR OWN right to their left,
newest on top ("the card on the very left is on the very top"), so the two side strips
mirror each other.

Built (workflow: implement + static/live lenses + fix + live re-verify; R10 direction
delta + its pins by hand): new SeatStack (one real theme CardBack per remaining card,
hand-size clamp lockstep-pinned, exposure 0.09w single-source) as the pill's SIBLING
inside a new .gd-seatzone (pill = identity/state only; count label + stack directly on
the table; active ring stays on the pill); east/west strips vertical (±90°), north
horizontal; placement direction R10: north/east cascade straight with the index, WEST
REVERSES (newest at strip top) — paint order is DOM order, no z-index, all pinned (T10);
new game.stack.cards key in all three locales ("{count} cards" / "27 張" / "27 张") with
handSizeTier escalation kept and hidden-count configs rendering ZERO backs (no leak);
deal wiring: DealOverlay onRemoteLanded fires per remote landing (marker path included),
GameTable keys the counters BY dealNo (helpers.RemoteDealt — stale counters READ as zero
on a new deal's first frame, no reset effect, no hands-2+ flash), and a `reserve` prop
sizes each strip for the final count from the first dealing frame so the ring never
reflows against DealOverlay's once-measured flight rects; old MiniFan/FAN_CAP/
--theme-back-* injection deleted (metrics contract intact); narrow (<720px) chrome
compression (header/tabs/headline) so the hand sits a screen closer at 390.

Review found + fixed: (HIGH) mid-deal stack growth reflowed the auto-sized ring against
once-measured flight rects — fixed by the deal-time reservation, then live-confirmed:
strips at final extent from frame one, ring/deck/fan pixel-constant, 108/108 landings at
0px error at 1456 AND true-390; (MED) post-paint counter reset flashed stale 27s on hands
2+ — fixed by the dealNo-keyed read; (MED) hand a full scroll below the fold — narrow
chrome compression brought 390 to trick-well + hand-top simultaneously visible, full fan
reveal 339px → 165px; plus React.memo on SeatStack (81 SVG backs no longer re-reconcile
on the 500ms countdown tick), unanchored CSS pin scanner, tab-switch counter hardening.

Visual verification (locale stated with width): desktop 1456 [en] settled + mid-deal,
true-390 iframe [en] + [zh-Hant], zh-Hant desktop; one-by-one growth in strict round-robin
with labels tracking 1:1; pre-deal shows NOTHING at any remote seat; R10 cascade measured
mid-deal and settled (north lefts increasing, east tops increasing, west tops DECREASING,
DOM index = arrival order). Two low findings documented, not fixed (flights transiently
occlude the north pill mid-deal; a server auto-play during choreography settles straight
to the post-play count).

Codex read-only audit pre-commit (clean-auditor doctrine: Claude produced, Codex
audited; record + dispositions in docs/audits/seatzone-codex.md): its HIGH — hidden-count
rooms rendered the growing stack/label mid-deal, contradicting the visibility config then
flipping to "—" at settle — FIXED (null now wins over dealing in stackCountFor, ternary
re-pinned + a null-beats-reserve component pin); its LOW — en critical aria lacked the
unit — FIXED ("Only {count} cards left!", dead game.plate.cards key removed from all
locales); its MED (west mid-deal position) REJECTED on physics: the pile is deliberately
bottom-anchored mid-deal, first card fixed, growing toward the player's left — both
states live-measured.

Suite 872/872; typecheck clean; lint:hooks clean; build clean. Committed locally; push
only on the owner's word.

> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Lobby round table (2026-07-16) — owner design + three verified bugs — OPUS round — local, unpushed

Owner reported (screenshots + a design directive): the lobby's center ellipse is redundant;
typing a name in seat 1's form then clicking take-a-seat elsewhere behaved wrongly; a
seated player's name auto-appeared in the next seat's form; a degenerate lone-giant-card
state; and a DESIGN: keep the name panel separate, draw a REAL round table with 4 seats
around it, take-a-seat/leave on the seats, no rename (leave+resit covers it), no "Seat N"
labels — the geography IS the identity.

Root causes (all verified): the old lobby rendered a full pre-filled claim form inside the
FIRST empty seat — after any claim it MIGRATED (still filled) to the next empty seat (the
"name leak"), Enter submitted it to the first empty seat (a real wrong-seat path), and the
ring re-anchored on claim (cards shuffled). The lone-card state: seatCell returned null for
seats missing from the roster payload, so a short seats array rendered one flex-stretched
card.

Built (Opus implement + fix, Sonnet live/honesty lenses; my post-round polish): name panel
(no <form> — Enter structurally cannot claim), a felt-and-rosewood DISC with the room code
+ copy button ON it (the old code hero retired), four chips at fixed compass positions
(partners across; DOM order constant — no re-anchoring, pinned), take-a-seat per chip
claiming exactly that seat with the input clearing on submission (recorder pins,
red-then-green verified), leave on own chips, rename UI removed (transport kept), every
seat 0..3 always renders (lone-card impossible, pinned), no visible seat numbers (aria
keeps positional names). Review findings fixed: flank take-buttons wrapped 2-3 lines on
phones (button font/padding tightened; disc untouched) + a comment arithmetic drift; my
own 390 re-measure still caught the ENGLISH flank label at 2 lines after that fix —
shortened en 'Take a seat' -> 'Sit here' (zh 入座 already short); post-change measure:
single line everywhere, zero overflow (scrollWidth 375).

Visual verification (locale stated with width): desktop 1456 [en] + true 390 iframe [en],
REAL join flow (no token adoption): Enter claimed nothing; clicking the right seat seated
exactly that chip with the input clearing and no shuffle; second claim (self-play) took a
fresh name; leave returned the chip to empty (after a reload — my test iframe's hello had
taken over the seats, the documented newest-tab transport semantic, recovered by re-hello;
not a lobby defect); start gating + seated-only rule editing intact. Design note for the
owner: the disc uses a classic GREEN felt (new --felt tokens) — it reads instantly as a
card table against the lacquer/rosewood; flag if you want an on-lacquer tone instead.

Suite 836/836; typecheck clean; lint:hooks clean. Committed locally; push only on the
owner's word.

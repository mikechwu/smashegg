# Seat-zone refinement — cross-model panel (2026-07-17)

Scope: uncommitted working-tree diff refining the two-row remote-hand blocks
(owner items 1-6): alternating deal fill, deeper row lap (linefrac 0.36),
front-row-on-top z flip, boundary clip (peek 0.5), count chip into the pill
with the pill lapping the block, and the countdown relocated from the seat
pills to the TableHeadline turn line.
Producer: Claude. Auditors: Codex + Grok, each on an isolated clone with the
identical brief (`BRIEF-REFINE.md`), gate re-run by each. Producer did not
audit its own change.

Live verification before the panel (390/1456 en + 390 zh-Hant, mid-deal +
settled): alternating fill measured per slot, row-major settled, ring-relative
reserve stability (size AND position), peek 0.5 / sliver 0.36 / box 0.86 cardH,
z-flip live, pill laps the block, headline clock with planning note, zero
`.gd-plate__timer` nodes, centre gap at 390px 122 → 215.6px. One live find
pinned then fixed pre-panel: the absolute pill's shrink-to-fit width was capped
at the zone box and squeezed a partner-tagged CJK name into an ellipsis
(zh-Hant 390) → `width: max-content` on the lapping pill + T3 regression pin.

## Round 1

### Converged finding — headline clock misattribution (Grok HIGH H1 = Codex MED)

Both auditors independently: reducing the concurrent actor deadlines to the
SOONEST and gluing it to a single turn sentence + the yourTurn urgency rule is
incorrect, because per-seat budgets genuinely diverge — the server clamps a
disconnected actor's dueAt to its grace (src/server/room-helpers.ts, cited by
both). Concrete case (Grok): double tribute, you at ~70s planning, co-payer
grace-clamped to ~8s → the headline reads "Your turn" + urgent 8 although YOUR
budget is 70 (the old pills showed 70 on yours, 8 on theirs). Remote variant:
"Alice's turn · 8s" while Alice has 70. The diff's "every concurrent deadline
is armed with the same duration" comment contradicts the server. **ACCEPTED.**

### Grok — 1 HIGH + 2 MED + 3 LOW

- **H1** — above.
- **M1 — the tests RATIFY the soonest design** (source pin on the reduce; the
  only integration fixture has a single deadline), so H1 could regress
  silently. **ACCEPTED.**
- **M2 — the "swap invisible only at 27" framing overclaims.** Derived: the
  two mappings' occupancy sets match at n ≤ cap and n ∈ {27, 28}, DIFFER at
  15…26; and the skip/reduced-motion path ends the deal with partial landed
  counts — safe because the same render jumps the count source to the settled
  view (a fill jump, which skipping always meant), NOT because the flip
  happens "exactly at 27". Comment/test wording, not a live bug. **ACCEPTED
  (comments + bounded pins).**
- **L1 — the planning note lost the old `planning && connected` gate** (a
  disconnected actor's chip would still say "Planning time"). **ACCEPTED.**
- **L2 — the side pill's pre-existing 6.5rem max-width can still ellipsize
  very long names** despite the width: max-content fix. **ACKNOWLEDGED,
  KEPT** — the cap is the deliberate long-name policy (a pill must not run
  over the trick area); the fixed bug was sizing against the ZONE.
- **L3 — the T10/T12 CSS pins are string-level, not algebraic.**
  **ACKNOWLEDGED** — the DOM-free suite's known depth; the live probes cover
  the rendered algebra (peek/sliver/box measured 0.5/0.36/0.86).

Grok verified clean (its own derivations): east's width-crop exactly mirrors
west's negative-offset crop for aspect 1.0–1.7 including partial 20 = 14+6;
R10 survives the z-flip (z carries only the row flip, DOM within rows); the
zone seal contains slot z under the pill; overflow crops only wrapped blocks;
the dual mapping is set-equal at 27; hidden/finished/pre-deal/viewer pill
states correct; clock suppression matches the old pills for single actors.
Gate in its clone: **898/898, typecheck, lint, build all PASS.**

### Codex — 0 HIGH + 1 MED + 1 LOW

- **MED** — the same clock misattribution (seat lost in the soonest
  reduction; urgency keyed to yourTurn against another seat's seconds).
  **ACCEPTED** (same fix).
- **LOW** — same as Grok M1 (multi-deadline integration coverage).
  **ACCEPTED.**

Codex verified clean: wrapped cross span 1 + linefrac − clip = 0.86 cardH;
north/west negative-offset crop vs east's narrowed-container crop mirror;
partial 20 = 14+6 tiles (lay extent pinned at perRow 14); set equality at 27;
the zone z-seal; clip scoped to --wrapped; pill count states. Its gate:
typecheck + lint pass; vitest/build hit EPERM in its read-only sandbox
(environment, not code — the temp dirs; producer's local gate and Grok's
clone gate both green).

## Fixes applied (producer)

1. **Named-seat clock** (H1/Codex MED): the chip binds to the seat the turn
   sentence NAMES — `clockSeat = yourTurn ? activeSeat : (actorSeats[0] ??
   null)` — reading that seat's own deadline only; the false "same duration"
   comment replaced with the server-clamp rationale; conceal/ceremony/deal
   gates unchanged. Urgency is now always about YOUR OWN seconds.
2. **Multi-deadline integration pins** (M1/Codex LOW): three GameTable
   renders with concurrent unequal deadlines — remote pair shows the named
   seat's ~30 (not the 6s co-payer, no urgency); "Your turn" keeps your 70
   against a 6s co-payer (quiet); your own 8s pulses urgent against a slower
   co-payer — plus rewritten source pins (named-seat selection, no
   `dueAt < min.dueAt` anywhere).
3. **Bounded swap claim** (M2): helpers.seatStackSlot doc states the exact
   equality bound and the skip-path count-jump rationale; the unit test pins
   equality at 1/5/14/27 AND the 20-count inequality.
4. **Connected planning gate** (L1): `planning = timingClass === 'planning'
   && clockConnected` off the named seat's room entry.
5. L2/L3 dispositions recorded above (no code change).

Post-fix gate: **901/901**, typecheck, lint:hooks, build clean; live re-verify
at 390 [en]: planning chip on the turn line, alternating fill, reflow + lap
checks all green.

## Round 2 (fix re-audit)

Both auditors re-checked the five dispositions on refreshed clones
(REAUDIT-REFINE.md).

- **Grok — no HIGH, no MED; 2 LOW (doc drift), both then fixed.** Re-derived
  every disposition: the named-seat binding matches actorName's seat in every
  phase the old pills handled (playing, planning, tribute/return multi-actor,
  timed and untimed anti-tribute, concealed leader, ceremony/deal), the
  co-payers keep their active rings, and there is NO phase where the old
  pills showed a timer for the NAMED seat that the headline now cannot.
  Confirmed the new tests would turn red under a soonest regression (the two
  integration cases + the source pin), re-derived the occupancy bound
  (1/5/14/27/28 equal, 20 unequal) and the skip-path count-jump rationale,
  and confirmed the connected planning gate matches the old pill. Its two
  LOWs — a stale "soonest" JSDoc on TableHeadline.dueSeconds and the same
  wording in STATUS.md — were fixed immediately (JSDoc rewritten to
  named-seat semantics; STATUS corrected). Gate in its clone: **901/901,
  typecheck, lint:hooks, build all exit 0.**
- **Codex — no HIGH; 1 MED (clone packaging) + 1 LOW (the same doc drift),
  all five dispositions CONFIRMED.** Confirmed the named-seat binding (reads
  only that seat's deadline; suppression gates intact; co-actors keep rings),
  that the three unequal-deadline cases would fail under a global-soonest
  regression, the bounded equality claim + 20-inequality pin, and the
  connected planning gate. Its MED: headline-clock.test.tsx was UNTRACKED in
  the clone, so the clone's own `git diff HEAD` omitted the new suite — an
  artifact of `git apply` not staging new files there; in the producer repo
  the file is intent-to-add tracked and the commit stages everything
  (verified at commit time below). Its LOW: the same stale "soonest" JSDoc
  Grok found — already fixed. Gate in its clone: typecheck + lint pass;
  vitest/build EPERM in its read-only sandbox (environment, not code — same
  as round 1; Grok's clone and the producer repo both ran the full gate
  green).

## Verdict

**Clean.** Two independent models converged twice: round 1 on the one real
defect (the soonest-deadline clock misattribution — fixed by binding the chip
to the named seat) and round 2 on the fixes being correct and pinned. The
geometry (alternating deal fill, deeper lap, front-row z-flip, boundary clip,
east/west mirrored crops), the dual mapping with its bounded swap-equality,
the pill lap with the count chip, and the relocated clock all hold under both
auditors' independent derivations. Residual round-2 items were doc drift and
clone packaging, both resolved. Gate: 901/901 + typecheck + lint:hooks +
build, green locally and in Grok's clone; live-verified at 390/1456 [en] and
390 [zh-Hant], mid-deal and settled, before and after the fix round.

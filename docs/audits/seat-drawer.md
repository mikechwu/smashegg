# Seat drawer + CUMULATIVE seat path — cross-model audit (2026-07-22)

Scope: the item-1b relocation (the sit-then-name ask moves from the felt
disc into a full-width drawer row adjacent to the pressed seat; Lobby.tsx
+ app.css + lobby pins) AND, per the owner's guard 4, the WHOLE seat path
as three rounds of changes now compose (sit-then-name + claiming lock →
blank-when-ambiguous prefill → the drawer). Producer: Claude. Auditors:
Codex + Grok in isolated clones; Grok ran the full suite green
(1039/1039 at audit time) and produced the composite call graph as
evidence; both were prior design-round consultants, disclosed.

## The cumulative question (guard 4): LOAD-BEARING SAFE — both lineages

Both walked the composite end to end and concur: **exactly one claim
funnel** — the two UI orders both gate (trimmed non-empty name, explicit
seat, the claiming lock, the empty-confirm early return) and converge on
takeSeat → store.claim → connection.claimSeat → the DO's serialized
handleClaimSeat, which mints the token once; the drawer patch touches no
store/connection/protocol/server file. Grok's guard-4 table: no second
claim site, no auto-claim, no prefill→mint path, no drawer-class leak,
no reset missed by the relocation (the state never lived in the panel).

## The composite catches — what guard 4 exists for (all fixed + pinned)

- **MED (both lineages, concurring): the retarget lock leak.** Pressing
  another seat while a drawer claim was in flight carried sitAskClaiming
  onto the NEW ask; the old seat's success echo checks the new sitAsk,
  so the new drawer wedged in "sitting down" until cancel. Fixed: a
  retarget is a NEW ask session — the open handler resets the lock (the
  orphaned flight belongs to the old seat; the DO serializes both).
- **MED (Grok): the orphan drawer.** A direct name-then-sit claim for
  seat B while seat A's drawer was open left A's drawer standing. Fixed:
  a direct claim supersedes any open ask (full ask reset).
- **MED (Codex, second-order): the in-flight prefill window.** After any
  claim, writeLastName has already stored the submitted name while the
  roster echo lags — a fast retarget prefilled the JUST-CLAIMED identity
  into the new ask, sidestepping blank-when-ambiguous. Fixed: both claim
  paths stamp lastClaimAtRef; the ask-open widens holds-a-seat with
  "a claim from this client < 10s ago".
- **LOW (Grok, fixed):** SitAskPanel now keyed by seat — a retarget
  remounts, so autofocus re-fires. **LOW (both, fixed):** the stale
  on-the-felt-disc comments in SitAskPanel and .lobby-sitask.
- **LOW (acknowledged, kept):** cancel-after-confirm cannot abort the
  wire claim (no request cancellation by design — the seat then simply
  appears claimed); disconnect mid-claim relies on the disabled confirm
  + cancel; "the pressed chip stays visible" is live-checked per
  position at 390px but not a repo pin (the keyboard half of that
  question is the declared M5 device boundary either way).

## Diff conformance (P1–P3): both lineages PASS

Drawer rows match the two insertion slots (top slot for seat 2, mid slot
otherwise — the bottom seat opening ABOVE itself per P2); the disc keeps
the room code unconditionally; the connector nub rides the pressed chip
(seat 0 pointing up) so alignment is correct by construction; the flank
slide is scoped to the pressed chip alone; the open is a 200ms one-shot,
instant under reduced motion; the input is 16px — which also FIXED a
live iOS-zoom bug (the old 0.9rem/14.4px input would zoom the page).

## Verification boundary (guard 3, stated)

The 390px iframe verified GEOMETRY: all four positions' drawers
on-screen and adjacent at a 10px gap, correct nub directions, the chip
ringed and on-screen, the code visible, 16px computed, focus landed —
plus desktop and reduced-motion probes, and the full drawer flow seating
through the unchanged claim path. **iOS soft-keyboard occlusion is NOT
verifiable in this environment** — it is a named M5 real-device check,
batched with the elder session.

## Post-fix state

Gate 1043/1043 (43 files) + typecheck + lint:hooks + build; both live
suites re-run green on the fixed code (7/7 drawer + 6/6 prefill/clear).

## Verdict

**Drawer: ship (both lineages). Cumulative path: load-bearing-safe, and
now clean on the three composite lifecycle edges the whole-path re-look
surfaced** — the owner's instinct that three correct steps don't
guarantee a correct composite found exactly three real holes.

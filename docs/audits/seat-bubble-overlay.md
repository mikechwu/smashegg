# Seat bubble overlay — cross-model audit (2026-07-22)

Scope: the owner overlay round — the inline SEAT DRAWER (923bdec) replaced by a
floating speech-bubble OVERLAY with a tail pointing at the pressed seat. Files:
src/client/Lobby.tsx (SitAskPanel + seatChip + the empty-seat button onClick),
src/client/app.css (the .lobby-bubble system; the .lobby-table--drawer* grid
swap deleted), src/client/i18n/locales/*.json (removed lobby.sitAsk.title +
.prompt, added .nameFor), tests/unit/client/lobby.test.tsx. This is the FOURTH
consecutive seating round (sit-then-name, prefill blank-when-ambiguous, the seat
drawer, now the overlay), so the owner's PRIMARY ask was the CUMULATIVE
seat-path: do the load-bearing token/redaction semantics still hold across the
accumulated changes? Producer: Claude. Auditors: Codex (isolated clone,
reasoned-only) + Grok (isolated clone; suite green 1072/1072; mutation-tested
the new pins) + a 9-agent workflow sweep (five dimensions, findings
adversarially verified with default-refute).

## The cumulative token/redaction question (the owner's PRIMARY ask): HOLDS

All three lineages independently confirmed the load-bearing invariants survive
the overlay move — this round is presentation-only:

- **The ONE claim path is untouched.** `store.claim` appears exactly once
  (inside `takeSeat`, Lobby.tsx); `takeSeat` is called in exactly TWO UI places
  — the name-ready fast path and the bubble confirm — and NEVER in the
  retarget/open else-branch. So a retarget mints nothing (verified by Codex +
  Grok + the workflow; Grok's mutation #3 — a `takeSeat` in the retarget branch
  — was CAUGHT by the count===2 pin).
- **Server redaction is intact.** game-room.ts `handleClaimSeat` (~1174-1178)
  mints the raw token, persists only its SHA-256 `token_hash`, sends
  `{seat, name, token}` to the CLAIMER and `{seat, name}` (no token) to every
  other socket; `buildRoomInfo` exposes only `{seat, name, claimed, connected}`.
  No UI change in any of the four seating rounds can reach a foreign token —
  the client stores a credential only when `msg.token !== undefined` on a
  seatClaimed addressed to it, and the Lobby reads ownership only via
  `snapshot.seats` (a Map of OUR credentials), never a roster token.
- **Live-verified end to end** at true 390px zh-Hant: retarget → confirm → the
  seat is claimed, `isYou` true (a token minted for us), the bubble closes on
  success. And the connected happy path still claims after the disconnect-guard
  fix below.

## The overlay properties

- **No reflow (verified):** the table className is CONSTANT (the
  `lobby-table--drawer` grid-area swap is deleted from both TSX and CSS); the
  bubble is `position:absolute`, out of flow, so opening it cannot reshape the
  grid.
- **Tail aims by construction (verified live + by mutation):** the bubble is
  anchored INSIDE the pressed seat's CHIP; per-seat CSS centers it on the
  seat's cross-axis and puts the border-triangle tail on the seat-facing edge.
  Measured at true 390px: dx=0 for top/bottom, dy=0 for the flanks — ZERO
  cross-axis offset for all four seats, every bubble fully on-screen. Grok's
  mutation #1/#1b (wrong tail side) was CAUGHT.
- **Keyboard:** the bubble is `absolute` (in the scrollable document), NOT
  `fixed`, so iOS's native scroll-focused-input-into-view still fires; input is
  16px (no iOS auto-zoom; Grok mutation #5 CAUGHT). Real soft-keyboard
  occlusion is UNPROVABLE in the iframe — batched into M5 (below).

## Findings (all addressed same-round)

- **MED (Codex): the flank tail was anchored to the seat WRAPPER, not the
  chip.** `.lobby-tableseat` is `width:100%` while `.lobby-seat` is centered and
  capped at `max-width:11rem`. At 390px they are equal (verified), but on a WIDE
  layout the flank column exceeds the chip, so the s1/s3 tail would point past
  the chip toward the disc. FIXED: the bubble now renders INSIDE `.lobby-seat`
  (position:relative), so it anchors to the chip. Re-verified live at a 760px
  layout: the wrapper is 64px wider than the chip, yet the bubble's edge lands
  at the CHIP's edge (−6px, the tail bridges the gap), not the wrapper's
  (−214px away). Grok did NOT independently find this (it checked robustness to
  chip HEIGHTS, not wrapper-vs-chip WIDTH) — the lineage-diversity payoff.
- **LOW (Codex): retarget preserved the name even with a confirm in flight.**
  Retargeting AFTER a confirm fired (sitAskClaiming true) preserved the
  just-committed identity into the new seat's bubble, re-opening the
  blank-when-ambiguous gap in that narrow window. FIXED: a `claimInFlight`
  guard runs the prefill (blank-when-ambiguous) on a retarget when a claim is
  in flight, and preserves the name ONLY on an uncommitted retarget. The
  workflow sweep independently REJECTED a related "same-seat re-press →
  duplicate claim" finding precisely because this fix blanks the name, so the
  second confirm hits the blank-name guard.
- **LOW (workflow sweep): disconnect parity did not cover the Enter path
  (PRE-EXISTING).** The confirm button is `disabled={claiming || !connected}`,
  but the input's Enter → onConfirm fired unconditionally, so Enter could claim
  over a dead socket and wedge the panel on "sitting down" (no rejection
  arrives to unwedge). Verified byte-identical to the drawer's panel at 923bdec
  — NOT a regression from this round. FIXED same-round per the ratchet: onConfirm
  now returns early when `!snapshot.connected`, so Enter respects disconnect
  too. The connected happy path is unaffected (re-verified live).
- **INFO (workflow sweep): the claiming hint was not a live region
  (PRE-EXISTING).** "Sitting down…" had `role={needName ? 'alert' : undefined}`,
  so AT got no in-flight feedback — contradicting the panel's own "never looks
  like silence" contract. FIXED: `role='status'` while claiming.
- **LOW (Grok): a structural pin could match a vacuous window.** The
  "nothing claimed on retarget" negative asserts extract a regex window that
  could pass vacuously if collapsed (mitigated by the global count pins).
  HARDENED: the window is now asserted non-empty before the negative checks.
- **INFO (Grok): the debug-dump endpoint exposes token_hash** behind the
  DEBUG_DUMP_TOKEN gate — raw token never in the public path; existing, out of
  overlay scope.

## Clean areas (per the auditors, one line each)

Claim funnel (store.claim ×1, takeSeat ×2, retarget claims nothing) — clean.
Server claimer-only token + hash-only persistence + roster-sans-token — clean.
Client stores only its OWN minted token; Lobby never touches a foreign token —
clean. No-reflow (constant table className, absolute bubble) — clean. Tail
robustness to the OTHER seats' chip HEIGHTS (own-wrapper anchoring, no
table-level measurement) — clean. Retarget preserves name on an uncommitted
retarget; blank-when-ambiguous on a fresh open — clean. a11y (input aria-label
carries the seat; the × cancel is labelled) — clean. Locale parity (title +
prompt removed, nameFor added, consistent across en/zh-Hant/zh-Hans) — clean.
Guard-3 16px — clean. All five Grok mutations CAUGHT, zero slips.

## Verification boundary (stated)

The iframe verified GEOMETRY at true 390px (tail dx/dy=0 all four seats,
on-screen) and the wide-layout chip-anchor at 760px, plus the full claim +
retarget behaviors in a real dev lobby. NOT provable here: real iOS
soft-keyboard occlusion (the iframe has no soft keyboard) — the bubble is
`absolute` (in-document, gets scroll-into-view) and opens every seat toward the
upper-central band, but device confirmation is an M5 real-iPhone check.

## Post-fix state

Gate 1072/1072 (45 files) + typecheck (4 tsconfigs) + lint:hooks + build
(bundle ~unchanged). New pins added for both fixes (chip-anchor, claimInFlight
gate, disconnect-parity-on-Enter, claiming live region) and the vacuous-window
hardening.

## Verdict

**Ship (both lineages + the sweep): the cumulative seat-path and redaction
semantics hold under the overlay move; the overlay never reflows; the tail aims
at every seat by construction (verified to dx/dy=0 at 390px and chip-anchored on
wide layouts); retargeting moves the tail and the claim target without
double- or half-claiming. Two producer findings (chip-anchor, claimInFlight)
and two pre-existing gaps the sweep surfaced (disconnect-on-Enter, claiming
live region) were fixed same-round and pinned.**

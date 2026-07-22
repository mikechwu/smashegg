# Sit-then-name — cross-lineage audit (2026-07-22)

Scope: the silent-no-op round item-2 change (Lobby.tsx sit-then-name ask,
app.css, 3 locales, lobby.test.tsx pins). Producer: Claude. Auditors:
Codex + Grok in isolated clones (neither produced the change). The
owner-named question: the seat-claim path is LOAD-BEARING (tokens gate
per-seat redaction) — this must be UI-only, the token minted exactly as
before, once, by the same claim call.

## Both lineages: the load-bearing question HELD (no HIGH)

- Exactly ONE `store.claim` call site (inside takeSeat); both orders
  route through it verbatim with the same trimmed-name + explicit-seat
  args; the patch touches no store/connection/protocol/server file; the
  top name panel still has no form/submit path (the old owner bug's
  auto-claim stays impossible); an empty or whitespace confirm never
  claims; a stale ask against an already-taken seat can send a claim but
  the DO rejects it before minting. Grok ran the suite in its clone
  green and walked the full call graph (its table: no second claim path,
  no auto-claim, no retry loop, no timing/args/idempotency change).

## Findings → outcomes

- **MED (both lineages, fixed):** the ask's confirm had no in-flight
  guard — a double-tap (elders' default) sent DUPLICATE claimSeat
  messages. Authority was never at risk (the DO rejects the second
  without minting), but the surfaced seat.taken rejection after a
  SUCCESSFUL sit read as failure, and the ask's round-trip wait
  lengthened the vulnerable window. Fixed: a claiming lock — one claim
  per confirm, the confirm disables, and the hint says "Sitting down…"
  (a visible wait, never a dead button); a growth-only rejection watcher
  unwedges the lock if the claim fails for a reason the roster never
  shows. Pinned (render + wiring).
- **MED/LOW (both lineages, fixed):** the confirm stayed enabled while
  disconnected, unlike the take buttons. Fixed: disconnect parity
  (disabled with the room-level alert carrying the explanation — the
  same one-allowed-disable policy the take buttons document). Pinned.
- **LOW (Grok, fixed):** the top panel's hint still taught name-first as
  the only order — copy updated in all three locales to name both paths.
- **LOW ×3 (acknowledged, kept):** the localStorage prefill is client-
  only display data with try/catch (untested in private mode); no
  event-level double-click/race tests (the pins are source/static-render
  per the DOM-free suite idiom; the live driven checks cover the race
  end-to-end); a pre-existing message-ordering edge can show "taken" if
  a seatClaimed token is lost while the roster updates (predates this
  change; the UI now at least says SOMETHING there).

## Post-fix state

Gate 1019/1019 (42 files) + typecheck + lint:hooks + build; live re-run
on the fixed code: 11/11 zh-Hant checks at TRUE 390×844 (all four seat
positions' panels on-screen, the empty-confirm explanation, the full
sit-then-name completion, the race-loser message, the unchanged
name-then-sit fast path, multi-seat under both orders, the prefill).

## Verdict

**UI-only confirmed by both lineages — the token mint path is untouched;
ship.** The panel's real catch (the duplicate-claim window) was a UX
integrity issue, not an authority one, and is fixed and pinned.

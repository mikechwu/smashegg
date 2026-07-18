# Tabs-removal + play-flight round — cross-model panel (2026-07-17)

Scope: uncommitted working-tree diff removing the Seat 1-4 tab bar (the name
pill of a HELD seat is the switcher now) and adding the play flight — a
played hand's cards fly FACE UP from the player's pile to their own
trick-well slots, 100% hidden at t0 behind the pile, emerging from its
table-facing edge, unsorted in flight (deterministic jitter/stagger), the
well's fresh cards hidden until each flight lands.
Producer: Claude. Auditors: Codex + Grok, isolated clones, identical brief
(`BRIEF-PLAYFX.md`), gate re-run by each. Producer did not audit its own
change.

Verified before the panel: SeatTabs confirmed pure client-local view
switching (renders nothing for one held seat) before removal; live 390 en
drive via pills only (cutter reached by pill cycling; "Switch to 阿華" flips
the bottombar identity; zero .gd-tabs nodes); the south flight (fx airborne
while the well card hides, landing reveals it, fx retires to display:none)
and a REMOTE flight (north pile 27 → 26 with the joker airborne, captured
via a mid-flight viewer switch). Gate 922/922 + typecheck + lint + build.

## Round 1

### Grok — 0 HIGH + 3 MED + 5 LOW (gate in its clone: 922/922 + tc/lint/build PASS)

- **M1 — first-paint flash.** The well's fresh cards commit VISIBLE and
  PlayOverlay's post-paint useEffect only hides them afterwards — "the
  landing is the reveal" loses a frame (cards pop on the table, vanish,
  re-emerge from the pile). **ACCEPTED.**
- **M2 — the viewless waiting screen lost its only switcher.** Per-seat
  views arrive staggered; while the ACTIVE seat's view is missing the ring
  (and every pill) does not render — the old tabs still worked there. A
  multi-seat client can sit stuck on a viewless seat while another held
  seat already has a table. (Codex independently noted the same edge,
  unconfirmed as a stable stuck state.) **ACCEPTED.**
- **M3 — mid-flight sweep ghosts.** trickWon re-keys the well empty while a
  flight is airborne (< 1600ms): the animations chase detached rects and
  orphan cards sail into the cleared centre until the gate unmounts.
  **ACCEPTED.**
- **L4 — the button's aria-label overrides its inner text** (dot/tags
  invisible to the accessible name). **ACKNOWLEDGED, KEPT** — "Switch to
  {name}" names the action and the seat, which is the button's job.
- **L5 — button.gd-plate reset incomplete** (no appearance/margin).
  **ACCEPTED.**
- **L6 — global document queries** (vs DealOverlay's closest('.gd-ring')
  scoping). **ACCEPTED.**
- **L7 — near-expiry viewer-switch partial re-flight** then hard cut.
  **ACKNOWLEDGED, KEPT** — the intended new-perspective semantics with a
  hard cap; cleanup still restores.
- **L8 — room.seatTab key kept.** **AS DESIGNED** (the name fallback).

Grok refuted its own suspicions on: rapid consecutive plays (old cleanup
restores before the next hide), countdown re-renders vs imperative
visibility, same-batch played+trickWon at start (empty-well bail),
last-card origin fallbacks, z-order, tribute/ceremony/deal interference,
jiefeng, the tick's self-expiry, nested buttons, the focus-ring cascade,
and event-vs-well card order (trick.ts shares the Play object).

### Codex — 0 HIGH + 1 MED + 0 LOW (gate: tc + lint pass; vitest/build EPERM
in its read-only sandbox — environment, as every round)

- **MED — PlayOverlay.tsx untracked in the clone** (git apply does not
  stage), so the clone's own `git diff HEAD` omits a module tracked code
  imports. Clone-packaging artifact (the producer repo intent-to-add
  tracks it; the commit stages everything — verified at commit below).
- Confirmed clean: the tabs removal loses no steady-state capability, the
  flight's cleanup/mismatch paths, reduced-motion ordering, and the
  keyed-overlay cleanup sequencing. Independently flagged the same
  viewless-waiting resilience note as Grok M2.

## Fixes applied (producer)

1. **Layout-effect hide** (M1): PlayOverlay's effect is a layout effect
   (local isomorphic guard — the deal gate's idiom), so the well's cards
   hide before the commit paints. Source pins added.
2. **Viewless auto-fallback** (M2): a GameTable effect switches
   setSelectedSeat to any HELD seat whose view has already arrived whenever
   the active seat's view is null — the waiting screen has nothing to
   preserve. Source pins added.
3. **Sweep kills the flight** (M3): the trickWon fold clears playFx; the
   overlay unmounts and its cleanup cancels + restores. Fold unit pin.
4. **Button reset hardened** (L5: appearance none, margin 0 — pinned) and
   **queries scoped** (L6: root.closest('.gd-ring'), pinned). L4/L7/L8
   dispositions recorded above (no change).
5. Codex's packaging MED: resolved procedurally — the commit below stages
   the new file (verified with git ls-files).

Post-fix gate: **922/922**, typecheck, lint:hooks, build clean; live re-drive
at 390 [en]: flight airborne with the well hidden, settled reveal, zero tabs.

## Round 2 (fix re-audit)

- **Grok — CLEAN: no HIGH, no MED, no new LOW; all three round-1 MEDs
  verified fixed.** Re-derived the fix-risk surfaces: the layout-effect hide
  runs before paint under React 18's commit order (the fold itself is a
  layout effect); the viewless fallback cannot loop or ping-pong (no
  setState when no alt has a view; React bails on identical state; store
  semantics don't flap A↔B) with one residual polish note (a single
  "waiting" frame can paint before the fallback — far better than stuck);
  same-batch played+trickWon folds sequentially to playFx null so the gate
  never mounts; hand-ending plays that skip trickWon are covered by the
  empty-well bail. Gate: **922/922 + typecheck + lint + build PASS.**
- **Codex — all dispositions CONFIRMED; 1 LOW.** Verified the layout-effect
  ordering, the fallback's no-loop behavior, the sweep clear, and the button
  reset. Its LOW: the query scoping kept a `?? document` fallback — true to
  the letter of the disposition's claim only in the ring-mounted product
  tree. **ACCEPTED + FIXED post-round**: the overlay now bails without a
  ring (DealOverlay's discipline), pinned with a no-`?? document` test;
  gate re-run 922/922 + tc/lint/build. Its gate: typecheck + lint pass;
  vitest/build EPERM in its read-only sandbox (environment, every round).

## Verdict

**Clean.** Round 1 produced three real MEDs (first-paint flash, the viewless
waiting screen's lost switcher, mid-flight sweep ghosts) — all fixed with
pins; round 2 verified every fix with no new MED/HIGH, and the one round-2
LOW (the defensive global-query fallback) was tightened to a hard bail. The
tabs removal was verified redundant before deletion, the pill switcher
reuses the exact client state the tabs called, and the flight's cleanup can
never leave the well hidden. Gate 922/922 + typecheck + lint:hooks + build,
green locally and in Grok's clone both rounds; live-driven at 390 [en]
entirely through pills, with the south flight and a remote-pile flight both
captured mid-air.

> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## UX timing/placement — reveal at the player's pace: anti-tribute deal-gate + on-table end-of-hand — shipping on the owner's word (2026-07-23)

Presentation-only round (owner: two playtest finds, one principle — information
at the wrong moment/place). Confirmed at diff level: only the client render layer
+ client tests changed; NO engine/server/shared/protocol/redaction/timing change;
the DO alarm stays the sole enforcer (Codex verified: no new/changed action, all
store.act calls stay render callbacks, deadline math display-only).

GOVERNING PRINCIPLE (owner): nothing about the cards is revealed or prompted
before the DEAL completes — the same rule the draw-cut ceremony set for the
leader. New pure gate `dealSettled({holdFan, dealing})` (helpers.ts, the
isCeremonyShowing precedent): true once the player can see their sorted hand.
Robust by construction — DealOverlay.onDone fires on animation-end, one-tap skip,
reduced-motion (instant) and a mid-deal reconnect (no re-fold → dealing false),
so it never strands anyone.

ITEM 1 — the premature-disclosure SWEEP (walked deal → tribute/anti → lead →
tricks → hand end from the player's view). PREMATURE, now gated on `settled`:
  • the anti-tribute REVEAL center panel ("Tribute resisted — both big jokers!"
    + the two joker faces) — THE REPORTED BUG; and the tribute PROMPT panel;
  • the ActionBar (incl. the anti-tribute invoke/decline buttons);
  • the whose-turn line, the clock, the active-seat ring;
  • the event LOG (its hand-start / anti-tribute lines wait too — Grok/sweep);
  • the seat committed-tribute chip (Codex sweep catch).
CHECKED, correctly timed (no change): DealOverlay + HandFan arrival slots + the
seat card-count (they ARE the deal); PlayDesk (suppressed while dealing/holdFan);
the play flight (gated); the hand-1 ceremony's own concealedLeader suspense;
jiefeng (feed-only, a PLAY-time event); the toast; the headline level/in-play tag
(ambient state, not card info / act-now). Live: after the deal settles the turn
line + clock + turn-ring appear correctly (390px + 900px); nothing before.

ITEM 2 — the end-of-hand result moved ONTO the table (players missed the bottom
strip). One coherent two-stage sequence, pure `interludeStage()` machine:
  STAGE A — the OUTCOME on the table, in the ring CENTRE by the winning play
    (InterludeOutcome.tsx): who won + the finishing order, held ~4s, tap-advances.
    A LIGHT scrim keeps the winning play a legible hero beneath (text-shadow so
    the outcome reads over it — Grok: not ghosted). NEVER the level meaning.
  STAGE B — the LEVEL-UP payoff, larger/covering (InterludeOverlay.tsx, now
    presentational): "us 5 → 7" + the A-attempt story + the next hand. NEVER
    restates the finishing order (each stage earns its screen time).
  Match end skips Stage B (ResultOverlay is the covering payoff). Reduced motion
  folds both into ONE static plate (outcome atop, meaning below) + a dismiss + a
  30s safety auto-release, so an away player is never left curtained. GameTable
  owns the stage timer + tap-to-advance (advances from the CURRENT stage — Codex
  fix: never a no-op after the timer moved on). Client-side only; the DO alarm is
  untouched, so an away player never stalls the table.

PINS (ratchet): dealSettled truth-table; a regression pin that the anti-tribute
reveal + tribute center + ActionBar + turn line + ring + log + committed-chip all
gate on `settled` (the reported bug cannot recur); the pure two-stage machine
(order, match-end shortening, A-insert on level-up, tap-advance); the
NO-REPETITION contract (Stage A shows order, Stage B doesn't); the reduced-motion
combined plate + 30s release; the on-table placement CSS (Stage A over the ring
centre w/ light scrim; Stage B fixed/covering). interludeStage/dealSettled are
pure predicates (the isCeremonyShowing precedent).

AUDITS (presentation, either lineage; disclosed split): **Codex on the code** —
presentation-only/DO-authority CLEAN; sweep near-complete; 3 findings: the
committed-tribute chip (fixed) + the feed lines (already fixed by the same-round
log gate) + a real tap-advance NO-OP bug (fixed: advance from the current stage).
**Grok on the UX** — SHIP: gating turn/clock/ring during the deal is sound (false
urgency before a readable hand); centre placement right; the no-repetition
two-stage pacing is sound. Its ship tweaks applied: lighter Stage-A scrim so the
play stays a legible hero, a visible tap hint, and gating the log's hand-start
lines with the same deal gate.

VISUAL: Stage A / Stage B / reduced verified at true 390px (the owner's tight
case) in the real ring CSS; the live table verified at 390px + 900px (deal → the
turn/clock/ring appear only post-settle — no regression). The rare
anti-tribute-mid-deal state is covered by the regression pin, not each
live-captured (reaching it needs a full hand).

Gate 1091/1091 (46 files) + typecheck (4 tsconfigs) + lint:hooks + build.
A four-lens adversarial pre-deploy audit (each lens trying to REFUTE the
presentation-only claim against the full diff) returned SHIP, 0 blockers: scope
confined to the client render layer, DO alarm the sole enforcer, gate re-run
120/120, no raw-color/off-scale-size reintroduced, no dangling refs / missing
i18n keys. Outgoing sweep clean. Shipping on the owner's word.

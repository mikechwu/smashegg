# Selection-survival fix — cross-lineage audit (2026-07-22)

Scope: the elder-playtest item-2 bug fix (pre-selection wiped when the turn
arrives) — helpers.reconcileSelection/remapSelectionByIdentity, the GameTable
effect split (chooser-only transient key + selection reconciliation layout
effect), and tests/unit/client/selection-survival.test.ts. Producer: Claude.
Auditors: Codex + Grok in isolated clones synced to the fixed tree (neither
produced the change; their design consulting this round was on the separate
items-1/3/4 theme, not this diff). Audit brief: adversarial, priority on
stale-card resurrection after tribute/auto-play, context seams (mid-match
adoption dealNo=0, rematch), the viewless-gap seat switch, render-loop
safety of the no-deps layout effect, and chooser interaction.

## Codex — no HIGH/MED; 1 LOW (acknowledged)

- Walked all five questions and found no defect: tribute/auto-play drops
  are clean (empty selections pass through, so a returned twin cannot
  resurrect); every live fresh-deal path changes handNo (and dealNo when
  folds run), no rematch path delivers 27 new cards with an unchanged
  context; the viewless gap preserves-then-resets correctly; all stable
  states return the same Set instance so the no-deps effect cannot loop
  (a changed hand costs at most one extra settle render); a stale-open
  chooser renders from CURRENT matches and submits CURRENT selectionCards,
  so it can at worst linger briefly with live handlers.
- **LOW (acknowledged, kept):** test shape — the headline regression pin is
  "true by construction" (hints/trick are not policy inputs) and the
  GameTable transitions are held by source-regex wiring pins rather than a
  rendered, driven component. Deliberate: the suite is DOM-free by design
  (renderToStaticMarkup runs no effects; there is no DOM test environment
  in the project), the owner's polish gate itself names the suite blind to
  interaction state ("eyes + extracted predicates"), and by-construction
  immunity is the strongest form of the fix. The real transition was
  verified live instead: a driven zh-Hant room at TRUE 390×844 — two cards
  lifted during 輪到 阿華, two intervening seat actions, same two cards
  (黑桃6 · 梅花9) still lifted the moment 輪到你 + the action bar mounted.
- Sandbox blocked vitest (npx tried the network) — reasoned-only, as every
  round.

## Grok — no HIGH; 1 MED + 5 LOW, ALL acknowledged; suite run in ITS clone green (971/971)

- Confirmed the fix sound along all five walks, with concrete sequences:
  no wrong-rank resurrection exists (partial auto-play keeps the survivor,
  tribute lose-then-gain is blocked by the empty-set short-circuit); every
  real fresh-deal path resets — handNo is authoritative where mid-match
  adoption leaves dealNo at 0, and next-match handNo restarts still
  compare unequal; no interleaving paints seat B's hand with seat A's
  indices; every stable state returns the same Set instance so the
  no-deps layout effect cannot loop; a stale-open chooser feeds on live
  matches and cannot submit cards the player is not holding. Verdict
  verbatim: "Ship as-is."
- **MED (acknowledged, kept):** the same finding as Codex's LOW, one tier
  higher — "THE regression" pure test is policy-tautological (hints/trick
  are not inputs by construction); the load-bearing anti-regression pins
  are the WIRING suite (which the old code demonstrably fails: the old
  effect wiped selection and used handKey). Both lineages converged on
  the same point independently; kept for the same reasons recorded under
  Codex, with Grok's optional follow-ups noted for a future round: a
  component-level idle→actor test, a reconnect pin (frozen dealNo +
  advancing handNo), a multi-seat viewless interleaving test.
- **LOW ×5 (acknowledged, kept):** twin sibling re-claim after an
  auto-play (intentional and unit-pinned — identity-correct, two decks
  make copies indistinguishable); handNo-carries-the-reset reliance on
  the engine always advancing handNo (dealNo stays belt-and-suspenders);
  A→B(with view)→A clears while A→viewless-B→A keeps (safe, slightly
  asymmetric in multi-seat self-play); a one-frame chooser close lag on
  hand-changing ticks (pre-existing passive-effect timing — the OLD reset
  effect was passive too — and options/handlers recompute from current
  state, so no stale submit exists); O(selected × hand) remap and O(hand)
  sameOrder per commit (≤ ~729 string compares on an actually-changed
  hand; clarity over a claimed-index map).

## Post-audit state

No code changes required by either lineage. Gate 971/971 (41 files) +
typecheck + lint:hooks + build.

## Verdict

**Clean — accepted by both lineages with zero HIGH and zero required
changes.** The independent convergence on the one MED/LOW (test shape)
is a suite-idiom boundary, not a defect: the DOM-free suite pins the
policy and the wiring, and the live 390px drive covers the rendered
transition end-to-end.

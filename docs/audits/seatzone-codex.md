# Seat-zone round — Codex read-only audit (2026-07-17)

Scope: uncommitted working-tree diff for the remote-seat-zone redesign (realistic
card-back stacks, name-only pill, top-view placement direction, deal wiring).
Producer: Claude (workflow). Auditor: Codex (clean — no involvement in production).

**Findings**

- **HIGH** - Hidden-count games leak remote hand sizes during the deal.  
  Evidence: [GameTable.tsx](/Users/mikechwu/Projects/smashegg/src/client/GameTable.tsx:544) uses `dealing ? remoteCounts[dir]` before checking `view.cardCounts[seat]`, while the engine defines `null` as hidden from this viewer in [types.ts](/Users/mikechwu/Projects/smashegg/src/engine/guandan/types.ts:325) and emits `null` above threshold in [index.ts](/Users/mikechwu/Projects/smashegg/src/engine/guandan/index.ts:851). `SeatStack` only suppresses backs when it actually receives `count === null` at [SeatStack.tsx](/Users/mikechwu/Projects/smashegg/src/client/table/SeatStack.tsx:66).  
  Failing scenario: room config `cardCountVisibility: 'onRequestLE10'`, first deal starts with opponents at 27. The settled view correctly has `cardCounts[remote] === null`, but while `dealing` is true the UI renders `0 cards`, then 1..27 real backs for each remote via landing counters, revealing exactly the hidden counts.

- **MED** - West’s reserved deal layout breaks the “newest at strip top” rule until the hand is complete.  
  Evidence: `SeatStack` uses one variable, `--gd-stack-n`, for both reservation sizing and west positioning: `sized = Math.max(count, reserve ?? 0)` in [SeatStack.tsx](/Users/mikechwu/Projects/smashegg/src/client/table/SeatStack.tsx:81), passed as `--gd-stack-n` at [SeatStack.tsx](/Users/mikechwu/Projects/smashegg/src/client/table/SeatStack.tsx:103). West then positions each slot with `(var(--gd-stack-n) - 1 - var(--gd-stack-i))` in [table.css](/Users/mikechwu/Projects/smashegg/src/client/table/table.css:1544).  
  Failing scenario: west has `reserve=27`, `count=3` during the deal. Slots render with indices 0,1,2, but positions are based on `27 - 1 - i`, so the newest landed card is near the bottom of the reserved strip, not at the top. The T10 test claims to pin this behavior at [seat-stack.test.tsx](/Users/mikechwu/Projects/smashegg/tests/unit/client/seat-stack.test.tsx:336), but it only checks the formula text, not the reserve interaction; this bad edit survives the test.

- **LOW** - Critical-count accessible text drops the required card unit in English.  
  Evidence: `SeatStack` renders visible text from `game.stack.cards` at [SeatStack.tsx](/Users/mikechwu/Projects/smashegg/src/client/table/SeatStack.tsx:98), but for critical counts it overrides the accessible name with `game.plate.cardsLow` at [SeatStack.tsx](/Users/mikechwu/Projects/smashegg/src/client/table/SeatStack.tsx:96). English `game.plate.cardsLow` is `"Only {count} left!"` in [en.json](/Users/mikechwu/Projects/smashegg/src/client/i18n/locales/en.json:145), while the new stack key with unit is at [en.json](/Users/mikechwu/Projects/smashegg/src/client/i18n/locales/en.json:148).  
  Failing scenario: screen reader focus on a 2-card stack announces “Only 2 left!” instead of “2 cards” or equivalent unit-bearing copy, contradicting the new unit-on-count requirement for accessible/i18n correctness.

Verdict: **HOLD** - the deal-time hidden-count leak exposes private remote hand sizes.


## Dispositions

- HIGH (hidden-count leak during deal): FIXED — stackCountFor now returns null
  BEFORE consulting dealing (the visibility contract beats the choreography);
  pinned by an updated ternary source pin + a new component pin (count null +
  reserve=27 still renders zero backs and the hidden chip).
- MED (west reserved-deal position): REJECTED on physics — mid-deal the west pile
  is deliberately bottom-anchored: the first card stays FIXED at the strip's
  bottom end and the pile grows upward toward the player's left, newest on top
  of the PILE (the owner's placement rule). 'Newest at the strip's top end' is
  the SETTLED-state description (count == n). The count-based formula Codex
  implies would slide every landed card down one exposure per landing. Both
  states live-measured (mid-deal west tops 607→533.6 decreasing with DOM order;
  settled 638→478.8).
- LOW (critical aria drops the unit in en): FIXED — en game.plate.cardsLow is now
  'Only {count} cards left!'. Adjacent hygiene: the now-dead game.plate.cards key
  removed from all three locales.

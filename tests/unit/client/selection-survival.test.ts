// Elder playtest round, item 2 — the selection-reset bug. Pre-selecting
// while other seats play is normal physical-table behavior, but the old
// reset effect keyed the selection on hints/trick state, so the lift was
// wiped the exact moment the turn arrived (idle→actor flipped the key).
// The ratchet: the survival policy (reconcileSelection) is hints-blind
// and trick-blind BY CONSTRUCTION — they are not inputs — so a
// pre-selection made during another seat's turn is still selected when
// the turn arrives; a changed hand remaps by card identity; only a real
// context change (seat switch / fresh deal) resets. Wiring pins hold
// GameTable to the policy: the chooser keeps the old transient key, the
// selection no longer rides it. DOM-free like the rest of the suite —
// the visible lift itself is eyes/browser-gated.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  reconcileSelection,
  remapSelectionByIdentity,
  type SelectionContext,
} from '../../../src/client/table/helpers';
import type { Card } from '../../../src/engine/guandan/cards';

const gameTableSrc = readFileSync(join(__dirname, '../../../src/client/GameTable.tsx'), 'utf8');

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const src = stripTsComments(gameTableSrc);

const H = (...cards: string[]): Card[] => cards as Card[];

const ctx = (over: Partial<SelectionContext> = {}): SelectionContext => ({
  seat: 0,
  handNo: 1,
  dealNo: 1,
  hand: H('2S', '3H', '9S', '9C', 'KD'),
  ...over,
});

describe('remapSelectionByIdentity', () => {
  it('keeps still-held cards, remapping their indices after a removal', () => {
    // The server auto-played 2S for a timed-out leader: the two lifted
    // nines survive at their shifted positions.
    const prev = H('2S', '3H', '9S', '9C', 'KD');
    const next = H('3H', '9S', '9C', 'KD');
    expect([...remapSelectionByIdentity(new Set([2, 3]), prev, next)].sort()).toEqual([1, 2]);
  });

  it('drops cards no longer in hand', () => {
    const prev = H('2S', '3H', '9S');
    expect(remapSelectionByIdentity(new Set([0, 2]), prev, H('3H', '9S'))).toEqual(new Set([1]));
    expect(remapSelectionByIdentity(new Set([0]), prev, H('3H', '9S')).size).toBe(0);
  });

  it('duplicate copies claim one slot each and never double-claim', () => {
    // Two decks mean twin cards. Selecting the SECOND copy maps onto the
    // one remaining copy; selecting BOTH keeps one when one is left, and
    // both when both survive a reorder.
    const prev = H('9S', '9S', 'QH');
    expect(remapSelectionByIdentity(new Set([1]), prev, H('9S', 'QH'))).toEqual(new Set([0]));
    expect(remapSelectionByIdentity(new Set([0, 1]), prev, H('9S', 'QH'))).toEqual(new Set([0]));
    expect(remapSelectionByIdentity(new Set([0, 1]), prev, H('9S', 'QH', '9S'))).toEqual(
      new Set([0, 2]),
    );
  });

  it('follows a reorder by identity and ignores stale indices', () => {
    const prev = H('2S', '3H', '9S');
    expect(remapSelectionByIdentity(new Set([2]), prev, H('9S', '2S', '3H'))).toEqual(new Set([0]));
    expect(remapSelectionByIdentity(new Set([7]), prev, prev).size).toBe(0);
  });
});

describe('reconcileSelection — the survival policy', () => {
  it('THE regression: a pre-selection survives the turn arriving, untouched', () => {
    // Same seat, same deal, same hand. Hints flipping idle→actor and the
    // trick top changing are NOT inputs to the policy, so they CANNOT
    // reset it. Same-instance return: setState bails, no extra render.
    const sel: ReadonlySet<number> = new Set([2, 3]);
    expect(reconcileSelection(sel, ctx(), ctx())).toBe(sel);
  });

  it('first observation carries the selection through unchanged', () => {
    const sel: ReadonlySet<number> = new Set([1]);
    expect(reconcileSelection(sel, null, ctx())).toBe(sel);
  });

  it('a changed hand remaps by identity (tribute, server auto-play)', () => {
    const prev = ctx();
    const next = ctx({ hand: H('3H', '9S', '9C', 'KD') });
    expect([...reconcileSelection(new Set([2, 3]), prev, next)].sort()).toEqual([1, 2]);
  });

  it('a seat switch or a fresh deal resets outright', () => {
    const sel: ReadonlySet<number> = new Set([0]);
    expect(reconcileSelection(sel, ctx(), ctx({ seat: 2 })).size).toBe(0);
    expect(reconcileSelection(sel, ctx(), ctx({ handNo: 2 })).size).toBe(0);
    expect(reconcileSelection(sel, ctx(), ctx({ dealNo: 2 })).size).toBe(0);
    // ...even when the fresh deal contains the very same card value: a
    // twin of a card lifted in the ENDED hand must not arrive pre-lifted.
    expect(
      reconcileSelection(sel, ctx({ hand: H('9S') }), ctx({ handNo: 2, hand: H('9S', '2S') })).size,
    ).toBe(0);
  });

  it('a reset over an already-empty selection returns the same instance', () => {
    const sel: ReadonlySet<number> = new Set();
    expect(reconcileSelection(sel, ctx(), ctx({ seat: 2 }))).toBe(sel);
  });
});

describe('GameTable wiring pins', () => {
  it('the chooser keeps the transient key; the selection does not ride it', () => {
    // The old bug in one regex: the effect keyed on the hints/trick-
    // bearing string may only close the chooser — nothing else.
    expect(src).toMatch(/useEffect\(\(\) => \{\s*setChooserOpen\(false\);\s*\}, \[chooserKey\]\)/);
  });

  it('the only blanket selection wipe left is act(); the rest reconciles', () => {
    // One direct wipe: act() clears the just-sent selection. Every other
    // transition flows through the survival policy.
    expect(src.match(/setSelected\(new Set\(\)\)/g) ?? []).toHaveLength(1);
    expect(src).toMatch(/setSelected\(\(sel\) => reconcileSelection\(sel, prev, ctx\)\)/);
  });

  it('reconciliation is a LAYOUT effect over the seat/handNo/dealNo/hand context', () => {
    // Layout, not passive: the remap must land in the same paint as the
    // changed hand, so a stale index never lights the wrong card.
    const effect = src.match(
      /const selectionCtxRef[\s\S]*?reconcileSelection\(sel, prev, ctx\)\)/,
    )?.[0];
    expect(effect).toBeDefined();
    expect(effect).toContain('useIsomorphicLayoutEffect');
    expect(effect).toContain('handNo: view.handNo');
    expect(effect).toContain('dealNo: derivedBySeat.get(activeSeat)?.dealNo ?? 0');
    expect(effect).toContain('hand: view.hand');
  });

  it('a viewless tick keeps the last context (no reset-to-null leak)', () => {
    // Nulling the ref on a viewless render would let a selection survive
    // an A→(viewless B) switch; keeping it lets the seat comparison catch
    // the change when B's view arrives.
    expect(src).toMatch(/if \(view === null \|\| activeSeat === undefined\) return;/);
  });
});

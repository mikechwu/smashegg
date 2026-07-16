// Obs 3 ratchet: the fan's arrival-order → sorted mapping and display. The
// FLIP slide is a WAAPI animation (browser-only, covered by the eyes-gate);
// the pure decision — that arrival order maps bijectively onto the sorted fan
// and the fan lays cards out in deal order while dealing — is pinned here.

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HandFan, dealToHandIndices } from '../../../src/client/table/HandFan';
import { sortCards, type Card } from '../../../src/engine/guandan/cards';

const NOOP = () => {};
const EMPTY = new Set<number>();
const EMPTY_GLOW = new Set<Card>();

describe('dealToHandIndices (obs 3)', () => {
  it('is a bijection deal-position → sorted index that recovers the deal order', () => {
    const dealOrder: Card[] = ['9S', '2H', 'KD', '5C', 'AH', '2H', 'TS', 'SJ'];
    const hand = sortCards(dealOrder, '2');
    const map = dealToHandIndices(dealOrder, hand);
    // A permutation of 0..n-1 (each sorted slot used exactly once).
    expect([...map].sort((a, b) => a - b)).toEqual(hand.map((_, i) => i));
    // hand[map[j]] === dealOrder[j] — the mapping recovers arrival order,
    // duplicates included (both 2H land on distinct slots).
    map.forEach((handIdx, j) => expect(hand[handIdx]).toBe(dealOrder[j]));
  });

  it('handles a full 27-card hand with duplicates', () => {
    const dealOrder: Card[] = [
      '2H', '2H', '5S', '5S', '9D', 'KC', 'KC', 'AS', '3H', '3H', '7C', 'TD', 'TD', 'JS',
      'QH', 'QH', '4D', '6S', '8C', 'BJ', 'SJ', '2S', '5H', '9C', 'KD', 'AH', '7S',
    ];
    const hand = sortCards(dealOrder, '2');
    const map = dealToHandIndices(dealOrder, hand);
    expect([...map].sort((a, b) => a - b)).toEqual(hand.map((_, i) => i));
    map.forEach((handIdx, j) => expect(hand[handIdx]).toBe(dealOrder[j]));
  });
});

describe('HandFan arrival-order display (obs 3)', () => {
  const dealOrder: Card[] = ['9S', '2H', 'KD', '5C', 'AH'];
  const hand = sortCards(dealOrder, '2');

  function labelsInOrder(html: string): string[] {
    return [...html.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]!);
  }

  it('lays cards out in DEAL order while dealing, not sorted', () => {
    const dealHtml = renderToStaticMarkup(
      createElement(HandFan, {
        hand,
        level: '2',
        selected: EMPTY,
        onToggle: NOOP,
        glow: EMPTY_GLOW,
        dealOrder,
        revealed: hand.length,
      }),
    );
    const sortedHtml = renderToStaticMarkup(
      createElement(HandFan, { hand, level: '2', selected: EMPTY, onToggle: NOOP, glow: EMPTY_GLOW }),
    );
    const dealLabels = labelsInOrder(dealHtml);
    const sortedLabels = labelsInOrder(sortedHtml);
    // The dealing fan is a permutation of the settled fan (same cards)…
    expect([...dealLabels].sort()).toEqual([...sortedLabels].sort());
    // …but in a DIFFERENT (arrival) order — this hand is not already sorted.
    expect(dealLabels).not.toEqual(sortedLabels);
  });

  it('reveals only the landed prefix while dealing (undealt slots hidden)', () => {
    const html = renderToStaticMarkup(
      createElement(HandFan, {
        hand,
        level: '2',
        selected: EMPTY,
        onToggle: NOOP,
        glow: EMPTY_GLOW,
        dealOrder,
        revealed: 2,
      }),
    );
    const undealt = (html.match(/gd-fan__card--undealt/g) ?? []).length;
    expect(undealt).toBe(hand.length - 2);
  });
});

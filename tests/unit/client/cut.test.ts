// Obs 1 ratchet: the cut ribbon's PURE split geometry (cut.ts). CutPanel's DOM
// is a thin renderer of these numbers; the DOM-free suite pins the split
// mapping and the conservation invariant, and (below) that CutPanel shows NO
// numeric index — the leak investigation ruled the number out for DESIGN
// reasons, and this makes its absence a regression.

import { describe, expect, it } from 'vitest';
import { CUT_RIBBON_SLIVERS, cutLeftCount, cutSplitFraction } from '../../../src/client/table/cut';
import { CUT_MIN, CUT_MAX, DEFAULT_CUT_POSITION } from '../../../src/engine/guandan';

describe('cutSplitFraction (obs 1)', () => {
  it('maps the legal cut band onto [0, 1], monotonically', () => {
    expect(cutSplitFraction(CUT_MIN)).toBe(0);
    expect(cutSplitFraction(CUT_MAX)).toBe(1);
    let prev = -1;
    for (let p = CUT_MIN; p <= CUT_MAX; p++) {
      const f = cutSplitFraction(p);
      expect(f).toBeGreaterThanOrEqual(prev);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
      prev = f;
    }
  });

  it('clamps positions outside the legal band (total function)', () => {
    expect(cutSplitFraction(CUT_MIN - 20)).toBe(0);
    expect(cutSplitFraction(CUT_MAX + 20)).toBe(1);
  });
});

describe('cutLeftCount (obs 1)', () => {
  it('conserves the deck: left + right === slivers at every position', () => {
    for (let p = CUT_MIN; p <= CUT_MAX; p++) {
      const left = cutLeftCount(p);
      const right = CUT_RIBBON_SLIVERS - left;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left).toBeLessThanOrEqual(CUT_RIBBON_SLIVERS);
      expect(left + right).toBe(CUT_RIBBON_SLIVERS);
    }
  });

  it('endpoints put the whole ribbon in one packet', () => {
    expect(cutLeftCount(CUT_MIN)).toBe(0);
    expect(cutLeftCount(CUT_MAX)).toBe(CUT_RIBBON_SLIVERS);
  });

  it('is monotonic non-decreasing across the band', () => {
    let prev = -1;
    for (let p = CUT_MIN; p <= CUT_MAX; p++) {
      const left = cutLeftCount(p);
      expect(left).toBeGreaterThanOrEqual(prev);
      prev = left;
    }
  });

  it('the default (indifferent) cut splits the ribbon roughly in half', () => {
    const left = cutLeftCount(DEFAULT_CUT_POSITION);
    expect(left).toBeGreaterThanOrEqual(CUT_RIBBON_SLIVERS / 2 - 2);
    expect(left).toBeLessThanOrEqual(CUT_RIBBON_SLIVERS / 2 + 2);
  });
});

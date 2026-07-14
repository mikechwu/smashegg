// parseHash is the pure core of the M3 hash router — testable with no DOM.

import { describe, expect, it } from 'vitest';
import { parseHash, roomHash } from '../../../src/client/router';

describe('parseHash', () => {
  it('empty / bare hashes are home', () => {
    expect(parseHash('')).toEqual({ page: 'home' });
    expect(parseHash('#')).toEqual({ page: 'home' });
    expect(parseHash('#/')).toEqual({ page: 'home' });
  });

  it('#/debug is the M0 connectivity demo', () => {
    expect(parseHash('#/debug')).toEqual({ page: 'debug' });
  });

  it('#/room/CODE parses and uppercases the code', () => {
    expect(parseHash('#/room/ABC234')).toEqual({ page: 'room', code: 'ABC234' });
    expect(parseHash('#/room/abc234')).toEqual({ page: 'room', code: 'ABC234' });
  });

  it('invalid room codes fall back to home (ambiguous chars, wrong length)', () => {
    expect(parseHash('#/room/AB')).toEqual({ page: 'home' });
    expect(parseHash('#/room/ABCDE0')).toEqual({ page: 'home' }); // 0 not in alphabet
    expect(parseHash('#/room/ABC234/extra')).toEqual({ page: 'home' });
  });

  it('unknown routes fall back to home', () => {
    expect(parseHash('#/nope')).toEqual({ page: 'home' });
    expect(parseHash('#/debug/deeper')).toEqual({ page: 'home' });
  });

  it('roomHash round-trips through parseHash', () => {
    expect(parseHash(roomHash('WXYZ23'))).toEqual({ page: 'room', code: 'WXYZ23' });
  });
});

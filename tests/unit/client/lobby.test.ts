// F3 (pre-M5): the rule & timing pickers must READ as disabled until you hold
// a seat — an unseated edit is server-rejected, and looking editable then
// failing is the first-thirty-seconds trap. The visual gate is DOM (untestable
// in the node client suite), so the DECISION is a pure predicate, tested here.

import { describe, expect, it } from 'vitest';
import { configEditable } from '../../../src/client/Lobby';

describe('configEditable (F3: pickers editable only when seated, in the lobby)', () => {
  it('is true only in the lobby AND holding a seat', () => {
    expect(configEditable('lobby', true)).toBe(true);
  });

  it('an unseated player in the lobby cannot edit (so no room.notSeated rejection fires)', () => {
    expect(configEditable('lobby', false)).toBe(false);
  });

  it('config is frozen once the match has started or finished, even holding a seat', () => {
    expect(configEditable('playing', true)).toBe(false);
    expect(configEditable('finished', true)).toBe(false);
  });
});

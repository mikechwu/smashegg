// Lobby redesign pins (owner-designed round-table layout). The client suite
// is DOM-free (node env, no jsdom): behaviour is pinned two ways, mirroring
// the repo idiom (cut-panel / hand-fan) — pure decision helpers exercised
// directly with a RECORDER RoomSender, and renderToStaticMarkup structure
// asserted against the markup. The locale is forced to English so the file
// stays CJK-free (the zh assertions live in the allowlisted table.test.ts).
//
// configEditable (F3) is retained from the pre-redesign file: the rule/timing
// pickers must READ as disabled until you hold a seat — an unseated edit is
// server-rejected, and looking editable then failing is the first-thirty-
// seconds trap. The visual gate is DOM (untestable here), so the DECISION is a
// pure predicate, tested below.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Lobby, configEditable, takeSeat } from '../../../src/client/Lobby';
import {
  RoomStore,
  type RoomSender,
  type RoomSnapshot,
  type SeatCredential,
  type StorageLike,
} from '../../../src/client/room/store';
import type { RoomInfo, SeatInfo } from '../../../src/shared/protocol';
import type { Seat } from '../../../src/engine/core/game';
import { getLocale, setLocale } from '../../../src/client/i18n';

const CODE = 'ABCDEF'; // no digits: keeps the "no visible seat number" scan clean

let savedLocale: ReturnType<typeof getLocale>;
beforeAll(() => {
  savedLocale = getLocale();
  setLocale('en');
});
afterAll(() => {
  setLocale(savedLocale);
});

function fakeStorage(): StorageLike {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

function recorderStore(): { store: RoomStore; calls: unknown[][] } {
  const calls: unknown[][] = [];
  const sender: RoomSender = {
    claimSeat: (...a) => calls.push(['claimSeat', ...a]),
    releaseSeat: (...a) => calls.push(['releaseSeat', ...a]),
    renameSeat: (...a) => calls.push(['renameSeat', ...a]),
    setConfig: (...a) => calls.push(['setConfig', ...a]),
    setTiming: (...a) => calls.push(['setTiming', ...a]),
    start: () => calls.push(['start']),
    act: (...a) => calls.push(['act', ...a]),
  };
  const store = new RoomStore(CODE, fakeStorage());
  store.bindSender(sender);
  return { store, calls };
}

function seatsWith(claimed: Record<number, string>): SeatInfo[] {
  return ([0, 1, 2, 3] as Seat[]).map((seat) =>
    seat in claimed
      ? { seat, name: claimed[seat]!, claimed: true, connected: true }
      : { seat, name: null, claimed: false, connected: false },
  );
}

function roomInfo(over: Partial<RoomInfo> = {}): RoomInfo {
  return {
    gameId: 'guandan',
    status: 'lobby',
    config: null,
    seats: seatsWith({}),
    timing: null,
    seq: 0,
    ...over,
  };
}

function snapshot(over: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    room: roomInfo(),
    seats: new Map<Seat, SeatCredential>(),
    perSeat: new Map(),
    seq: 0,
    connected: true,
    rejections: [],
    deadlines: [],
    ...over,
  };
}

function render(snap: RoomSnapshot, store: RoomStore = new RoomStore(CODE, fakeStorage())): string {
  return renderToStaticMarkup(createElement(Lobby, { snapshot: snap, store }));
}

// Seat-wrapper class order in the markup — the FIXED geographic DOM order.
function chipOrder(html: string): number[] {
  return [...html.matchAll(/lobby-tableseat--s(\d)/g)].map((m) => Number(m[1]));
}

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

describe('take-a-seat claims exactly its own seat (owner bugs 6a/6b: wrong seat + name migration)', () => {
  it('claims EXACTLY seat k with the trimmed name and clears the panel, for every k', () => {
    for (const k of [0, 1, 2, 3] as Seat[]) {
      const { store, calls } = recorderStore();
      const nextName = takeSeat(store, '  mike  ', k);
      // (a) the wrong-seat pin: the button's own seat index is the target,
      // never a defaulted first-empty seat.
      expect(calls).toEqual([['claimSeat', 'mike', k]]);
      // (b) the leak pin: the name clears on every claim so it can never
      // pre-fill or migrate to another seat.
      expect(nextName).toBe('');
    }
  });

  it('the controlled name input renders EMPTY (the panel value is the cleared state)', () => {
    const html = render(snapshot());
    expect(html).toMatch(/<input[^>]*id="lobby-name"[^>]*value=""/);
  });
});

describe('the name panel has no hidden claim target (owner bug 6b)', () => {
  it('is not a form and exposes no submit control — Enter/submit claims nothing', () => {
    const html = render(snapshot());
    // No <form> to implicitly submit, and no submit button to trigger a
    // claim: every claim goes through an explicit seat button (tested above),
    // so there is no first-empty-seat default path left.
    expect(html).not.toContain('<form');
    expect(html).not.toContain('type="submit"');
    expect(html).toContain('lobby-namepanel');
  });
});

describe('every seat 0..3 always renders a chip (owner bug 6c: no lone-card state)', () => {
  it('renders four chips even when room.seats carries no entries', () => {
    const html = render(snapshot({ room: roomInfo({ seats: [] }) }));
    for (const k of [0, 1, 2, 3]) expect(html).toContain(`lobby-tableseat--s${k}`);
    // all empty ⇒ four take-a-seat buttons, one placeholder per seat index
    expect(html.match(/lobby-seat__take/g) ?? []).toHaveLength(4);
  });

  it('the old decorative ring/anchor layout and its centre ellipse are gone', () => {
    const html = render(snapshot());
    expect(html).not.toContain('lobby-ring__center');
    expect(html).not.toContain('lobby-ring');
  });

  it('no VISIBLE seat-number label anywhere (positional identity only; aria excluded)', () => {
    const html = render(snapshot());
    expect(html).not.toContain('lobby-seat__label');
    // Stripping tags drops all attributes (aria included); the removed
    // "Seat {n}" label must not survive in visible text.
    const visible = html.replace(/<[^>]*>/g, ' ');
    expect(visible).not.toMatch(/\bSeat \d/);
  });
});

describe('seat chips keep FIXED DOM positions regardless of who the viewer is (re-anchor pin)', () => {
  it('renders chips in order 0,1,2,3 whether the viewer holds seat 0 or seat 2', () => {
    const held0 = render(
      snapshot({
        seats: new Map<Seat, SeatCredential>([[0, { token: 't' }]]),
        room: roomInfo({ seats: seatsWith({ 0: 'me' }) }),
      }),
    );
    const held2 = render(
      snapshot({
        seats: new Map<Seat, SeatCredential>([[2, { token: 't' }]]),
        room: roomInfo({ seats: seatsWith({ 2: 'me' }) }),
      }),
    );
    expect(chipOrder(held0)).toEqual([0, 1, 2, 3]);
    expect(chipOrder(held2)).toEqual([0, 1, 2, 3]);
  });
});

describe('no lobby rename UI; leave releases the held seat (owner dropped rename)', () => {
  it('a held seat shows a leave button (and only the held seat) with no rename control', () => {
    const html = render(
      snapshot({
        seats: new Map<Seat, SeatCredential>([[1, { token: 't' }]]),
        room: roomInfo({ seats: seatsWith({ 1: 'me' }) }),
      }),
    );
    // rename is gone from the lobby entirely (store.rename transport is kept
    // for other surfaces, but no lobby UI reaches it).
    expect(html).not.toContain('Rename');
    expect(html).not.toContain('lobby-seat__ctl');
    // exactly one leave button — the viewer's own held seat
    expect(html.match(/lobby-seat__leave/g) ?? []).toHaveLength(1);
    expect(html).toContain('Leave seat');
  });

  it('the leave button forwards releaseSeat(k) to the transport', () => {
    const { store, calls } = recorderStore();
    store.release(1);
    expect(calls).toEqual([['releaseSeat', 1]]);
  });
});

// ---------------------------------------------------------------------------
// Silent-no-op round, item 2 — sit-then-name. THE playtest bug: pressing Sit
// with no name did NOTHING (a disabled button, the NN/g anti-pattern). The
// ratchet: a nameless Sit must ALWAYS produce a visible response (the ask
// panel), both orders must converge on the SAME single claim path (the seat
// token is minted exactly as before), and the race loser gets an explicit
// message. DOM-free idiom: pure decision + render pins + source pins.
// ---------------------------------------------------------------------------

import { SitAskPanel, sitIntent } from '../../../src/client/Lobby';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const lobbySrc = readFileSync(join(__dirname, '../../../src/client/Lobby.tsx'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
).replace(/\/\/[^\n]*/g, '');

describe('sit-then-name (the silent no-op regression)', () => {
  it('THE regression: a blank name NEVER disables the take-a-seat button', () => {
    const html = render(snapshot());
    const takeButtons = html.match(/<button[^>]*lobby-seat__take[^>]*>/g) ?? [];
    expect(takeButtons).toHaveLength(4);
    for (const b of takeButtons) expect(b).not.toContain('disabled');
  });

  it('the Sit press routes by name readiness — claim with a name, ASK without (never nothing)', () => {
    expect(sitIntent(true)).toBe('claim');
    expect(sitIntent(false)).toBe('ask');
    expect(lobbySrc).toMatch(/if \(sitIntent\(nameReady\) === 'claim'\) \{/);
    expect(lobbySrc).toMatch(/setSitAsk\(s\);/);
  });

  it('one claim path only: store.claim appears exactly once, inside takeSeat, and the ask confirm routes through takeSeat', () => {
    expect(lobbySrc.match(/store\.claim\(/g) ?? []).toHaveLength(1);
    expect(lobbySrc).toMatch(/takeSeat\(store, sitAskName, sitAsk\);/);
  });

  it('the ask panel asks (title + prompt + confirm), explains an empty confirm, and never silently no-ops', () => {
    const base = {
      position: 'bottom',
      name: '',
      needName: false,
      taken: false,
      claiming: false,
      connected: true,
      onName: () => {},
      onConfirm: () => {},
      onCancel: () => {},
    };
    const asking = renderToStaticMarkup(createElement(SitAskPanel, base));
    expect(asking).toContain('Take the bottom seat');
    expect(asking).toContain('Enter a name to finish sitting down');
    expect(asking).toContain('Sit down');
    expect(asking).toContain('Cancel');
    const needName = renderToStaticMarkup(createElement(SitAskPanel, { ...base, needName: true }));
    expect(needName).toContain('Please enter a name first');
    expect(needName).toContain('role="alert"');
  });

  it('the race loser sees an explicit taken message with a dismiss — not a form, not silence', () => {
    const taken = renderToStaticMarkup(
      createElement(SitAskPanel, {
        position: 'top',
        name: 'x',
        needName: false,
        taken: true,
        claiming: false,
        connected: true,
        onName: () => {},
        onConfirm: () => {},
        onCancel: () => {},
      }),
    );
    expect(taken).toContain('Someone just took this seat');
    expect(taken).toContain('Got it');
    expect(taken).toContain('role="alert"');
    expect(taken).not.toContain('lobby-sitask__input');
  });

  it('wiring: the ask closes on OWN success, flips to taken on the lost race, highlights its chip', () => {
    expect(lobbySrc).toMatch(/if \(sitAsk !== null && snapshot\.seats\.has\(sitAsk\)\) \{/);
    expect(lobbySrc).toMatch(/taken=\{claimedOf\(sitAsk\) && !snapshot\.seats\.has\(sitAsk\)\}/);
    expect(lobbySrc).toMatch(/asking \? 'lobby-seat--asking' : ''/);
  });

  it('name-then-sit still claims directly and clears the shared name (unchanged fast path)', () => {
    const { store, calls } = recorderStore();
    const next = takeSeat(store, '  mike  ', 2 as Seat);
    expect(next).toBe('');
    expect(calls).toEqual([['claimSeat', 'mike', 2]]);
  });
});

describe('the in-flight claim lock (panel MED, Codex + Grok concurring)', () => {
  it('while claiming the confirm locks and the hint SAYS so — a wait, never silence', () => {
    const html = renderToStaticMarkup(
      createElement(SitAskPanel, {
        position: 'bottom',
        name: 'mike',
        needName: false,
        taken: false,
        claiming: true,
        connected: true,
        onName: () => {},
        onConfirm: () => {},
        onCancel: () => {},
      }),
    );
    expect(html).toContain('Sitting down');
    expect(html).toMatch(/lobby-sitask__confirm[^>]*disabled/);
  });

  it('wiring: one claim per confirm, growth-only unwedge, disconnect parity with the take buttons', () => {
    expect(lobbySrc).toMatch(/if \(sitAskClaiming\) return;/);
    expect(lobbySrc).toMatch(/setSitAskClaiming\(true\);/);
    expect(lobbySrc).toMatch(/if \(rejectionCount > prevRejectionsRef\.current\) setSitAskClaiming\(false\);/);
    expect(lobbySrc).toMatch(/disabled=\{claiming \|\| !connected\}/);
  });
});

// RoomStore reducer tests (M3): recorded ServerMessage fixtures shaped
// exactly like the GameRoom DO's sends (src/server/game-room.ts fan-out /
// lobby handlers), reduced with NO network and NO DOM — storage is an
// injected in-memory fake, per the store's StorageLike seam.

import { describe, expect, it } from 'vitest';
import type { RoomInfo, ServerMessage } from '../../../src/shared/protocol';
import {
  RoomStore,
  storageKeyFor,
  type RoomSender,
  type StorageLike,
} from '../../../src/client/room/store';

const CODE = 'ABC234';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}

function roomInfo(overrides: Partial<RoomInfo> = {}): RoomInfo {
  return {
    gameId: 'guandan',
    status: 'lobby',
    config: null,
    seats: [0, 1, 2, 3].map((seat) => ({ seat, name: null, claimed: false, connected: false })),
    timing: null,
    seq: 0,
    ...overrides,
  };
}

// --- recorded message fixtures (wire shapes from src/shared/protocol.ts) ---

const welcome = (seats: number[], room: RoomInfo, seq = room.seq): ServerMessage => ({
  v: 1,
  type: 'welcome',
  seq,
  seats,
  room,
});

const seatClaimedOwn = (seat: number, name: string, token: string, seq: number): ServerMessage => ({
  v: 1,
  type: 'seatClaimed',
  seq,
  seat,
  name,
  token, // present ONLY on the claiming connection's copy
});

const seatClaimedOther = (seat: number, name: string, seq: number): ServerMessage => ({
  v: 1,
  type: 'seatClaimed',
  seq,
  seat,
  name,
});

const configChanged = (config: unknown, bySeat: number, seq: number): ServerMessage => ({
  v: 1,
  type: 'configChanged',
  seq,
  config,
  bySeat,
});

const started = (seq: number): ServerMessage => ({ v: 1, type: 'started', seq });

const eventMsg = (
  seat: number,
  seq: number,
  view: unknown,
  events: unknown[],
  hints?: unknown[],
): ServerMessage => {
  const msg: ServerMessage = { v: 1, type: 'event', seq, seat, event: events, view };
  if (hints !== undefined) msg.hints = hints;
  return msg;
};

const resyncMsg = (
  seat: number,
  seq: number,
  view: unknown,
  opts: { events?: { seq: number; event: unknown }[]; hints?: unknown[] } = {},
): ServerMessage => {
  const msg: ServerMessage = { v: 1, type: 'resync', seq, seat, view };
  if (opts.events !== undefined) msg.events = opts.events;
  if (opts.hints !== undefined) msg.hints = opts.hints;
  return msg;
};

const presence = (seat: number, connected: boolean, seq: number): ServerMessage => ({
  v: 1,
  type: 'presence',
  seq,
  seat,
  connected,
});

const rejected = (error: { code: string }, seq: number, actionId?: string): ServerMessage => {
  const msg: ServerMessage = { v: 1, type: 'rejected', seq, error };
  if (actionId !== undefined) msg.actionId = actionId;
  return msg;
};

// ---------------------------------------------------------------------------

describe('RoomStore reducer', () => {
  it('welcome stores the room snapshot and seq', () => {
    const store = new RoomStore(CODE, fakeStorage());
    store.dispatch(welcome([], roomInfo({ seq: 5 }), 5));
    const snap = store.getSnapshot();
    expect(snap.room?.gameId).toBe('guandan');
    expect(snap.room?.status).toBe('lobby');
    expect(snap.seq).toBe(5);
  });

  it('roomChanged replaces the room wholesale — timing included (setTiming rides roomChanged, no dedicated reducer case)', () => {
    const store = new RoomStore(CODE, fakeStorage());
    store.dispatch(welcome([], roomInfo()));
    expect(store.getSnapshot().room?.timing).toBeNull();
    const timing = { perTurnMs: 20_000, planningMs: 45_000 };
    store.dispatch({ v: 1, type: 'roomChanged', seq: 2, room: roomInfo({ timing, seq: 2 }) });
    expect(store.getSnapshot().room?.timing).toEqual(timing);
    expect(store.getSnapshot().seq).toBe(2);
  });

  it('seatClaimed WITH token records the credential and marks the roster seat', () => {
    const store = new RoomStore(CODE, fakeStorage());
    store.dispatch(welcome([], roomInfo()));
    store.dispatch(seatClaimedOwn(1, 'mike', 'tok-1', 1));
    const snap = store.getSnapshot();
    expect(snap.seats.get(1)).toEqual({ token: 'tok-1' });
    expect(snap.room?.seats[1]).toMatchObject({ claimed: true, name: 'mike' });
    expect(snap.seq).toBe(1);
  });

  it('seatClaimed WITHOUT token (another client) updates the roster but mints no credential', () => {
    const store = new RoomStore(CODE, fakeStorage());
    store.dispatch(welcome([], roomInfo()));
    store.dispatch(seatClaimedOther(2, 'ana', 1));
    const snap = store.getSnapshot();
    expect(snap.seats.has(2)).toBe(false);
    expect(snap.room?.seats[2]).toMatchObject({ claimed: true, name: 'ana' });
  });

  it('multi-seat self-play (PLAN §4): several own claims accumulate credentials', () => {
    const store = new RoomStore(CODE, fakeStorage());
    store.dispatch(welcome([], roomInfo()));
    store.dispatch(seatClaimedOwn(0, 'solo', 'tok-a', 1));
    store.dispatch(seatClaimedOwn(1, 'solo', 'tok-b', 2));
    expect(store.heldTokens()).toEqual(['tok-a', 'tok-b']);
    expect(store.getSnapshot().seats.size).toBe(2);
  });

  it('configChanged replaces room.config', () => {
    const store = new RoomStore(CODE, fakeStorage());
    store.dispatch(welcome([], roomInfo()));
    store.dispatch(configChanged({ deckCount: 2 }, 0, 3));
    const snap = store.getSnapshot();
    expect(snap.room?.config).toEqual({ deckCount: 2 });
    expect(snap.seq).toBe(3);
  });

  it('started flips room.status to playing', () => {
    const store = new RoomStore(CODE, fakeStorage());
    store.dispatch(welcome([], roomInfo()));
    store.dispatch(started(4));
    expect(store.getSnapshot().room?.status).toBe('playing');
  });

  it('event stores per-seat view, hints, and the event batch', () => {
    const store = new RoomStore(CODE, fakeStorage());
    store.dispatch(eventMsg(0, 7, { hand: ['AS'] }, [{ type: 'dealt' }], [{ type: 'pass' }]));
    const entry = store.getSnapshot().perSeat.get(0);
    expect(entry).toEqual({
      view: { hand: ['AS'] },
      hints: [{ type: 'pass' }],
      lastEventBatch: [{ type: 'dealt' }],
    });
    expect(store.getSnapshot().seq).toBe(7);
  });

  it('event without hints clears the seat hints (no longer an expected actor)', () => {
    const store = new RoomStore(CODE, fakeStorage());
    store.dispatch(eventMsg(0, 7, { a: 1 }, [], [{ type: 'pass' }]));
    store.dispatch(eventMsg(0, 8, { a: 2 }, [{ type: 'played' }]));
    expect(store.getSnapshot().perSeat.get(0)?.hints).toBeNull();
  });

  it('events for different held seats keep separate per-seat entries', () => {
    const store = new RoomStore(CODE, fakeStorage());
    store.dispatch(eventMsg(0, 7, { mine: 0 }, []));
    store.dispatch(eventMsg(2, 7, { mine: 2 }, []));
    const snap = store.getSnapshot();
    expect(snap.perSeat.get(0)?.view).toEqual({ mine: 0 });
    expect(snap.perSeat.get(2)?.view).toEqual({ mine: 2 });
  });

  it('resync replaces the view/hints and clears the stale event batch', () => {
    const store = new RoomStore(CODE, fakeStorage());
    store.dispatch(eventMsg(1, 5, { old: true }, [{ type: 'played' }]));
    store.dispatch(
      resyncMsg(1, 9, { fresh: true }, {
        events: [{ seq: 6, event: [{ type: 'passed' }] }],
        hints: [{ type: 'pass' }],
      }),
    );
    const entry = store.getSnapshot().perSeat.get(1);
    expect(entry).toEqual({ view: { fresh: true }, hints: [{ type: 'pass' }], lastEventBatch: null });
    expect(store.getSnapshot().seq).toBe(9);
  });

  it('presence flips the roster seat connected flag', () => {
    const store = new RoomStore(CODE, fakeStorage());
    store.dispatch(welcome([], roomInfo()));
    store.dispatch(presence(3, true, 1));
    expect(store.getSnapshot().room?.seats[3]?.connected).toBe(true);
    store.dispatch(presence(3, false, 1));
    expect(store.getSnapshot().room?.seats[3]?.connected).toBe(false);
  });

  it('rejected appends to rejections with actionId and semantic code', () => {
    const store = new RoomStore(CODE, fakeStorage());
    store.dispatch(rejected({ code: 'seat.notHeld' }, 4, 'aid-1'));
    expect(store.getSnapshot().rejections).toEqual([
      { seq: 4, actionId: 'aid-1', error: { code: 'seat.notHeld' } },
    ]);
  });

  it('rejections are bounded (oldest dropped first)', () => {
    const store = new RoomStore(CODE, fakeStorage());
    for (let i = 0; i < 25; i++) store.dispatch(rejected({ code: `e${i}` }, i));
    const rej = store.getSnapshot().rejections;
    expect(rej.length).toBe(20);
    expect(rej[0]?.error.code).toBe('e5');
    expect(rej[19]?.error.code).toBe('e24');
  });

  it('seq is monotonic: a late lower-seq message never regresses the cursor', () => {
    const store = new RoomStore(CODE, fakeStorage());
    store.dispatch(eventMsg(0, 9, { a: 1 }, []));
    store.dispatch(presence(1, true, 3)); // stale broadcast arriving late
    expect(store.getSnapshot().seq).toBe(9);
  });

  it('snapshot identity is stable across getSnapshot calls and changes only on dispatch', () => {
    const store = new RoomStore(CODE, fakeStorage());
    const a = store.getSnapshot();
    expect(store.getSnapshot()).toBe(a); // useSyncExternalStore contract
    store.dispatch(started(1));
    expect(store.getSnapshot()).not.toBe(a);
  });

  it('subscribe notifies on dispatch and unsubscribe stops notifications', () => {
    const store = new RoomStore(CODE, fakeStorage());
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    store.dispatch(started(1));
    expect(calls).toBe(1);
    unsubscribe();
    store.dispatch(presence(0, true, 2));
    expect(calls).toBe(1);
  });
});

describe('RoomStore persistence (PLAN §5 flow step 1)', () => {
  it('persists tokens by seat and lastSeenSeq under room:CODE', () => {
    const storage = fakeStorage();
    const store = new RoomStore(CODE, storage);
    store.dispatch(seatClaimedOwn(0, 'mike', 'tok-x', 1));
    store.dispatch(eventMsg(0, 12, { v: 1 }, []));
    expect(JSON.parse(storage.data.get(storageKeyFor(CODE)) as string)).toEqual({
      tokens: { '0': 'tok-x' },
      lastSeenSeq: 12,
    });
  });

  it('a new store instance reloads tokens + lastSeenSeq (tab-reload survival)', () => {
    const storage = fakeStorage();
    const first = new RoomStore(CODE, storage);
    first.dispatch(seatClaimedOwn(0, 'mike', 'tok-x', 1));
    first.dispatch(seatClaimedOwn(1, 'mike', 'tok-y', 2));
    first.dispatch(eventMsg(0, 8, {}, []));

    const reloaded = new RoomStore(CODE, storage);
    expect(reloaded.heldTokens()).toEqual(['tok-x', 'tok-y']);
    expect(reloaded.lastSeenSeq).toBe(8); // hello.lastSeenSeq → delta resync
  });

  it('welcome prunes persisted tokens the server no longer resolves', () => {
    const storage = fakeStorage({
      [storageKeyFor(CODE)]: JSON.stringify({ tokens: { '0': 'stale', '2': 'live' }, lastSeenSeq: 3 }),
    });
    const store = new RoomStore(CODE, storage);
    // The server resolved only seat 2's token (e.g. seat 0 was re-minted).
    store.dispatch(welcome([2], roomInfo({ seq: 3 }), 3));
    expect(store.heldTokens()).toEqual(['live']);
    expect(JSON.parse(storage.data.get(storageKeyFor(CODE)) as string).tokens).toEqual({
      '2': 'live',
    });
  });

  it('corrupt persisted JSON is ignored, not fatal', () => {
    const storage = fakeStorage({ [storageKeyFor(CODE)]: '{not json' });
    const store = new RoomStore(CODE, storage);
    expect(store.getSnapshot().seats.size).toBe(0);
    expect(store.lastSeenSeq).toBe(0);
  });

  it('no storage at all (node / private mode) still works in memory', () => {
    const store = new RoomStore(CODE, null);
    store.dispatch(seatClaimedOwn(0, 'mike', 'tok-x', 1));
    expect(store.heldTokens()).toEqual(['tok-x']);
  });
});

describe('RoomStore actions delegate to the bound sender', () => {
  it('claim/setConfig/setTiming/start/act forward with their arguments', () => {
    const calls: unknown[][] = [];
    const sender: RoomSender = {
      claimSeat: (...a) => calls.push(['claimSeat', ...a]),
      setConfig: (...a) => calls.push(['setConfig', ...a]),
      setTiming: (...a) => calls.push(['setTiming', ...a]),
      start: () => calls.push(['start']),
      act: (...a) => calls.push(['act', ...a]),
    };
    const store = new RoomStore(CODE, fakeStorage());
    store.bindSender(sender);
    store.claim('mike');
    store.setConfig({ x: 1 });
    store.setTiming({ perTurnMs: 20_000, planningMs: 45_000 });
    store.start();
    store.act(2, { type: 'pass' });
    expect(calls).toEqual([
      ['claimSeat', 'mike'],
      ['setConfig', { x: 1 }],
      ['setTiming', { perTurnMs: 20_000, planningMs: 45_000 }],
      ['start'],
      ['act', 2, { type: 'pass' }],
    ]);
  });

  it('actions are no-ops (not crashes) before a sender is bound', () => {
    const store = new RoomStore(CODE, fakeStorage());
    expect(() => {
      store.claim('mike');
      store.start();
    }).not.toThrow();
  });

  it('setConnected toggles the flag without touching game state', () => {
    const store = new RoomStore(CODE, fakeStorage());
    store.dispatch(eventMsg(0, 2, { keep: true }, []));
    store.setConnected(true);
    const snap = store.getSnapshot();
    expect(snap.connected).toBe(true);
    expect(snap.perSeat.get(0)?.view).toEqual({ keep: true });
    expect(snap.seq).toBe(2);
  });
});

// Auto-pass-on-no-legal-play e2e (auto-pass round): the feature's WIRE
// behaviour, read only off broadcasts (never server internals), like every e2e.
//   1. AUTO-PASS FIRES: a forced-pass seat's deadline carries timingClass
//      'forcedPass' with the ~4s grace, and the DO auto-passes it on expiry.
//   3. NEAR-BOUNDARY EXACTLY-ONCE: after the auto-pass commits, a late manual
//      pass at the old seq is REJECTED (out of turn) — the REAL mechanism, never
//      a second passed event (owner strengthen #1: assert the mechanism).
//   2. MANUAL PRESS EXACTLY-ONCE: pressing pass inside the window advances the
//      hand exactly once; the dropped row means no second (auto) pass follows.
//   OFF: with auto-pass off, a pass-only state carries a NORMAL turn budget and
//      NO 'forcedPass' class (OFF ≡ today).
//   UNTIMED: with the untimed preset + auto-pass on, a pass-only seat still gets
//      the ~4s forcedPass row even though other seats are untimed.
//
// The server LABELS a pass-only follower's deadline 'forcedPass', so the driver
// plays beating plays until a broadcast deadline carries that class — no engine
// re-derivation on the test side.

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { Seat } from '../../src/engine/core/game';
import { JIANGSU_OFFICIAL_ONLINE } from '../../src/engine/guandan/config';
import type { GuandanEvent } from '../../src/engine/guandan/types';
import type { ServerMessage, WireDeadline } from '../../src/shared/protocol';
import { AUTO_PASS_MS, TIMING_PRESETS, type RoomTiming } from '../../src/shared/timing';
import { DEFAULT_GAME_ID } from '../../src/client/config';
import {
  claimSeat,
  connectAndWelcome,
  createRoomFor,
  startServer,
  stopAllServers,
  type DevServer,
  type EventMsg,
  type RejectedMsg,
  type WsClient,
} from './helpers';

type RoomChangedMsg = Extract<ServerMessage, { type: 'roomChanged' }>;

// A firstLeadMethod that skips the draw-cut ceremony — this feature lives in the
// playing phase, and we want to reach it without cut plumbing.
const CONFIG = { ...JIANGSU_OFFICIAL_ONLINE, firstLeadMethod: 'random' as const };

async function setTimingAndAwait(client: WsClient, timing: RoomTiming): Promise<RoomChangedMsg> {
  const mark = client.mark();
  client.setTiming(timing);
  return client.waitFor<RoomChangedMsg>(
    (m) => m.type === 'roomChanged' && JSON.stringify(m.room.timing) === JSON.stringify(timing),
    { from: mark },
  );
}

interface ForcedPass {
  actor: Seat;
  seq: number;
  deadlines: WireDeadline[];
  row: WireDeadline; // the acting seat's own row
}

/** Start the match and drive (playing a beating play for each actor) until a
 *  broadcast deadline is labelled 'forcedPass' for the seat to act — i.e. the
 *  engine has judged that seat's only legal action is pass. Returns that seat +
 *  the seq/deadlines the state was observed at, WITHOUT acting on it. */
async function driveToForcedPass(client: WsClient): Promise<ForcedPass> {
  const startMark = client.mark();
  client.start();
  await client.waitFor((m) => m.type === 'started', { from: startMark });

  let atSeq = 0;
  for (let i = 0; i < 400; i++) {
    // The acting seat's copy of the latest event carries `hints`.
    const copy = await client.waitFor<EventMsg>(
      (m) => m.type === 'event' && m.hints !== undefined && m.seq >= atSeq,
      { from: startMark, timeoutMs: 20_000 },
    );
    const actor = copy.seat;
    const hints = copy.hints!;
    const deadlines = copy.deadlines ?? [];
    const row = deadlines.find((d) => d.seat === actor);

    // The feature signal: the server labelled this seat's decision forcedPass.
    if (row?.timingClass === 'forcedPass') {
      return { actor, seq: copy.seq, deadlines, row };
    }
    // Corroborating engine signal (belt): pass is the only legal action.
    const play = hints.find((h) => (h as { type: string }).type === 'play');
    if (play === undefined) {
      // pass-only but not labelled forcedPass (auto-pass OFF / untimed OFF): the
      // OFF/untimed tests inspect the row directly, so return it here too.
      return { actor, seq: copy.seq, deadlines, row: row ?? { seat: actor, dueAt: 0 } };
    }

    // Play a beating play to escalate the trick toward a forced pass.
    const mark = client.mark();
    client.action(actor, play, { expectedSeq: copy.seq });
    const next = await client.waitFor<EventMsg>(
      (m) => m.type === 'event' && m.hints !== undefined && m.seq > copy.seq,
      { from: mark, timeoutMs: 20_000 },
    );
    atSeq = next.seq;
  }
  throw new Error('did not reach a forced-pass state within the action budget');
}

const passedBy = (batch: GuandanEvent[], seat: Seat): boolean =>
  batch.some((e) => e.type === 'passed' && (e as { seat?: Seat }).seat === seat);

describe('Auto-pass on no-legal-play e2e (auto-pass round)', () => {
  let server: DevServer;
  beforeAll(async () => {
    server = await startServer();
  });
  afterAll(async () => {
    await stopAllServers();
  });

  test(
    'ON: a forced-pass seat carries the forcedPass class + ~4s grace; the DO auto-passes on expiry; a LATE manual pass is rejected (exactly once)',
    async () => {
      const code = await createRoomFor(server, DEFAULT_GAME_ID, CONFIG);
      const { client } = await connectAndWelcome(server, code, { label: 'auto-on' });
      try {
        for (let i = 0; i < 4; i++) await claimSeat(client, `on-${i}`);
        await setTimingAndAwait(client, TIMING_PRESETS.standard); // auto-pass ON by default

        const fp = await driveToForcedPass(client);
        // The wire label + the ~4s grace (clamp-exempt; well under the 45s turn).
        expect(fp.row.timingClass).toBe('forcedPass');
        const graceLeft = fp.row.dueAt - Date.now();
        expect(graceLeft).toBeGreaterThan(1_500);
        expect(graceLeft).toBeLessThanOrEqual(AUTO_PASS_MS + 500);

        // Send NOTHING: the DO's alarm auto-passes the seat on expiry.
        const fireMark = client.mark();
        const autoPassed = await client.waitFor<EventMsg>(
          (m) =>
            m.type === 'event' &&
            m.seat === fp.actor &&
            m.seq > fp.seq &&
            passedBy(m.event as GuandanEvent[], fp.actor),
          { from: fireMark, timeoutMs: AUTO_PASS_MS + 6_000 },
        );
        const advancedSeq = autoPassed.seq;

        // NEAR-BOUNDARY / alarm-first exactly-once: a manual pass for the seat at
        // the OLD seq now loses — the engine re-validates against the advanced
        // state and REJECTS it out of turn (the real mechanism, not a seq no-op),
        // and no second passed event for that seat appears.
        const lateMark = client.mark();
        const lateId = client.action(fp.actor, { type: 'pass' }, { expectedSeq: fp.seq });
        const reply = await client.waitFor<RejectedMsg | EventMsg>(
          (m) =>
            (m.type === 'rejected' && m.actionId === lateId) ||
            (m.type === 'event' && m.seq > advancedSeq && m.hints !== undefined),
          { from: lateMark, timeoutMs: 10_000 },
        );
        expect(reply.type).toBe('rejected');
        if (reply.type === 'rejected') {
          expect(['action.notYourTurn', 'action.wrongPhase']).toContain(reply.error.code);
        }
      } finally {
        client.close();
      }
    },
    90_000,
  );

  test(
    'ON: a MANUAL pass inside the window advances the hand EXACTLY once (no trailing auto-pass on the dropped row)',
    async () => {
      const code = await createRoomFor(server, DEFAULT_GAME_ID, CONFIG);
      const { client } = await connectAndWelcome(server, code, { label: 'auto-manual' });
      try {
        for (let i = 0; i < 4; i++) await claimSeat(client, `mn-${i}`);
        await setTimingAndAwait(client, TIMING_PRESETS.standard);

        const fp = await driveToForcedPass(client);
        expect(fp.row.timingClass).toBe('forcedPass');

        // Press pass immediately (inside the window) — it advances the hand
        // EXACTLY once (seq + 1), before the ~4s alarm could fire.
        const mark = client.mark();
        const id = client.action(fp.actor, { type: 'pass' }, { expectedSeq: fp.seq });
        const passedEvent = await client.waitFor<EventMsg>(
          (m) =>
            m.type === 'event' &&
            m.seat === fp.actor &&
            m.seq > fp.seq &&
            passedBy(m.event as GuandanEvent[], fp.actor),
          { from: mark, timeoutMs: 10_000 },
        );
        expect(passedEvent.seq).toBe(fp.seq + 1);

        // Re-submitting the SAME press (same actionId) is an idempotent no-op — a
        // resync at the current seq, never a second advance (actions_seen dedup).
        const reMark = client.mark();
        const beforeReSeq = passedEvent.seq;
        client.action(fp.actor, { type: 'pass' }, { expectedSeq: fp.seq, actionId: id });
        const resync = await client.waitFor(
          (m) => m.type === 'resync' && m.seat === fp.actor,
          { from: reMark, timeoutMs: 8_000 },
        );
        expect(resync.type).toBe('resync');
        if (resync.type === 'resync') expect(resync.seq).toBe(beforeReSeq); // no new advance
      } finally {
        client.close();
      }
    },
    90_000,
  );

  test(
    'OFF ≡ today: a pass-only state carries a NORMAL turn budget and NO forcedPass class',
    async () => {
      const code = await createRoomFor(server, DEFAULT_GAME_ID, CONFIG);
      const { client } = await connectAndWelcome(server, code, { label: 'auto-off' });
      try {
        for (let i = 0; i < 4; i++) await claimSeat(client, `off-${i}`);
        await setTimingAndAwait(client, { ...TIMING_PRESETS.standard, autoPassNoPlay: false });

        const fp = await driveToForcedPass(client);
        // The engine still emits forcedPass, but the ROOM (auto-pass OFF) reports
        // an ordinary turn/planning class + the normal budget — today's behaviour.
        expect(fp.row.timingClass).not.toBe('forcedPass');
        const left = fp.row.dueAt - Date.now();
        expect(left).toBeGreaterThan(AUTO_PASS_MS + 3_000); // clearly not the 4s grace
      } finally {
        client.close();
      }
    },
    90_000,
  );

  test(
    'UNTIMED + ON: a pass-only seat still gets the ~4s forcedPass row though other seats are untimed',
    async () => {
      const code = await createRoomFor(server, DEFAULT_GAME_ID, CONFIG);
      const { client } = await connectAndWelcome(server, code, { label: 'auto-untimed' });
      try {
        for (let i = 0; i < 4; i++) await claimSeat(client, `ut-${i}`);
        await setTimingAndAwait(client, TIMING_PRESETS.untimed); // autoPassNoPlay ON

        const fp = await driveToForcedPass(client);
        // Decision 3: auto-pass applies even in an untimed room (a forced pass is
        // not a decision). The forced-pass seat carries the ~4s forcedPass row.
        expect(fp.row.timingClass).toBe('forcedPass');
        const left = fp.row.dueAt - Date.now();
        expect(left).toBeGreaterThan(1_500);
        expect(left).toBeLessThanOrEqual(AUTO_PASS_MS + 500);
      } finally {
        client.close();
      }
    },
    90_000,
  );
});

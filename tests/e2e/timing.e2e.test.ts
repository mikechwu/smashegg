// M4 room-timing e2e (docs/research/room-timing.md): the timing config's
// full wire lifecycle — server-side default, lobby setTiming over the
// roomChanged broadcast, class-labeled deadlines (planning vs turn), the
// alarm-applied default action on expiry, and the untimed preset's
// disconnect-grace liveness shape. Wire-protocol only, like every e2e file:
// deadlines are read off welcome/event broadcasts, never server internals.

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { Seat } from '../../src/engine/core/game';
import { JIANGSU_OFFICIAL_ONLINE } from '../../src/engine/guandan/config';
import type { GuandanAction, GuandanEvent } from '../../src/engine/guandan/types';
import type { ServerMessage } from '../../src/shared/protocol';
import { TIMING_PRESETS, type RoomTiming } from '../../src/shared/timing';
import { DEFAULT_GAME_ID } from '../../src/client/config';
import {
  claimSeat,
  connectAndWelcome,
  createRoomFor,
  startServer,
  stopAllServers,
  type DevServer,
  type EventMsg,
  type WelcomeMsg,
  type WsClient,
} from './helpers';

type RoomChangedMsg = Extract<ServerMessage, { type: 'roomChanged' }>;

/** Any valid full RuleVariant does — timing is orthogonal to game rules,
 *  and 'random' first lead skips the ceremony payload as irrelevant here. */
const CONFIG = JIANGSU_OFFICIAL_ONLINE;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** setTiming, then await the roomChanged that carries the new value. The
 *  predicate must match on the timing itself: seat claims ALSO broadcast
 *  roomChanged (after their seatClaimed), so a bare type match can catch a
 *  stale roster broadcast still in flight from the last claim. */
async function setTimingAndAwaitBroadcast(
  client: WsClient,
  timing: RoomTiming,
): Promise<RoomChangedMsg> {
  const mark = client.mark();
  client.setTiming(timing);
  return client.waitFor<RoomChangedMsg>(
    (m) => m.type === 'roomChanged' && JSON.stringify(m.room.timing) === JSON.stringify(timing),
    { from: mark },
  );
}

describe('Room timing e2e (M4)', () => {
  let server: DevServer;

  beforeAll(async () => {
    server = await startServer();
  });

  afterAll(async () => {
    await stopAllServers();
  });

  test(
    'lobby timing path: standard default, setTiming(fast) broadcast, planning then turn deadlines',
    async () => {
      // Created WITHOUT timing → the server defaults the standard preset,
      // visible on the welcome's RoomInfo.
      const code = await createRoomFor(server, DEFAULT_GAME_ID, CONFIG);
      const { client, welcome } = await connectAndWelcome(server, code, { label: 'timing-lobby' });
      try {
        expect(welcome.room.timing).toEqual(TIMING_PRESETS.standard);

        for (let i = 0; i < 4; i++) await claimSeat(client, `tl-${i}`);

        // setTiming from a seated lobby client rides the existing
        // roomChanged broadcast — RoomInfo carries the fresh value.
        const changed = await setTimingAndAwaitBroadcast(client, TIMING_PRESETS.fast);
        expect(changed.room.timing).toEqual(TIMING_PRESETS.fast);

        // Start. The FIRST deadline broadcast is the opening lead — the
        // 'planning' class mapped through fast's 45s planning budget.
        const startMark = client.mark();
        client.start();
        const started = await client.waitFor((m) => m.type === 'started', { from: startMark });
        const copies = new Map<Seat, EventMsg>();
        for (let seat = 0 as Seat; seat < 4; seat++) {
          copies.set(
            seat,
            await client.waitFor<EventMsg>(
              (m) => m.type === 'event' && m.seat === seat && m.seq === started.seq,
              { from: startMark },
            ),
          );
        }
        const planningReceivedAt = Date.now();
        const deadlines = copies.get(0)!.deadlines!;
        expect(deadlines).toHaveLength(1);
        expect(deadlines[0]!.timingClass).toBe('planning');
        const planningLeft = deadlines[0]!.dueAt - planningReceivedAt;
        expect(planningLeft).toBeGreaterThan(40_000);
        expect(planningLeft).toBeLessThanOrEqual(46_000);

        // The opening lead: the one seat whose copy carries hints is the
        // planning row's seat; play its first hint.
        const [leader, leaderCopy] = [...copies.entries()].find(
          ([, m]) => m.hints !== undefined,
        )!;
        expect(deadlines[0]!.seat).toBe(leader);
        const hints = leaderCopy.hints as GuandanAction[];
        const playMark = client.mark();
        const actionId = client.action(leader, hints[0]!, { expectedSeq: started.seq });
        const reply = await client.waitFor(
          (m) =>
            (m.type === 'event' && m.seat === leader && m.seq > started.seq) ||
            (m.type === 'rejected' && m.actionId === actionId),
          { from: playMark },
        );
        expect(reply.type).toBe('event');

        // After the lead the follower is an ordinary 'turn' under fast's 20s.
        const turnReceivedAt = Date.now();
        const nextDeadlines = (reply as EventMsg).deadlines!;
        expect(nextDeadlines).toHaveLength(1);
        expect(nextDeadlines[0]!.timingClass).toBe('turn');
        expect(nextDeadlines[0]!.seat).not.toBe(leader);
        const turnLeft = nextDeadlines[0]!.dueAt - turnReceivedAt;
        expect(turnLeft).toBeGreaterThan(15_000);
        expect(turnLeft).toBeLessThanOrEqual(21_000);
      } finally {
        client.close();
      }
    },
    60_000,
  );

  test(
    'timeout auto-play observed end to end: the alarm-applied default action reaches every seat',
    async () => {
      const code = await createRoomFor(server, DEFAULT_GAME_ID, CONFIG);
      const { client } = await connectAndWelcome(server, code, { label: 'timing-timeout' });
      try {
        for (let i = 0; i < 4; i++) await claimSeat(client, `to-${i}`);

        // Custom (non-preset) values are valid — validateRoomTiming checks
        // range, not preset membership.
        const timing = { perTurnMs: 5_000, planningMs: 5_000 };
        const changed = await setTimingAndAwaitBroadcast(client, timing);
        expect(changed.room.timing).toEqual(timing);

        const startMark = client.mark();
        client.start();
        const started = await client.waitFor((m) => m.type === 'started', { from: startMark });
        const armedAt = Date.now();

        // Send NOTHING. The DO's alarm applies the default action at ~5s;
        // the applied action's event batch (played/passed) reaching every
        // seat IS the observable proof — no server internals inspected.
        let autoSeq: number | null = null;
        for (let seat = 0 as Seat; seat < 4; seat++) {
          const copy = await client.waitFor<EventMsg>(
            (m) => m.type === 'event' && m.seat === seat && m.seq > started.seq,
            { from: startMark, timeoutMs: 15_000 },
          );
          const batch = copy.event as GuandanEvent[];
          expect(batch.some((e) => e.type === 'played' || e.type === 'passed')).toBe(true);
          if (autoSeq === null) autoSeq = copy.seq;
          else expect(copy.seq).toBe(autoSeq); // one auto action, every copy of it
        }
        // The whole observation landed well within ~10s of arming the 5s clock.
        expect(Date.now() - armedAt).toBeLessThan(12_000);
      } finally {
        client.close();
      }
    },
    60_000,
  );

  test(
    'untimed liveness shape: no rows while connected; disconnect inserts the 60s grace row',
    async () => {
      const code = await createRoomFor(server, DEFAULT_GAME_ID, CONFIG);
      const { client: holder } = await connectAndWelcome(server, code, { label: 'untimed-holder' });
      let observer: WsClient | null = null;
      try {
        for (let i = 0; i < 4; i++) await claimSeat(holder, `u-${i}`);
        const changed = await setTimingAndAwaitBroadcast(holder, TIMING_PRESETS.untimed);
        expect(changed.room.timing).toEqual(TIMING_PRESETS.untimed);

        // Start: a CONNECTED actor under untimed gets NO deadline row —
        // the start fan-out broadcasts an empty deadlines array.
        const startMark = holder.mark();
        holder.start();
        const started = await holder.waitFor((m) => m.type === 'started', { from: startMark });
        let leader: Seat | null = null;
        for (let seat = 0 as Seat; seat < 4; seat++) {
          const copy = await holder.waitFor<EventMsg>(
            (m) => m.type === 'event' && m.seat === seat && m.seq === started.seq,
            { from: startMark },
          );
          expect(copy.deadlines).toEqual([]);
          if (copy.hints !== undefined) leader = seat;
        }
        expect(leader).not.toBeNull();

        // A token-less observer outlives the holder socket to watch the
        // presence recompute's result.
        const obs = await connectAndWelcome(server, code, { label: 'untimed-observer' });
        observer = obs.client;
        expect(obs.welcome.deadlines ?? []).toEqual([]);

        // Hard-close the holder: every seat drops at once, and the presence
        // recompute must insert the disconnect-grace row for the ONE
        // expected actor (PLAN §4 null-timeout rule — liveness never
        // depends on the untimed config).
        const obsMark = observer.mark();
        const closedAt = Date.now();
        holder.close();
        await observer.waitFor(
          (m) => m.type === 'presence' && m.seat === leader && m.connected === false,
          { from: obsMark },
        );
        await sleep(250); // let the reconcile's synchronous SQL settle

        // Read the rows via a fresh hello (welcome carries the current
        // deadlines) — assert the ROW, never wait out the 60s.
        const helloMark = observer.mark();
        observer.hello([], 0);
        const welcome2 = await observer.waitFor<WelcomeMsg>((m) => m.type === 'welcome', {
          from: helloMark,
        });
        const rows = welcome2.deadlines ?? [];
        expect(rows).toHaveLength(1);
        expect(rows[0]!.seat).toBe(leader);
        const graceLeft = rows[0]!.dueAt - Date.now();
        expect(graceLeft).toBeGreaterThan(55_000);
        expect(graceLeft).toBeLessThanOrEqual(61_000);
        // The grace is anchored at the disconnect, not at our read.
        expect(rows[0]!.dueAt - closedAt).toBeLessThanOrEqual(61_000);
      } finally {
        observer?.close();
        holder.close();
      }
    },
    60_000,
  );
});

// M4 version-skew signal e2e: the injected BUILD_VERSION rides welcome.build
// and /api/health, and — the production-redeploy analog — a stop/restart on
// the same persist dir under a NEW build both advertises that build to a
// reconnecting stale client and resyncs its game intact. Wire-protocol only,
// like every e2e file.

import { afterAll, describe, expect, test } from 'vitest';

import type { GNConfig, GNView } from '../../src/engine/guess-number';
import type { HealthResponse } from '../../src/shared/protocol';
import { TIMING_PRESETS } from '../../src/shared/timing';
import {
  claimSeat,
  connectAndWelcome,
  createRoomFor,
  getDump,
  makePersistDir,
  startServer,
  stopAllServers,
  WsClient,
  type DevServer,
  type EventMsg,
  type ResyncMsg,
} from './helpers';

const CONFIG: GNConfig = { rangeMax: 100, suddenDeath: true };

async function getHealth(server: DevServer): Promise<HealthResponse> {
  const res = await fetch(`${server.url}/api/health`);
  if (!res.ok) throw new Error(`health failed: ${res.status}`);
  return (await res.json()) as HealthResponse;
}

describe('Version-skew signal e2e (M4)', () => {
  afterAll(async () => {
    await stopAllServers();
  });

  test('injected build version rides welcome.build and /api/health', async () => {
    const server = await startServer({ buildVersion: 'aaaaaaa' });
    const opened: WsClient[] = [];
    try {
      // Out-of-band probe: the same assertion the deploy smoke check makes.
      expect(await getHealth(server)).toEqual({ ok: true, build: 'aaaaaaa' });

      const code = await createRoomFor(server, 'guess-number', CONFIG);
      const { client, welcome } = await connectAndWelcome(server, code);
      opened.push(client);
      expect(welcome.build).toBe('aaaaaaa');
    } finally {
      for (const c of opened) c.close();
      await server.stop();
    }
  });

  test('restart under a NEW build: stale reconnect learns it AND resyncs intact', async () => {
    // The closest local analog to a production redeploy (same pattern as the
    // kill/restart test in room.e2e.test.ts): one persist dir, two wrangler
    // processes with different BUILD_VERSIONs.
    const persistDir = makePersistDir();
    const server1 = await startServer({ persistDir, buildVersion: 'aaaaaaa' });

    // ---- Phase 1: play half a game under build A. ---- Untimed keeps the
    // restart window free of alarm auto-plays (a disconnected seat's grace
    // is 60s, far above the restart's tens of seconds).
    const code = await createRoomFor(server1, 'guess-number', CONFIG, TIMING_PRESETS.untimed);
    const { client: a1, welcome: welcomeA1 } = await connectAndWelcome(server1, code, { label: 'a1' });
    expect(welcomeA1.build).toBe('aaaaaaa');
    const seatA = await claimSeat(a1, 'alice');
    const { client: b1 } = await connectAndWelcome(server1, code, { label: 'b1' });
    const seatB = await claimSeat(b1, 'bob');
    a1.start();
    const started = await a1.waitFor((m) => m.type === 'started');
    const startedSeq = started.seq;

    // Guaranteed-WRONG guesses so the half-game can't accidentally end
    // (dump route, PLAN §6 — dev-gated, always open under startServer).
    const dump = await getDump(server1, code);
    const secret = dump.snapshot.state?.secret as number;
    const wrongGuess = secret === 1 ? 2 : 1;

    let seq = startedSeq;
    for (const seat of [seatA.seat, seatB.seat]) {
      const client = seat === seatA.seat ? a1 : b1;
      const mark = client.mark();
      client.action(seat, { type: 'guess', value: wrongGuess }, { expectedSeq: seq });
      const ev = await client.waitFor<EventMsg>(
        (m) => m.type === 'event' && m.seat === seat && m.seq > seq,
        { from: mark },
      );
      seq = ev.seq;
    }
    const preStopSeq = seq;

    // Await A's own fan-out copy of every seq before capturing what it saw
    // live — the loop above only awaited each SENDER's copy.
    for (let s = startedSeq; s <= preStopSeq; s++) {
      await a1.waitFor((m) => m.type === 'event' && m.seat === seatA.seat && m.seq === s);
    }
    const liveEventsBySeq = new Map<number, unknown>(
      a1.log
        .filter((m): m is EventMsg => m.type === 'event' && m.seat === seatA.seat)
        .map((m) => [m.seq, m.event]),
    );
    const preStopView = a1.log
      .filter((m): m is EventMsg => m.type === 'event' && m.seat === seatA.seat)
      .map((m) => m.view as GNView)
      .pop();

    a1.close();
    b1.close();
    await server1.stop();

    // ---- Phase 2: same persist dir, build B — the "redeploy". ----
    const server2 = await startServer({ persistDir, buildVersion: 'bbbbbbb' });
    const { client: a2, welcome: welcomeA2 } = await connectAndWelcome(server2, code, {
      tokens: [seatA.token],
      lastSeenSeq: startedSeq, // a real gap -> exercises the delta path
      label: 'a2',
    });
    const { client: b2, welcome: welcomeB2 } = await connectAndWelcome(server2, code, {
      tokens: [seatB.token],
      lastSeenSeq: preStopSeq, // fully caught-up
      label: 'b2',
    });
    try {
      // The skew signal: BOTH channels serve the new build...
      expect((await getHealth(server2)).build).toBe('bbbbbbb');
      expect(welcomeA2.build).toBe('bbbbbbb');
      expect(welcomeB2.build).toBe('bbbbbbb');

      // ...AND state continuity coexists with it: same seats, still playing,
      // seq never rewound.
      expect(welcomeA2.seats).toEqual([seatA.seat]);
      expect(welcomeB2.seats).toEqual([seatB.seat]);
      expect(welcomeA2.room.status).toBe('playing');
      expect(welcomeA2.seq).toBeGreaterThanOrEqual(preStopSeq);

      const resyncA = await a2.waitFor<ResyncMsg>((m) => m.type === 'resync' && m.seat === seatA.seat);
      const resumedView = resyncA.view as GNView;
      expect(preStopView).toBeDefined();
      expect(resumedView.guesses.slice(0, preStopView!.guesses.length)).toEqual(preStopView!.guesses);
      if (welcomeA2.seq === preStopSeq) expect(resumedView).toEqual(preStopView);

      // A's gap is delta-covered, contiguous, and (for the pre-stop span)
      // byte-identical to what was delivered live under build A.
      expect(resyncA.events).toBeDefined();
      expect(resyncA.events!.map((e) => e.seq)).toEqual(
        Array.from({ length: welcomeA2.seq - startedSeq }, (_, i) => startedSeq + 1 + i),
      );
      for (const entry of resyncA.events!) {
        if (entry.seq <= preStopSeq) {
          expect(entry.event).toEqual(liveEventsBySeq.get(entry.seq));
        }
      }

      // The resynced client is genuinely LIVE across the version change:
      // A2's next action applies and B2 witnesses it.
      const b2Mark = b2.mark();
      a2.action(seatA.seat, { type: 'guess', value: wrongGuess }, { expectedSeq: resyncA.seq });
      const applied = await a2.waitFor<EventMsg>(
        (m) => m.type === 'event' && m.seat === seatA.seat && m.seq > resyncA.seq,
      );
      await b2.waitFor((m) => m.type === 'event' && m.seq === applied.seq, { from: b2Mark });
    } finally {
      a2.close();
      b2.close();
      await server2.stop();
    }
  });
});

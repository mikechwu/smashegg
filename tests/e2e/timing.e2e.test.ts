// M4 room-timing e2e (docs/research/room-timing.md): the timing config's
// full wire lifecycle — server-side default, lobby setTiming over the
// roomChanged broadcast, class-labeled deadlines (planning vs turn), the
// alarm-applied default action on expiry, and the untimed preset's
// disconnect-grace liveness shape. Wire-protocol only, like every e2e file:
// deadlines are read off welcome/event broadcasts, never server internals.

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { Seat } from '../../src/engine/core/game';
import { JIANGSU_OFFICIAL_ONLINE } from '../../src/engine/guandan/config';
import type { GuandanAction, GuandanEvent, GuandanView } from '../../src/engine/guandan/types';
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

/**
 * The LOWEST single this seat can lead, chosen from the WIRE alone.
 *
 * `playerView.hand` is already `sortCards`'d ascending by levelValue
 * (engine/guandan/index.ts), so the single whose card sits earliest in
 * `view.hand` is the weakest lead available. No engine ordering is re-derived
 * test-side — the house rule this file's neighbours state (see auto-pass.e2e).
 *
 * WHY NOT `hints[0]`, which this test used to lead with. `legalPlays`
 * enumerates `for (const rank of RANKS)` and `RANKS[0] === '2'` — which at hand
 * 1 IS the level rank. So `hints[0]` was a level-card single (above an Ace,
 * beatable only by a joker or a bomb) on ~91% of deals, and that left the first
 * follower with NO legal play. `timingClass` checks `isForcedPass` BEFORE the
 * planning branch — a forced pass is not a decision — so that seat truthfully
 * classed 'forcedPass' and was armed with AUTO_PASS_MS (4s), not planningMs
 * (45s). The assertion below then read 4000 > 40_000 and CI went red.
 *
 * MEASURED HERE, by replaying the engine over fresh server-format seeds — this
 * is the run that backs this comment, not a figure quoted from elsewhere:
 *   hints[0]      -> first follower forced on 178/20_000 = 0.890% of deals
 *   lowest single -> 0/20_000
 * (An earlier draft also cited "0/300_000 follower-instances". That number came
 * from a different analysis and was not reproduced when audited, so it is gone;
 * 0/20_000 is what was actually run.)
 * The bound is structural rather than sampled: a bomb-free 27-card hand spans
 * at least ceil(27/3) = 9 distinct ranks, so a follower can only be forced by a
 * lead of J-or-higher, which needs the leader's whole hand inside
 * {J,Q,K,A,level,SJ,BJ} — C(44,27)/C(108,27) ~= 3e-14.
 *
 * WHAT THIS COSTS, stated rather than buried. Leading low means the follower is
 * never pass-only here, so this test can no longer notice a `legalPlays` that
 * UNDER-generates (e.g. drops bombs against a single) — the old lead reddened on
 * ~28% of deals under that mutant. That detection is deliberately given up: its
 * failure message was `expected 'planning', got 'forcedPass'`, indistinguishable
 * from the 0.9% flake above, so in practice it would have been re-run and
 * dismissed rather than investigated — an effective rate of zero, not 28%.
 *
 * The mutant is owned deterministically instead by
 * tests/unit/engine/generate.test.ts — "a follower holding a BOMB is never
 * forced to pass against a single" and "following filter: only beating
 * projections are generated". Both were CONFIRMED red under that mutant, and
 * combos.test.ts was confirmed NOT to catch it (it tests the beats-relation,
 * not the generator), so the pointer names the file that actually holds the
 * line. generate.test.ts carries the matching note pointing back here, so
 * deleting it surfaces this dependency at the moment of deletion.
 */
function lowestSingleLead(hints: readonly GuandanAction[], view: GuandanView): GuandanAction {
  const singles = hints.filter(
    (h): h is Extract<GuandanAction, { type: 'play' }> => h.type === 'play' && h.cards.length === 1,
  );
  // Every held card is a legal single lead, so an empty list means the wire
  // shape changed under us — fail loudly rather than fall back to hints[0].
  expect(singles.length, 'the leader was offered at least one single').toBeGreaterThan(0);
  const at = (h: Extract<GuandanAction, { type: 'play' }>): number => view.hand.indexOf(h.cards[0]!);
  const lead = singles.reduce((lo, h) => (at(h) < at(lo) ? h : lo));
  expect(at(lead), 'the chosen single is a card this seat actually holds').toBeGreaterThanOrEqual(0);
  return lead;
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
    'lobby timing path: standard default, setTiming(fast) broadcast, PER-SEAT planning windows then turn (item 2)',
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
        // planning row's seat. It leads its LOWEST single — see
        // lowestSingleLead for why hints[0] made this test a 0.9% CI red.
        const [leader, leaderCopy] = [...copies.entries()].find(
          ([, m]) => m.hints !== undefined,
        )!;
        expect(deadlines[0]!.seat).toBe(leader);
        const hints = leaderCopy.hints as GuandanAction[];
        const lead = lowestSingleLead(hints, leaderCopy.view as GuandanView);
        const playMark = client.mark();
        const actionId = client.action(leader, lead, { expectedSeq: started.seq });
        const reply = await client.waitFor(
          (m) =>
            (m.type === 'event' && m.seat === leader && m.seq > started.seq) ||
            (m.type === 'rejected' && m.actionId === actionId),
          { from: playMark },
        );
        expect(reply.type).toBe('event');

        // Item 2 (the owner scenario, on the wire): the FOLLOWER's first
        // action of the hand is ALSO its planning moment — fast's 45s
        // planning budget, NOT the 20s turn budget. Pre-item-2 this row
        // classed 'turn'; the leader playing fast must not eat the other
        // seats' windows.
        //
        // UNCONDITIONAL on purpose. A conditional form ("planning only if the
        // follower has a play") was designed and rejected: `isForcedPass` IS
        // `legalPlays(...).length === 0` and the hints come from that same
        // call, so the condition ENTAILS the class it guards — it can only
        // certify whatever it finds. The randomness is removed at the source
        // instead, by the lead choice above, which leaves this line total.
        //
        // This is also the ONLY place in the repo where a NON-leader seat is
        // seen drawing a planning window on a real broadcast after another
        // seat has already acted. room-helpers.test.ts exercises the resolver
        // but not its caller, and deadline-liveness mirrors the DO's per-seat
        // call inside its own VirtualRoom rather than exercising it — so a
        // regression that resolved once and reused the result for every row
        // leaves both green and only this line red.
        const followerReceivedAt = Date.now();
        const nextDeadlines = (reply as EventMsg).deadlines!;
        expect(nextDeadlines).toHaveLength(1);
        expect(nextDeadlines[0]!.timingClass).toBe('planning');
        expect(nextDeadlines[0]!.seat).not.toBe(leader);
        const followerLeft = nextDeadlines[0]!.dueAt - followerReceivedAt;
        expect(followerLeft).toBeGreaterThan(40_000);
        expect(followerLeft).toBeLessThanOrEqual(46_000);

        // Pass the trick around — each follower's own first (planning)
        // action — until the lead returns to the leader for trick 2: the
        // leader's SECOND action of the hand classes 'turn' under fast's
        // 20s budget (its window was consumed by the opening lead).
        let seq = (reply as EventMsg).seq;
        let rows = nextDeadlines;
        for (let i = 0; i < 3; i++) {
          const actor = rows[0]!.seat;
          const actorCopy = await client.waitFor<EventMsg>(
            (m) => m.type === 'event' && m.seat === actor && m.seq === seq,
            { from: startMark },
          );
          const pass = (actorCopy.hints as GuandanAction[]).find((a) => a.type === 'pass');
          expect(pass, `follower ${actor} can pass`).toBeDefined();
          const mark2 = client.mark();
          client.action(actor, pass!, { expectedSeq: seq });
          const next = await client.waitFor<EventMsg>(
            (m) => m.type === 'event' && m.seat === actor && m.seq > seq,
            { from: mark2 },
          );
          seq = next.seq;
          rows = next.deadlines!;
        }
        const turn2ReceivedAt = Date.now();
        expect(rows).toHaveLength(1);
        expect(rows[0]!.seat).toBe(leader);
        expect(rows[0]!.timingClass).toBe('turn');
        const turnLeft = rows[0]!.dueAt - turn2ReceivedAt;
        expect(turnLeft).toBeGreaterThan(15_000);
        expect(turnLeft).toBeLessThanOrEqual(21_000);

        // A FOLLOWER'S SECOND DECISION also classes 'turn' — and it is a seat
        // whose only action so far was a PASS.
        //
        // This is the one assertion here that adds detection rather than
        // removing flake. It is aimed at two mutants:
        //   - the acted flag marked on a PLAY only, so passing never consumes
        //     a seat's window and it draws 45s every trick;
        //   - a card-count proxy for "has acted", which a pass also leaves
        //     unchanged, with the same effect.
        // Both are invisible to every OTHER row in this file, because each of
        // those belongs either to the leader (which PLAYED) or to a seat taking
        // its FIRST action. Only a passer acting a second time separates them.
        //
        // SCOPE, because an earlier draft of this comment overstated it: "0%
        // detection" is true OF THIS FILE, not of the suite. The unit twin
        // tests/unit/engine/timing-class.test.ts already catches both mutants
        // at the model level — its `actOnce(state, 1)` makes seat 1 PASS, so a
        // play-only acted flag leaves it 'planning' and that test goes red.
        // Verified by injecting the mutant. What this row adds is the WIRE
        // path: that a passer's spent window survives the DO's per-seat
        // resolution and the broadcast, which the unit test cannot see.
        const leaderCopy2 = await client.waitFor<EventMsg>(
          (m) => m.type === 'event' && m.seat === leader && m.seq === seq,
          { from: startMark },
        );
        const lead2 = lowestSingleLead(
          leaderCopy2.hints as GuandanAction[],
          leaderCopy2.view as GuandanView,
        );
        const mark3 = client.mark();
        client.action(leader, lead2, { expectedSeq: seq });
        const trick2 = await client.waitFor<EventMsg>(
          (m) => m.type === 'event' && m.seat === leader && m.seq > seq,
          { from: mark3 },
        );
        const secondReceivedAt = Date.now();
        const rows2 = trick2.deadlines!;
        expect(rows2).toHaveLength(1);
        const repeatActor = rows2[0]!.seat;
        expect(repeatActor, 'the next actor is a follower, not the leader').not.toBe(leader);
        expect(
          rows2[0]!.timingClass,
          `seat ${repeatActor} already passed this hand, so its window is spent`,
        ).toBe('turn');
        const secondLeft = rows2[0]!.dueAt - secondReceivedAt;
        expect(secondLeft).toBeGreaterThan(15_000);
        expect(secondLeft).toBeLessThanOrEqual(21_000);
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
        const timing = { perTurnMs: 5_000, planningMs: 5_000, autoPassNoPlay: true };
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

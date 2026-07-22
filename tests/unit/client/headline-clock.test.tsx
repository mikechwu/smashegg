// Refinement round, item 6 — the turn COUNTDOWN moved off the seat pills onto
// TableHeadline's turn line. The ratchet: the clock renders ONLY beside a
// named turn (one table-wide number, label left / seconds right), carries the
// planning-window word when that is what it times, escalates ONLY for your
// own turn running short (≤10s, the owner's original urgency rule relocated
// intact), and the pills themselves are clock-free — SeatPlate no longer even
// accepts timing props. Same DOM-free idiom as seat-stack.test.tsx: static
// renders + comment-stripped source pins; the ticking is eyes/browser-gated.

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { TableHeadline, type TableHeadlineProps } from '../../../src/client/table/TableHeadline';
import { GameTable } from '../../../src/client/GameTable';
import { RoomStore, type RoomSnapshot } from '../../../src/client/room/store';
import type { GuandanView } from '../../../src/engine/guandan/types';
import { getLocale, setLocale, t } from '../../../src/client/i18n';
import { playingLevelTeam } from '../../../src/client/table/helpers';

const gameTableSrc = readFileSync(join(__dirname, '../../../src/client/GameTable.tsx'), 'utf8');
const seatPlateSrc = readFileSync(
  join(__dirname, '../../../src/client/table/SeatPlate.tsx'),
  'utf8',
);

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function renderHeadline(over: Partial<TableHeadlineProps> = {}): string {
  return renderToStaticMarkup(
    createElement(TableHeadline, {
      levels: ['2', '2'],
      aAttempts: [0, 0],
      aAttemptsExhausted: [false, false],
      viewerTeam: 0,
      yourTurn: false,
      actorName: 'Actor Two',
      playingTeam: null,
      dueSeconds: null,
      planning: false,
      ...over,
    }),
  );
}

describe('headline clock: one table-wide countdown on the turn line', () => {
  it('renders the chip beside a named actor turn: seconds in the num slot, countdown aria, no urgency', () => {
    const original = getLocale();
    try {
      setLocale('en');
      const html = renderHeadline({ dueSeconds: 79 });
      expect(html).toContain('gd-headline__clock');
      expect(html).toMatch(/gd-headline__clockNum">79</);
      expect(html).toContain(`aria-label="${t('game.turn.countdown', { seconds: 79 })}"`);
      // Urgency is reserved for YOUR turn — a remote actor at 8s stays quiet.
      expect(renderHeadline({ dueSeconds: 8 })).not.toContain('gd-headline__clock--urgent');
    } finally {
      setLocale(original);
    }
  });

  it('escalates ONLY your own turn at ≤10s (the auto-pass moment): 11 quiet, 10 urgent', () => {
    const yours = (s: number) =>
      renderHeadline({ yourTurn: true, actorName: null, dueSeconds: s });
    expect(yours(11)).not.toContain('gd-headline__clock--urgent');
    expect(yours(10)).toContain('gd-headline__clock--urgent');
    expect(yours(3)).toContain('gd-headline__clock--urgent');
  });

  it('carries the planning-window word inside the chip when the clock times the planning window', () => {
    const original = getLocale();
    try {
      setLocale('en');
      const planning = renderHeadline({ dueSeconds: 85, planning: true });
      expect(planning).toContain('gd-headline__clockNote');
      expect(planning).toContain(t('table.deadline.planning'));
      // An ordinary turn clock carries no note — just the seconds.
      expect(renderHeadline({ dueSeconds: 20 })).not.toContain('gd-headline__clockNote');
    } finally {
      setLocale(original);
    }
  });

  it('no clock without a turn to pin it to, and no clock without a deadline', () => {
    // A deadline with no named actor (between turns) must stay silent…
    expect(renderHeadline({ actorName: null, dueSeconds: 30 })).not.toContain(
      'gd-headline__clock',
    );
    // …and a named turn with no armed deadline shows the sentence alone.
    const bare = renderHeadline({ dueSeconds: null });
    expect(bare).not.toContain('gd-headline__clock');
    expect(bare).toContain('gd-headline__turn');
  });

  it('SeatPlate is clock-free by construction: no timing props, no timer markup, no planning note', () => {
    const plate = stripTsComments(seatPlateSrc);
    for (const gone of ['dueAt', 'planning', 'dimTimer', 'remainingSeconds', '__timer']) {
      expect(plate, `SeatPlate must not carry ${gone}`).not.toContain(gone);
    }
  });

  it('GameTable binds the clock to the NAMED seat (source pins): named-actor attribution, conceal + ceremony/deal suppression, connected planning gate', () => {
    const table = stripTsComments(gameTableSrc);
    // Panel HIGH (Codex + Grok concurring): concurrent deadlines are per-seat
    // budgets and genuinely diverge (disconnect grace clamps), so the chip
    // must bind to the seat the turn sentence NAMES — your seat on your turn,
    // else actorSeats[0] (the same seat actorName reads) — never to a global
    // "soonest" that could pin another payer's dying clock (and its urgency)
    // on "Your turn".
    expect(table).toMatch(/const clockSeat = yourTurn \? activeSeat : \(actorSeats\[0\] \?\? null\);/);
    expect(table).not.toContain('dueAt < min.dueAt');
    // The concealed hand-1 leader never gets a clock (the landing IS the
    // reveal)…
    expect(table).toMatch(/clockSeat === null \|\| clockSeat === leaderConcealed\s*\?\s*undefined/);
    // …and the owner rule is relocated intact: no countdown during the
    // ceremony or the deal — a clock before the player HAS a sorted hand is
    // meaningless.
    expect(table).toMatch(
      /ceremonyShowing \|\| dealing \|\| interludeShowing \|\| clockDeadline === undefined\s*\?\s*null\s*:\s*remainingSeconds\(clockDeadline\.dueAt, now\)/,
    );
    // The concealed-leader override rides the SAME prop the turn line uses.
    expect(table).toMatch(/dueSeconds=\{leaderConcealed !== null \? null : dueSeconds\}/);
    // The planning word only for a CONNECTED actor (the old pill's
    // `planning && connected` gate, relocated — Grok LOW).
    expect(table).toMatch(/planning=\{clockDeadline\?\.timingClass === 'planning' && clockConnected\}/);
    expect(table).toMatch(/s\.seat === clockSeat\)\?\.connected \?\? false/);
  });
});

// ---------------------------------------------------------------------------
// End to end through GameTable: a playing snapshot with an armed deadline
// shows the clock ON the turn line, while every seat pill stays clock-free.
// ---------------------------------------------------------------------------

function playingView(): GuandanView {
  return {
    seat: 0,
    phase: 'playing',
    handNo: 2,
    currentLevel: '2',
    declarerTeam: null,
    levels: ['2', '2'],
    aAttempts: [0, 0],
    aAttemptsExhausted: [false, false],
    hand: [],
    cardCounts: [27, 27, 27, 27],
    ceremonyCutter: null,
    ceremonyFlips: null,
    finishOrder: [],
    trick: { leader: 1, toAct: 1, top: null, jiefengTo: null },
    tribute: null,
    matchWinner: null,
  } as unknown as GuandanView;
}

function snapshotWithDeadline(): RoomSnapshot {
  return {
    room: {
      gameId: 'guandan',
      status: 'playing',
      config: null,
      seats: [0, 1, 2, 3].map((seat) => ({
        seat,
        name: seat === 0 ? 'ViewerName' : `Seat${seat + 1}`,
        claimed: true,
        connected: true,
      })),
      timing: null,
      seq: 1,
    },
    seats: new Map([[0, { token: 'tok' }]]),
    perSeat: new Map([[0, { view: playingView(), hints: null, lastEventBatch: null }]]),
    seq: 1,
    connected: true,
    rejections: [],
    deadlines: [{ seat: 1, dueAt: Date.now() + 30_000, timingClass: 'turn' }],
  } as unknown as RoomSnapshot;
}

describe('headline clock through GameTable (integration)', () => {
  it('the armed deadline renders ON the turn line; every pill is clock-free; the actor pill keeps its ring', () => {
    const store = new RoomStore('TESTCODE');
    const html = renderToStaticMarkup(
      createElement(GameTable, { snapshot: snapshotWithDeadline(), store }),
    );
    // The turn line names seat 1 and carries the chip with a live number.
    expect(html).toContain('gd-headline__turn');
    expect(html).toMatch(/gd-headline__clockNum">\d+</);
    // No pill anywhere carries a clock; the acting seat still shows its ring.
    expect(html).not.toContain('gd-plate__timer');
    expect(html).toContain('gd-plate--active');
    // A REMOTE turn puts nothing beside your own controls (the hand clock is
    // your-turn-only, flank round item 3).
    expect(html).not.toContain('gd-handclock');
  });

  it('the chip rides BESIDE the turn sentence, not the bar far end (flank round: no margin-left auto)', () => {
    const stripped = readFileSync(
      join(__dirname, '../../../src/client/table/table.css'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = stripped.match(/\.gd-headline__clock\s*\{[^}]*\}/)?.[0] ?? '';
    expect(rule, 'headline clock rule not found').not.toBe('');
    expect(rule).not.toContain('margin-left: auto');
  });
});

// ---------------------------------------------------------------------------
// The own-turn clock moved ONTO THE PLAY DESK (elder round, D4/D5 —
// superseding flank item 3's sort-pill chip): one large labeled clock in
// the loud desk, discrete urgency (never a pulse), and the old gd-handclock
// duplicate is gone for good.
// ---------------------------------------------------------------------------

describe('own-turn clock on the play desk', () => {
  function yourTurnSnapshot(secondsFromNow: number): RoomSnapshot {
    const snap = snapshotWithDeadline() as unknown as {
      perSeat: Map<number, { view: GuandanView; hints: unknown; lastEventBatch: null }>;
      deadlines: { seat: number; dueAt: number; timingClass: string }[];
    };
    const view = playingView() as unknown as {
      trick: { leader: number; toAct: number; top: null; jiefengTo: null };
    };
    view.trick = { leader: 0, toAct: 0, top: null, jiefengTo: null };
    snap.perSeat.set(0, { view: view as unknown as GuandanView, hints: [], lastEventBatch: null });
    snap.deadlines = [{ seat: 0, dueAt: Date.now() + secondsFromNow * 1000, timingClass: 'turn' }];
    return snap as unknown as RoomSnapshot;
  }

  it('the LOUD desk carries the single own-turn clock; the sort-pill chip is gone', () => {
    const store = new RoomStore('TESTCODE');
    const html = renderToStaticMarkup(
      createElement(GameTable, { snapshot: yourTurnSnapshot(30), store }),
    );
    expect(html).toContain('gd-desk--play');
    const num = Number(html.match(/gd-desk__clock[^>]*>(\d+)</)?.[1]);
    expect(num).toBeGreaterThanOrEqual(28);
    expect(num).toBeLessThanOrEqual(30);
    // Calm above the amber third: no urgency class, no hurry copy.
    expect(html).not.toContain('gd-desk--urgent');
    expect(html).not.toContain('gd-desk__hurry');
    // The old duplicate is gone EVERYWHERE, not merely relocated.
    expect(html).not.toContain('gd-handclock');
  });

  it('escalates at <=10s: urgent stage class, the title carrying the hurry seconds — no extra row', () => {
    const store = new RoomStore('TESTCODE');
    const html = renderToStaticMarkup(
      createElement(GameTable, { snapshot: yourTurnSnapshot(8), store }),
    );
    expect(html).toContain('gd-desk--urgent');
    // Locale-agnostic: the hurry copy in the TITLE slot carries the number.
    expect(html).toMatch(/gd-desk__title[^>]*>[^<]*[78][^<]*</);
    expect(html).not.toContain('gd-desk__hurry');
  });
});

// ---------------------------------------------------------------------------
// Panel HIGH regression pins (Codex + Grok concurring): with CONCURRENT
// unequal deadlines (double tribute; the server clamps a disconnected payer's
// dueAt to its grace), the chip must show the NAMED seat's seconds — never
// another payer's sooner clock, and never someone else's urgency on "Your
// turn".
// ---------------------------------------------------------------------------

function tributeView(payers: [number, number], withHand: boolean): GuandanView {
  return {
    seat: 0,
    phase: 'tribute',
    handNo: 2,
    currentLevel: '2',
    declarerTeam: null,
    levels: ['2', '2'],
    aAttempts: [0, 0],
    aAttemptsExhausted: [false, false],
    hand: withHand ? [] : [],
    cardCounts: [27, 27, 27, 27],
    ceremonyCutter: null,
    ceremonyFlips: null,
    finishOrder: [],
    trick: null,
    tribute: {
      kind: 'double',
      payers,
      receivers: [1, 3],
      committed: [],
      ownStaged: null,
      paid: null,
      returned: null,
    },
    matchWinner: null,
  } as unknown as GuandanView;
}

function tributeSnapshot(over: {
  payers: [number, number];
  viewerIsActor: boolean;
  deadlines: { seat: number; dueAt: number; timingClass: string }[];
}): RoomSnapshot {
  return {
    room: {
      gameId: 'guandan',
      status: 'playing',
      config: null,
      seats: [0, 1, 2, 3].map((seat) => ({
        seat,
        name: seat === 0 ? 'ViewerName' : `Seat${seat + 1}`,
        claimed: true,
        connected: true,
      })),
      timing: null,
      seq: 1,
    },
    seats: new Map([[0, { token: 'tok' }]]),
    perSeat: new Map([
      [
        0,
        {
          view: tributeView(over.payers, over.viewerIsActor),
          // yourTurn keys on hints !== null — an actor viewer has hints.
          hints: over.viewerIsActor ? [] : null,
          lastEventBatch: null,
        },
      ],
    ]),
    seq: 1,
    connected: true,
    rejections: [],
    deadlines: over.deadlines,
  } as unknown as RoomSnapshot;
}

describe('concurrent unequal deadlines: the clock follows the NAMED seat (panel HIGH)', () => {
  it("a remote pair shows the named actor's seconds, not the other payer's sooner clock", () => {
    // Payers 1 and 2; the line names seat 1 (the lowest actor). Seat 2's
    // clock has been grace-clamped to ~6s — the chip must still read seat
    // 1's ~30 and stay quiet.
    const store = new RoomStore('TESTCODE');
    const html = renderToStaticMarkup(
      createElement(GameTable, {
        snapshot: tributeSnapshot({
          payers: [1, 2],
          viewerIsActor: false,
          deadlines: [
            { seat: 1, dueAt: Date.now() + 30_000, timingClass: 'turn' },
            { seat: 2, dueAt: Date.now() + 6_000, timingClass: 'turn' },
          ],
        }),
        store,
      }),
    );
    const num = Number(html.match(/gd-headline__clockNum">(\d+)</)?.[1]);
    expect(num).toBeGreaterThanOrEqual(28);
    expect(num).toBeLessThanOrEqual(30);
    expect(html).not.toContain('gd-headline__clock--urgent');
  });

  it('"Your turn" shows YOUR seconds — a co-payer dying at 6s neither replaces the number nor pulses your chip', () => {
    // The viewer (seat 0) is a payer with ~70s; co-payer seat 2 is clamped
    // to ~6s. The old pills showed 70 on yours and 6 on theirs; the single
    // chip must inherit YOUR number and no urgency.
    const store = new RoomStore('TESTCODE');
    const html = renderToStaticMarkup(
      createElement(GameTable, {
        snapshot: tributeSnapshot({
          payers: [0, 2],
          viewerIsActor: true,
          deadlines: [
            { seat: 0, dueAt: Date.now() + 70_000, timingClass: 'turn' },
            { seat: 2, dueAt: Date.now() + 6_000, timingClass: 'turn' },
          ],
        }),
        store,
      }),
    );
    const num = Number(html.match(/gd-headline__clockNum">(\d+)</)?.[1]);
    expect(num).toBeGreaterThanOrEqual(68);
    expect(num).toBeLessThanOrEqual(70);
    expect(html).not.toContain('gd-headline__clock--urgent');
  });

  it('your OWN clamped clock still escalates: yours at 8s pulses even with a slower co-payer', () => {
    const store = new RoomStore('TESTCODE');
    const html = renderToStaticMarkup(
      createElement(GameTable, {
        snapshot: tributeSnapshot({
          payers: [0, 2],
          viewerIsActor: true,
          deadlines: [
            { seat: 0, dueAt: Date.now() + 8_000, timingClass: 'turn' },
            { seat: 2, dueAt: Date.now() + 60_000, timingClass: 'turn' },
          ],
        }),
        store,
      }),
    );
    expect(html).toContain('gd-headline__clock--urgent');
  });
});

// ---------------------------------------------------------------------------
// Compact-bar round: the badges ARE the level display, and the PLAYING
// team's badge carries the in-play attribution (panel MED, Codex + Grok
// converging: once levels diverge, "Us level A · Them level 5" alone no
// longer says which level — and wild — is live).
// ---------------------------------------------------------------------------

describe('compact headline: badges carry the levels and the in-play tag', () => {
  it('the level numeral and wild chip are GONE; badges read label + connective + rank', () => {
    const original = getLocale();
    try {
      setLocale('en');
      const html = renderHeadline({});
      expect(html).not.toContain('gd-headline__level');
      expect(html).not.toContain('gd-headline__wild');
      expect(html).toContain('gd-team__lvword');
      // Composed aria says it with real spaces (panel LOW, Codex: the visual
      // spans rely on flex gap, so raw extraction reads "Uslevel2").
      expect(html).toContain('aria-label="Us level 2"');
      expect(html).toContain('aria-label="Them level 2"');
    } finally {
      setLocale(original);
    }
  });

  it("the playing team's badge gets --playing, the in-play tag, and the aria word; null playingTeam tags nothing", () => {
    const original = getLocale();
    try {
      setLocale('en');
      const playing = renderHeadline({ playingTeam: 0, levels: ['A', '5'] });
      const usBadge = playing.match(/<span class="gd-team gd-team--us[^"]*"[^>]*>/)?.[0] ?? '';
      expect(usBadge).toContain('gd-team--playing');
      expect(playing).toContain('gd-team__now');
      expect(playing).toContain(`>${t('game.rail.playingNow')}<`);
      expect(playing).toContain('aria-label="Us level A in play"');
      // The other badge stays untagged…
      expect(playing.match(/gd-team--playing/g) ?? []).toHaveLength(1);
      // …and with no declarer (hand 1) nothing is tagged at all.
      const none = renderHeadline({ playingTeam: null });
      expect(none).not.toContain('gd-team--playing');
      expect(none).not.toContain('gd-team__now');
    } finally {
      setLocale(original);
    }
  });
});

// ---------------------------------------------------------------------------
// Panel round-2 MED (Codex + Grok converging): the in-play tag must follow
// the level the hand is ACTUALLY played at — an A-SUSPENDED declarer plays
// at the opponents' level, so binding the tag to declarerTeam alone pointed
// at the wrong badge exactly when levels diverge.
// ---------------------------------------------------------------------------

describe('the in-play tag follows the LIVE level, not the declarer (suspension redirect)', () => {
  it('playingLevelTeam: declarer owns its level; a suspended declarer redirects; no declarer, no tag', () => {
    // Normal hand: the declarer's own ladder rank is live.
    expect(playingLevelTeam(0, ['5', '3'], '5')).toBe(0);
    expect(playingLevelTeam(1, ['5', '3'], '3')).toBe(1);
    // Suspended declarer (suspendPlayOpponentLevel): the hand plays at the
    // OPPONENTS' level — the tag must cross the bar.
    expect(playingLevelTeam(0, ['A', '5'], '5')).toBe(1);
    // Equal levels: the declarer wins the tie (both are right).
    expect(playingLevelTeam(1, ['2', '2'], '2')).toBe(1);
    expect(playingLevelTeam(null, ['2', '2'], '2')).toBeNull();
  });

  it('GameTable derives the tag through the helper, never raw declarerTeam (source pin)', () => {
    const table = stripTsComments(gameTableSrc);
    // Interlude round: the tag is suppressed while the end-of-hand beat runs
    // (the view is already the NEXT hand; a live tag under frozen old levels
    // would mislabel) — the non-interlude side still derives via the helper.
    expect(table).toMatch(
      /playingTeam=\{\s*interludeShowing \? null : playingLevelTeam\(view\.declarerTeam, view\.levels, view\.currentLevel\)\s*\}/,
    );
    expect(table).not.toMatch(/playingTeam=\{view\.declarerTeam\}/);
  });

  it('the badge aria carries everything the badge shows: zh wording, suspension, A-attempts', () => {
    const original = getLocale();
    try {
      setLocale('zh-Hant');
      const zh = renderHeadline({ playingTeam: 0 });
      expect(zh).toContain(`aria-label="${t('game.rail.us')} ${t('game.rail.teamLevel')} 2 ${t('game.rail.playingNow')}"`);
      setLocale('en');
      const susp = renderHeadline({
        playingTeam: 1,
        levels: ['A', '5'],
        aAttempts: [2, 0],
        aAttemptsExhausted: [true, false],
      });
      // The suspended A badge announces its full state even though the
      // aria-label suppresses its children (attribute apostrophes render as
      // HTML entities in the static markup).
      const suspendedAria = `Us level A ${t('game.rail.suspended')} ${t('game.rail.aAttempts', { count: 2 })}`;
      expect(susp).toContain(`aria-label="${suspendedAria.replaceAll("'", '&#x27;')}"`);
      // And the OTHER team carries the in-play word (the redirect case).
      expect(susp).toContain('aria-label="Them level 5 in play"');
    } finally {
      setLocale(original);
    }
  });
});

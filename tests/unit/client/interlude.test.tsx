// The end-of-hand interlude (docs/research/hand-interlude.md) — DOM-free
// pins for the beat's three layers:
//   1. the pure step machine (ordering, durations, the A-insert extension,
//      the 6.5s hard cap, the match-end shortening, remount catch-up);
//   2. the foldEvents capture (the snapshot lands at handEnded BEFORE the
//      same batch's handStarted wipes the table, the levels/A trackers, the
//      burned/suspended detection, the mid-match-join degradation, the
//      matchEnded marking);
//   3. the overlay's stage-conditional render + the GameTable/CSS wiring
//      pins (deal gate, ResultOverlay gate, action-bar gate, z-order,
//      vignette, reduced motion).
// Render is owned by the visual round; these make the design's load-bearing
// choices regressions.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

declare module 'node:fs' {
  export function readFileSync(path: URL, encoding: 'utf8'): string;
}

import type { Seat } from '../../../src/engine/core/game';
import type { GuandanEvent } from '../../../src/engine/guandan/types';
import { EMPTY_DERIVED, foldEvents } from '../../../src/client/GameTable';
import { InterludeOverlay } from '../../../src/client/table/InterludeOverlay';
import {
  INTERLUDE_CAP_MS,
  INTERLUDE_INSERT_MS,
  INTERLUDE_STEP_MS,
  interludeStepAt,
  interludeSteps,
  type InterludeFx,
} from '../../../src/client/table/helpers';
import { getLocale, setLocale } from '../../../src/client/i18n';

const tableCss = readFileSync(new URL('../../../src/client/table/table.css', import.meta.url), 'utf8');
const gameTableSrc = readFileSync(new URL('../../../src/client/GameTable.tsx', import.meta.url), 'utf8');

const names = ['Actor One', 'Actor Two', 'Actor Three', 'Actor Four'];
const nameFor = (seat: Seat) => names[seat]!;

// ---------------------------------------------------------------------------
// 1. The step machine.
// ---------------------------------------------------------------------------

describe('interludeSteps — the beat structure', () => {
  it('normal hand: hold → standings → levels → curtain, at the plan durations', () => {
    const steps = interludeSteps({ insert: false, match: false });
    expect(steps.map((s) => s.kind)).toEqual(['hold', 'standings', 'levels', 'curtain']);
    expect(steps.map((s) => s.ms)).toEqual([
      INTERLUDE_STEP_MS.hold,
      INTERLUDE_STEP_MS.standings,
      INTERLUDE_STEP_MS.levels,
      INTERLUDE_STEP_MS.curtain,
    ]);
  });

  it('the A-story insert EXTENDS the levels dwell — no extra step, order unchanged', () => {
    const steps = interludeSteps({ insert: true, match: false });
    expect(steps.map((s) => s.kind)).toEqual(['hold', 'standings', 'levels', 'curtain']);
    expect(steps[2]!.ms).toBe(INTERLUDE_STEP_MS.levels + INTERLUDE_INSERT_MS);
  });

  it('match end SHORTENS the beat: hold → standings → one match line (ResultOverlay owns the ceremony)', () => {
    const steps = interludeSteps({ insert: false, match: true });
    expect(steps.map((s) => s.kind)).toEqual(['hold', 'standings', 'matchline']);
  });

  it('every branch auto-runs under the hard cap', () => {
    for (const insert of [false, true]) {
      for (const match of [false, true]) {
        const total = interludeSteps({ insert, match }).reduce((acc, s) => acc + s.ms, 0);
        expect(total, `insert=${insert} match=${match}`).toBeLessThanOrEqual(INTERLUDE_CAP_MS);
      }
    }
  });

  it('interludeStepAt catches a remount up to the wall-clock stage — and past-total means done', () => {
    const steps = interludeSteps({ insert: false, match: false });
    expect(interludeStepAt(0, steps)).toBe(0);
    expect(interludeStepAt(INTERLUDE_STEP_MS.hold - 1, steps)).toBe(0);
    expect(interludeStepAt(INTERLUDE_STEP_MS.hold, steps)).toBe(1);
    expect(interludeStepAt(INTERLUDE_STEP_MS.hold + INTERLUDE_STEP_MS.standings, steps)).toBe(2);
    expect(interludeStepAt(999_999, steps)).toBe(steps.length);
  });
});

// ---------------------------------------------------------------------------
// 2. The fold capture.
// ---------------------------------------------------------------------------

const nextIdFactory = () => {
  let id = 1;
  return () => id++;
};

const handStarted = (handNo: number, level: string, own: string[] = ['3S', '4S']): GuandanEvent =>
  ({
    type: 'handStarted',
    handNo,
    currentLevel: level,
    declarerTeam: handNo === 1 ? null : 0,
    suspensionApplied: false,
    hands: [own, [], [], []],
  }) as GuandanEvent;

const handEnded = (over: {
  newLevels: [string, string];
  aAttempts?: [number, number];
  exhausted?: [boolean, boolean];
  levelDelta?: number;
}): GuandanEvent =>
  ({
    type: 'handEnded',
    result: {
      finishOrder: [0, 2, 1, 3],
      winnerTeam: 0,
      levelDelta: over.levelDelta ?? 2,
    },
    newLevels: over.newLevels,
    aAttempts: over.aAttempts ?? [0, 0],
    aAttemptsExhausted: over.exhausted ?? [false, false],
  }) as GuandanEvent;

const played = (seat: Seat, cards: string[]): GuandanEvent =>
  ({ type: 'played', seat, cards, decl: { type: 'single', size: 1, keyRank: '9' } }) as GuandanEvent;

describe('foldEvents — the interlude snapshot', () => {
  it('captures the beat at handEnded BEFORE the same batch handStarted wipes the table', () => {
    const nextId = nextIdFactory();
    let d = foldEvents(EMPTY_DERIVED, [handStarted(1, '2')], 0, nameFor, nextId);
    expect(d.teamLevels).toEqual(['2', '2']); // hand 1 seeds the tracker
    d = foldEvents(d, [played(2, ['9S'])], 0, nameFor, nextId);
    d = foldEvents(
      d,
      [handEnded({ newLevels: ['4', '2'] }), handStarted(2, '4')],
      0,
      nameFor,
      nextId,
    );
    const fx = d.interlude!;
    expect(fx).not.toBeNull();
    // The final play survives INSIDE the snapshot even though handStarted
    // cleared playFx/topCards for the new hand.
    expect(fx.finalPlay).toEqual({ seat: 2, cards: ['9S'] });
    expect(d.playFx).toBeNull();
    expect(d.topCards).toBeNull();
    // The ended hand's level marks the held well; the transition has both sides.
    expect(fx.level).toBe('2');
    expect(fx.oldLevels).toEqual(['2', '2']);
    expect(fx.newLevels).toEqual(['4', '2']);
    // The same batch's handStarted names the curtain's hand.
    expect(fx.next).toEqual({ handNo: 2, level: '4' });
    expect(fx.matchWinner).toBeNull();
    // The trackers moved forward for the NEXT beat's before-side.
    expect(d.teamLevels).toEqual(['4', '2']);
  });

  it('detects an A-burn and a fresh suspension against the tracked before-state', () => {
    const nextId = nextIdFactory();
    let d = foldEvents(EMPTY_DERIVED, [handStarted(1, '2')], 0, nameFor, nextId);
    d = foldEvents(d, [handEnded({ newLevels: ['A', '2'], aAttempts: [1, 0] })], 0, nameFor, nextId);
    expect(d.interlude!.aBurnedTeam).toBe(0);
    expect(d.interlude!.aSuspendedTeam).toBeNull();
    expect(d.interlude!.aBefore).toEqual({ attempts: [0, 0], exhausted: [false, false] });
    d = foldEvents(
      d,
      [handEnded({ newLevels: ['A', '2'], aAttempts: [3, 0], exhausted: [true, false] })],
      0,
      nameFor,
      nextId,
    );
    expect(d.interlude!.aSuspendedTeam).toBe(0);
    expect(d.interlude!.aBurnedTeam).toBeNull(); // exhausted, not merely burned
  });

  it('a mid-match join (no prior folds) degrades honestly: no before-side, no insert', () => {
    const d = foldEvents(
      EMPTY_DERIVED,
      [handEnded({ newLevels: ['6', '4'], aAttempts: [1, 0] })],
      0,
      nameFor,
      nextIdFactory(),
    );
    expect(d.interlude!.oldLevels).toBeNull();
    expect(d.interlude!.aBefore).toBeNull();
    expect(d.interlude!.aBurnedTeam).toBeNull();
    expect(d.interlude!.finalPlay).toBeNull(); // no tracked trick either
  });

  it('matchEnded in the batch marks the shortened beat and no next hand', () => {
    const nextId = nextIdFactory();
    let d = foldEvents(EMPTY_DERIVED, [handStarted(1, '2')], 0, nameFor, nextId);
    d = foldEvents(
      d,
      [
        handEnded({ newLevels: ['A', '2'] }),
        { type: 'matchEnded', winnerTeam: 0 } as GuandanEvent,
      ],
      0,
      nameFor,
      nextId,
    );
    expect(d.interlude!.matchWinner).toBe(0);
    expect(d.interlude!.next).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. The overlay's stage-conditional render + wiring pins.
// ---------------------------------------------------------------------------

const baseFx = (over: Partial<InterludeFx>): InterludeFx => ({
  at: Date.now(),
  id: 7,
  finalPlay: { seat: 2, cards: ['9S'] },
  level: '2',
  result: { finishOrder: [0, 2, 1, 3], winnerTeam: 0, levelDelta: 2 },
  oldLevels: ['2', '2'],
  newLevels: ['4', '2'],
  aAttempts: [0, 0],
  aAttemptsExhausted: [false, false],
  aBefore: { attempts: [0, 0], exhausted: [false, false] },
  aBurnedTeam: null,
  aSuspendedTeam: null,
  next: { handNo: 2, level: '4' },
  matchWinner: null,
  ...over,
});

const render = (fx: InterludeFx) =>
  renderToStaticMarkup(
    createElement(InterludeOverlay, {
      interlude: fx,
      viewerTeam: 0,
      nameFor,
      aMaxAttempts: 3,
      onLevelsReached: () => {},
      onDone: () => {},
    }),
  );

describe('InterludeOverlay — stage-conditional content (en)', () => {
  const withEn = (body: () => void) => {
    const original = getLocale();
    try {
      setLocale('en');
      body();
    } finally {
      setLocale(original);
    }
  };

  it('hold stage: title + final-play attribution + skip caption, standings NOT yet shown', () =>
    withEn(() => {
      const html = render(baseFx({ at: Date.now() }));
      expect(html).toContain('Hand over');
      expect(html).toContain('Last play: Actor Three');
      expect(html).toContain('Tap to skip');
      expect(html).not.toContain('1st out');
    }));

  it('standings stage: finishing order with place words + the verdict with the delta', () =>
    withEn(() => {
      const html = render(baseFx({ at: Date.now() - (INTERLUDE_STEP_MS.hold + 100) }));
      expect(html).toContain('1st out');
      expect(html).toContain('Actor One');
      expect(html).toContain('Us wins the hand — up 2');
      expect(html).toContain('gd-interlude__verdict--won');
      expect(html).not.toContain('level 2 → 4'); // levels stage not reached
    }));

  it('levels stage: the transition both ways round + the curtain after it', () =>
    withEn(() => {
      const atLevels = Date.now() - (INTERLUDE_STEP_MS.hold + INTERLUDE_STEP_MS.standings + 100);
      const html = render(baseFx({ at: atLevels }));
      expect(html).toContain('Us: level 2 → 4');
      expect(html).toContain('Them: level 2');
      const atCurtain =
        Date.now() -
        (INTERLUDE_STEP_MS.hold + INTERLUDE_STEP_MS.standings + INTERLUDE_STEP_MS.levels + 100);
      const curtain = render(baseFx({ at: atCurtain }));
      expect(curtain).toContain('Hand 2 — playing level 4');
    }));

  it('a fresh suspension renders the dedicated block at the levels stage', () =>
    withEn(() => {
      const at =
        Date.now() - (INTERLUDE_STEP_MS.hold + INTERLUDE_STEP_MS.standings + 100);
      const html = render(
        baseFx({
          at,
          aSuspendedTeam: 1,
          aAttempts: [0, 3],
          aAttemptsExhausted: [false, true],
          newLevels: ['4', 'A'],
          oldLevels: ['2', 'A'],
        }),
      );
      expect(html).toContain('Ace attempts exhausted');
      expect(html).toContain('gd-interlude__aline--suspended');
    }));

  it('match end: the shortened beat reaches the match line, never a curtain', () =>
    withEn(() => {
      const at = Date.now() - (INTERLUDE_STEP_MS.hold + INTERLUDE_STEP_MS.standings + 100);
      const html = render(baseFx({ at, matchWinner: 0, next: null }));
      expect(html).toContain('Us wins the match');
      expect(html).not.toContain('playing level');
    }));

  it('a finished beat renders NOTHING (the wall-clock discipline: remounts never replay)', () => {
    const html = render(baseFx({ at: Date.now() - 20_000 }));
    expect(html).toBe('');
  });
});

describe('interlude wiring pins (GameTable source + stylesheet)', () => {
  it('the deal, the clocks, the action bar, the in-play tag and ResultOverlay all wait for the beat', () => {
    expect(gameTableSrc).toMatch(/!interludeShowing &&\s*view\.phase !== 'ceremonyCut'/);
    expect(gameTableSrc).toContain("view.phase !== 'ceremonyCut' && !interludeShowing && (");
    expect(gameTableSrc).toContain('view.matchWinner !== null && !interludeShowing && (');
    expect(gameTableSrc).toMatch(/ceremonyShowing \|\| dealing \|\| interludeShowing \|\| clockDeadline/);
    expect(gameTableSrc).toMatch(/interludeShowing \? null : playingLevelTeam/);
    // The NEXT hand's turn sentence and actor rings stay quiet under the
    // beat (visual round: both leaked through the dim).
    expect(gameTableSrc).toMatch(/leaderConcealed !== null \|\| interludeShowing \? false : yourTurn/);
    expect(gameTableSrc).toMatch(/leaderConcealed !== null \|\| interludeShowing \? null : actorName/);
    expect(gameTableSrc).toMatch(/seat !== leaderConcealed &&\s*!interludeShowing/);
  });

  it('multi-seat self-play: done/late are SETS of ids, never scalars (Grok HIGH)', () => {
    // Per-seat folds mint distinct ids for the same hand end; a scalar
    // un-marked seat A's finished beat when seat B's completed, resurrecting
    // it on the next pill switch within the 60s window.
    expect(gameTableSrc).toMatch(/useState<ReadonlySet<number>>\(new Set\(\)\)/);
    expect(gameTableSrc).toMatch(/!interludeDone\.has\(interlude\.id\)/);
    expect(gameTableSrc).toMatch(/!interludeLate\.has\(interlude\.id\)/);
    expect(gameTableSrc).toMatch(/setInterludeDone\(\(prev\) => new Set\(prev\)\.add\(interlude\.id\)\)/);
  });

  it('the fan stays quiet under the beat even at match end (no next deal to hold it)', () => {
    expect(gameTableSrc).toContain('hidden={holdFan || interludeShowing}');
  });

  it('the clock tick tracks the interlude stamp past the 60s stale guard (Codex MED)', () => {
    // An untimed room arms no deadline at hand end; without this leg `now`
    // freezes and the parent guard behind a frozen overlay timer chain could
    // never trip.
    expect(gameTableSrc).toMatch(/d\.interlude !== null \? \[d\.interlude\.at \+ 61_000\]/);
  });

  it('the A-insert dwell fires only when its line renders (Codex LOW: no dead air under unlimited attempts)', () => {
    const overlaySrc = readFileSync(
      new URL('../../../src/client/table/InterludeOverlay.tsx', import.meta.url),
      'utf8',
    );
    expect(overlaySrc).toMatch(
      /interlude\.aSuspendedTeam !== null \|\|\s*\(interlude\.aBurnedTeam !== null && aMaxAttempts !== null\)/,
    );
  });

  it('a mid-match adoption seeds the before-side from the first view, never across a hand end', () => {
    // The seed makes a rejoiner's next interlude show the real old → new
    // transition; the guard keeps the same-tick hand-end race on the honest
    // degradation path (seeding post-scoring levels would fake a no-op).
    expect(gameTableSrc).toMatch(
      /current\.teamLevels === null && !events\.some\(\(e\) => e\.type === 'handEnded'\)/,
    );
  });

  it('the held well reads by the ENDED hand level and the final play', () => {
    expect(gameTableSrc).toMatch(/heldTop=\{interlude\.finalPlay\?\.cards \?\? null\}/);
    expect(gameTableSrc).toMatch(/level=\{interlude\.level\}/);
  });

  it('overlay CSS: above the play flight, vignette not wash, plate bounded, reduced motion stilled', () => {
    const block = tableCss.match(/\.gd-interlude\s*\{([^}]*)\}/)?.[1];
    expect(block, '.gd-interlude block').toBeDefined();
    expect(block).toContain('z-index: 12'); // .gd-playfx is 11
    // Viewport-fixed (visual round): the pre-deal hold collapses the table
    // section, so an in-section overlay would cover the held winning play.
    expect(block).toContain('position: fixed');
    expect(block).toContain('radial-gradient');
    const plate = tableCss.match(/\.gd-interlude__plate\s*\{([^}]*)\}/)?.[1];
    expect(plate).toContain('max-width: 22rem');
    // The reduced-motion block stills every interlude entrance (and the
    // badge-rank tick that rides the same keyframes).
    expect(tableCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.gd-interlude__order,[^@]*animation: none;/,
    );
  });
});

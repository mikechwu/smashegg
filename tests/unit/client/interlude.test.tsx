// The end-of-hand beat (docs/research/hand-interlude.md), restructured into TWO
// on-table stages (owner UX round) — DOM-free pins for:
//   1. the pure STAGE machine (outcome -> level-up -> done; the match-end
//      shortening; the A-story extending the level-up dwell; tap-to-advance);
//   2. the foldEvents capture (unchanged: the snapshot lands at handEnded BEFORE
//      the same batch's handStarted wipes the table);
//   3. Stage A (InterludeOutcome, on the table by the winning play) + Stage B
//      (InterludeOverlay, the covering level-up) render, the NO-REPETITION
//      contract, and the GameTable/CSS wiring (stage-conditional placement, the
//      deal gate, ResultOverlay gate, reduced-motion, z-order).
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
import { InterludeOutcome } from '../../../src/client/table/InterludeOutcome';
import {
  INTERLUDE_LEVELUP_INSERT_MS,
  INTERLUDE_LEVELUP_MS,
  INTERLUDE_OUTCOME_MS,
  interludeStage,
  type InterludeFx,
} from '../../../src/client/table/helpers';
import { getLocale, setLocale } from '../../../src/client/i18n';

const tableCss = readFileSync(new URL('../../../src/client/table/table.css', import.meta.url), 'utf8');
const gameTableSrc = readFileSync(new URL('../../../src/client/GameTable.tsx', import.meta.url), 'utf8');

const names = ['Actor One', 'Actor Two', 'Actor Three', 'Actor Four'];
const nameFor = (seat: Seat) => names[seat]!;

// ---------------------------------------------------------------------------
// 1. The stage machine.
// ---------------------------------------------------------------------------

describe('interludeStage — the two on-table stages', () => {
  it('a normal hand: OUTCOME on the table (~4s), then the LEVEL-UP payoff, then done', () => {
    const a = { advance: 0, matchEnd: false, insert: false };
    expect(interludeStage({ ...a, elapsedMs: 0 })).toBe('outcome');
    expect(interludeStage({ ...a, elapsedMs: INTERLUDE_OUTCOME_MS - 1 })).toBe('outcome');
    expect(interludeStage({ ...a, elapsedMs: INTERLUDE_OUTCOME_MS })).toBe('levelup');
    expect(interludeStage({ ...a, elapsedMs: INTERLUDE_OUTCOME_MS + INTERLUDE_LEVELUP_MS - 1 })).toBe('levelup');
    expect(interludeStage({ ...a, elapsedMs: INTERLUDE_OUTCOME_MS + INTERLUDE_LEVELUP_MS })).toBe('done');
  });

  it('the outcome holds ~4s so it registers before the story advances (owner)', () => {
    expect(INTERLUDE_OUTCOME_MS).toBe(4000);
  });

  it('match end has NO level-up stage — outcome then done (ResultOverlay is the covering payoff)', () => {
    const m = { advance: 0, matchEnd: true, insert: false };
    expect(interludeStage({ ...m, elapsedMs: 0 })).toBe('outcome');
    expect(interludeStage({ ...m, elapsedMs: INTERLUDE_OUTCOME_MS })).toBe('done');
  });

  it('the A-story EXTENDS the LEVEL-UP dwell (insert), never the outcome', () => {
    const w = { advance: 0, matchEnd: false, insert: true };
    // still on level-up at the moment a no-insert beat would already be done
    expect(interludeStage({ ...w, elapsedMs: INTERLUDE_OUTCOME_MS + INTERLUDE_LEVELUP_MS })).toBe('levelup');
    expect(
      interludeStage({ ...w, elapsedMs: INTERLUDE_OUTCOME_MS + INTERLUDE_LEVELUP_MS + INTERLUDE_LEVELUP_INSERT_MS }),
    ).toBe('done');
  });

  it('tap-to-advance jumps to the next stage even before the timer (whichever first)', () => {
    const early = { elapsedMs: 0, matchEnd: false, insert: false };
    expect(interludeStage({ ...early, advance: 1 })).toBe('levelup');
    expect(interludeStage({ ...early, advance: 2 })).toBe('done');
    // one tap ends a match-end beat (it has no level-up stage to advance into)
    expect(interludeStage({ elapsedMs: 0, matchEnd: true, insert: false, advance: 1 })).toBe('done');
  });

  it('the total auto-run stays at the old ~6.5s cap (+0.9s with the A-insert)', () => {
    expect(INTERLUDE_OUTCOME_MS + INTERLUDE_LEVELUP_MS).toBe(6500);
    expect(INTERLUDE_OUTCOME_MS + INTERLUDE_LEVELUP_MS + INTERLUDE_LEVELUP_INSERT_MS).toBeLessThanOrEqual(7500);
  });
});

// ---------------------------------------------------------------------------
// 2. The fold capture (unchanged: foldEvents still snapshots the beat).
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
    expect(fx.finalPlay).toEqual({ seat: 2, cards: ['9S'] });
    expect(d.playFx).toBeNull();
    expect(d.topCards).toBeNull();
    expect(fx.level).toBe('2');
    expect(fx.oldLevels).toEqual(['2', '2']);
    expect(fx.newLevels).toEqual(['4', '2']);
    expect(fx.next).toEqual({ handNo: 2, level: '4' });
    expect(fx.matchWinner).toBeNull();
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
    expect(d.interlude!.aBurnedTeam).toBeNull();
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
    expect(d.interlude!.finalPlay).toBeNull();
  });

  it('matchEnded in the batch marks the shortened beat and no next hand', () => {
    const nextId = nextIdFactory();
    let d = foldEvents(EMPTY_DERIVED, [handStarted(1, '2')], 0, nameFor, nextId);
    d = foldEvents(
      d,
      [handEnded({ newLevels: ['A', '2'] }), { type: 'matchEnded', winnerTeam: 0 } as GuandanEvent],
      0,
      nameFor,
      nextId,
    );
    expect(d.interlude!.matchWinner).toBe(0);
    expect(d.interlude!.next).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Stage A / Stage B render + the no-repetition contract + wiring pins.
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

const renderOutcome = (fx: InterludeFx) =>
  renderToStaticMarkup(
    createElement(InterludeOutcome, { interlude: fx, viewerTeam: 0, nameFor, onAdvance: () => {} }),
  );

const renderLevelUp = (fx: InterludeFx, reduced = false) =>
  renderToStaticMarkup(
    createElement(InterludeOverlay, {
      interlude: fx,
      viewerTeam: 0,
      nameFor,
      aMaxAttempts: 3,
      reduced,
      onAdvance: () => {},
    }),
  );

const withEn = (body: () => void) => {
  const original = getLocale();
  try {
    setLocale('en');
    body();
  } finally {
    setLocale(original);
  }
};

describe('Stage A — the outcome, ON the table (who won + finishing order, never the level meaning)', () => {
  it('shows the winner verdict and the full finishing order with place words', () =>
    withEn(() => {
      const html = renderOutcome(baseFx({}));
      expect(html).toContain('gd-outcome'); // rendered in the ring centre, not a bottom strip
      expect(html).toContain('Us wins the hand — up 2');
      expect(html).toContain('gd-outcome__verdict--won');
      expect(html).toContain('1st out');
      expect(html).toContain('Actor One');
      expect(html).toContain('Actor Four');
    }));

  it('does NOT show the level meaning — that is Stage B (no repetition)', () =>
    withEn(() => {
      const html = renderOutcome(baseFx({}));
      expect(html).not.toContain('level 2 → 4');
      expect(html).not.toContain('Hand 2');
    }));
});

describe('Stage B — the level-up payoff (the meaning), NEVER restating the order', () => {
  it('shows the level transition both ways and the next-hand curtain', () =>
    withEn(() => {
      const html = renderLevelUp(baseFx({}));
      expect(html).toContain('gd-levelup');
      expect(html).toContain('Us: level 2 → 4');
      expect(html).toContain('Them: level 2');
      expect(html).toContain('Hand 2 — playing level 4');
    }));

  it('does NOT restate the finishing order (Stage A already showed it — no repetition)', () =>
    withEn(() => {
      const html = renderLevelUp(baseFx({}));
      expect(html).not.toContain('gd-levelup__order'); // the order list appears only under reduced motion
      expect(html).not.toContain('1st out');
    }));

  it('a fresh suspension renders the dedicated block WITH the level transition', () =>
    withEn(() => {
      const html = renderLevelUp(
        baseFx({
          aSuspendedTeam: 1,
          aAttempts: [0, 3],
          aAttemptsExhausted: [false, true],
          newLevels: ['4', 'A'],
          oldLevels: ['2', 'A'],
        }),
      );
      expect(html).toContain('Ace attempts exhausted');
      expect(html).toContain('gd-levelup__aline--suspended');
    }));

  it('reduced motion folds the outcome recap into the single static plate + a dismiss', () =>
    withEn(() => {
      const html = renderLevelUp(baseFx({}), true);
      expect(html).toContain('Us wins the hand — up 2'); // the outcome recap
      expect(html).toContain('gd-levelup__order'); // and the order, here only
      expect(html).toContain('Us: level 2 → 4'); // AND the level-up
      expect(html).toContain('Dismiss');
    }));

  it('at match end the level-up stage carries no level/curtain (ResultOverlay is the payoff)', () =>
    withEn(() => {
      const html = renderLevelUp(baseFx({ matchWinner: 0, next: null }), true);
      expect(html).not.toContain('playing level'); // no next-hand curtain
      expect(html).not.toContain('level 2 → 4'); // no transition — the match is decided
    }));
});

describe('interlude wiring pins (GameTable source + stylesheet)', () => {
  it('STAGE A renders in the ring centre by the winning play; STAGE B covers', () => {
    // Stage A (outcome) is rendered in the centre next to the held final play,
    // gated on the OUTCOME stage; Stage B (level-up) covers on the level stage.
    expect(gameTableSrc).toMatch(/interludeStageNow === 'outcome' && \(\s*<InterludeOutcome/);
    expect(gameTableSrc).toMatch(/\(reducedMotion \|\| interludeStageNow === 'levelup'\) && \(\s*<InterludeOverlay/);
    expect(gameTableSrc).toMatch(/reduced=\{reducedMotion\}/);
    // The winning final play still stays held in the well through the beat.
    expect(gameTableSrc).toMatch(/heldTop=\{interlude\.finalPlay\?\.cards \?\? null\}/);
    expect(gameTableSrc).toMatch(/level=\{interlude\.level\}/);
  });

  it('tap-to-advance jumps from the CURRENT stage (never a no-op after the timer moved on)', () => {
    expect(gameTableSrc).toMatch(/const advanceInterlude = \(\) =>/);
    expect(gameTableSrc).toMatch(/onAdvance=\{reducedMotion \? dismissInterlude : advanceInterlude\}/);
    expect(gameTableSrc).toMatch(/interludeStage\(\{/); // the pure stage machine drives it
    // Advance from the current effective stage index (+1), NOT a stored tap
    // count — a Stage-B tap after the timer already reached level-up must go to
    // 'done', not no-op (Codex).
    expect(gameTableSrc).toMatch(/idx: interludeStageIdx \+ 1/);
  });

  it('the deal, clocks, action bar and ResultOverlay all wait for the beat AND the deal (Item 1)', () => {
    expect(gameTableSrc).toContain("view.phase !== 'ceremonyCut' && !interludeShowing && settled && (");
    expect(gameTableSrc).toContain('view.matchWinner !== null && !interludeShowing && (');
    expect(gameTableSrc).toMatch(/!settled \|\| interludeShowing \|\| clockDeadline/);
    expect(gameTableSrc).toMatch(/interludeShowing \? null : playingLevelTeam/);
    expect(gameTableSrc).toMatch(/leaderConcealed !== null \|\| interludeShowing \|\| !settled \? false : yourTurn/);
    expect(gameTableSrc).toMatch(/seat !== leaderConcealed &&\s*!interludeShowing/);
  });

  it('multi-seat self-play: done/late are SETS of ids, never scalars (Grok HIGH)', () => {
    expect(gameTableSrc).toMatch(/useState<ReadonlySet<number>>\(new Set\(\)\)/);
    expect(gameTableSrc).toMatch(/!interludeDone\.has\(interlude\.id\)/);
    expect(gameTableSrc).toMatch(/!interludeLate\.has\(interlude\.id\)/);
    expect(gameTableSrc).toMatch(/setInterludeDone\(\(prev\) => new Set\(prev\)\.add\(interlude\.id\)\)/);
  });

  it('the fan stays quiet under the beat even at match end (no next deal to hold it)', () => {
    expect(gameTableSrc).toContain('hidden={holdFan || interludeShowing}');
  });

  it('the clock tick tracks the interlude stamp past the 60s stale guard (Codex MED)', () => {
    expect(gameTableSrc).toMatch(/d\.interlude !== null \? \[d\.interlude\.at \+ 61_000\]/);
  });

  it('reduced motion gets a safety auto-release so an away player is never left curtained', () => {
    expect(gameTableSrc).toMatch(/setTimeout\(\(\) => onDoneRef\.current\(\), 30_000\)/);
  });

  it('the held well reads by the ENDED hand level and the final play', () => {
    expect(gameTableSrc).toMatch(/heldTop=\{interlude\.finalPlay\?\.cards \?\? null\}/);
  });

  it('CSS: Stage A over the ring centre (light scrim); Stage B a covering vignette; reduced stilled', () => {
    // Stage A — absolute, over the ring centre (the ring table is its
    // positioning context), a LIGHT scrim so the winning cards stay readable.
    const outcome = tableCss.match(/\.gd-outcome\s*\{([^}]*)\}/)?.[1];
    expect(outcome, '.gd-outcome block').toBeDefined();
    expect(outcome).toContain('position: absolute');
    expect(outcome).toMatch(/color-mix\(in srgb, var\(--lacquer\)/); // the scrim, not a solid wash
    expect(tableCss).toMatch(/\.gd-ring__table\s*\{[^}]*position: relative/);
    // Stage B — fixed, covering, above the play flight (11), plate bounded.
    const levelup = tableCss.match(/\.gd-levelup\s*\{([^}]*)\}/)?.[1];
    expect(levelup, '.gd-levelup block').toBeDefined();
    expect(levelup).toContain('position: fixed');
    expect(levelup).toContain('z-index: 12');
    expect(levelup).toContain('radial-gradient');
    expect(tableCss.match(/\.gd-levelup__plate\s*\{([^}]*)\}/)?.[1]).toContain('max-width: 22rem');
    // Reduced motion stills every beat entrance (and the badge-rank tick).
    expect(tableCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.gd-outcome,[^@]*animation: none;/,
    );
  });
});

// The play desk (elder-visibility round, docs/research/state-visibility.md,
// owner decisions D1–D7 + guards). The ratchet, DOM-free per the suite's
// idiom (pure functions + static renders + comment-stripped source/CSS
// pins; the moving parts are eyes/browser-gated):
//  • the desk state machine — loud ONLY on your turn (the loudness
//    hierarchy's spine), quiet pre-stage (D2) only with staged cards,
//    every table-owning choreography suppresses;
//  • the combo preview reuses the EXISTING classifiers (guard 5): the
//    quiet naming is literally classifyPlays' output, the loud naming is
//    matchSelection's matches — no new classification path exists;
//  • D5's discrete urgency ramp + fraction bar (calm→amber→urgent, never
//    a pulse) and the untimed degradation (no clock chrome, no fake bar);
//  • D6's timeout notice with guard 4's frequency cap;
//  • the steady-state rule (no infinite animation in the desk CSS), the
//    reduced-motion carriage, D3's dim, D4's headline demotion, and the
//    guard-2 acting reflow.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlayDesk, type PlayDeskProps } from '../../../src/client/table/PlayDesk';
import {
  deskFraction,
  deskMode,
  deskStage,
  deskUrgency,
  DESK_STAGE_MAX_FACES,
  MAX_TIMEOUT_NOTICES,
  TIMEOUT_NOTICE_MS,
} from '../../../src/client/table/helpers';
import { classifyPlays } from '../../../src/engine/guandan/combos';
import { JIANGSU_OFFICIAL_ONLINE } from '../../../src/engine/guandan/config';
import type { Card } from '../../../src/engine/guandan/cards';
import { getLocale, setLocale } from '../../../src/client/i18n';

const read = (rel: string) => readFileSync(join(__dirname, '../../../', rel), 'utf8');
const stripTs = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const stripCss = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '');

const gameTableSrc = stripTs(read('src/client/GameTable.tsx'));
const playDeskSrc = read('src/client/table/PlayDesk.tsx');
const headlineSrc = stripTs(read('src/client/table/TableHeadline.tsx'));
const tableCss = read('src/client/table/table.css');

const VARIANT = JIANGSU_OFFICIAL_ONLINE;
const H = (...cards: string[]): Card[] => cards as Card[];

// ---------------------------------------------------------------------------
// The state machine.
// ---------------------------------------------------------------------------

describe('deskMode — the loudness hierarchy in one function', () => {
  const base = {
    phase: 'playing',
    yourTurn: false,
    tributePhase: null,
    selectionCount: 0,
    suppressed: false,
  } as const;

  it('loud play ONLY on your turn in the playing phase', () => {
    expect(deskMode({ ...base, yourTurn: true })).toBe('play');
    expect(deskMode({ ...base })).toBe('off');
  });

  it('quiet pre-stage (D2) needs staged cards; empty idle is OFF', () => {
    expect(deskMode({ ...base, selectionCount: 2 })).toBe('quiet');
    expect(deskMode({ ...base, selectionCount: 0 })).toBe('off');
  });

  it('tribute phases retitle the desk — and REQUIRE yourTurn (panel MED, Grok: defense in depth)', () => {
    expect(deskMode({ ...base, yourTurn: true, tributePhase: 'payTribute' })).toBe('tribute');
    expect(deskMode({ ...base, yourTurn: true, tributePhase: 'returnTribute' })).toBe('tribute');
    // A tribute phase without hints must NEVER hand a non-actor the loud
    // shell, whatever a future caller passes.
    expect(deskMode({ ...base, tributePhase: 'payTribute' })).toBe('off');
  });

  it('suppression beats everything — ceremony/deal/interlude/cut/anti/result own the table', () => {
    expect(deskMode({ ...base, yourTurn: true, suppressed: true })).toBe('off');
    expect(deskMode({ ...base, selectionCount: 5, suppressed: true })).toBe('off');
    expect(
      deskMode({ ...base, yourTurn: true, tributePhase: 'payTribute', suppressed: true }),
    ).toBe('off');
  });

  it('non-playing, non-tribute phases never mount the desk (anti-tribute keeps its own panel)', () => {
    expect(deskMode({ ...base, phase: 'antiTributeDecision', yourTurn: true })).toBe('off');
    expect(deskMode({ ...base, phase: 'ceremonyCut', yourTurn: true })).toBe('off');
  });
});

// ---------------------------------------------------------------------------
// D5: the discrete ramp + the bar. Untimed degradation.
// ---------------------------------------------------------------------------

describe('deskUrgency / deskFraction — D5 discrete ramp', () => {
  it('urgent at <=10s regardless of budget; amber inside the last third; calm before', () => {
    expect(deskUrgency(8, 45_000)).toBe('urgent');
    expect(deskUrgency(10, null)).toBe('urgent');
    expect(deskUrgency(14, 45_000)).toBe('amber'); // 14s of a 45s budget < 1/3
    expect(deskUrgency(30, 45_000)).toBe('calm');
  });

  it('no knowable budget (legacy timing NULL): amber falls back to <=20s', () => {
    expect(deskUrgency(19, null)).toBe('amber');
    expect(deskUrgency(21, null)).toBe('calm');
  });

  it('no clock at all: null — the untimed room shows NO urgency state', () => {
    expect(deskUrgency(null, 45_000)).toBeNull();
    expect(deskUrgency(null, null)).toBeNull();
  });

  it('the bar exists only when both seconds AND budget exist, clamped to [0,1]', () => {
    expect(deskFraction(30, 45_000)).toBeCloseTo(2 / 3);
    expect(deskFraction(60, 45_000)).toBe(1);
    expect(deskFraction(null, 45_000)).toBeNull();
    expect(deskFraction(30, null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Guard 5: the preview classifies through the EXISTING engine classifier.
// ---------------------------------------------------------------------------

describe('deskStage — reused classification, never re-implemented', () => {
  it('quiet naming IS classifyPlays output (behavioral identity, not similarity)', () => {
    const cards = H('9S', '9C');
    const stage = deskStage(cards, null, '2', VARIANT);
    expect(stage.decls).toEqual(classifyPlays([...cards], '2', VARIANT));
    expect(stage.decls).toHaveLength(1);
    expect(stage.decls[0]).toMatchObject({ type: 'pair', keyRank: '9' });
    // Playability is NOT knowable without hints — the desk stays honest.
    expect(stage.playableCount).toBeNull();
  });

  it('a non-combo stages zero decls (the noForm line)', () => {
    const stage = deskStage(H('6S', '9C'), null, '2', VARIANT);
    expect(stage.decls).toHaveLength(0);
  });

  it('on your turn the decls are the MATCHES (hint-gated), playable counted', () => {
    const matches = [
      { cards: H('9S', '9C'), decl: { type: 'pair', size: 2, keyRank: '9' }, playable: true },
      { cards: H('9S', '9C'), decl: { type: 'pair', size: 2, keyRank: 'K' }, playable: false },
    ] as never;
    const stage = deskStage(H('9S', '9C'), matches, '2', VARIANT);
    expect(stage.decls).toHaveLength(2);
    expect(stage.playableCount).toBe(1);
  });

  it('PlayDesk imports no engine classifier — naming flows through helpers only', () => {
    const code = stripTs(playDeskSrc);
    expect(code).not.toContain("from '../../engine/guandan/combos'");
    expect(code).not.toContain('classifyPlays');
    // And the helper's quiet branch is literally the engine call:
    const helpersSrc = stripTs(read('src/client/table/helpers.ts'));
    expect(helpersSrc).toMatch(/return \{ decls: classifyPlays\(\[\.\.\.cards\], level, variant\), playableCount: null \};/);
  });
});

// ---------------------------------------------------------------------------
// Static renders (en for string pins; restored after).
// ---------------------------------------------------------------------------

describe('PlayDesk render states', () => {
  let original: ReturnType<typeof getLocale>;
  beforeEach(() => {
    original = getLocale();
    setLocale('en');
  });
  afterEach(() => {
    setLocale(original);
  });

  const baseProps: PlayDeskProps = {
    mode: 'play',
    dueSeconds: null,
    totalMs: null,
    planning: false,
    level: '2',
    staged: [],
    stage: { decls: [], playableCount: 0 },
    beat: 'lead',
    tributePhase: null,
    tributeReady: false,
    onUnstage: () => {},
    onClearAll: () => {},
  };
  const renderDesk = (over: Partial<PlayDeskProps>) =>
    renderToStaticMarkup(createElement(PlayDesk, { ...baseProps, ...over }));

  it('loud empty lead: shell + title + lead prompt + stage hint, NO clock chrome (untimed)', () => {
    const html = renderDesk({});
    expect(html).toContain('gd-desk--play');
    expect(html).toContain('Your turn — play');
    expect(html).toContain('Your lead — play first');
    expect(html).toContain('Tap cards to stage them here');
    expect(html).not.toContain('gd-desk__clock');
    expect(html).not.toContain('gd-desk__bar');
  });

  it('the staged pair names itself BEFORE commit — the misread-killer', () => {
    const cards = H('9S', '9C');
    const html = renderDesk({
      staged: [
        { card: '9S' as Card, index: 3 },
        { card: '9C' as Card, index: 4 },
      ],
      stage: deskStage(cards, null, '2', VARIANT),
      mode: 'quiet',
    });
    expect(html).toContain('About to play: Pair 9');
    // Quiet form: no shell, no title, no clock — D2's whole point.
    expect(html).not.toContain('gd-desk--play');
    expect(html).not.toContain('Your turn');
    expect(html).not.toContain('gd-desk__clock');
  });

  it('a single vs a pair is now a WORD difference, not a squint', () => {
    const single = renderDesk({
      mode: 'quiet',
      staged: [{ card: '9S' as Card, index: 3 }],
      stage: deskStage(H('9S'), null, '2', VARIANT),
    });
    expect(single).toContain('About to play: Single 9');
    expect(single).not.toContain('Pair');
  });

  it('the staged verdict rides BOTH ways (panel MED, Grok): cannot-beat AND beats-the-table', () => {
    const staged = [
      { card: '9S' as Card, index: 3 },
      { card: '9C' as Card, index: 4 },
    ];
    const pairDecl = { decls: [{ type: 'pair', size: 2, keyRank: '9' }] as never };
    const unplayable = renderDesk({ staged, stage: { ...pairDecl, playableCount: 0 }, beat: 'canBeat' });
    // renderToStaticMarkup escapes the apostrophe — pin around it.
    expect(unplayable).toMatch(/About to play: Pair 9.*beat the table/);
    expect(unplayable).not.toMatch(/· beats the table/);
    const playable = renderDesk({ staged, stage: { ...pairDecl, playableCount: 1 }, beat: 'canBeat' });
    expect(playable).toMatch(/About to play: Pair 9.*· beats the table/);
    // A LEAD has nothing to beat — no suffix either way.
    const lead = renderDesk({ staged, stage: { ...pairDecl, playableCount: 1 }, beat: 'lead' });
    expect(lead).toContain('About to play: Pair 9');
    expect(lead).not.toContain('beat the table');
    const multi = renderDesk({
      staged: [{ card: 'HH' as Card, index: 0 }],
      stage: {
        decls: [
          { type: 'single', size: 1, keyRank: '2' },
          { type: 'single', size: 1, keyRank: '3' },
        ] as never,
        playableCount: 2,
      },
    });
    expect(multi).toContain('About to play — several readings');
    expect(multi).toContain('Tap Play to choose the declaration');
  });

  it('timed loud desk: clock + bar; at urgent the hurry copy BECOMES the title (no extra row)', () => {
    const calm = renderDesk({ dueSeconds: 40, totalMs: 45_000 });
    expect(calm).toMatch(/gd-desk__clock[^>]*>40</);
    expect(calm).toContain('gd-desk__bar');
    expect(calm).not.toContain('gd-desk--urgent');
    const urgent = renderDesk({ dueSeconds: 7, totalMs: 45_000 });
    expect(urgent).toContain('gd-desk--urgent');
    // Visual-round find: a separate hurry ROW pushed Play/Pass below the
    // 390px fold at the auto-pass horizon — the title slot carries it now.
    expect(urgent).toMatch(/gd-desk__title[^>]*>Play soon — 7s left</);
    expect(urgent).not.toContain('Your turn — play');
    expect(urgent).not.toContain('gd-desk__hurry');
  });

  it('planning window reads as its own register — copy AND a calm ivory border (moved off goldleaf)', () => {
    const html = renderDesk({ planning: true, dueSeconds: 80, totalMs: 90_000 });
    expect(html).toContain('Your turn · planning');
    expect(html).toContain('gd-desk--planning');
    // The register is a CALM IVORY border now (visual-refinement round: moved
    // off goldleaf so gold stays achievement-only — this state is calm, not
    // caution, so it is neither --amber nor gold). Assert the CSS, not the class.
    const planningRule = stripCss(tableCss).match(/\.gd-desk--planning \{[^}]*\}/)?.[0] ?? '';
    expect(planningRule).toContain('var(--ivory)');
    expect(planningRule).not.toContain('goldleaf');
    // Quiet never wears it; a non-planning turn never wears it.
    expect(renderDesk({ dueSeconds: 40, totalMs: 45_000 })).not.toContain('gd-desk--planning');
  });

  it('tribute desk: retitled, staged face, ready line — and no combo classifier output', () => {
    const html = renderDesk({
      mode: 'tribute',
      tributePhase: 'payTribute',
      tributeReady: true,
      staged: [{ card: 'KD' as Card, index: 1 }],
      stage: { decls: [], playableCount: null },
    });
    expect(html).toContain('Your turn — pay tribute');
    expect(html).toContain('About to pay tribute');
    expect(html).not.toContain('About to play');
  });

  it('the staged strip caps at DESK_STAGE_MAX_FACES with a +N chip', () => {
    const staged = Array.from({ length: 14 }, (_, i) => ({ card: '9S' as Card, index: i }));
    const html = renderDesk({ mode: 'quiet', staged, stage: { decls: [], playableCount: null } });
    expect(html.match(/gd-desk__stagedCard/g)).toHaveLength(DESK_STAGE_MAX_FACES);
    expect(html).toContain('+4');
  });
});

// ---------------------------------------------------------------------------
// Wiring pins — GameTable holds the desk to the design.
// ---------------------------------------------------------------------------

describe('GameTable wiring pins', () => {
  it('the desk mounts keyed by mode (the entrance replays exactly at the turn boundary)', () => {
    expect(gameTableSrc).toMatch(/<PlayDesk\s+key=\{desk\}/);
    expect(gameTableSrc).toMatch(/\{desk !== 'off' && \(/);
  });

  it('the loud desk drives the acting reflow class AND the D4 headline demotion', () => {
    expect(gameTableSrc).toMatch(/deskLoud \? ' gd-table--acting' : ''/);
    expect(gameTableSrc).toMatch(/deskOwnsTurn=\{deskLoud\}/);
    expect(gameTableSrc).toMatch(/const deskLoud = desk === 'play' \|\| desk === 'tribute';/);
  });

  it('quiet mode gets NO clock: dueSeconds flows only when loud', () => {
    expect(gameTableSrc).toMatch(/dueSeconds=\{deskLoud \? dueSeconds : null\}/);
  });

  it('every table-owning choreography suppresses the desk', () => {
    const suppressed = gameTableSrc.match(/suppressed:\s*([\s\S]*?),\s*\}\)/)?.[1] ?? '';
    for (const gate of [
      'ceremonyShowing',
      'dealing',
      'holdFan',
      'interludeShowing',
      "leaderConcealed !== null",
      'showAnti',
      "view.phase === 'ceremonyCut'",
      'view.matchWinner !== null',
    ]) {
      expect(suppressed).toContain(gate);
    }
  });

  it('D3: the fan dims only in loud play with a non-empty selection', () => {
    expect(gameTableSrc).toMatch(/dimUnselected=\{desk === 'play' && selected\.size > 0\}/);
  });

  it('D6: auto-pass detection is own-seat + not-locally-sent; notice capped and transient', () => {
    expect(gameTableSrc).toMatch(
      /ev\.seat === ownSeat && consumeLocalPass !== undefined && !consumeLocalPass\(ev\.seat\)/,
    );
    expect(gameTableSrc).toMatch(/nth: \(d\.autoPass\?\.nth \?\? 0\) \+ 1/);
    expect(gameTableSrc).toMatch(/autoPass\.nth <= MAX_TIMEOUT_NOTICES/);
    expect(gameTableSrc).toMatch(/now - autoPass\.at < TIMEOUT_NOTICE_MS/);
    expect(MAX_TIMEOUT_NOTICES).toBe(2);
    expect(TIMEOUT_NOTICE_MS).toBe(4000);
  });

  it('D6: the local-pass stamp is CONSUMED by its matching fold (panel MED, Codex)', () => {
    // One stamp maps to one pass event — without the delete, a REAL
    // auto-pass on the seat's next turn inside the 10s window was
    // suppressed as "local" and the teaching notice silently eaten.
    const fn = gameTableSrc.match(/const consumeLocalPass[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toContain('localPassRef.current.delete(seat)');
    expect(fn).toContain("if (at === undefined) return false;");
  });

  it("the notice's freshness rides the tick horizon (the untimed-room frozen-now class)", () => {
    expect(gameTableSrc).toMatch(
      /d\.autoPass !== null \? \[d\.autoPass\.at \+ TIMEOUT_NOTICE_MS \+ 500\] : \[\]/,
    );
  });

  it('act() stamps locally-sent passes for the detection', () => {
    expect(gameTableSrc).toMatch(
      /if \(action\.type === 'pass'\) localPassRef\.current\.set\(activeSeat, Date\.now\(\)\)/,
    );
  });

  it('the visibility guarantee: a LOUD desk (and a growing stage) snaps the buttons into view, instantly', () => {
    // Visual-round find: the full column can overflow 844px and elders do
    // not know to scroll. Instant (behavior auto) — nothing for
    // reduced-motion to lose, no smooth glide to sit through. A CHILD
    // component (ScrollActionsIntoView) because GameTable's hook section
    // ends before its early returns — the first shape crashed the table on
    // a viewless render (Rules of Hooks) and the live drive caught it.
    expect(gameTableSrc).toMatch(
      /if \(loud\) targetRef\.current\?\.scrollIntoView\(\{ block: 'nearest', behavior: 'auto' \}\)/,
    );
    expect(gameTableSrc).toMatch(/\}, \[loud, stagedCount, targetRef\]\)/);
    expect(gameTableSrc).toMatch(
      /<ScrollActionsIntoView\s+loud=\{deskLoud\}\s+stagedCount=\{stagedCards\.length\}\s+targetRef=\{actionsRowRef\}/,
    );
  });

  it('the headline echo class exists and is your-turn + desk-owned only', () => {
    expect(headlineSrc).toMatch(/yourTurn && deskOwnsTurn \? 'gd-headline__turn--echo' : ''/);
  });
});

// ---------------------------------------------------------------------------
// CSS pins — steady-state rule, reduced motion, the recycled budget.
// ---------------------------------------------------------------------------

describe('desk CSS pins', () => {
  const css = stripCss(tableCss);
  const deskBlock = css.slice(css.indexOf('.gd-desk {'), css.indexOf('.gd-actions {'));

  it('the desk block exists and contains NO infinite animation (steady-state rule)', () => {
    expect(deskBlock.length).toBeGreaterThan(100);
    expect(deskBlock).not.toContain('infinite');
    expect(deskBlock).toMatch(/animation: gd-desk-in 200ms ease-out;/);
  });

  it('the loud shell styles only the play/tribute forms — quiet has no shell rule', () => {
    expect(css).toMatch(/\.gd-desk--play,\s*\.gd-desk--tribute \{/);
    expect(css).not.toMatch(/\.gd-desk--quiet\s*\{[^}]*border/);
  });

  it('urgency stages are color+weight (caution --amber distinct from goldleaf; urgent cinnabar bold), never a pulse', () => {
    // Owner Option A: the caution stage moved OFF goldleaf so gold means
    // achievement only. The clock ramps calm ivory -> caution --amber ->
    // urgent cinnabar+bold, and the depleting bar carries time non-colour.
    expect(css).toMatch(/\.gd-desk--amber \.gd-desk__clock \{\s*color: var\(--amber\);/);
    expect(css).toMatch(
      /\.gd-desk--urgent \.gd-desk__clock \{\s*color: var\(--cinnabar\);\s*font-weight: 700;/,
    );
    // Structural pin: the caution hue is a DISTINCT palette colour from both
    // goldleaf (achievement) and cinnabar (urgent) — never re-collapsed to gold.
    const hex = (name: string) => css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
    const amber = hex('--amber');
    expect(amber, '--amber must be defined').toBeTruthy();
    expect(amber, 'caution amber must differ from goldleaf (gold = achievement only)').not.toBe(hex('--goldleaf'));
    expect(amber, 'caution amber must differ from cinnabar (urgent)').not.toBe(hex('--cinnabar'));
    expect(deskBlock).not.toContain('gd-pulse');
  });

  it('reduced motion: the FACE lift collapses to the ring pair; the D3 dim is off', () => {
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(
      /\.gd-fan__card--selected \.gd-card,\s*\.gd-fan__card--selected:hover \.gd-card,\s*\.gd-fan__card:hover \.gd-card \{\s*transform: none;/,
    );
    expect(reduced).toMatch(
      /\.gd-fan--dim \.gd-fan__card:not\(\.gd-fan__card--selected\) \{\s*opacity: 1;/,
    );
  });

  it('the selected FACE keeps the full -14px lift and the ivory outer ring (item 3a + variant D F2)', () => {
    const rule = css.match(/\.gd-fan__card--selected \.gd-card,\s*\.gd-fan__card--selected:hover \.gd-card \{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('transform: translateY(-14px)');
    expect(rule).toContain('var(--cinnabar)');
    expect(rule).toContain('var(--ivory)');
  });

  it('D4 phone demotion + guard-2 acting shrink live in the <=719px block; desktop keeps its rows', () => {
    const phone = css.slice(css.indexOf('@media (max-width: 719px)'));
    expect(phone).toMatch(/\.gd-headline__turn--echo \{\s*display: none;/);
    expect(phone).toMatch(
      /\.gd-table--acting \.gd-ring__table \{\s*grid-template-rows: auto minmax\(3\.25rem, 1fr\);/,
    );
  });

  it('the recycled budget: the reason band and the handclock are gone from the stylesheet', () => {
    expect(css).not.toContain('.gd-actions__reason');
    expect(css).not.toContain('.gd-handclock');
  });
});

// ---------------------------------------------------------------------------
// One-tap clear (prefill-visibility round, item 2): one control empties the
// WHOLE selection. The cross-system guarantee is BY CONSTRUCTION — there is
// exactly one selection source (GameTable's `selected` set) and both
// surfaces derive from it — and the pins hold that construction in place.
// ---------------------------------------------------------------------------

describe('one-tap clear', () => {
  const clearProps = {
    mode: 'quiet' as const,
    dueSeconds: null,
    totalMs: null,
    planning: false,
    level: '2' as const,
    staged: [
      { card: '9S' as never, index: 3 },
      { card: '9C' as never, index: 4 },
    ],
    stage: { decls: [], playableCount: null },
    beat: null,
    tributePhase: null,
    tributeReady: false,
    onUnstage: () => {},
    onClearAll: () => {},
  };
  let original: ReturnType<typeof getLocale>;
  beforeEach(() => {
    original = getLocale();
    setLocale('en');
  });
  afterEach(() => {
    setLocale(original);
  });

  it('the clear control exists ONLY with staged cards (a clear with nothing selected is noise)', () => {
    const withCards = renderToStaticMarkup(createElement(PlayDesk, clearProps));
    expect(withCards).toContain('gd-desk__clear');
    expect(withCards).toContain('Re-pick');
    expect(withCards).toContain('Clear all selected cards');
    const empty = renderToStaticMarkup(
      createElement(PlayDesk, { ...clearProps, mode: 'play', staged: [], beat: 'lead' as const }),
    );
    expect(empty).not.toContain('gd-desk__clear');
  });

  it('one clear zeroes BOTH surfaces: single selection source, both derivations pinned', () => {
    // The clear empties the ONE set (and closes the chooser)...
    expect(gameTableSrc).toMatch(
      /onClearAll=\{\(\) => \{\s*setSelected\(new Set\(\)\);\s*setChooserOpen\(false\);\s*\}\}/,
    );
    // ...and both surfaces read from that same set: the fan's lifts...
    expect(gameTableSrc).toMatch(/selected=\{selected\}/);
    // ...and the desk's staged faces (stagedCards derives from `selected`).
    expect(gameTableSrc).toMatch(/const stagedCards = \[\.\.\.selected\]/);
    // No second selection store exists to leave a ghost behind (the other
    // ReadonlySet states are the interlude's done/late bookkeeping, not
    // selection).
    expect(gameTableSrc.match(/const \[selected, setSelected\]/g) ?? []).toHaveLength(1);
  });

  it('the clear pill meets the elder tap-target floor (panel LOW, Codex)', () => {
    const rule = stripCss(tableCss).match(/\.gd-desk__clear \{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('min-height: 2.75rem');
  });
});

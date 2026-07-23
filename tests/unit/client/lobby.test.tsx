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
    // The bubble renders inside its own seat's wrapper (seatChip), so the
    // confirm claims THAT seat (s), the same single takeSeat path.
    expect(lobbySrc).toMatch(/takeSeat\(store, sitAskName, s\);/);
  });

  it('the ask panel is spare (input + confirm + a corner cancel), carries the seat ONLY in aria, and explains an empty confirm', () => {
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
    // The visible seat-label crutch is GONE (the bubble's tail carries
    // belongs-to); the steady prompt line is gone too — spare by design.
    const visible = asking.replace(/<[^>]*>/g, ' ');
    expect(visible).not.toContain('Take the bottom seat');
    expect(visible).not.toContain('Enter a name to finish sitting down');
    // The seat identity still reaches assistive tech through the input's
    // aria-label — a tail is invisible to a screen reader.
    expect(asking).toContain('aria-label="Enter a name for the bottom seat"');
    // Just the input and the confirm, plus a corner × to cancel.
    expect(asking).toContain('lobby-sitask__input');
    expect(asking).toContain('Sit down');
    expect(asking).toContain('lobby-sitask__close');
    expect(asking).toContain('aria-label="Cancel"');
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
    // The bubble is rendered inside its OWN seat's wrapper, so the taken
    // signal reads against that seat (s), not the shared sitAsk.
    expect(lobbySrc).toMatch(/taken=\{claimedOf\(s\) && !snapshot\.seats\.has\(s\)\}/);
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
    // ...and the claiming hint is a LIVE REGION (role=status) so AT hears the
    // wait too — the "never silence" contract for screen readers (panel-audit
    // INFO, workflow sweep).
    expect(html).toContain('role="status"');
  });

  it('wiring: one claim per confirm, growth-only unwedge, disconnect parity on BOTH the button AND Enter', () => {
    expect(lobbySrc).toMatch(/if \(sitAskClaiming\) return;/);
    expect(lobbySrc).toMatch(/setSitAskClaiming\(true\);/);
    expect(lobbySrc).toMatch(/if \(rejectionCount > prevRejectionsRef\.current\) setSitAskClaiming\(false\);/);
    expect(lobbySrc).toMatch(/disabled=\{claiming \|\| !connected\}/);
    // Disconnect parity extends to the Enter path: onConfirm itself refuses to
    // claim while disconnected, so Enter cannot bypass the disabled button
    // (panel-audit LOW, workflow sweep — a pre-existing gap, fixed same-round).
    expect(lobbySrc).toMatch(/if \(!snapshot\.connected\) return;/);
  });
});

// ---------------------------------------------------------------------------
// Prefill-visibility round, item 1a — blank-when-ambiguous. Diagnosis
// (evidence in Lobby.tsx): the browser-profile localStorage scope was the
// DESIGNED sit-then-name behavior, not state residue; the too-coarse part
// was prefilling for a DIFFERENT person. The corrected rule is pinned so
// it cannot drift back either way.
// ---------------------------------------------------------------------------

import { sitAskPrefill } from '../../../src/client/Lobby';

describe('sitAskPrefill — blank when ambiguous, remembered when clearly the same person', () => {
  it('prefills the rejoin case: no seat held here, name not already at the table', () => {
    expect(sitAskPrefill('  mike  ', false, ['ana'])).toBe('mike');
  });

  it('blank when this client already holds a seat (the next claim is someone else)', () => {
    expect(sitAskPrefill('mike', true, [])).toBe('');
  });

  it('blank when the remembered name is already seated on the roster', () => {
    expect(sitAskPrefill('mike', false, ['mike', 'ana'])).toBe('');
  });

  it('blank stays blank', () => {
    expect(sitAskPrefill('   ', false, [])).toBe('');
  });

  it('wiring: the ask-open reads the prefill THROUGH the predicate with live room signals', () => {
    // holds-a-seat is widened by the in-flight claim stamp (cumulative
    // panel MED, Codex — see the dedicated describe below).
    expect(lobbySrc).toMatch(
      /sitAskPrefill\(\s*readLastName\(\),\s*snapshot\.seats\.size > 0 \|\| Date\.now\(\) - lastClaimAtRef\.current < 10_000,\s*room\.seats\.filter\(\(x\) => x\.claimed\)\.map\(\(x\) => x\.name \?\? ''\),?\s*\)/,
    );
  });
});

// ---------------------------------------------------------------------------
// The seat BUBBLE overlay (owner overlay round; supersedes the inline seat
// drawer — real-player feedback, recorded not rewritten in seat-entry-
// placement.md per METHODOLOGY §9). The relocation moves SitAskPanel wholesale
// — every sit-then-name / prefill / claiming-lock / race pin above must keep
// passing UNTOUCHED (a break means the relocation changed behaviour it should
// not have). These pins cover what is NEW: the overlay never reflows the
// lobby, the tail aims at the targeted seat by construction, retargeting moves
// the tail and the claim target with no double-claim, and guard 3's 16px fact.
// ---------------------------------------------------------------------------

const appCss = readFileSync(join(__dirname, '../../../src/client/app.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

describe('the seat bubble overlay (owner round)', () => {
  it('overlays WITHOUT reflowing: the table className is constant and the bubble is absolute', () => {
    // The class no longer switches on sitAsk (the old grid-area swap that
    // reflowed the lobby is gone); the drawer areas are gone from the CSS.
    expect(lobbySrc).toContain('<div className="lobby-table" role="group"');
    expect(lobbySrc).not.toContain('lobby-table--drawer');
    expect(appCss).not.toContain('lobby-table--drawer');
    expect(appCss).not.toContain('lobby-drawer');
    // The bubble floats above (absolute) inside a position:relative table.
    const table = appCss.match(/\.lobby-table \{[^}]*\}/)?.[0] ?? '';
    expect(table).toContain('position: relative');
    const bubble = appCss.match(/\.lobby-bubble \{[^}]*\}/)?.[0] ?? '';
    expect(bubble).toContain('position: absolute');
  });

  it('the bubble is rendered INSIDE the pressed seat CHIP (so the tail anchors to the chip, not the wider wrapper), only when asking', () => {
    // The bubble immediately follows the take button, INSIDE the .lobby-seat
    // chip (not after it as a wrapper sibling) — so on a wide layout, where the
    // flank column exceeds the chip's max-width, the flank tail still aims at
    // the seat (panel-audit MED, Codex). The chip is the positioned containing
    // block. A retarget unmounts the old seat's bubble and mounts the new one,
    // so autofocus re-fires with no key.
    expect(lobbySrc).toMatch(/\{asking && \(\s*<div className="lobby-bubble">/);
    // The bubble closes and is followed by TWO closing divs — the chip AND the
    // wrapper — before seatChip returns, so it is nested INSIDE the chip (a
    // wrapper-level sibling would have only one trailing div). The chip is the
    // positioned containing block for the anchor.
    expect(lobbySrc).toMatch(/<\/div>\s*\)\}\s*<\/div>\s*<\/div>\s*\);\s*\};/);
    const chip = appCss.match(/\.lobby-seat \{[^}]*\}/)?.[0] ?? '';
    expect(chip).toContain('position: relative');
    expect(lobbySrc).not.toContain('lobby-drawer');
  });

  it('the disc keeps the room code (the bubble floats over the felt, never replaces it)', () => {
    expect(lobbySrc).toMatch(
      /className="lobby-table__disc">\s*<span className="lobby-table__codelabel"/,
    );
  });

  it('the tail points at the targeted seat by construction — one direction per seat, centered on the seat axis', () => {
    // top (s2): bubble hangs below, tail on its BOTTOM-facing edge points UP;
    // bottom (s0): above, tail points DOWN; right (s1): left of the seat, tail
    // RIGHT; left (s3): right of the seat, tail LEFT. Each tail is centered on
    // the bubble's seat-facing edge, and the bubble is centered on the seat's
    // own axis (translateX/Y(-50%)), so the tail sits on the seat's centre by
    // construction — robust to the other seats' chip heights.
    const s2 = appCss.match(/\.lobby-tableseat--s2 \.lobby-bubble \{[^}]*\}/)?.[0] ?? '';
    expect(s2).toContain('top: calc(100% + 8px)');
    expect(s2).toContain('translateX(-50%)');
    const s2tail = appCss.match(/\.lobby-tableseat--s2 \.lobby-bubble::after \{[^}]*\}/)?.[0] ?? '';
    expect(s2tail).toContain('bottom: 100%');
    expect(s2tail).toContain('border-bottom: 8px solid var(--bubble-surface)');

    const s0 = appCss.match(/\.lobby-tableseat--s0 \.lobby-bubble \{[^}]*\}/)?.[0] ?? '';
    expect(s0).toContain('bottom: calc(100% + 8px)');
    expect(s0).toContain('translateX(-50%)');
    const s0tail = appCss.match(/\.lobby-tableseat--s0 \.lobby-bubble::after \{[^}]*\}/)?.[0] ?? '';
    expect(s0tail).toContain('top: 100%');
    expect(s0tail).toContain('border-top: 8px solid var(--bubble-surface)');

    const s1 = appCss.match(/\.lobby-tableseat--s1 \.lobby-bubble \{[^}]*\}/)?.[0] ?? '';
    expect(s1).toContain('right: calc(100% + 8px)');
    expect(s1).toContain('translateY(-50%)');
    const s1tail = appCss.match(/\.lobby-tableseat--s1 \.lobby-bubble::after \{[^}]*\}/)?.[0] ?? '';
    expect(s1tail).toContain('left: 100%');
    expect(s1tail).toContain('border-left: 8px solid var(--bubble-surface)');

    const s3 = appCss.match(/\.lobby-tableseat--s3 \.lobby-bubble \{[^}]*\}/)?.[0] ?? '';
    expect(s3).toContain('left: calc(100% + 8px)');
    expect(s3).toContain('translateY(-50%)');
    const s3tail = appCss.match(/\.lobby-tableseat--s3 \.lobby-bubble::after \{[^}]*\}/)?.[0] ?? '';
    expect(s3tail).toContain('right: 100%');
    expect(s3tail).toContain('border-right: 8px solid var(--bubble-surface)');
  });

  it('the targeted wrapper lifts above its neighbours + the disc so the bubble is never occluded', () => {
    expect(lobbySrc).toMatch(/asking \? ' lobby-tableseat--asking' : ''/);
    const asking = appCss.match(/\.lobby-tableseat--asking \{[^}]*\}/)?.[0] ?? '';
    expect(asking).toContain('z-index');
    const wrapper = appCss.match(/\.lobby-tableseat \{[^}]*\}/)?.[0] ?? '';
    expect(wrapper).toContain('position: relative');
  });

  it('a one-shot open, never a loop, instant under reduced motion', () => {
    const bubble = appCss.match(/\.lobby-bubble \{[^}]*\}/)?.[0] ?? '';
    expect(bubble).toMatch(/animation: lobby-bubble-in \d+ms ease-out/);
    expect(bubble).not.toContain('infinite');
    const reduced = appCss.slice(appCss.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.lobby-bubble,\s*\.lobby-sitask \{\s*animation: none;/);
  });

  it('guard 3 pinned: the ask input is 16px (1rem) — below that iOS zooms the page', () => {
    const input = appCss.match(/\.lobby-sitask__input \{[^}]*\}/)?.[0] ?? '';
    expect(input).toContain('font-size: 1rem');
    expect(input).not.toMatch(/font-size: 0\.\d/);
  });
});

describe('last-pressed-seat-wins: retargeting moves the tail + the claim target, never double-claims', () => {
  // The retarget/open else-branch, extracted once. Asserted NON-EMPTY at each
  // use so the negative pins below cannot pass vacuously on a collapsed window
  // (panel-audit LOW, Grok).
  const openBranch =
    lobbySrc.match(/const retarget = sitAsk !== null;[\s\S]*?setSitAskClaiming\(false\);\s*\}/)?.[0] ?? '';

  it('nothing is claimed on retarget — the ONLY claim stays the confirm (and the name-ready fast path)', () => {
    // store.claim once (inside takeSeat); takeSeat is called in exactly two
    // places — the name-ready fast path and the bubble confirm — never in the
    // retarget (open) branch. So a retarget cannot mint a token.
    expect(lobbySrc.match(/store\.claim\(/g) ?? []).toHaveLength(1);
    expect(lobbySrc.match(/takeSeat\(store,/g) ?? []).toHaveLength(2);
    // The open/retarget branch (else of sitIntent) contains NO takeSeat.
    expect(openBranch.length).toBeGreaterThan(0);
    expect(openBranch).not.toContain('takeSeat(');
    expect(openBranch).not.toContain('store.claim');
  });

  it('a retarget PRESERVES the typed name (seat moved, not person) UNLESS a claim is in flight, when it re-faces prefill', () => {
    // retarget = the bubble was already open; prefill is SKIPPED (name kept) on
    // an UNCOMMITTED retarget, but RUN when a confirm is already in flight — a
    // just-committed identity must re-face blank-when-ambiguous (panel-audit
    // LOW, Codex: shared device, the next seat is likely a DIFFERENT person).
    expect(lobbySrc).toContain('const retarget = sitAsk !== null;');
    expect(lobbySrc).toContain('const claimInFlight = sitAskClaiming;');
    expect(lobbySrc).toMatch(/if \(!retarget \|\| claimInFlight\) \{\s*setSitAskName\(\s*sitAskPrefill\(/);
    // The tail moves because the single sitAsk target moves to the new seat.
    expect(lobbySrc).toMatch(/setSitAsk\(s\);/);
  });

  it('a retarget is a NEW confirm session: the in-flight lock resets so it cannot wedge', () => {
    expect(openBranch.length).toBeGreaterThan(0);
    expect(openBranch).toContain('setSitAskNeedName(false)');
    expect(openBranch).toContain('setSitAskClaiming(false)');
  });

  it('a direct name-then-sit claim SUPERSEDES any open bubble (no orphan)', () => {
    const claimBranch = lobbySrc.match(/setName\(takeSeat\(store, name, s\)\);[\s\S]*?\} else \{/)?.[0] ?? '';
    expect(claimBranch).toContain('setSitAsk(null)');
    expect(claimBranch).toContain('setSitAskClaiming(false)');
  });

  it('both confirm and the take-a-seat button complete the claim: each of the two takeSeat calls seats a specific seat', () => {
    // The name-ready take-a-seat fast path claims seat s directly; the bubble
    // confirm claims its own seat s. Both are takeSeat(store, ..., s) — the
    // same single path.
    expect(lobbySrc).toMatch(/setName\(takeSeat\(store, name, s\)\);/);
    expect(lobbySrc).toMatch(/takeSeat\(store, sitAskName, s\);/);
  });
});

describe('the in-flight prefill window (cumulative panel MED, Codex)', () => {
  it('a fresh claim stamps the window and the ask-open widens holds-a-seat with it', () => {
    // Both claim paths stamp...
    expect(lobbySrc.match(/lastClaimAtRef\.current = Date\.now\(\);/g) ?? []).toHaveLength(2);
    // ...and the prefill treats a <10s-old claim as holding a seat, so the
    // just-claimed identity can never prefill the next ask during the
    // roster echo lag.
    expect(lobbySrc).toMatch(
      /snapshot\.seats\.size > 0 \|\| Date\.now\(\) - lastClaimAtRef\.current < 10_000,/,
    );
  });
});

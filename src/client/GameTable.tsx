// <GameTable/> — the M3 Guandan table UI. The shell contract is unchanged:
// per-seat views/hints come from the RoomSnapshot, the active-seat tab bar
// drives multi-seat self-play (PLAN §4), and every panel renders the ACTIVE
// seat's view. Internals: the Lacquer Ledger seat RING (you bottom, partner
// across, opponents flanking a bounded centre), a TableHeadline topbar
// (the level (rank) / wild / whose-turn) as the signature, per-seat zones
// (identity pill + a real card-back stack, SeatPlate/SeatStack),
// HandFan selection → hint matching → ActionBar, trick well /
// tribute panel, hand-1 draw ceremony, result overlay, event feed.
//
// The store keeps only each seat's LATEST event batch (view-carrying
// events, PLAN §5) — so trick-local presentation state (pass markers,
// jiefeng banner, anti-tribute reveals, the ceremony payload, the feed) is folded
// here from batches as they arrive.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Seat } from '../engine/core/game';
import { teamOf } from '../engine/guandan/types';
import type { GuandanAction, GuandanEvent } from '../engine/guandan/types';
import type { Card, Rank } from '../engine/guandan/cards';
import type { RoomSnapshot, RoomStore } from './room/store';
import { ActionBar } from './table/ActionBar';
import { CeremonyOverlay } from './table/CeremonyOverlay';
import { CutPanel } from './table/CutPanel';
import { DealOverlay } from './table/DealOverlay';
import { HAND_SIZE, dealDirOrder, markerDealBeat } from './table/deal';
import { EventFeed, FEED_LIMIT, type FeedLine } from './table/EventFeed';
import { PlayOverlay } from './table/PlayOverlay';
import { HandFan } from './table/HandFan';
import { TableHeadline } from './table/TableHeadline';
import { ResultOverlay } from './table/ResultOverlay';
import { SeatPlate } from './table/SeatPlate';
import { SeatCount, SeatStack, type SeatStackDir } from './table/SeatStack';
import { TributePanel } from './table/TributePanel';
import { TrickWell } from './table/TrickWell';
import {
  activeSeats,
  asGuandanEvents,
  asGuandanView,
  asRuleVariant,
  declJokerRank,
  concealedLeader,
  holdPreDealFan,
  isCeremonyShowing,
  landRemoteDealt,
  matchSelection,
  multisetKey,
  NO_REMOTE_DEALT,
  placeOf,
  playingLevelTeam,
  remainingSeconds,
  remoteDealtCounts,
  rankText,
  seatLayout,
  tributeEligibleCards,
  tributeKind,
  type Ceremony,
  type PlayMatch,
  type RemoteDealt,
} from './table/helpers';
import { t } from './i18n';
import { describeError } from './errors';
import './table/table.css';

export interface GameTableProps {
  snapshot: RoomSnapshot;
  store: RoomStore;
}

// ---------------------------------------------------------------------------
// Hand-sort direction — a per-client UI preference (owner §3), NOT room
// state: it never touches the server, so it's read/written straight to
// localStorage rather than folded through the snapshot/store like the rest
// of this file's state.
// ---------------------------------------------------------------------------

// The fold must commit the new deal's dealNo in the SAME paint as the new
// view.hand — otherwise, for one render, view.hand holds the fresh deal while
// derived.dealNo still lags (dealing false, no gate), flashing the full hand
// before the DealOverlay/ceremony overlay mounts (hand 1 AND hands 2+). A
// layout effect flushes the fold synchronously before the browser paints, so
// that intermediate frame is never shown. `useEffect` on the server (no DOM,
// and renderToStaticMarkup runs no effects anyway) avoids React's SSR
// useLayoutEffect warning.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const HAND_SORT_STORAGE_KEY = 'pref:handSort';

function readHandSortDescending(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(HAND_SORT_STORAGE_KEY) === 'desc';
  } catch {
    return false;
  }
}

function writeHandSortDescending(descending: boolean): void {
  try {
    localStorage.setItem(HAND_SORT_STORAGE_KEY, descending ? 'desc' : 'asc');
  } catch {
    // localStorage unavailable (e.g. private mode) — the toggle still
    // works for the current session, just doesn't persist.
  }
}

// ---------------------------------------------------------------------------
// Per-seat presentation state folded from event batches.
// ---------------------------------------------------------------------------

export interface SeatDerived {
  feed: FeedLine[];
  passed: Seat[];
  /** Wall-clock fold time of each seat's pass THIS trick (cleared with
   *  `passed`). The transient pass fade renders from THIS, gated on
   *  now − passedAt < the animation's span — so a zone remount (seat-tab
   *  switch) after the fade has let go can never replay it (panel MED,
   *  Codex + Grok concurring); `passed` itself stays the durable
   *  trick-state fact. */
  passedAt: Partial<Record<Seat, number>>;
  /** The latest play's flight trigger (owner: cards fly from the pile to the
   *  table like the deal): stamped on every 'played' fold, rendered by
   *  PlayOverlay while fresh (same wall-clock discipline as passedAt — a
   *  remount never replays a settled flight), cleared by a new hand or the
   *  sweep. `id` keys the overlay so consecutive plays remount it.
   *  `covered` is the play this one lands ON TOP of (owner physics
   *  refinement): the previous top's cards stay on the table as a well
   *  underlay while the new cards fly, then fade once covered. */
  playFx: { seat: Seat; cards: Card[]; covered: Card[] | null; at: number; id: number } | null;
  /** The trick's current top play as folded — solely so the NEXT 'played'
   *  fold knows which cards it covers (playFx.covered). Cleared with the
   *  trick/hand; null right after a reconnect (the resync drops event
   *  history), which degrades that one flight to the old instant swap. */
  topCards: Card[] | null;
  jiefeng: { finisher: Seat; leader: Seat } | null;
  anti: { seat: Seat; card: Card }[] | null;
  ceremony: Ceremony | null;
  level: Rank;
  sweep: number;
  /** Item 4: bumped on every handStarted fold — each new deal plays the
   *  physical deal animation exactly once (reconnect resyncs fold no
   *  events, so a rejoin never replays it). */
  dealNo: number;
  /** Obs 3: this seat's own hand in TRUE DEAL ORDER (round-robin for hand 1),
   *  taken straight from the handStarted event — NOT a new field, and NOT a
   *  leak: viewEvent already redacts handStarted.hands to the seat's own
   *  cards, so this is exactly the 27 cards it already holds, in the order the
   *  server already sent. The deal animates arrival in THIS order and sorts in
   *  one beat at the end (never "arrives sorted"). Null until the first deal. */
  dealOrder: readonly Card[] | null;
}

export const EMPTY_DERIVED: SeatDerived = {
  feed: [],
  passed: [],
  passedAt: {},
  playFx: null,
  topCards: null,
  jiefeng: null,
  anti: null,
  ceremony: null,
  level: '2',
  sweep: 0,
  dealNo: 0,
  dealOrder: null,
};

// Exported (not just used internally) so a unit test can fold real events
// and assert the resulting FeedLine carries SEMANTIC params (combo/place/
// card descriptors, not pre-localized strings) and that resolving those
// params (EventFeed.resolveFeedParams) re-localizes correctly after a
// locale switch — tests/unit/client/table.test.ts, m1 fix.
export function foldEvents(
  prev: SeatDerived,
  events: readonly GuandanEvent[],
  viewerTeam: 0 | 1,
  nameFor: (seat: Seat) => string,
  nextId: () => number,
): SeatDerived {
  let d = { ...prev, feed: [...prev.feed] };
  const push = (key: FeedLine['key'], params?: FeedLine['params']) => {
    d.feed.push({ id: nextId(), key, params });
  };
  for (const ev of events) {
    switch (ev.type) {
      case 'ceremonyCutStarted':
        push('game.feed.cutStarted', { name: nameFor(ev.cutter) });
        break;
      case 'ceremonyCutFlipped':
        // Re-cut round: an uncountable flip — public, and the cutter goes
        // again (the CutPanel shows the flip from view.ceremonyFlips).
        push('game.feed.cutFlipped', { name: nameFor(ev.cutter) });
        break;
      case 'handStarted': {
        // The redacted handStarted carries ONLY this seat's own hand populated
        // (viewEvent empties the other three), in the engine's deal order — so
        // the single non-empty entry IS this seat's deal order (obligation 3
        // already guarantees it holds no other seat's cards).
        const ownDealOrder = ev.hands.find((h) => h.length > 0) ?? null;
        d = {
          ...d,
          passed: [],
          passedAt: {},
          playFx: null,
          topCards: null,
          jiefeng: null,
          anti: null,
          level: ev.currentLevel,
          dealNo: d.dealNo + 1,
          dealOrder: ownDealOrder,
        };
        if (ev.ceremony !== undefined) d.ceremony = ev.ceremony;
        push('game.feed.handStarted', { hand: ev.handNo, rank: rankText(ev.currentLevel) });
        break;
      }
      case 'played':
        d.passed = d.passed.filter((s) => s !== ev.seat);
        if (d.passedAt[ev.seat] !== undefined) {
          const { [ev.seat]: _dropped, ...rest } = d.passedAt;
          d.passedAt = rest;
        }
        // The play flight (owner: from the pile to the table, like the
        // deal). Cards on the table are public — viewEvent never redacts a
        // played hand — so every seat's fold can fly them. The play it
        // covers (the trick's previous top) rides along: those cards stay
        // on the table under the flight and fade once covered.
        d.playFx = {
          seat: ev.seat,
          cards: ev.cards,
          covered: d.topCards,
          at: Date.now(),
          id: nextId(),
        };
        d.topCards = ev.cards;
        d.jiefeng = null;
        d.anti = null; // the anti-tribute reveal yields the center back to the trick
        push('game.feed.played', {
          name: nameFor(ev.seat),
          combo: {
            kind: 'combo',
            comboType: ev.decl.type,
            keyRank: ev.decl.keyRank,
            jokerRank: declJokerRank(ev.decl),
          },
        });
        break;
      case 'passed':
        if (!d.passed.includes(ev.seat)) d.passed = [...d.passed, ev.seat];
        d.passedAt = { ...d.passedAt, [ev.seat]: Date.now() };
        push('game.feed.passed', { name: nameFor(ev.seat) });
        break;
      case 'trickWon':
        // playFx dies with the trick (panel MED, Grok): the sweep re-keys the
        // well, and a still-airborne flight would sail into the cleared
        // centre chasing detached rects. topCards too — the next trick opens
        // on a bare table.
        d = {
          ...d,
          passed: [],
          passedAt: {},
          playFx: null,
          topCards: null,
          anti: null,
          sweep: d.sweep + 1,
        };
        push('game.feed.trickWon', { name: nameFor(ev.seat) });
        break;
      case 'jiefeng':
        d.jiefeng = { finisher: ev.finisher, leader: ev.leader };
        // feed.jiefeng carries BOTH names (the upgraded sentence names who
        // leads and on whose behalf) — the well's old goldleaf banner said
        // this same thing visually; the log is now the only place it's said.
        push('game.feed.jiefeng', { leader: nameFor(ev.leader), finisher: nameFor(ev.finisher) });
        break;
      case 'playerFinished':
        push('game.feed.playerFinished', {
          name: nameFor(ev.seat),
          place: { kind: 'place', place: ev.place },
        });
        break;
      case 'tributeCommitted':
        push('game.feed.tributeCommitted', { name: nameFor(ev.seat) });
        break;
      case 'tributePaid':
        for (const p of ev.pairings) {
          push('game.feed.tributePaid', {
            from: nameFor(p.from),
            to: nameFor(p.to),
            card: { kind: 'card', card: p.card, level: d.level },
          });
        }
        break;
      case 'tributeReturned':
        for (const p of ev.pairings) {
          push('game.feed.tributeReturned', {
            from: nameFor(p.from),
            to: nameFor(p.to),
            card: { kind: 'card', card: p.card, level: d.level },
          });
        }
        break;
      case 'antiTribute':
        d.anti = ev.reveals;
        push('game.feed.antiTribute');
        break;
      case 'handEnded':
        d.passed = [];
        push('game.feed.handEnded', {
          us: rankText(ev.newLevels[viewerTeam]),
          them: rankText(ev.newLevels[(1 - viewerTeam) as 0 | 1]),
        });
        break;
      case 'matchEnded':
        push('game.feed.matchEnded');
        break;
      default:
        break;
    }
  }
  d.feed = d.feed.slice(-FEED_LIMIT);
  return d;
}

// ---------------------------------------------------------------------------

export function GameTable({ snapshot, store }: GameTableProps) {
  const heldSeats: Seat[] = [...snapshot.seats.keys()].sort((a, b) => a - b);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);

  // --- presentation folds & local UI state (hooks before any early return) --
  const [derivedBySeat, setDerivedBySeat] = useState<ReadonlyMap<Seat, SeatDerived>>(new Map());
  const processedRef = useRef(new Map<Seat, unknown>());
  const feedIdRef = useRef(0);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [chooserOpen, setChooserOpen] = useState(false);
  const [ceremonyDone, setCeremonyDone] = useState(false);
  // Item 4: which dealNo has finished animating + how many own slots have
  // landed so far (null = not dealing, the whole fan shows).
  const [dealShown, setDealShown] = useState(0);
  const [dealRevealed, setDealRevealed] = useState<number | null>(null);
  // Seat-zone round (R3), review-hardened: per-deal remote landing counters,
  // KEYED by the deal they were landed during — while the deal choreography
  // runs, each remote seat's back stack shows EXACTLY this many cards (grown
  // one per DealOverlay onRemoteLanded callback), so the stacks build in
  // lockstep with the flights. The keying (helpers.remoteDealtCounts) makes
  // "a new deal starts from zero" a property of the READ: no reset effect
  // exists, so hands 2+ can never paint a frame of the previous deal's full
  // stacks (the old post-paint reset's flash — which DealOverlay's mount
  // effect then measured its flight rects against), and a mid-deal seat-tab
  // switch to a lagging seat cannot zero a running deal's counters.
  const [dealtRemote, setDealtRemote] = useState<RemoteDealt>(NO_REMOTE_DEALT);
  // Suspense reveal (owner rule): true once the face-up marker has LANDED
  // this deal — before that, the leader's seat ring stays unlit.
  const [dealLeadRevealed, setDealLeadRevealed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [handDescending, setHandDescending] = useState(() => readHandSortDescending());
  const toggleHandSort = () => {
    setHandDescending((prev) => {
      const next = !prev;
      writeHandSortDescending(next);
      return next;
    });
  };

  const room = snapshot.room;
  const nameFor = (seat: Seat): string =>
    room?.seats.find((s) => s.seat === seat)?.name ?? t('room.seatTab', { seat: seat + 1 });

  // Fold newly arrived event batches into per-seat presentation state. A
  // LAYOUT effect (see useIsomorphicLayoutEffect): the deal-gate reads
  // derived.dealNo, which must land in the same paint as the snapshot's new
  // view.hand or the full hand flashes for one frame before the overlays mount.
  useIsomorphicLayoutEffect(() => {
    let next: Map<Seat, SeatDerived> | null = null;
    for (const [seat, perSeat] of snapshot.perSeat) {
      const batch = perSeat.lastEventBatch;
      if (batch === null || processedRef.current.get(seat) === batch) continue;
      processedRef.current.set(seat, batch);
      const events = asGuandanEvents(batch);
      if (events.length === 0) continue;
      if (next === null) next = new Map(derivedBySeat);
      next.set(
        seat,
        foldEvents(next.get(seat) ?? EMPTY_DERIVED, events, teamOf(seat), nameFor, () => feedIdRef.current++),
      );
    }
    if (next !== null) setDerivedBySeat(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot]);

  // Countdown tick — while a deadline is outstanding, OR while a transient
  // effect's wall-clock window is still open (panel round 2, Grok: an
  // UNTIMED room folds a pass with no deadline armed, so without this leg
  // `now` freezes and the reduced-motion static pass stays visible until
  // the trick clears; the play flight rides the same clock). The fx leg
  // self-expires: once every stamp has aged past the widest render gate
  // (+ slack), the interval's own tick clears it.
  const deadlines = snapshot.deadlines;
  const latestFxAt = Math.max(
    0,
    ...[...derivedBySeat.values()].flatMap((d) => [
      ...(Object.values(d.passedAt) as number[]),
      ...(d.playFx !== null ? [d.playFx.at] : []),
    ]),
  );
  useEffect(() => {
    const fxFreshUntil = latestFxAt + 3500;
    if (deadlines.length === 0 && Date.now() >= fxFreshUntil) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (deadlines.length === 0 && Date.now() >= fxFreshUntil) clearInterval(timer);
    }, 500);
    return () => clearInterval(timer);
  }, [deadlines.length, latestFxAt]);

  // The selected tab must always be a seat we still hold (a takeover by
  // another tab can shrink the held set); fall back to the lowest seat.
  const firstSeat = heldSeats[0] as Seat | undefined;
  const activeSeat =
    selectedSeat !== null && heldSeats.includes(selectedSeat) ? selectedSeat : firstSeat;
  const perSeat = activeSeat === undefined ? undefined : snapshot.perSeat.get(activeSeat);
  const view = perSeat === undefined ? null : asGuandanView(perSeat.view);
  const hints =
    perSeat?.hints == null ? null : (perSeat.hints as GuandanAction[]);

  // The tab bar's one non-redundant power, preserved (panel MED, Grok; Codex
  // noting): per-seat views arrive staggered (seats and perSeat are separate
  // maps), and while THIS seat's view is missing the ring — and therefore
  // every switcher pill — does not render. The old tabs still worked on that
  // waiting screen; without them a multi-seat client could sit on a viewless
  // seat while another held seat already has a table. Fall back
  // automatically: a "Waiting for game data" screen has nothing to preserve.
  useEffect(() => {
    if (view !== null || activeSeat === undefined) return;
    const alt = heldSeats.find(
      (s) => s !== activeSeat && asGuandanView(snapshot.perSeat.get(s)?.view ?? null) !== null,
    );
    if (alt !== undefined) setSelectedSeat(alt);
  });

  // Selection resets whenever the active seat or the hand contents change
  // (a play/tribute/deal replaced the cards under the indices), whenever
  // this seat's expected-actor status ends (hints → null: the turn was
  // resolved — possibly by the server clock), and whenever the trick
  // context changes (a new top play, a new leader, or a trick sweep): a
  // lifted card must never survive the situation it was lifted for.
  const trickKey =
    view === null || view.trick === null
      ? 'noTrick'
      : `${view.trick.leader}|${view.trick.top === null ? 'lead' : multisetKey(view.trick.top.cards)}`;
  const handKey =
    view === null
      ? ''
      : `${activeSeat}|${multisetKey(view.hand)}|${hints === null ? 'idle' : 'actor'}|${trickKey}`;
  useEffect(() => {
    setSelected(new Set());
    setChooserOpen(false);
  }, [handKey]);

  // R3: no reset effect for the remote counters — they are keyed by dealNo
  // (see the dealtRemote declaration above), so a NEW deal reads zeros in its
  // very first render. onDone needs no reset either: dealing flips false
  // there and the settled view counts take over, so a skipped or
  // reduced-motion deal lands on the true numbers regardless of how many
  // callbacks fired.

  const selectionCards: Card[] = useMemo(() => {
    if (view === null) return [];
    return [...selected]
      .sort((a, b) => a - b)
      .map((i) => view.hand[i])
      .filter((c): c is Card => c !== undefined);
  }, [selected, view]);

  // classifyPlays needs the room's rule variant (coerced defensively —
  // helpers.asRuleVariant; the server's hints still gate legality).
  const roomConfig = room?.config;
  const variant = useMemo(() => asRuleVariant(roomConfig), [roomConfig]);

  const matches: PlayMatch[] = useMemo(() => {
    if (view === null || hints === null || view.phase !== 'playing') return [];
    return matchSelection(selectionCards, hints, view.currentLevel, variant);
  }, [selectionCards, hints, view, variant]);

  // Seat-zone round: the old F11 mini-fan (and the --theme-back-* CSS-var
  // injection that themed its slivers) is gone — remote hands now render as
  // REAL theme CardBacks in SeatStack, which reads the active theme itself,
  // so GameTable no longer consumes the theme here at all.

  if (activeSeat === undefined) {
    // Connected without any seat token (e.g. joined a game already going):
    // nothing to render — per-seat views only flow to token holders (PLAN §4).
    return <p>{t('room.spectating')}</p>;
  }

  const derived = derivedBySeat.get(activeSeat) ?? EMPTY_DERIVED;

  // Owner flank follow-up: the Seat 1-4 tab bar is GONE — it was pure
  // same-user view switching for multi-seat self-play (verified: client
  // state only, rendered nothing for a single held seat), redundant now that
  // clicking a held seat's name pill switches the view (see plate()).
  if (view === null) {
    return (
      <section className="gd-table">
        <p>{t('room.waitingForView')}</p>
      </section>
    );
  }

  const viewerTeam = teamOf(activeSeat);
  const layout = seatLayout(activeSeat);
  const deadlineBySeat = new Map(deadlines.map((d) => [d.seat, d]));
  const ringSeats = new Set<Seat>(activeSeats(view));
  if (view.phase === 'antiTributeDecision') for (const d of deadlines) ringSeats.add(d.seat);
  // Turn-in-words for the headline (F8): "your turn" keys on hints — the
  // authoritative "this seat is an expected actor" signal (PLAN §5), robust
  // across every phase/timing, INCLUDING untimed anti-tribute where the
  // engine marks a payer as an expected actor and sends hints but there is no
  // deadline row and activeSeats() returns [] (Codex catch). The other-seat
  // actor name still comes from the ring set — a spectator can only be shown
  // the anti-tribute actor via an expected-actors field in the view, a
  // protocol change that is out of this presentation-only scope.
  const yourTurn = hints !== null;
  const actorSeats = [...ringSeats].sort((a, b) => a - b);
  const actorName = yourTurn || actorSeats.length === 0 ? null : nameFor(actorSeats[0]!);

  // The hand-1 draw ceremony plays INSIDE the planning window (room-timing.md
  // §4 absorb decision); while its overlay is up the countdown is dimmed —
  // client-only cosmetics, the DO's alarm remains the sole enforcer.
  const ceremonyShowing = isCeremonyShowing({
    hasCeremony: derived.ceremony !== null,
    ceremonyDone,
    handNo: view.handNo,
    matchWinner: view.matchWinner,
  });

  // Item 4: play the physical deal once per fold-observed deal — after the
  // hand-1 ceremony overlay (flips/count) finishes, immediately on later
  // hands. Purely presentational: the clock is already running (the 90s
  // per-seat planning window absorbs the choreography — ≤5s typical, ≤5.5s
  // at the deepest cut where the 900ms marker lands last; deal.ts pins).
  const dealing =
    derived.dealNo > dealShown && !ceremonyShowing && view.phase !== 'ceremonyCut' && view.hand.length > 0;
  // Owner bug: the hand must show NOTHING from the moment a fresh deal exists
  // until the deal choreography starts revealing it (the cut/ceremony window).
  // The dealing beat itself is not held — the fan then renders arrival slots.
  const holdFan = holdPreDealFan({
    phase: view.phase,
    dealNo: derived.dealNo,
    dealShown,
    ceremonyShowing,
    dealing,
  });
  const dirFor = (seat: Seat): 'south' | 'east' | 'north' | 'west' =>
    seat === layout.south ? 'south' : seat === layout.east ? 'east' : seat === layout.north ? 'north' : 'west';
  // Hand 1 deals FROM the first drawer (public, from the ceremony) so the
  // marker lands at its true beat; hands 2+ keep the default south-first
  // order. The marker card AND its deal beat come straight from the public
  // ceremony payload (marker / markerDealIndex — a specific card INSTANCE at
  // a deck position, never "the 8♥": two decks mean twins). The old
  // flips-derived beat was the 2026-07-15 defect.
  const dealCeremony = dealing && derived.ceremony !== null && view.handNo === 1 ? derived.ceremony : null;
  const dealDir = dealCeremony
    ? dealDirOrder(dirFor(dealCeremony.firstDrawer), variant.turnDirection === 'clockwise')
    : undefined;
  const dealMarker = dealCeremony
    ? { card: dealCeremony.marker, beat: markerDealBeat(dealCeremony.markerDealIndex) }
    : null;
  // The suspense gate (owner rule): from the ceremony overlay until the
  // face-up marker actually LANDS, the UI must not name the leader anywhere
  // — the seat ring stays off, the headline stays generic (the visual pass
  // caught it leaking the leader behind the overlay), and the leader's
  // countdown chip stays hidden. The landing IS the reveal. UI-level
  // suspense only (the payload is public); hands 2+ and the settled table
  // are unaffected, and reduced-motion (instant deal) reveals immediately.
  const leaderConcealed = concealedLeader({
    handNo: view.handNo,
    markerSeat: derived.ceremony?.markerSeat ?? null,
    markerLanded: dealLeadRevealed,
    ceremonyShowing,
    dealing,
  });

  const tributePhase = tributeKind(hints ?? []);
  const eligible = tributeEligibleCards(hints ?? []);
  const selectedEligible =
    selectionCards.length === 1 && eligible.has(selectionCards[0]!) ? selectionCards[0]! : null;
  const tributeAction =
    tributePhase === null || selectedEligible === null
      ? null
      : tributePhase === 'payTribute'
        ? { type: 'payTribute' as const, card: selectedEligible }
        : { type: 'returnTribute' as const, card: selectedEligible };

  const inTributeCenter =
    view.phase === 'tribute' || view.phase === 'returnTribute' || view.phase === 'antiTributeDecision';
  const showAnti = derived.anti !== null;

  // A rejection clears on the next action (store.act/claim/…) or a start, so
  // whatever's still here is the latest un-acted failure — show it, dismissible.
  const lastRejection = snapshot.rejections[snapshot.rejections.length - 1];
  const showToast = lastRejection !== undefined;

  const committedSet = new Set<Seat>(view.tribute?.committed ?? []);

  // The pill: identity only (flank round) — the count is a standalone
  // SeatCount chip on the cards' other side, pass is a transient fade over
  // the cards, and the countdown lives on the headline (+ above the sort
  // pill on your turn), so no state beyond committed rides here. In
  // multi-seat self-play the pill of another HELD seat is ALSO the seat
  // switcher (the Seat 1-4 tab bar is gone — clicking the name overlay is
  // the selection): same client-local setSelectedSeat the tabs called.
  const plate = (seat: Seat) => {
    const selectable = heldSeats.length > 1 && heldSeats.includes(seat) && seat !== activeSeat;
    return (
      <SeatPlate
        seat={seat}
        name={nameFor(seat)}
        connected={room?.seats.find((s) => s.seat === seat)?.connected ?? false}
        isViewer={seat === activeSeat}
        partner={teamOf(seat) === viewerTeam && seat !== activeSeat}
        place={placeOf(view.finishOrder, seat)}
        active={(ringSeats.has(seat) || (seat === activeSeat && yourTurn)) && seat !== leaderConcealed}
        committed={inTributeCenter && committedSet.has(seat)}
        onSelect={selectable ? () => setSelectedSeat(seat) : undefined}
      />
    );
  };

  // Headline clock (refinement round item 6): the countdown moved OFF the
  // seat pills onto the turn line. The chip binds to the seat the turn
  // sentence NAMES — your own seat on your turn, else the named actor
  // (actorSeats[0], the same seat actorName reads) — never to some other
  // timed seat: concurrent deadlines are per-seat budgets and genuinely
  // diverge (the server clamps a disconnected actor's dueAt to its grace,
  // room-helpers), so a global "soonest" could pin another payer's dying
  // clock (and its urgency) on "Your turn" (panel HIGH, Codex+Grok
  // concurring). Other timed actors keep their active rings. The old pill
  // gates are relocated intact: nothing during the ceremony/the deal
  // (countdowns are meaningless before the player HAS a sorted hand),
  // nothing for the concealed hand-1 leader, and the planning word only for
  // a CONNECTED actor (a disconnected player is not thinking).
  const clockSeat = yourTurn ? activeSeat : (actorSeats[0] ?? null);
  const clockDeadline =
    clockSeat === null || clockSeat === leaderConcealed
      ? undefined
      : deadlineBySeat.get(clockSeat);
  const dueSeconds =
    ceremonyShowing || dealing || clockDeadline === undefined
      ? null
      : remainingSeconds(clockDeadline.dueAt, now);
  const clockConnected =
    clockSeat !== null && (room?.seats.find((s) => s.seat === clockSeat)?.connected ?? false);

  // The play flight (owner: cards fly face-up from the pile to the table,
  // like the deal): rendered while the fold's stamp is fresh — 2000ms covers
  // the widest bomb's staggered flight (~1050ms) PLUS the covered underlay's
  // last-landing 600ms fade — and never during the deal/ceremony (their own
  // choreography owns the table then). Keyed by the fold id so consecutive
  // plays remount cleanly.
  const playFx = derived.playFx;
  const playFlight =
    playFx !== null && !dealing && !ceremonyShowing && now - playFx.at < 2000 ? playFx : null;

  // R3 displayed-count rule (ONE ternary, spec-pinned): a hidden count
  // (null — the config says this viewer may not see it) wins over EVERYTHING,
  // the deal included (Codex audit: rendering the growing stack/label mid-deal
  // in a hidden-count room contradicts the visibility contract and then
  // visibly flips to the "—" chip at settle — SeatStack renders the chip and
  // NO backs, since a stack's length would state the number). Otherwise:
  // while the choreography runs the stack length IS the landed count (read
  // through the dealNo key, so an older deal's counters can never leak into
  // this one); the pre-deal hold (owner: nothing before cards are dealt)
  // empties remote stacks through the cut/ceremony window exactly like the
  // fan; the settled table reads the view's counts.
  const remoteCounts = remoteDealtCounts(dealtRemote, derived.dealNo);
  const stackCountFor = (seat: Seat, dir: SeatStackDir): number | null => {
    const settledCount = view.cardCounts[seat] ?? null;
    if (settledCount === null) return null;
    return dealing ? remoteCounts[dir] : holdFan ? 0 : settledCount;
  };

  // R1/R7 seat zone: the identity pill plus the seat's REAL hand OUTSIDE it,
  // as siblings — top-view logic, the pill toward the table edge, the cards
  // between the name and the centre, count adjacent on the name side
  // (identity → status → cards, one scan line). Wrapped INSIDE the existing
  // .gd-ring__seat--* cells so DealOverlay's seat-rect reads keep working
  // untouched. A finished seat keeps its place badge in the pill and shows
  // no stack and no count (R6). While dealing, each stack RESERVES its final
  // 27-card extent (review fix): DealOverlay reads its flight-target rects
  // once at mount, so the ring layout must hold still while cards land —
  // strips fill in place instead of growing the grid under the flights.
  // Flank round (owner items 1-2): the zone is a flex line along the seat's
  // own handedness — the NAME pill at the seat's RIGHT HAND (the same
  // top-view translation R10 uses: north's right is the screen's left,
  // east's is its strip top, west's is its strip bottom), the cards in the
  // middle, and the COUNT chip at the opposite end. DOM order is always
  // [pill, cards, count]; the CSS turns it into a row for north and a
  // column for east — west flips with column-reverse, which is what puts
  // its pill at the strip's bottom. Nothing overlaps the cards; PASS is the
  // one exception and it is transient — a fade over the block that lets go
  // after ~2s (the .gd-seatzone__pass animation), keyed per seat so a new
  // trick's pass replays it.
  const seatZone = (dir: SeatStackDir) => {
    const seat = layout[dir];
    const finished = placeOf(view.finishOrder, seat) !== null;
    const count = finished ? null : stackCountFor(seat, dir);
    const reserve = dealing ? HAND_SIZE : undefined;
    // Finished seats and the pre-deal hold show no chip at all (undefined);
    // a hidden-count seat shows the "—" chip (null); the deal counts up
    // from 0 in place.
    const chipCount = finished || (count === 0 && !dealing) ? undefined : count;
    // Mirrors SeatStack's own render gate: backs exist only for an unfinished
    // seat with a visible count and a non-zero sized extent. Only then do
    // north's flanks hang absolutely (--flanked) — a zone WITHOUT a block
    // (finished badge, hidden-count "—", the pre-deal hold) keeps everything
    // in flow, so nothing anchors to a collapsed box (panel MED, Grok).
    const hasStack = !finished && count !== null && Math.max(count, reserve ?? 0) > 0;
    // The pass fade renders from the fold's wall-clock stamp, not the durable
    // passed set: a zone remount (seat-tab switch) after the fade has let go
    // must never replay it (panel MED, Codex + Grok concurring). 3s covers
    // the 2.8s animation; the `now` tick — which runs for fresh passes even
    // in an untimed room (see the tick effect) — unmounts it right after.
    // And only over a real block — a hidden-count zone has no cards to fade
    // over (the feed still records the pass).
    const passedStamp = derived.passedAt[seat];
    const passFresh = hasStack && passedStamp !== undefined && now - passedStamp < 3000;
    return (
      <div
        className={`gd-seatzone gd-seatzone--${dir}${hasStack ? ' gd-seatzone--flanked' : ''}`}
      >
        {plate(seat)}
        {hasStack && (
          <span className="gd-seatzone__stackwrap">
            <SeatStack dir={dir} count={count} reserve={reserve} />
            {passFresh && (
              <span className="gd-seatzone__pass" aria-hidden="true">
                {t('game.action.pass')}
              </span>
            )}
          </span>
        )}
        <SeatCount count={chipCount} dealing={dealing} />
      </div>
    );
  };

  const act = (action: GuandanAction) => {
    store.act(activeSeat, action);
    setSelected(new Set());
    setChooserOpen(false);
  };

  return (
    <section className="gd-table gd-ring">
      <TableHeadline
        levels={view.levels}
        aAttempts={view.aAttempts}
        aAttemptsExhausted={view.aAttemptsExhausted}
        viewerTeam={viewerTeam}
        playingTeam={playingLevelTeam(view.declarerTeam, view.levels, view.currentLevel)}
        yourTurn={leaderConcealed !== null ? false : yourTurn}
        actorName={leaderConcealed !== null ? null : actorName}
        dueSeconds={leaderConcealed !== null ? null : dueSeconds}
        planning={clockDeadline?.timingClass === 'planning' && clockConnected}
      />

      {/* The ring: you at the bottom, partner across the top, opponents left
          and right flanking a bounded centre (trick / tribute). seatLayout
          already maps the directions — this is the visual frame for them. */}
      <div className="gd-ring__table">
        <div className="gd-ring__seat gd-ring__seat--north">{seatZone('north')}</div>
        <div className="gd-ring__seat gd-ring__seat--west">{seatZone('west')}</div>
        <div className="gd-ring__center">
          {view.phase === 'ceremonyCut' && view.ceremonyCutter !== null ? (
            // Item 3: the REAL cut — one actor, three spectators, all named.
            <CutPanel
              cutter={view.ceremonyCutter}
              isCutter={view.ceremonyCutter === activeSeat}
              flips={view.ceremonyFlips ?? []}
              level={view.currentLevel}
              nameFor={nameFor}
              onCut={(position) => act({ type: 'cutDeck', position })}
            />
          ) : inTributeCenter || showAnti ? (
            <TributePanel view={view} nameFor={nameFor} antiReveals={derived.anti} />
          ) : (
            <TrickWell
              trick={view.trick}
              level={view.currentLevel}
              sweepKey={derived.sweep}
              covered={playFlight !== null ? playFlight.covered : null}
              coveredKey={playFlight !== null ? playFlight.id : undefined}
            />
          )}
        </div>
        <div className="gd-ring__seat gd-ring__seat--east">{seatZone('east')}</div>
      </div>

      {/* Your zone: hand (full width) first, then an actions row directly
          below it — never across the table — then the bottom bar (owner
          round: the log moved off the ring's south slot down here, on the
          same line as your own seat plate, so the hand fan sits closer to
          the trick well). The sort toggle moved BELOW the fan (quiet-table
          round): it's a secondary per-client preference, not a primary
          action, so it no longer sits above the cards competing with them
          for the first thing the eye meets. */}
      <div className="gd-handzone">
        <HandFan
          hand={view.hand}
          level={view.currentLevel}
          selected={selected}
          onToggle={(i) =>
            setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(i)) next.delete(i);
              else next.add(i);
              return next;
            })
          }
          glow={eligible}
          descending={handDescending}
          revealed={dealing ? (dealRevealed ?? 0) : undefined}
          dealOrder={dealing ? derived.dealOrder : undefined}
          hidden={holdFan}
        />

        {/* 3-column grid, ActionBar centered in the middle cell and the sort
            pill right-aligned in the right cell — three ALWAYS-present grid
            cells (not conditional siblings) so Play/Pass stay centered
            whether or not the sort pill renders, and the pill sits far
            enough from Pass to avoid a mis-tap (owner rule: secondary
            control at the edge, primary actions centered). */}
        <div className="gd-actionsRow">
          <div className="gd-actionsRow__spacer" aria-hidden="true" />
          <div className="gd-actionsRow__bar">
            {view.phase !== 'ceremonyCut' && (
              <ActionBar
                hints={hints}
                phase={view.phase}
                level={view.currentLevel}
                matches={matches}
                passAvailable={hints !== null && hints.some((h) => h.type === 'pass')}
                selectionCount={selected.size}
                tributeAction={tributeAction}
                tributePhase={tributePhase}
                chooserOpen={chooserOpen}
                onPlay={(match) => act({ type: 'play', cards: match.cards, decl: match.decl })}
                onOpenChooser={() => setChooserOpen(true)}
                onCloseChooser={() => setChooserOpen(false)}
                onPass={() => act({ type: 'pass' })}
                onTribute={() => {
                  if (tributeAction !== null) act(tributeAction);
                }}
                onAntiDecision={(invoke) => act({ type: 'antiTributeDecision', invoke })}
              />
            )}
          </div>
          <div className="gd-actionsRow__sort">
            {/* Your OWN turn's clock, doubled next to your controls (owner
                item 3: "if it is the player's turn the additional countdown
                can show above" the sort pill) — the same number the headline
                chip shows, so your eyes never have to leave your hand. Same
                urgency rule (≤10s). */}
            {yourTurn && leaderConcealed === null && dueSeconds !== null && (
              <span
                className={`gd-handclock${dueSeconds <= 10 ? ' gd-handclock--urgent' : ''}`}
                aria-label={t('game.turn.countdown', { seconds: dueSeconds })}
              >
                {dueSeconds}
              </span>
            )}
            {/* Owner rule: the sort toggle is meaningless until the player has
                all cards, sorted — hidden through the cut/ceremony/deal (the
                same pre-deal hold that empties the fan) and while dealing. */}
            {!holdFan && !dealing && (
              <button
                type="button"
                className="gd-handSort"
                aria-label={t('game.sort.label')}
                aria-pressed={handDescending}
                onClick={toggleHandSort}
              >
                {handDescending ? t('game.sort.descending') : t('game.sort.ascending')}
              </button>
            )}
          </div>
        </div>

        {/* Your own seat plate — the SAME element the ring's south slot used
            to render (plate(layout.south) === plate(activeSeat), seatLayout's
            invariant) — now sits beside the log on one line, thinning the
            ring by a full grid row. */}
        <div className="gd-bottombar">
          {plate(layout.south)}
          <EventFeed lines={derived.feed} />
        </div>
      </div>

      {showToast && lastRejection !== undefined && (
        <div className="gd-toast" role="alert">
          <span>{describeError(lastRejection.error.code)}</span>
          <button type="button" onClick={() => store.clearRejections()}>
            {t('game.action.dismiss')}
          </button>
        </div>
      )}

      {ceremonyShowing && derived.ceremony !== null && (
        <CeremonyOverlay
          ceremony={derived.ceremony}
          level={view.currentLevel}
          twoCard={variant.ceremonyCardCount === 2}
          nameFor={nameFor}
          onDone={() => setCeremonyDone(true)}
        />
      )}

      {playFlight !== null && (
        <PlayOverlay
          key={playFlight.id}
          dir={dirFor(playFlight.seat)}
          cards={playFlight.cards}
          level={view.currentLevel}
        />
      )}

      {dealing && (
        <DealOverlay
          key={derived.dealNo}
          dirOrder={dealDir}
          marker={dealMarker}
          level={view.currentLevel}
          onOwnLanded={setDealRevealed}
          onMarkerLanded={() => setDealLeadRevealed(true)}
          onRemoteLanded={(dir) => setDealtRemote((prev) => landRemoteDealt(prev, derived.dealNo, dir))}
          onDone={() => {
            setDealShown(derived.dealNo);
            setDealRevealed(null);
            setDealLeadRevealed(false);
          }}
        />
      )}

      {view.matchWinner !== null && (
        <ResultOverlay
          winnerTeam={view.matchWinner}
          viewerTeam={viewerTeam}
          levels={view.levels}
          nameFor={nameFor}
        />
      )}
    </section>
  );
}


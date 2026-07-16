// <GameTable/> — the M3 Guandan table UI. The shell contract is unchanged:
// per-seat views/hints come from the RoomSnapshot, the active-seat tab bar
// drives multi-seat self-play (PLAN §4), and every panel renders the ACTIVE
// seat's view. Internals: the Lacquer Ledger seat RING (you bottom, partner
// across, opponents flanking a bounded centre), a TableHeadline topbar
// (the level (rank) / wild / whose-turn) as the signature, value-dependent seat
// plates, HandFan selection → hint matching → ActionBar, trick well /
// tribute panel, hand-1 draw ceremony, result overlay, event feed.
//
// The store keeps only each seat's LATEST event batch (view-carrying
// events, PLAN §5) — so trick-local presentation state (pass markers,
// jiefeng banner, anti-tribute reveals, the ceremony payload, the feed) is folded
// here from batches as they arrive.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Seat } from '../engine/core/game';
import { teamOf } from '../engine/guandan/types';
import type { GuandanAction, GuandanEvent } from '../engine/guandan/types';
import type { Card, Rank } from '../engine/guandan/cards';
import type { RoomSnapshot, RoomStore } from './room/store';
import { ActionBar } from './table/ActionBar';
import { CeremonyOverlay } from './table/CeremonyOverlay';
import { CutPanel } from './table/CutPanel';
import { DealOverlay } from './table/DealOverlay';
import { dealDirOrder, markerDealBeat } from './table/deal';
import { EventFeed, FEED_LIMIT, type FeedLine } from './table/EventFeed';
import { HandFan } from './table/HandFan';
import { TableHeadline } from './table/TableHeadline';
import { ResultOverlay } from './table/ResultOverlay';
import { SeatPlate } from './table/SeatPlate';
import { TributePanel } from './table/TributePanel';
import { TrickWell } from './table/TrickWell';
import {
  activeSeats,
  asGuandanEvents,
  asGuandanView,
  asRuleVariant,
  declJokerRank,
  concealedLeader,
  isCeremonyShowing,
  matchSelection,
  multisetKey,
  placeOf,
  rankText,
  seatLayout,
  tributeEligibleCards,
  tributeKind,
  type Ceremony,
  type PlayMatch,
} from './table/helpers';
import { t } from './i18n';
import { describeError } from './errors';
import { activeDeckTheme } from './table/theme';
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
        push('game.feed.passed', { name: nameFor(ev.seat) });
        break;
      case 'trickWon':
        d = { ...d, passed: [], anti: null, sweep: d.sweep + 1 };
        push('game.feed.trickWon', { name: nameFor(ev.seat) });
        break;
      case 'jiefeng':
        d.jiefeng = { finisher: ev.finisher, leader: ev.leader };
        push('game.feed.jiefeng', { name: nameFor(ev.leader) });
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

  // Fold newly arrived event batches into per-seat presentation state.
  useEffect(() => {
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

  // Countdown tick — only while a deadline is outstanding.
  const deadlines = snapshot.deadlines;
  useEffect(() => {
    if (deadlines.length === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [deadlines.length]);

  // The selected tab must always be a seat we still hold (a takeover by
  // another tab can shrink the held set); fall back to the lowest seat.
  const firstSeat = heldSeats[0] as Seat | undefined;
  const activeSeat =
    selectedSeat !== null && heldSeats.includes(selectedSeat) ? selectedSeat : firstSeat;
  const perSeat = activeSeat === undefined ? undefined : snapshot.perSeat.get(activeSeat);
  const view = perSeat === undefined ? null : asGuandanView(perSeat.view);
  const hints =
    perSeat?.hints == null ? null : (perSeat.hints as GuandanAction[]);

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

  if (activeSeat === undefined) {
    // Connected without any seat token (e.g. joined a game already going):
    // nothing to render — per-seat views only flow to token holders (PLAN §4).
    return <p>{t('room.spectating')}</p>;
  }

  const derived = derivedBySeat.get(activeSeat) ?? EMPTY_DERIVED;

  if (view === null) {
    return (
      <section className="gd-table">
        <SeatTabs heldSeats={heldSeats} activeSeat={activeSeat} onSelect={setSelectedSeat} />
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
    ? {
        card: dealCeremony.marker,
        beat: markerDealBeat(dealCeremony.markerDealIndex),
        leaderName: nameFor(dealCeremony.markerSeat),
      }
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

  const plate = (seat: Seat) => (
    <SeatPlate
      seat={seat}
      name={nameFor(seat)}
      connected={room?.seats.find((s) => s.seat === seat)?.connected ?? false}
      isViewer={seat === activeSeat}
      partner={teamOf(seat) === viewerTeam && seat !== activeSeat}
      cardCount={view.cardCounts[seat] ?? null}
      place={placeOf(view.finishOrder, seat)}
      active={(ringSeats.has(seat) || (seat === activeSeat && yourTurn)) && seat !== leaderConcealed}
      dueAt={
        // Owner rule (live-build feedback): countdown chips — the planning
        // window included — appear only once the player HAS their sorted
        // hand; during the ceremony and the deal they are meaningless.
        ceremonyShowing || dealing || seat === leaderConcealed
          ? null
          : (deadlineBySeat.get(seat)?.dueAt ?? null)
      }
      planning={deadlineBySeat.get(seat)?.timingClass === 'planning'}
      dimTimer={ceremonyShowing}
      now={now}
      passed={derived.passed.includes(seat)}
      committed={inTributeCenter && committedSet.has(seat)}
    />
  );

  const act = (action: GuandanAction) => {
    store.act(activeSeat, action);
    setSelected(new Set());
    setChooserOpen(false);
  };

  // Item 5: the active theme's back tokens ride CSS vars, so the F11
  // mini-fan (framework-owned geometry) renders any theme's back colors.
  const themeMetrics = activeDeckTheme().metrics;

  return (
    <section
      className="gd-table gd-ring"
      style={
        {
          '--theme-back-edge': themeMetrics.backEdge,
          '--theme-back-gradient': themeMetrics.backGradient,
        } as CSSProperties
      }
    >
      <SeatTabs heldSeats={heldSeats} activeSeat={activeSeat} onSelect={setSelectedSeat} />

      <TableHeadline
        currentLevel={view.currentLevel}
        levels={view.levels}
        aAttempts={view.aAttempts}
        aAttemptsExhausted={view.aAttemptsExhausted}
        viewerTeam={viewerTeam}
        yourTurn={leaderConcealed !== null ? false : yourTurn}
        actorName={leaderConcealed !== null ? null : actorName}
      />

      {/* The ring: you at the bottom, partner across the top, opponents left
          and right flanking a bounded centre (trick / tribute). seatLayout
          already maps the directions — this is the visual frame for them. */}
      <div className="gd-ring__table">
        <div className="gd-ring__seat gd-ring__seat--north">{plate(layout.north)}</div>
        <div className="gd-ring__seat gd-ring__seat--west">{plate(layout.west)}</div>
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
              nameFor={nameFor}
              sweepKey={derived.sweep}
              jiefeng={derived.jiefeng}
              viewerSeat={activeSeat}
              concealLeader={dealing || leaderConcealed !== null}
            />
          )}
        </div>
        <div className="gd-ring__seat gd-ring__seat--east">{plate(layout.east)}</div>
        <div className="gd-ring__seat gd-ring__seat--south">{plate(layout.south)}</div>
      </div>

      {/* Your zone: game log, then your hand (full width) with its action bar
          and sort toggle directly adjacent — never across the table. */}
      <div className="gd-handzone">
        <EventFeed lines={derived.feed} />
        <div className="gd-handzone__sortrow">
          {/* Owner rule: the sort toggle is meaningless until the player has
              all cards, sorted — hidden through the cut/ceremony/deal. */}
          {view.phase !== 'ceremonyCut' && !ceremonyShowing && !dealing && (
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
        />
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

      {dealing && (
        <DealOverlay
          key={derived.dealNo}
          dirOrder={dealDir}
          marker={dealMarker}
          level={view.currentLevel}
          onOwnLanded={setDealRevealed}
          onMarkerLanded={() => setDealLeadRevealed(true)}
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

function SeatTabs({
  heldSeats,
  activeSeat,
  onSelect,
}: {
  heldSeats: Seat[];
  activeSeat: Seat;
  onSelect: (seat: Seat) => void;
}) {
  if (heldSeats.length <= 1) return null;
  return (
    <nav className="gd-tabs" aria-label={t('room.seatTabsLabel')}>
      {heldSeats.map((seat) => (
        <button
          key={seat}
          type="button"
          disabled={seat === activeSeat}
          onClick={() => onSelect(seat)}
        >
          {t('room.seatTab', { seat: seat + 1 })}
        </button>
      ))}
    </nav>
  );
}

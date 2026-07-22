// Lobby screen (M3 shell, PLAN.md §4 lobby phase). Owner-designed redesign:
// a SEPARATE name panel above a round card table. The table is a felt disc
// with a rosewood rim — the thing people gather around — carrying the room
// code and its copy-link button ON the felt. Four seats sit around it in
// FIXED geographic positions (0 bottom, 1 right, 2 top, 3 left) that never
// re-anchor to the viewer, so partners (0&2, 1&3) always face ACROSS the
// table and the geometry itself carries the team structure. Each empty seat
// is a take-a-seat button that claims EXACTLY that seat (multi-seat self-play
// stays: one client may claim several seats, one name typed per claim); a
// held seat shows a connection dot, the name, a you-badge, and a leave button.

import { useEffect, useRef, useState } from 'react';
import type { Seat } from '../engine/core/game';
import type { RoomInfo } from '../shared/protocol';
import type { RoomSnapshot, RoomStore } from './room/store';
import { RulePicker } from './RulePicker';
import { TimingPicker } from './TimingPicker';
import { roomHash } from './router';
import { t, type TranslationKey } from './i18n';

export interface LobbyProps {
  snapshot: RoomSnapshot;
  store: RoomStore;
}

/** The rule & timing pickers are editable only in the lobby AND only once you
 *  hold a seat (pre-M5 F3): an unseated player's edit is server-rejected, so
 *  the pickers must READ as disabled-until-seated rather than look editable
 *  and fail with a rejection. Pure + exported for the unit test (the client
 *  suite is DOM-free, so this predicate is the testable gate). */
export function configEditable(status: RoomInfo['status'], holdsSeat: boolean): boolean {
  return status === 'lobby' && holdsSeat;
}

type CopyState = 'idle' | 'copied' | 'failed';

/** The four seats in a FIXED render order (owner design §3). This order is
 *  the DOM order of the chips and never re-anchors to the viewer — geography
 *  is the identity, so seat 0 is always bottom, 1 right, 2 top, 3 left, and
 *  partners always sit across. */
const SEATS: readonly Seat[] = [0, 1, 2, 3];

/** Localized position word per seat, for aria ONLY (§4): the visual carries
 *  no seat index, but assistive tech still needs to tell the four
 *  take-a-seat buttons apart, so their accessible names name the position. */
const POSITION_KEY: Record<number, TranslationKey> = {
  0: 'lobby.position.bottom',
  1: 'lobby.position.right',
  2: 'lobby.position.top',
  3: 'lobby.position.left',
};

/** A take-a-seat button claims EXACTLY its own seat with the panel's trimmed
 *  name, then resets the panel to empty (the returned next value). The seat
 *  is always the button's own index — there is never a defaulted target
 *  (owner bugs: the old first-empty-seat form both submitted to the WRONG
 *  seat and let a pre-filled name MIGRATE). Clearing the name on every claim
 *  is what stops it pre-filling or migrating to another seat. Pure over the
 *  store (a recorder in tests) so the seat→claimSeat(_, seat) mapping and the
 *  name-clear are both unit-pinned with no DOM.
 *
 *  Silent-no-op round: this is THE one claim path — both orders (name-then-
 *  sit and sit-then-name) end here, so the seat token is minted exactly as
 *  before, once, when name+seat are both resolved. The sit-then-name panel
 *  reorders UI steps only; it never grows a second claim call. */
export function takeSeat(store: RoomStore, name: string, seat: Seat): string {
  store.claim(name.trim(), seat);
  return '';
}

/** Pure route for a Sit press (silent-no-op round, item 2): with a ready
 *  name the press claims directly (the unchanged fast path); without one
 *  it must OPEN THE ASK PANEL — never nothing. The playtest bug was the
 *  disabled button's silence, so the decision is pinned as a function. */
export function sitIntent(nameReady: boolean): 'claim' | 'ask' {
  return nameReady ? 'claim' : 'ask';
}

/** The sit-then-name form, rendered in the SEAT DRAWER (item 1b — a
 *  full-width row inserted into the lobby grid adjacent to the pressed
 *  seat; it replaced the earlier on-disc placement, which the proximity
 *  research and the owner's playtest both found too disconnected from
 *  the seat). Exported for DOM-free render pins of its three states:
 *  asking, needs-a-name, and the race-loser message. */
export function SitAskPanel({
  position,
  name,
  needName,
  taken,
  claiming,
  connected,
  onName,
  onConfirm,
  onCancel,
}: {
  /** Localized position word of the target seat (bottom/right/top/left). */
  position: string;
  name: string;
  /** True after a confirm attempt with a blank name — the inline
   *  explanation, never a silently disabled button. */
  needName: boolean;
  /** True when the seat was claimed by someone else mid-entry (the DO
   *  serialized the race and this client lost) — an explicit message,
   *  never a silent no-op. */
  taken: boolean;
  /** True while this panel's claim is in flight (panel MED fix): the
   *  confirm locks and the hint SAYS so — a double-tap must not send a
   *  duplicate claimSeat, and the wait must never look like silence. */
  claiming: boolean;
  /** Mirrors the take buttons' one allowed disable: disconnection (the
   *  room-level alert carries the explanation). */
  connected: boolean;
  onName: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (taken) {
    return (
      <div className="lobby-sitask" role="alert">
        <p className="lobby-sitask__taken">{t('lobby.sitAsk.taken')}</p>
        <button type="button" className="lobby-sitask__cancel" onClick={onCancel}>
          {t('lobby.sitAsk.takenDismiss')}
        </button>
      </div>
    );
  }
  return (
    <div className="lobby-sitask">
      <p className="lobby-sitask__title">{t('lobby.sitAsk.title', { position })}</p>
      <input
        className="lobby-sitask__input"
        type="text"
        value={name}
        onChange={(e) => onName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onConfirm();
        }}
        placeholder={t('lobby.namePlaceholder')}
        maxLength={32}
        autoFocus
      />
      <p className="lobby-sitask__hint" role={needName ? 'alert' : undefined}>
        {needName
          ? t('lobby.sitAsk.needName')
          : claiming
            ? t('lobby.sitAsk.claiming')
            : t('lobby.sitAsk.prompt')}
      </p>
      <span className="lobby-sitask__row">
        <button
          type="button"
          className="lobby-sitask__confirm"
          disabled={claiming || !connected}
          onClick={onConfirm}
        >
          {t('lobby.sitAsk.confirm')}
        </button>
        <button type="button" className="lobby-sitask__cancel" onClick={onCancel}>
          {t('lobby.sitAsk.cancel')}
        </button>
      </span>
    </div>
  );
}

/** Last-used player name (research adoption: elders usually just confirm a
 *  prefilled name in the sit-then-name prompt). Same localStorage idiom as
 *  the hand-sort preference — client-only, never room state. */
const PLAYER_NAME_STORAGE_KEY = 'pref:playerName';

function readLastName(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem(PLAYER_NAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeLastName(name: string): void {
  try {
    localStorage.setItem(PLAYER_NAME_STORAGE_KEY, name);
  } catch {
    // localStorage unavailable — the prefill just stays session-local.
  }
}

/** Blank-when-ambiguous prefill (prefill-visibility round, item 1a). The
 *  remembered name is a SAME-PERSON convenience (rejoining, the next
 *  room) — it must never hand a DIFFERENT person a stranger's name to
 *  delete first. Diagnosis note: the browser-profile localStorage scope
 *  is the DESIGNED behavior (sit-then-name round), not state residue —
 *  what was too coarse is the ambiguity rule. Two signals kill the
 *  prefill: this client already holds a seat in THIS room (the next
 *  claim is for someone else — a shared device or multi-seat
 *  self-play), or the remembered name is already seated on the roster
 *  (prefilling would duplicate an identity already at the table). Pure +
 *  exported for the pins. */
export function sitAskPrefill(
  lastName: string,
  holdsSeatAlready: boolean,
  seatedNames: readonly string[],
): string {
  const trimmed = lastName.trim();
  if (trimmed.length === 0) return '';
  if (holdsSeatAlready) return '';
  if (seatedNames.includes(trimmed)) return '';
  return trimmed;
}

export function Lobby({ snapshot, store }: LobbyProps) {
  const [name, setName] = useState('');
  const [copyState, setCopyState] = useState<CopyState>('idle');
  // Sit-then-name (silent-no-op round item 2): the seat a nameless Sit
  // press asked about (null = no ask open), the prompt's own transient
  // input, and whether an empty confirm was attempted (the inline
  // explanation state). The ask NEVER claims by itself — its confirm
  // routes through the same takeSeat as the name-first flow.
  const [sitAsk, setSitAsk] = useState<Seat | null>(null);
  const [sitAskName, setSitAskName] = useState('');
  const [sitAskNeedName, setSitAskNeedName] = useState(false);
  // In-flight guard (panel MED, Codex + Grok concurring): elders double-tap,
  // and an unguarded confirm sent DUPLICATE claimSeat messages — the DO
  // rejects the second without minting (authority safe), but the surfaced
  // seat.taken rejection after a SUCCESSFUL sit reads as failure. While
  // claiming, the confirm disables and the hint says so (visible, never a
  // bare dead button).
  const [sitAskClaiming, setSitAskClaiming] = useState(false);
  // The in-flight window (cumulative panel MED, Codex): right after ANY
  // claim from this client, writeLastName has already stored the
  // submitted name while snapshot.seats has not yet echoed — a fast
  // retarget would prefill the just-claimed identity into the new ask,
  // sidestepping blank-when-ambiguous. A fresh-claim stamp widens the
  // holds-a-seat signal across that lag (10s ≫ any echo).
  const lastClaimAtRef = useRef(0);
  const room = snapshot.room as RoomInfo; // RoomPage only renders Lobby with a room

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = setTimeout(() => setCopyState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [copyState]);

  // The ask closes itself the moment ITS seat becomes ours — the claim
  // round-tripped and succeeded (the DO is the authority; the UI only
  // reacts). A seat claimed by SOMEONE ELSE flips the panel to the
  // explicit race-loser message instead (sitAskTaken below) — losing a
  // race must never be a silent no-op either.
  useEffect(() => {
    if (sitAsk !== null && snapshot.seats.has(sitAsk)) {
      setSitAsk(null);
      setSitAskName('');
      setSitAskNeedName(false);
      setSitAskClaiming(false);
    }
  }, [snapshot, sitAsk]);

  // Unwedge: a NEW rejection releases the in-flight guard — a claim that
  // failed for a reason the roster never reflects (transport hiccup, an
  // invalid-name server rule) must hand the form back, not wedge the panel
  // in "sitting down" forever. Growth only: store.claim itself CLEARS old
  // rejections, and a shrinking count must not release a just-armed lock.
  const rejectionCount = snapshot.rejections.length;
  const prevRejectionsRef = useRef(rejectionCount);
  useEffect(() => {
    if (rejectionCount > prevRejectionsRef.current) setSitAskClaiming(false);
    prevRejectionsRef.current = rejectionCount;
  }, [rejectionCount]);

  // Seat status is read against the FIXED 0..3 set, never against whatever
  // subset room.seats happens to carry (owner bug 6c: a short/partial roster
  // must not collapse the ring to a lone card — every seat below renders a
  // chip regardless).
  const claimedOf = (s: Seat): boolean =>
    room.seats.find((x) => x.seat === s)?.claimed ?? false;
  const freeSeats = SEATS.filter((s) => !claimedOf(s)).length;
  const allClaimed = freeSeats === 0;
  const holdsSeat = snapshot.seats.size > 0;
  const editable = configEditable(room.status, holdsSeat);
  const nameReady = name.trim().length > 0;
  // Start rule (PLAN §4): any seated player may start once all seats are
  // claimed. The server re-validates; this only gates the button.
  const canStart = snapshot.connected && holdsSeat && allClaimed;

  const startReason = !allClaimed
    ? t('lobby.waitingForSeats', { count: freeSeats })
    : !holdsSeat
      ? t('lobby.startNeedSeat')
      : !snapshot.connected
        ? t('room.statusDisconnected')
        : null;

  const copyLink = async () => {
    const url = `${location.origin}${location.pathname}${roomHash(store.code)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
    } catch {
      // clipboard unavailable (insecure context / permission denied)
      setCopyState('failed');
    }
  };

  const seatChip = (s: Seat) => {
    const seat = room.seats.find((x) => x.seat === s);
    const claimed = seat?.claimed ?? false;
    const isYou = snapshot.seats.has(s);
    const positionLabel = t(POSITION_KEY[s]!);
    // Silent-no-op round: the take button is NO LONGER disabled while the
    // name is blank (NN/g + GOV.UK: a disabled button with no explanation
    // is the anti-pattern this playtest hit). A nameless press opens the
    // sit-then-name ask instead — ALWAYS a visible response. Disabled only
    // while disconnected (a transient transport state, shown elsewhere).
    const asking = sitAsk === s;
    return (
      <div
        key={s}
        className={`lobby-tableseat lobby-tableseat--s${s}${asking ? ' lobby-tableseat--asking' : ''}`}
      >
        <div
          className={[
            'lobby-seat',
            claimed ? 'lobby-seat--taken' : 'lobby-seat--empty',
            asking ? 'lobby-seat--asking' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {claimed ? (
            <>
              <span className="lobby-seat__row">
                <span
                  className={
                    seat!.connected
                      ? 'lobby-seat__dot lobby-seat__dot--on'
                      : 'lobby-seat__dot lobby-seat__dot--off'
                  }
                  role="img"
                  aria-label={
                    seat!.connected ? t('lobby.seatConnected') : t('lobby.seatDisconnected')
                  }
                />
                <span className="lobby-seat__name">{seat!.name ?? ''}</span>
                {isYou && <span className="lobby-seat__you">{t('lobby.seatYou')}</span>}
              </span>
              {isYou && (
                <button
                  type="button"
                  className="lobby-seat__leave"
                  onClick={() => store.release(s)}
                >
                  {t('lobby.leaveSeat')}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="lobby-seat__take"
              disabled={!snapshot.connected}
              // Aria carries the position word so the four otherwise-identical
              // take-a-seat buttons are distinguishable (§4); the visible label
              // is the same plain "take a seat" for every seat.
              aria-label={t('lobby.takeSeatAt', { position: positionLabel })}
              onClick={() => {
                if (sitIntent(nameReady) === 'claim') {
                  lastClaimAtRef.current = Date.now();
                  setName(takeSeat(store, name, s));
                  writeLastName(name.trim());
                  // A direct claim SUPERSEDES any open ask (cumulative
                  // panel MED 2: name-then-sit for seat B while seat A's
                  // drawer was open left an orphan drawer).
                  setSitAsk(null);
                  setSitAskName('');
                  setSitAskNeedName(false);
                  setSitAskClaiming(false);
                } else {
                  setSitAsk(s);
                  setSitAskName(
                    sitAskPrefill(
                      readLastName(),
                      snapshot.seats.size > 0 || Date.now() - lastClaimAtRef.current < 10_000,
                      room.seats.filter((x) => x.claimed).map((x) => x.name ?? ''),
                    ),
                  );
                  setSitAskNeedName(false);
                  // A retarget is a NEW ask session (cumulative panel MED
                  // 1: an in-flight lock carried onto the new seat wedged
                  // its drawer in "sitting down" — the old flight belongs
                  // to the old seat; the DO serializes both regardless).
                  setSitAskClaiming(false);
                }
              }}
            >
              {t('lobby.claimButton')}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="lobby">
      <h2 className="lobby-heading">{t('lobby.heading')}</h2>

      {/* Name panel (§1): a SEPARATE input above the table. Deliberately NOT a
          <form> — Enter/submit here must claim NOTHING (there is no default
          seat; you claim only by clicking a specific chip, owner bug 6b). */}
      <div className="lobby-namepanel">
        <label className="lobby-namepanel__label" htmlFor="lobby-name">
          {t('lobby.nameLabel')}
        </label>
        <input
          id="lobby-name"
          className="lobby-namepanel__input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('lobby.namePlaceholder')}
          maxLength={32}
        />
        <p className="lobby-namepanel__hint">{t('lobby.nameHint')}</p>
      </div>

      {/* The round table (§2): a felt disc with a rosewood rim ring. The room
          code and its copy-link button live ON the felt, centered — the table
          earns its existence as the thing people gather around. Four seats
          (§3) sit around it in FIXED geographic positions, so partners face
          across. */}
      {/* The seat DRAWER grid (item 1b, docs/research/seat-entry-placement.md,
          P1–P3): while an ask is open the table grid gains a full-width
          drawer row ADJACENT to the pressed seat — below the top seat's
          row, below the disc row for the flanks, and ABOVE the bottom
          seat's row (P2: keyboard clearance + on-screen guarantee). The
          disc ALWAYS keeps the room code — it is never covered or
          replaced. Belongs-to is triple-signaled (research: adjacency +
          connector nub + shared accent): the nub is a ::after triangle ON
          THE PRESSED CHIP itself, so its alignment is correct by
          construction for every seat position. */}
      <div
        className={`lobby-table${
          sitAsk === null ? '' : sitAsk === 2 ? ' lobby-table--drawer-top' : ' lobby-table--drawer-mid'
        }`}
        role="group"
        aria-label={t('lobby.heading')}
      >
        <div className="lobby-table__disc">
          <span className="lobby-table__codelabel">{t('lobby.roomCode')}</span>
          <strong className="lobby-table__code">{store.code}</strong>
          <button
            type="button"
            className="lobby-table__copy"
            onClick={() => {
              void copyLink();
            }}
          >
            {t('lobby.copyLink')}
          </button>
          {/* Persistent live region: the copied-toast swaps into a reserved
              line, so announcing works and the felt never reflows. */}
          <p className="lobby-table__status" role="status">
            {copyState === 'copied'
              ? t('lobby.copied')
              : copyState === 'failed'
                ? t('lobby.copyFailed')
                : ' '}
          </p>
        </div>
        {SEATS.map((s) => seatChip(s))}
        {sitAsk !== null && (
          <div className="lobby-drawer">
            {/* Keyed by seat: a RETARGET remounts the panel, so autofocus
                re-fires on the new ask (cumulative panel LOW). */}
            <SitAskPanel
              key={sitAsk}
              position={t(POSITION_KEY[sitAsk]!)}
              name={sitAskName}
              needName={sitAskNeedName}
              taken={claimedOf(sitAsk) && !snapshot.seats.has(sitAsk)}
              claiming={sitAskClaiming}
              connected={snapshot.connected}
              onName={(value) => {
                setSitAskName(value);
                setSitAskNeedName(false);
              }}
              onConfirm={() => {
                if (sitAskClaiming) return;
                if (sitAskName.trim().length === 0) {
                  setSitAskNeedName(true);
                  return;
                }
                // The SAME single claim path as name-then-sit (takeSeat →
                // store.claim) — the drawer reorders UI steps, never the
                // authoritative claim. Success closes via the effect
                // above; a lost race flips `taken` instead; the claiming
                // lock (panel MED) makes a double-tap send exactly one
                // claimSeat.
                setSitAskClaiming(true);
                lastClaimAtRef.current = Date.now();
                takeSeat(store, sitAskName, sitAsk);
                writeLastName(sitAskName.trim());
              }}
              onCancel={() => {
                setSitAsk(null);
                setSitAskName('');
                setSitAskNeedName(false);
                setSitAskClaiming(false);
              }}
            />
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn-primary lobby-start"
        disabled={!canStart}
        onClick={() => store.start()}
      >
        {t('lobby.startButton')}
      </button>
      {startReason !== null && <p className="lobby-start__reason">{startReason}</p>}

      {/* Config-panel slot: the curated Guandan rule-picker (a subset of the
          25 RuleVariant keys over the opaque setConfig transport, PLAN
          §4/§9). Any seated player may edit; edits broadcast live via
          configChanged (RulePicker is fully controlled by room.config), and
          the panel disables itself once the match config is frozen
          (room.status !== 'lobby'). */}
      <section className="lobby-config" data-slot="config-panel">
        <h3>{t('lobby.configHeading')}</h3>
        {room.status === 'lobby' && !holdsSeat && (
          <p className="lobby-config__needSeat">{t('lobby.configNeedSeat')}</p>
        )}
        <RulePicker
          config={room.config}
          disabled={!editable}
          onChange={(config) => store.setConfig(config)}
        />
      </section>

      {/* Timing-panel slot (M4): the four-preset timing picker over the
          setTiming transport — same authority and freeze rules as the rule
          picker (any seated player edits, live via roomChanged, frozen once
          the match starts). Its legend is the panel heading. */}
      <section className="lobby-config" data-slot="timing-panel">
        <TimingPicker
          timing={room.timing}
          disabled={!editable}
          onChange={(timing) => store.setTiming(timing)}
        />
      </section>
    </section>
  );
}

# Design-refinement round — 5 items, proposal (PROPOSE stage; items 3–5 await owner pick)

**Date:** 2026-07-15 · **Status:** PROPOSAL — items 1–2 decided-and-justified below (build
authorized by the brief once stated); items 3/4/5 carry real forks and await the owner's pick.
Companion research (deck depth / deal animation / cut interaction / theme architecture) runs as
a background workflow; its digest informs items 4–5 execution, not these decisions.

## Gate buckets (stated before starting, per the brief)

| # | Item | Bucket | Why |
|---|------|--------|-----|
| 1 | Nickname edit + leave/change seat | **FULL** (authority) | Touches seat-token authority → redaction. Pure decisions + wire e2e (stale-token starvation) + panel. |
| 2 | Per-seat planning window | **FULL** (timing) | Timing-CLASS derivation change in the machinery that broke twice. Property extension + decision table + panel. |
| 3 | Real cut in 翻牌定先 | **FULL** (engine/interface) | New phase + action + state; replay, uniformity, deadlock-freedom, redaction of the committed deck. |
| 4 | Physical deal animation | **Presentation** | Client-only render of already-received state; clock interaction stated, not negotiated with the server. |
| 5 | DeckTheme framework | **Presentation** | Pure client rendering keyed on (rank, suit); engine/DO never learn it exists. Contract + conformance ratchet. |

Sub-bucket note: item 1's Lobby UI and item 3's cut UI are presentation, but they ship inside
their parent item's full gate (the e2e drives them over the wire).

---

## Item 1 — Editable nickname; leave/change seat (FULL)

### The hard line, designed explicitly
Release **invalidates at the row level**: the seat's `token_hash` is deleted from the `seats`
table. Authority is resolved by hash lookup (hello → `WHERE token_hash = ?`; actions → the
socket's held-seats set), so clearing the row kills the stale token for **every** holder
(multi-tab included) in one place — there is no cached-authority path that survives it. The
next claim mints a **fresh** token exactly as today (32 random bytes; only the hash persists).

Release must also purge the **socket→seats delivery map**: the DO walks all live sockets and
removes the released seat from any attachment holding it (same `setSeats` idiom as takeover).
After that, per-seat `event`/`resync` fan-out — which iterates held seats — simply has nothing
to deliver to the old holder. Wire e2e pins the starvation explicitly: after release,
(a) a hello presenting the stale token is granted **no seat**; (b) an action naming the seat →
`seat.notHeld`; (c) the old socket receives **zero** `event`/`resync` messages for that seat
while the new claimant receives them all (checked against the new claimant's view).

### Decisions (justified)
- **Seat changes are LOBBY-only.** Mid-match, four seats hold dealt hands and the deadline
  machinery keys on seats; "leaving" a seat mid-hand would orphan a hand (the engine has no
  concept of an unowned hand) and re-seating would be a redaction transfer with no rule to
  govern it. There is no family-game story that needs it: a player who must go stops playing
  and the disconnect machinery (grace → auto-play → Q3 pause) already models exactly that.
  Server rejects non-lobby release with `room.notLobby` (human copy exists).
- **Nickname edit works ANYTIME (lobby + in-game).** Checked: names live only in the `seats`
  row and `RoomInfo`; the engine never sees them; feed lines capture the name at fold time
  (so lines already written keep the old name — acceptable and arguably correct, like a chat
  log). Rename broadcasts `roomChanged`; every client re-renders plates/headline from the
  roster. Validation identical to claim (trim, 1..32 chars).
- **Move = release + claim, not a "swap" primitive.** `claimSeat` gains an optional
  `seat?: number` (validated: integer, in range, unclaimed) so a player can sit at a CHOSEN
  empty seat; omitted = first-free (today's behavior, backward compatible). Moving is the
  natural two-step; no new atomic swap is needed because the DO serializes — the race below
  is an ordering, not atomicity, problem.
- **The race** (you leave, someone takes it, you try to return): second claim hits an occupied
  row → new rejection code `seat.taken` with dedicated human copy 「這個座位剛被人坐下」/
  "Someone just took that seat" (added to describeError + the complete-inventory ratchet).
  The roster broadcast keeps every lobby live, so the UI already shows who sat down.
- **Multi-seat/self-play:** release takes an explicit `seat` parameter and touches only that
  seat; the connection keeps its other tokens. e2e covers a 2-seat holder releasing one.

### Wire protocol (additive, v:1 unchanged)
```
client→server:  { v:1, type:'releaseSeat', seat }        // lobby-only, holder-only
                { v:1, type:'renameSeat',  seat, name }   // anytime, holder-only
                claimSeat gains optional `seat?: number`
server→client:  { v:1, type:'seatReleased', seat, seq }   // broadcast; roster + credential prune
```
Store: reducer case for `seatReleased` (patch roster; drop own credential + persist),
`release(seat)` / `rename(seat, name)` senders (clearRejections first, like the others).
Lobby UI: on each of MY claimed plates — 離座 + a small rename affordance; empty plates keep
the claim form (now clickable on ANY empty seat, not only the first).

---

## Item 2 — The planning window is PER-SEAT (FULL)

### Design
Replace the global fragile predicate (`phase==='playing' && top===null && held===108` — whose
own comment admits its fragility and deliberately excluded tribute) with an explicit per-seat
flag in `GuandanState`:

```
actedThisHand: [boolean, boolean, boolean, boolean]   // reset to all-false at every DEAL
```
Set to `true` for seat S the first time S's action **applies** in that hand — play, pass,
payTribute, returnTribute, antiTributeDecision alike. The class derivation becomes:

```
timingClass(state, seat) = actedThisHand[seat] ? 'turn' : 'planning'
```

Interface change (PLAN §3): `timingClass?(state: S): TimingClass` →
`timingClass?(state: S, seat: Seat): TimingClass`. The room layer stays game-agnostic: it
already asks per expected actor; `classFor(game, state, seat)` and `nextDeadlines` carry a
per-seat class instead of one shared class (the M4 decision table is otherwise unchanged —
budget for a NEWLY-acting seat = `timeoutMsFor(timing, class(seat))`; a seat that remains an
actor keeps its base; grace clamps unchanged).

### Decisions (justified)
- **Tribute CONSUMES the seat's window — yes** (owner's lean, adopted). It is a hand-reading
  decision over the freshly dealt 27; that is precisely what the window is for. Consequence
  accepted deliberately: non-tributing seats effectively get free sorting time during the
  tribute phase AND keep their own window for trick 1 — generous, correct for a family game,
  and *simpler* (one uniform rule: your first applied action this hand is your planning
  action, whatever the phase). The old "tribute is a small forced choice" argument dies with
  the old global predicate: the point was never the choice's size but the hand-reading.
- **Hand 1 + ceremony:** the acted flags reset at the DEAL. Under item 3, the cut phase
  precedes the deal, so the cut does **not** consume anyone's window (see item 3's class
  decision); every seat's window arms fresh when hands land — which also absorbs item 4's
  deal animation (~4s inside 90s planning; stated in item 4).
- **不限時 stays moot — verified by construction:** the class only selects WHICH budget
  (`perTurnMs` vs `planningMs`); the untimed preset has both `null`, so class never produces
  a clock. The property suite's untimed dimension re-checks it.

### Gate plan
- The obligations property test's current "'planning' ⇔ independently tracked no-play-yet
  flag" assertion is REPLACED by the per-seat version: for every seat at every step,
  `timingClass(state, seat) === 'planning'` ⇔ that seat has not yet acted this hand (tracked
  independently by the test driver, not by reading `actedThisHand` back — model = product).
- deadline-liveness property: VirtualRoom gains the per-seat class dimension; DL1–DL3 and
  I1–I4 re-asserted; named cases: (a) seat 1 plays fast → seats 2–4 still get planningMs on
  their first action; (b) a seat's SECOND action the same hand gets perTurnMs; (c) tribute
  payer's window consumed by payTribute → their trick-1 lead gets perTurnMs; (d) untimed →
  all null.
- Wire e2e: standard-timing room, drive seat 0's lead, then assert seat 1's first deadline
  window ≈ planningMs (not perTurnMs) via the deadlines broadcast — the exact owner scenario.

---

## Item 3 — A REAL cut (FULL) — recommendation: real, as the owner leans

**Theatre is rejected** for the owner's reason: a UI claiming agency the code doesn't have
violates the claim-must-match-code culture. The cut becomes an engine action.

### Design (the fork details for owner sign-off)
- **State:** `init` (hand 1, `firstLeadMethod='drawCard'` only) shuffles the deck as today but
  **stores it undealt**: `deckOrder: Card[108]` in `S`, hands empty, new phase
  `'ceremonyCut'`, `cutter` drawn via PRNG (as today). `deckOrder` is hidden info of the
  strongest kind (everyone's future hands) — `playerView` never exposes it and the obligation-3
  property tests extend to assert its unreachability exactly like the PRNG state.
- **Action:** `{ type:'cutDeck', position }` with `position ∈ [1..107]` (a physical cut takes
  a non-empty packet from a 108-card deck). `legalActions(cutter)` returns the exact 107-action
  set (choice-phase exact-set rule); everyone else gets `[]`.
- **Apply:** rotate `deckOrder` by `position`; run the flip sequence from the TOP of the cut
  deck — `deck[0], deck[1], …` with today's re-flip rule (joker/level-rank) and today's owner
  counting rule (cutter=1, CCW, `(value−1) mod 4`) — determine `firstDrawer`/`markerSeat`;
  then **deal the same rotated deck** round-robin from `firstDrawer` so the publicly-flipped
  marker card genuinely lands at `markerSeat` (明牌 physically真實 — everyone knows where the
  known cards went, exactly as at a physical table); enter the hand as today (`handStarted`
  with ceremony data now including `cutPosition`). The cut therefore changes BOTH the flips
  AND the hands — the choice genuinely matters.
- **Liveness:** `expectedActors = [cutter]`; `defaultAction = { type:'cutDeck', position:54 }`
  (deterministic middle cut — what an indifferent human does); the phase gets an ordinary
  deadline so an AFK cutter auto-cuts. **Timing class: 'turn'** (45s standard) — cutting needs
  no hand-reading (there are no hands yet), and crucially the cut must NOT consume the
  cutter's per-hand planning window: acted flags reset at the DEAL, which happens after the
  cut, so the cutter still gets planningMs for their real first action. (This also retires
  the old "planning window absorbs the ceremony" hack — the ceremony now has its own clock.)
- **Uniformity:** deck order is uniformly random ⇒ for ANY cut position (chosen blind), the
  card sequence at the cut is uniform ⇒ the leader distribution stays uniform over seats. The
  existing 400-seed 25%±5% test is updated to drive the cut action; run it both with a fixed
  position and with seed-varied positions. If it fails, that is a FINDING reported to the
  owner, per the brief.
- **Replay/dump:** the cut is an ordinary logged action — `(seed, config, action log)` still
  reconstructs bit-for-bit; no harness change beyond the new action type.
- **Other variants:** `random`/`fixedSeat` skip the phase entirely (deal at init as today);
  hands 2+ unchanged (tribute machinery governs leadership). The config-grid property tests
  cover both arms.
- **UI (inside this item's gate, rendered via item 5's contract):** the deck ribbon in the
  ring centre; the cutter gets a position picker with one-line microcopy
  (「請選擇切牌位置——從這裡分開牌疊」), the other three see 「等 {cutter} 切牌」+ the actor's
  plate ring; then the flip/count animation plays as today, now from real deck cards.

**Interface/PLAN impact (for the record):** phase union +`'ceremonyCut'`; `GuandanAction`
+`cutDeck`; `S` +`deckOrder`+`actedThisHand` (item 2); `timingClass` gains the seat parameter
(item 2). PLAN §3's sketch updates accordingly at implementation.

---

## Item 4 — Physical deal (presentation; AFTER item 5)

- **Pacing (the stated number):** all four seats deal concurrently, one card per seat per
  ~120ms tick → 27 ticks ≈ **3.2s**, marker-card fly-in ≈ +0.8s ⇒ **≤4s total**, absorbed by
  the 90s per-seat planning window (item 2) with >95% of the budget intact. The server is
  never asked to wait: the DO arms deadlines at the state transition; the animation is purely
  client-side over the already-received view.
- **Auto-arrange:** cards land INTO their final sorted fan positions (the hand in the view is
  already sorted; the animation replays its construction, inserting each card at its final
  index — FLIP-style transform-only motion).
- **Skip:** tap anywhere on the table = jump to the final layout — local only, touches no
  state and no clock (same precedent as the ceremony tap-skip). `prefers-reduced-motion` ⇒
  instant layout, no flight.
- **Marker draw:** the last beat animates the marker card from the deck to the leader's seat
  plate, so everyone SEES who leads (the ring makes the destination legible).
- **Deck rendering:** a depth-stacked pile (research digest will pin the exact CSS recipe);
  the same deck object is the cut-phase ribbon (item 3) and the deal source (item 4) — one
  component.
- **Verification:** desktop + TRUE 390px via the METHODOLOGY iframe recipe; the state-driver
  bot reaches hand-2 deals (tribute-adjacent) as well as hand-1; any find → regression first.

## Item 5 — DeckTheme framework (presentation; BEFORE item 4)

```ts
// src/client/table/theme.ts — the fourth axis (game / rules / locale / THEME)
export interface DeckTheme {
  id: string;                              // 'lacquer' (default)
  name: TranslationKey;                    // localized display name
  /** Face CONTENT only — rank/suit/joker identity at a given size. The
   *  framework owns everything stateful drawn OVER the face. */
  Face: ComponentType<{ card: Card; level: Rank; size: CardFaceSize }>;
  /** Back art for full-size backs (deck pile, opponents' deal flights). */
  Back: ComponentType<{ size: CardFaceSize }>;
  /** Metrics dependent UI reads INSTEAD of hardcoding: */
  metrics: {
    aspect: number;                        // height/width (1.45 today)
    cornerIndexMinPx: number;              // legibility floor the theme claims
    backEdge: string;                      // CSS color for F11 mini-fan slivers
    backGradient: string;                  // CSS background for sliver/back fills
  };
}
```
- **The framework (not the theme) renders:** the 配 cinnabar wild marker (overlaid on top of
  `Face` by the shared `CardFrame` wrapper — a theme has no code path to remove or cover it),
  selection lift + cinnabar edge, focus ring, tribute glow, ghost faces' via-wild identity.
  That is how the non-negotiables are enforced by CONTRACT: the theme never touches game-state
  indicators.
- **F11 mini-fan** reads `metrics.backEdge`/`backGradient` — any back design keeps 2-vs-27
  legible because the sliver geometry is framework-owned.
- **Registry + selection:** `DECK_THEMES` registry; active theme from a client pref
  (localStorage, same idiom as `handSort`), default `'lacquer'`; a settings toggle ships LATER
  (the framework now, per the owner). All render sites (HandFan, TrickWell, chooser chips,
  ceremony flips, result rows, deck pile) route through `CardFrame`/`CardBack` — one path.
- **Conformance ratchet:** a per-registered-theme unit suite asserts the code-checkable
  invariants (metrics sane: aspect within [1.3,1.6], cornerIndexMinPx ≥ 10, colors parse,
  Face/Back render for every rank/suit/joker at every size without throwing) + the CSS-token
  arithmetic tests (chooser 390px fit) re-derived from theme metrics. True-390 visual check
  per theme remains the eyes-gate (a theme failing it is not shippable — stated in the
  contract's doc comment).

---

## Panel brief (both lineages, headless, after items land)
Must include: the release→invalidate path (redaction — the one hard line; hunt for any way a
stale token still receives a view or acts); first-leader uniformity surviving a player-chosen
cut; the engine staying time-free (classes are labels; no ms in engine) and locale-free;
`deckOrder` unreachable from views/events (obligation 3); the DO staying game-agnostic (the
ceremony phase flows through generic expectedActors/deadline/defaultAction paths); themes
having no code path to game state; no comment overstating the code.

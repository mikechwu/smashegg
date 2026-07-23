# STATUS

## Seat bubble overlay BUILT local (2026-07-22) — the ask floats above the table with a tail at the pressed seat; awaiting the owner's deploy word

Owner overlay round: the inline SEAT DRAWER (923bdec) is replaced by a small
speech-bubble OVERLAY that floats above the table with a TAIL pointing at the
seat being claimed. The drawer's one practical weakness — it was inserted into
the grid flow, so opening it REFLOWED the lobby — is gone: the bubble is
`position:absolute`, out of flow, and the table's className is now CONSTANT
(the old grid-area swap that reflowed is deleted). The prior mechanic is
recorded as superseded, NOT rewritten, in docs/research/seat-entry-placement.md
(METHODOLOGY §9 banner) — the drawer research stays valid as the record of why
we got here.

Belongs-to is now the TAIL alone (the 「入座:{position}」 text label is gone —
the pointer does the work; the seat identity still reaches assistive tech
through the input's aria-label). The bubble is anchored INSIDE the pressed
seat's own wrapper, so the tail aims BY CONSTRUCTION: top/bottom seats center
the bubble on the seat's x-axis, the flanks on its y-axis — robust to the other
seats' chip heights, no measurement. Each seat opens its bubble toward the
table CENTER, keeping all four in the upper-central band. Spare by design: just
the input, the 坐下 confirm, and a corner × — the steady prompt line is gone.

COLOUR (owner feedback: the first dark-on-dark tail was hard to link to a
seat). Redesigned as a LIGHT ivory callout with a CINNABAR edge and a bigger
bordered ARROW (a cinnabar rim continuing the body border over an ivory fill) —
a high-contrast figure on the dark lacquer table, and the shared cinnabar
color-codes the bubble to its seat, whose highlight is now a cinnabar ring +
glow (Gestalt similarity: red arrow → red seat). Dark ink on ivory (AAA); the
confirm stays cinnabar. Re-verified live at 390px zh-Hant across all four seats
— the arrow reads clearly and points at the ringed seat each time.

LAST-PRESSED-SEAT-WINS (new): pressing a DIFFERENT seat while the bubble is open
RETARGETS it — the single sitAsk target moves, so the old seat's bubble unmounts
and the new one mounts (the tail follows; autofocus re-fires with no key). A
retarget PRESERVES the typed name (the seat changed, not the person) and resets
the needName/claiming flags; it claims NOTHING. The ONE claim path (takeSeat →
store.claim) is UNTOUCHED — store.claim appears exactly once, takeSeat is called
in exactly two places (the name-ready fast path and the bubble confirm), never
in the retarget branch, so a retarget can neither double-claim nor half-claim.

KEYBOARD (the constraint that killed floating panels last time): the bubble is
`absolute` (in the scrollable document), NOT `fixed`, so iOS's native
scroll-focused-input-into-view still fires — the same mechanism the drawer
relied on. Input stays 16px (no iOS auto-zoom, guard 3, pinned). Real
soft-keyboard occlusion is UNPROVABLE in the 390px iframe (it has no keyboard)
— batched into the pending M5 real-iPhone session.

Live-verified at true 390px zh-Hant (a real dev lobby in a 390px iframe): all
four seats measured with ZERO cross-axis offset (tail dx=0 for top/bottom,
dy=0 for flanks — exact aim), every bubble fully on-screen and in the central
band; retarget moves the tail + preserves the name (阿明) with 0 seats claimed;
confirm mints the token and seats the player (isYou), bubble closes on success.

PANEL (the owner's cumulative seat-path ask — 4th seating round): Codex
(reasoned-only) + Grok (suite green + mutation-tested the 5 new pins, 0 slips) +
a 9-agent workflow sweep (adversarially verified). VERDICT: the load-bearing
token/redaction semantics HOLD across the accumulated changes — store.claim ×1,
takeSeat ×2 (never in the retarget branch), server sends the token only to the
claimer + persists hash-only, the client stores only its OWN token, the UI never
touches a foreign token. Findings, all fixed same-round: MED (Codex) the flank
tail anchored to the seat WRAPPER not the chip — off on WIDE layouts; fixed by
anchoring the bubble inside .lobby-seat, re-verified at 760px (tail tracks the
chip, 64px wrapper gap notwithstanding). LOW (Codex) retarget preserved the name
even with a confirm in flight — fixed with a claimInFlight guard (the sweep then
REJECTED a duplicate-claim finding because of it). LOW + INFO (sweep,
PRE-EXISTING, byte-identical to the drawer panel at 923bdec, NOT regressions):
Enter bypassed the disconnect-disabled confirm — fixed (onConfirm guards
!connected); the claiming hint was not a live region — fixed (role=status).
LOW (Grok) a pin could match a vacuous window — hardened. docs/audits/seat-bubble-overlay.md.

Gate 1072/1072 (45 files) + typecheck (4 tsconfigs) + lint:hooks + build
(bundle ~unchanged). Every carry-over pin (sit-then-name, prefill,
claiming-lock, race, close-on-success, in-flight stamp) still passes untouched.
NOT pushed — this round's order carries no deploy word. Batched into the pending
M5 real-iPhone session: soft-keyboard occlusion of the bubble (the iframe has no
keyboard — unprovable there), plus the still-open elder checks.

## Deploy record (2026-07-22) — 3fafde3 verified live (health build == pushed HEAD)

Round close on the owner's word: pushed 43b45e5 (the suit registry —
SVG suit parts replace every Unicode glyph) + 3fafde3 (the joker faces
— the owner's three parts compose both variants); outgoing sweep clean
(zero sibling-name hits, zero secret patterns, no docs/local). `npm run
deploy` → version bc558011-47c7-45c6-8a26-83088f6078a3; /api/health
build == 3fafde30… == pushed HEAD; site 200. No prod smoke rooms. Open
validation: the batched M5 real-device session — the elder checks plus
the suit round's Chinese-brand Android emoji-gone confirmation (the one
thing desktop verification structurally cannot prove).

## Joker faces BUILT local (2026-07-22) — the owner's three parts compose both variants; awaiting the owner's deploy word

The owner's three SVGs (figure illustration / JOKER wordmark / dollar-J
logo) are now the joker rendering for BOTH themes, through the same
registry seam the suits established: joker-art-data.ts (145/5/1 paths,
extracted VERBATIM from the supplied files — transcription by script,
never by hand) + jokers.tsx (JokerFace: wordmark top reading on from
the top-left corner logo, the logo mirrored bottom-right by a 180 turn
about the card center, the figure filling the body; composition per the
owner's reference). Variants: small joker entirely monochrome
currentColor; big joker's logo/wordmark red via the face class and the
illustration FULL COLOR — 18 flat patches in the traditional
red/gold/black court palette (+ regal purple vest) painted UNDER the
open linework, palette in ONE place (JOKER_PALETTE). Both themes' old
joker code deleted (lacquer's star/lozenge marks; cinnabar-court's
jester figures + emblems out of the frozen art.tsx — the disclosed
edit; courts untouched). No text nodes on joker faces (the wordmark is
paths); the letter-stack era is fully gone.

THE NAMED CONSTRAINT — big vs small WITHOUT color: evaluated the
owner's offered options by screenshot (outline logo dies at small
sizes; bars looked tacked-on) and landed on: both corners keep the
solid logo, the BIG joker adds a solid five-point star under each
corner logo (presence-of-glyph survives every size), with the big
joker's shaded body vs the small's white line art as the second cue.
Verified at 50/36px, in grayscale, and in a REAL fan sliver at true 390
zh-Hant (a live hand holding BJ+SJ side by side — crops in the round
records; the corner star measures 4.6px at 390). Grok mutation-tested
the property (star drops and color swaps each fail pins — one pin
hardened same-round to count both corners per theme); Codex re-derived
the composition geometry independently (corner column inside the 0.40w
sliver; rotated corner correct). The supplied art carries NO
id/defs/gradients (verified at intake + pinned, source AND rendered).

Audits: Codex zero findings; Grok no HIGH (1 MED pin-hardening + LOWs,
all fixed); an 11-agent five-modality workflow sweep (surfaces walk
total — every joker path routes through the one part; geometry
recomputed clean; contract/prior-round regressions none; 2 stale
comments + 1 inline-label LOW fixed). docs/audits/joker-faces.md.
Detail ladder: no reduced form needed — the line-art illustration reads
as texture at hand size, verified in shots, no mud. Gate 1069/1069 (45
files) + typecheck + lint:hooks + build (+34KB gzip: the art's real
cost). NOT pushed — this round's order carries no deploy word (the suit
round's 43b45e5 is also local-only, same reason).

## Suit registry BUILT local (2026-07-22) — SVG suit parts replace every Unicode glyph; awaiting the owner's deploy word

The owner's four suit SVGs are now the SINGLE SOURCE OF TRUTH for suit
shapes: src/client/table/suits.tsx (paths normalized as a family from
typeface-convention measurements — near-equal ink height, heart
x-squeezed 10%, diamond +6%; SuitMark, fill=currentColor, the seam the
jokers/court cards plug into next). Every render site consumes it:
lacquer corner + body pip, GhostFace, cinnabar-court corner/pip
field/court cartouche (art.tsx's own 24x28 paths deleted — the one
disclosed edit to the frozen module: shape source + cartouche transform
only, court/joker geometry untouched), and the desk/chooser SF run
labels (declRunText is rank-window-only; the suit renders as SuitMark
visually and the localized suit WORD in aria, via the new
i18n/react.tsx tNode rich-interpolation seam). suitGlyph is gone.

The structural pin (the round's strongest verifiable artifact): a scan
over EVERY file in src/client bans suit codepoints in every known
encoding — literals, JS/CSS escapes, HTML entities, surrogate pairs,
fromCharCode/fromCodePoint construction, the U+1F0A0 card-emoji block,
U+2763/2764 heart stand-ins — with a self-test proving each smuggling
form is caught. Completeness verified three ways (Codex, Grok with the
suite green in its clone, and a 17-agent six-modality workflow sweep
with adversarial verification): TOTAL — zero rendered-surface suit
codepoints repo-wide; all inert hits (docs prose, engine comments, test
names) individually refuted. Panel MEDs (escape blind spot; the
local-helper hole) hardened same-round; docs/audits/suit-registry.md.

Live (zh-Hant, TRUE 390×844 + desktop, both themes): 13/13 — every
corner/pip/ghost/desk suit is the shared part, zero Unicode suit text
nodes in the DOM, pip ink clears the wild seal 3.4px / the corner index
11.4px (re-measured per the CSS comment's own rule), cinnabar corner
fill=currentColor resolving to the theme palette, the desk naming a
staged pair through the node-built status. The ~12px named check:
corner ink ~12.0px at 390 and the four silhouettes separate (family
screenshots). **Boundary stated: desktop/iPhone rendered the OLD glyphs
fine too — the Chinese-brand Android emoji render is NOT verifiable
here; the scan removes the cause structurally, and the emoji-gone
confirmation is a named M5 real-device check (Xiaomi/Huawei/OPPO/vivo),
batched with the elder session.** Gate 1060/1060 (44 files) + typecheck
+ lint:hooks + build. NOT pushed — this round's order carries no deploy
word.

## Deploy record (2026-07-22) — 923bdec verified live (health build == pushed HEAD)

Round close: pushed cda882d (prefill blank-when-ambiguous + one-tap
clear) + 923bdec (the seat drawer + the guard-4 composite fixes);
outgoing sweep clean. `npm run deploy` → version
79c7f26d-a9b8-4817-a715-cf50a09c4267; /api/health build == 923bdec0… ==
pushed HEAD; site 200. No prod smoke rooms. Open validation: the
batched M5 elder-on-iPhone session (five checks listed in the drawer
entry below).

## Seat drawer BUILT (2026-07-22) — item 1b per P1–P3 + the guard-4 composite closed — deployed with the round

The sit-then-name ask relocated from the felt disc into a full-width
DRAWER row inserted into the lobby grid adjacent to the pressed seat
(top slot for seat 2, mid slot otherwise — the bottom seat opens ABOVE
itself, P2), with the connector nub ON the pressed chip (correct by
construction; seat 0 points up), the matching cinnabar ring, a pressed
FLANK chip sliding to meet its drawer, the disc keeping the room code
untouched, a 200ms one-shot open (instant under reduced motion), and a
16px input — which fixed a live iOS-zoom bug (the old 14.4px input).
SitAskPanel moved wholesale: claim path, lock, race handling, prefill
all carried (every prior seating pin passed unchanged).

Guard 4's cumulative audit (Codex + Grok, composite call graph as
evidence; Grok ran the suite green): the three-round seat path is
LOAD-BEARING SAFE — exactly one claim funnel, token minted once by the
unchanged DO path — and the whole-path re-look surfaced THREE real
composite holes, all fixed + pinned: the retarget lock leak (a new ask
session resets the claiming lock), the orphan drawer (a direct claim
supersedes any open ask), and Codex's in-flight prefill window (both
claim paths stamp lastClaimAtRef; the ask-open widens holds-a-seat with
a <10s fresh-claim signal, so a just-claimed identity can never prefill
the next ask during the roster echo). docs/audits/seat-drawer.md.

Live (zh-Hant, TRUE 390×844 + desktop + reduced-motion): 7/7 — all four
positions adjacent at a 10px gap with correct nub directions, chip
ringed + on-screen, code visible, 16px focused input, the drawer flow
seating through the same claim path. **Guard-3 boundary stated: iOS
soft-keyboard occlusion is NOT iframe-verifiable — an M5 device check.**
Gate 1043/1043 (43 files) + typecheck + lint:hooks + build.

**The batched M5 elder session (one iPhone sitting answers all):** the
play-desk reflow read; dual-render "how many nines"; variant-D
top-of-lifted-card unselect; the drawer disorientation read (guard 1 —
does the row opening say "type here for THIS seat" or "the seats
moved"); iOS keyboard occlusion (guard 3).

## Prefill round (2026-07-22) — 1a + item 2 BUILT local; 1b (seat drawer) AWAITING SIGN-OFF

**Item 1a — diagnosed FIRST, as ordered: NOT the residue-bug class.**
Evidence: pref:playerName (localStorage, browser-profile scope) written
on every claim, read only at the sit-ask open — the sit-then-name
round's DESIGNED rejoin convenience; the flaw was the too-coarse
ambiguity rule (it prefilled a stranger's name for a different person).
Fix per the owner's steer, blank-when-ambiguous (sitAskPrefill, pure +
pinned): blank when this client holds a seat here, blank when the name
is already seated on the roster, else the remembered name (rejoin keeps
its convenience). Claim path untouched.

**Item 2 — one-tap clear on the desk:** 重選 rides the staged-faces row
(exists only with a selection), 44px-class target (panel fix), full
aria; the handler empties the ONE selection set + closes the chooser —
every derived surface zeroes by construction (fan lifts, dim, staged
faces, combo line, pass-arm), pinned as the single-source construction;
the survival reconciler cannot rehydrate a user wipe. Panel (Codex +
Grok; Grok ran suites green): zero HIGH; the concurring tap-target
finding fixed + pinned; LOWs acknowledged — docs/audits/prefill-clear.md.
Live: 6/6 zh-Hant checks at TRUE 390×844. Gate 1033/1033 (43 files) +
typecheck + lint:hooks + build. Local commit, unpushed.

**Item 1b — placement research done, no code:** docs/research/
seat-entry-placement.md. In-place morph FAILS the ~75px flanks (iOS
16px input-zoom floor + full-width CJK glyphs need ~80-84px); bottom
sheets slide under the iOS soft keyboard and cover the bottom seat;
proximity beats tethering (Wickens & Carswell). Proposal: the SEAT
DRAWER — a full-width in-flow entry row adjacent to the pressed seat
(above it for the bottom seat), connector nub + matching cinnabar ring,
the disc keeps the room code untouched, SitAskPanel relocates wholesale
(claim path + all audited behaviors carry over). Owner decisions P1–P3
in chat; build on sign-off.

## Deploy record (2026-07-22) — c8c4bf3 verified live (health build == pushed HEAD)

Round close per the owner's build order: pushed fc3f5c0 (sit-then-name)
+ c8c4bf3 (fan variant D); outgoing sweep clean. `npm run deploy` →
version 82fb4f1a-f2c4-4470-8175-864091cabb41; /api/health build ==
c8c4bf39… == pushed HEAD; site 200. No prod smoke rooms. The batched
elder session (below) is the open validation.

## Fan variant D BUILT (2026-07-22) — item 1 closed per F1–F3 — deployed with the round

Owner locked F1=variant D, F2=keep −14px, F3=harness as the recorded
gate. table.css only: every fan lift/nudge transform moved from the card
BUTTON to the FACE (.gd-card) with pointer-events:none — paint unchanged
(the pull-proud lift, the ring pair), hit boxes at base layout in every
selection state. The named check ran on the shipped code: ZERO victims
across the full 27×27 elementFromPoint sweep at TRUE 390×844 zh-Hant
(the old button lift halved the strip above: 700→350px²); probe
faceLifted=14 / buttonTransform=none / pointerEvents=none. The sweep is
now scripts/measure-fan-tap-targets.mjs — the REQUIRED visual-gate check
for any fan/selection change (manual: playwright deliberately not a repo
dep); the two silent-revert vectors are source-pinned in
tests/unit/client/fan-tap-targets.test.ts (comma-list-hardened button
scan, pointer-events, fan-only scoping, reduced-motion face override,
script existence, the guard-3 desk dependency note). Panel (Codex +
Grok; Grok ran the suites green): PASS both lineages, zero HIGH/MED;
LOWs fixed (scan parser gap, reduced-motion pin placement, stale
CardFace comment) or acknowledged (focus ring stays at the true hit
position; the manual-gate script) — docs/audits/fan-variant-d.md. Gate
1025/1025 (43 files) + typecheck + lint:hooks + build.

**Batched elder session (one sitting answers all three):** guard 1 here
— aim at the TOP of a lifted card to unselect (does the near-miss
mis-select, and do they discover the desk's tap-to-unstage instead?);
the desk round's guard 2 (the acting reflow read) and guard 3
(dual-render "how many nines do you see?").

## Silent-no-op round (2026-07-22) — item 2 (sit-then-name) BUILT local; item 1 (fan tap targets) MEASURED, mechanic AWAITING SIGN-OFF

Two playtest items, one root: the UI silently did nothing instead of
saying what it wants. Both presentation-only.

**Item 2 — sit-then-name: BUILT, committed locally.** The take-a-seat
button is never name-disabled (the NN/g anti-pattern was the bug): with a
name it one-taps exactly as before; without one it opens the ask ON THE
FELT DISC (research: poker's seat-first dialog; centered, never a
seat-anchored popover — the flank grid columns are ~75px at 390px) with
the chosen chip ringed, the input autofocused and prefilled from the
last-used name, an empty confirm explaining itself, and the race loser
told explicitly. ONE claim path (takeSeat → store.claim) for both orders
— the seat token mints exactly as before. Cross-lineage audit (Codex +
Grok; Grok ran the suite green): load-bearing question HELD, no HIGH;
the concurring MED (double-tap sent duplicate claimSeat — DO-safe but a
false failure read) fixed with a claiming lock + growth-only unwedge +
disconnect parity; docs/audits/sit-then-name.md. Ratchet: lobby.test.tsx
(the blank-name-never-disables regression, sitIntent routing, single-
claim-path pins, the ask's render states, the lock). Live: 11/11 zh-Hant
checks at TRUE 390×844 incl. all four seat positions and a real
two-client race. Gate 1019/1019 (42 files) + typecheck + lint + build.

**Item 1 — fan lift occlusion: MEASURED, no code shipped.** A Playwright
harness swept all 27 selections × 27 tap-target measurements per variant
at true 390px (docs/research/fan-tap-targets.md). Diagnosis: the −14px
lift halves the tappable strip of the card above it in its pile (700 →
350px²). Variants measured: owner's gap-open A′ (good on area, but moves
the elder's NEXT tap targets — the documented fisheye failure mode);
ring-only B (zero victims, loses the lift); solo −8px C (still −25%);
**hit/paint-decoupled D (recommended): zero victims, targets byte-stable,
the current visual unchanged — the production-DDZ pattern, ~4 CSS lines.**
Owner decision F1–F3 delivered in chat; build on sign-off.

## Deploy record (2026-07-22) — 42cd5d2 verified live (health build == pushed HEAD)

Owner word: "ready to deploy". Pushed 39258e3 + 1e1cec5 + c1b11c8 + 42cd5d2
(tribute hand-size faces, the end-of-hand interlude, selection survival,
the play desk); outgoing-content sweep clean (no sibling names; demo
videos stay gitignored in docs/local/). `npm run deploy` → version
43e3294a-257a-4570-838f-7fec650e98be;
/api/health build == 42cd5d28… == pushed HEAD; site 200 serving the new
bundle. No prod smoke rooms created (the DO stays clean). Open with real
players: the guard-2 reflow read and the guard-3 dual-render elder check.

## Play desk BUILT (2026-07-22) — elder-visibility items 1/3/4 as signed off — local, unpushed

Owner locked D1–D7 + five guards; docs/research/state-visibility.md is now
real. ONE surface between fan and buttons (PlayDesk) concentrates whose
turn / clock / staged cards / combo name. Loudness hierarchy as the spine:
loud shell ONLY on your turn (play/tribute); D2 quiet pre-stage (faces +
naming, no shell/clock — rides the item-2 selection-survival fix); absent
otherwise. D5 discrete calm→amber→urgent (never a pulse; urgent hurry copy
in the TITLE slot — visual find: a separate row pushed 出牌/過 under the
390px fold), fraction bar from the room preset (shared timeoutMsFor, no
wire change), planning = goldleaf register; untimed rooms show no clock
chrome. D4 phone demotes the headline to teams-only while the desk is loud
(desktop keeps the echo; anti/cut keep the sentence — no desk there). D3
dim 0.72 + doubled −14px lift with ivory outer ring; reduced motion keeps
the ring pair, drops transform/dim. D6 timeout notice (client-only fold
detection, consumed local-pass stamps, MAX 2/session, neutral wording).
ScrollActionsIntoView guarantees desk+buttons on screen (its first inline
shape was a Rules-of-Hooks crash on viewless renders — caught by the LIVE
drive, not the static gate; restructured + pinned). ActionBar reduces to
buttons+chooser; tribute retitles the same desk. Guard 5 held: naming is
literally classifyPlays/matchSelection through comboKey/comboRankLabel/
declRunText/beatState — no new classification path (pinned behaviorally).

Ratchet: tests/unit/client/play-desk.test.tsx (state machine incl. the
tribute-requires-yourTurn defense, D5 ramp + untimed degradation, guard-5
reuse identity, render states, wiring incl. D6 cap/consumption + tick
horizon + scroll child, CSS steady-state/reduced-motion/recycled-budget);
two headline-clock pins rewritten (handclock superseded). Conformance
panel (Codex + Grok, disclosed design-anchored; Grok ran the suite green):
both owner questions HELD — presentation-only (DO alarm sole enforcer, no
wire change) and reused-not-reimplemented. Zero HIGH. 4 MED fixed same
hour (Codex: unconsumed local-pass stamp ate a real teaching notice;
Grok: planning register was copy-only, staged verdict lacked the positive
壓得過 side, deskMode tribute branch lacked the yourTurn defense) + 1 LOW
fixed, 5 acknowledged — docs/audits/play-desk.md. Gate 1010/1010 (42
files) + typecheck + lint:hooks + build. Live: 16/16 checks across four
driven zh-Hant rooms at TRUE 390×844 + desktop resize probe.

**Owner checkpoints still open (named gate items, need real elders):**
guard 2 — does the acting ring-shrink reflow read as "my turn" or as
"something broke"; guard 3 — dual-render ("how many nines do you see?");
if dual-render fails, v1.1 is extract-from-fan.

## Elder-visibility round (2026-07-22) — item 2 bug FIXED local; items 1/3/4 proposal AWAITING SIGN-OFF

Second real-human playtest: one true bug + a three-faced visibility theme.

**Item 2 — pre-selection wiped when the turn arrives: FIXED, committed locally.**
Root cause: the selection reset effect keyed on a compound string carrying
`hints null↔present` and the trick context — the idle→actor flip (and every
trick-top change) wiped client-only selection state. Fix: the chooser keeps
the transient key; selection gets a pure survival policy
(helpers.reconcileSelection — hints/trick-blind BY CONSTRUCTION, identity
remap on hand change with per-twin slot claiming, reset only on seat switch
or fresh deal via handNo/dealNo) run as a layout effect with same-instance
bailouts. Ratchet: tests/unit/client/selection-survival.test.ts (13 pins:
remap, policy, wiring — the old code fails the wiring pins). Live-verified
zh-Hant (stated) at TRUE 390×844: 黑桃6+梅花9 lifted during 輪到 阿華, still
lifted at 輪到你 after two intervening actions. Cross-lineage audit (Codex +
Grok, neither produced the fix; Grok ran the suite green in its clone): zero
HIGH, zero required changes — "Ship as-is"; one convergent MED/LOW on test
shape (DOM-free suite pins policy+wiring, the rendered transition is
eyes-verified per the polish gate) + residual LOWs, all acknowledged in
docs/audits/selection-survival.md. Gate 971/971 (41 files) + typecheck +
lint:hooks + build.

**Items 1/3/4 — turn/clock/selection visibility: PROPOSAL, no code.**
docs/research/state-visibility.md — four-agent research sweep (codebase
signal inventory; 掼蛋/斗地主/Hearthstone/chess.com turn-timer precedents;
Balatro/Marvel Snap/Tichu/Big Two staging mechanics; elder-HCI literature)
plus two INDEPENDENT design proposals (Codex, Grok) that converged
unprompted on one architecture: 出牌台, a unified play desk between fan and
buttons owning the turn banner, ONE large own-clock (calm discrete urgency
ramp, untimed rooms simply omit it), staged full faces, and a live combo
label (「即將出：對子 9」) before commit — opponent turns stay quiet, no
drag, no pulse loops, no sound dependency, chooser stays the wild
specialist, presentation-only throughout. Owner decisions D1–D7 delivered
in chat; build starts on sign-off.

## End-of-hand interlude (2026-07-22) — BUILT as designed + demo videos — local, unpushed

Owner sign-off arrived as the demo-video request ("show it is implemented as
designed"): the beat from docs/research/hand-interlude.md is now real. One
lower-third plate over a vignette, the winning final play HELD in the trick
well; hold → standings (頭游…末游 + goldleaf verdict) → level transition (the
HEADLINE badges tick old → new) → curtain (第 N 局 · 本局打 X); ~4.9s auto,
one-tap whole-beat skip, 6.5s cap; A-burn/suspension insert; matchEnded runs
the shortened beat into ResultOverlay; reduced-motion static plate. Fold-time
snapshot on the transient-fx discipline (before-side trackers seeded at hand 1
AND lazily from the first observed view on mid-match adoption, guarded against
the same-tick handEnded race); every surface gates behind the beat (deal, fan
hold, tribute center, action bar, clocks, turn sentence, actor rings, in-play
tag, ResultOverlay). Two visual-round finds fixed before recording: the
overlay went viewport-FIXED (the pre-deal hold collapses the table section —
an in-section overlay covered the held play), and the next hand's turn
sentence + actor rings leaked through the dim.

Ratchet: tests/unit/client/interlude.test.tsx (23 pins: step machine, fold
capture incl. batch-order survival + tracker seeds + burn/suspension
precedence + mid-match degradation, stage-conditional render, wiring/CSS,
audit fixes). Cross-model panel (Codex + Grok, fresh clones at the true
base, both disclosed as design-anchored): Grok found the one HIGH —
multi-seat done-id bookkeeping was scalar, resurrecting a finished beat on
pill switch (→ ReadonlySet fix, pinned); both found the frozen-`now` 60s
guard MED (→ per-stamp tick horizons); LOWs fixed (unlimited-attempts dead
air, match-end fan under the vignette) or acknowledged (stage-E fade, burn
copy wording) — docs/audits/interlude-panel.md. Videos re-recorded on the
FIXED code. Gate 958/958 (40 files) + typecheck + lint:hooks + build.

**Demo videos (owner request): docs/local/videos/interlude-{zh-Hant,en}.{mp4,webm}**
— gitignored (docs/local/), NEVER pushed. Each records a REAL driven test
game at 390×844: live timeout endgame → the final play → the full beat (both
locales verified reading their proper copy, zh-Hant 打2 → 打5 with the badge
tick) → the deal into hand 2 → the tribute flow (item 2's hand-size cards
visible). mp4 = the last 45s (trimmed for clarity); webm = the full capture.

## Post-M5 human-feedback round (2026-07-21) — item 2 LANDED local; item 1 plan AWAITING SIGN-OFF

First real-human playtest feedback, two items, both presentation-only (polish gate).

**Item 2 — tribute panel cards at hand size: DONE, committed locally.** The panel's
three reveal sites (paid/returned pairings, anti-tribute jokers, own staged card) moved
from the dormant 'trick' size to size="hand"; 'trick' joins 'mini' as a dormant token
(CSS comment updated). `.gd-tribute__own` gains flex-wrap (pairings already wrapped).
Ratchet: tests/unit/client/tribute-faces.test.ts — TributePanel hand-only, a
directory-swept "no trick/mini anywhere" pin (Codex LOW fix: enumerated, not
hand-listed), wrap + max-width structure; all pins failed pre-fix. Live-verified
zh-Hant (stated): first-hint bot drove a real room to the hand-2 return-tribute
reveal; tribute card == fan card at TRUE 390px (50.7px) and desktop (68px), zero
overflow. Honest find: the sparse joker face is the lacquer theme's designed
corner-emblem-only look (DOM-probed identical on a fan joker) — pre-existing, not
this change. Codex audit (isolated clone): no HIGH/MED, 2 LOW (both fixed —
self-maintaining sweep pin + three stale mini-era comments). Gate 935/935 (39
files) + typecheck + lint:hooks + build. docs/audits/tribute-panel.md.

**Item 1 — the end-of-hand → next-hand beat: PLAN PROPOSED, no code.** Verified
architecture fact: finishHand commits handEnded + the next hand atomically in one
batch — no server inter-hand phase exists, so the beat is client-side framing over a
committed result (the owner's preferred answer; timeout surface untouched; next hand's
clocks run during the beat, so it stays ~5s and skippable). Independent design panel
(Codex + Grok, isolated clones, same brief, no cross-visibility) CONVERGED on every
load-bearing choice: staged sub-beats in one overlay plate; final play HELD in the
trick well (never lifted into chrome); one tap skips the WHOLE beat; ~4.9s auto /
6.5s hard cap; the level transition rendered by the HEADLINE badges crossfading
old→new; a conditional A-attempt/suspension insert with the round's hardest copy;
matchEnded gets a shortened hold that dissolves into ResultOverlay (never two
endings); snapshot reconnects never synthesize the beat. Web research corroborates
(verdict-first, sequential-reveal-as-pedagogy, tap-to-skip as hard convention, and
the genre's two-tier settlement: light per-hand vs heavy per-match). Full plan +
provenance + implementation shape: docs/research/hand-interlude.md. Build starts
only on owner sign-off.

## Deploy record (2026-07-17)

Pushed f04dc0e..1d58f80 (13 commits: in-pile selection, lobby round table, seat-zone
realistic hands, two-row wrap, lapped rows + headline clock, flank layout + pass fade +
split clocks + one card size, tabs removed + play flight, covered-play physics, chooser
at hand size, compact headline, cut-by-hand, hand badge, seam fix) and deployed on the
owner's word. Pre-push gate: 932/932 + typecheck + lint:hooks + build. Verified live:
/api/health build == pushed HEAD (1d58f80a3bcff3ab5c7f2c139f8deae8f863dd3e), and a full
production smoke drive at 390 — room built over wss, seats claimed, drag-cut ON the cards
with the badge measured 0px from the DOM seam, settled table with three "27 cards" chips,
zero .gd-tabs, "Us level 2 / Them level 2" badges (numeral + wild chip absent), 3 held
switcher pills, and a play flight airborne with the well card hidden until landing.
Worker version b6eb674e-5cbe-442e-ac6d-fd1b2f1eabdd.

## Cut handle icon (2026-07-17) — owner refinement — deployed

Owner directive (screenshot): the handle's chevron glyph rendered as a small confusable
DIAMOND — hide it, or a small pointing hand aligned with the gap, or anything practical
and elegant.

Built: the handle is now an inline SVG (the WildSeal idiom) — a 24px coin badge (lacquer
disc, goldleaf ring, goldleaf pointing-hand path) riding the SAME pixel-exact split
geometry from the previous round (interior formula + data-split-edge overrides,
transition, z-29, pointer-events none all untouched). Three hand candidates were rendered
and eyeballed at 18-72px before choosing; the coin backing is what keeps the hand legible
at handle size. Pins: the handle span contains svg/circle/path and NO chevron/diamond
codepoints; all geometry/stacking pins unchanged.

Live-verified (390 en): drag 12 → 20 slivers, Home/End handle centres at 11.2 /
width−11.2 exactly (no geometry regression), badge clearly legible on the parted gap.

Cross-model panel (Codex + Grok, isolated clones, light single-round brief
BRIEF-HANDICON.md; producer≠auditor): see docs/audits/handicon-panel.md. Gate 932/932;
typecheck, lint:hooks, build clean. Committed locally; push only on the owner's word.

## Cut by hand (2026-07-17) — owner refinement — local, unpushed

Owner directive (screenshot of the cut panel): the cards themselves are the slide
control — no separate visible sliding bar; users cut with mouse or finger directly on the
deck.

Built: CutRibbon gains value/onChange/sliderLabel — the CUTTER gets an INVISIBLE native
range input overlaying the cards (absolute inset-0, opacity 0, z-index 30 ABOVE the
slivers' 0..23 split-order z — a live find: the first overlay sat under them and the
cards swallowed the drag), so dragging the deck IS the native slider drag while keyboard
arrows/Home/End and the aria slider semantics survive untouched; the visible bar is
REMOVED; spectators keep the bare ribbon. cursor: ew-resize + touch-action: none on the
live ribbon; keyboard focus stays visible via :has(:focus-visible) framing the ribbon in
goldleaf. The §leak doctrine note unchanged (same input, same documented partial
mitigation).

Live-verified (390 en): press at 25% dragged to 80% moved the split 12 → 20 slivers with
no visible bar anywhere; Home snapped to 0; the overlay measures invisible and exactly
covering the ribbon; Cut proceeds (one run hit a legitimate re-cut flip).

Cross-model panel (Codex + Grok, isolated clones, identical brief BRIEF-CUTDRAG.md;
producer≠auditor): see docs/audits/cutdrag-panel.md. Gate 932/932; typecheck, lint:hooks,
build clean. Committed locally; push only on the owner's word.

## Compact headline (2026-07-17) — owner refinement — local, unpushed

Owner directive (screenshot of the bar): remove the big LEVEL numeral and the ♥-wild chip
— just "Us level 2 / Them level 2" (good Chinese wording) — and redesign with best
practice.

Built: TableHeadline's __level block and __wild chip GONE (currentLevel prop removed; keys
game.level.playPrefix / game.wild.tag / game.rail.playing removed ×3 locales). The two
TeamBadges are the level story: label + connective word + goldleaf rank — en "Us level 2",
zh 我隊打2/對方打2 (new key game.rail.teamLevel; the guandan 打X idiom); A-dots +
suspension unchanged. Best-practice bar: badges lead left, the turn sentence + clock
anchor right (margin-left:auto), sharing one row when it fits and wrapping under when not;
badges gained presence (0.875rem, rank 1.05rem goldleaf — F7's bold move at badge scale).
F6 ("wild stated always") is SUPERSEDED by the owner's directive — the wild's own seal
still marks it in play. Narrow block dropped the dead __rank compression.

Live-verified: 390 zh-Hant single row 35px (「我隊 打2 · 對方 打2 ─ 輪到你 45」); 390 en
wraps to a right-anchored second line (64px); 1456 en one row; __level/__wild absent from
the DOM everywhere (was ~90px with the numeral + forced second line).

Cross-model panel (Codex + Grok, isolated clones, identical brief BRIEF-HEADLINE.md;
producer≠auditor): see docs/audits/headline-panel.md. Gate 925/925; typecheck, lint:hooks,
build clean. Committed locally; push only on the owner's word.

## Decl chooser at hand size (2026-07-17) — owner refinement — local, unpushed

Owner directive (screenshot of the "Declare the combination" panel): the chooser's card
style and size must be consistent with hand cards.

Built: ActionBar's four chooser renders switched mini → hand (chip wild + ghost target,
result ghosts + faces); `.gd-chooser__result` swapped its flat gap for the trick well's
own -0.6 overlap (`> * + *` — real faces are .gd-cardframe, ghosts bare .gd-card, both
carry gd-card--hand so --gd-cardw resolves per element) — the result row IS the combo as
it will hit the table, so it now previews exactly the table presentation. The mini-era
§3.1/§5.4 fit arithmetic is superseded: chooser-faces.test.ts re-proves the inequality
from stylesheet tokens at the HAND clamp for 390/375, pins result-overlap == well-overlap
(lockstep) and ActionBar mini-free; the wild-seal legibility pin moved to the hand floor
(the smallest size the game UI now ships anywhere). The 'mini' size stays as a DORMANT
token (the frozen cinnabar-court art references the size union; narrowing types against a
frozen file is out of scope) — stated, not hidden.

Live-verified (390 en, a REAL ambiguous selection — 2♥ wild + 3,4,5,6 → Straight 7 vs
Straight 6): every chooser face measures exactly the fan's 50.7px, the panel 228px wide,
on-screen, both options rendered.

Cross-model panel (Codex + Grok, isolated clones, identical brief BRIEF-CHOOSER.md;
producer≠auditor): see docs/audits/chooser-panel.md. Gate 925/925; typecheck, lint:hooks,
build clean. Committed locally; push only on the owner's word.

## Play flight: covered-play physics (2026-07-17) — owner refinement — local, unpushed

Owner directive: while the new cards are flying to the table, the EXISTING cards on the
table must still be present (correct physics), and since the existing play can be LONGER
than the incoming set, the existing cards gradually fade out once the new cards cover
them.

Built: the fold tracks `topCards` (the trick's current top); 'played' stamps
`playFx.covered = topCards` then takes the top over; trickWon/handStarted clear both
(reconnect leaves topCards null → that one flight degrades to the old instant swap).
TrickWell renders `covered` as an underlay GRID-STACKED with the top row (both rows
grid-area 1/1; the well sizes to the LARGER, so a longer old play keeps its exact
width/wrap/pixels; neither row positioned, so DOM order is the paint order), KEYED per
flight (a reused element would inherit the fade class), only alongside a top, alive
exactly as long as the flight (2000ms gate / sweep-clears-playFx). PlayOverlay targets
ONLY the top row (`:not(--covered)`); the LAST landing (an airborne counter) adds
`--fading` (600ms opacity out — the old play's PROTRUDING cards are what the fade visibly
removes); the flight layer moved z 8 → 11 (over the well: with the covered play visible,
incoming cards must fly ABOVE it; the landing hand-off stays one task = one paint).
Reduced motion: no flight, underlay display:none. The grid stacking, the per-flight key,
and the last-landing fade are all panel round-1 fixes — both auditors CONVERGED on the
element-reuse and box-collapse HIGHs.

Live-verified (390 en, before and after the fix wave): single 3 covered by a single
Joker — mid-flight the underlay present at opacity 1, new top hidden, fx airborne;
post-landing --fading applied (caught mid-transition at computed opacity 0.016);
post-gate unmounted, top visible.

Cross-model panel (Codex + Grok, isolated clones, identical brief BRIEF-COVER.md;
producer≠auditor): see docs/audits/cover-panel.md. Gate 925/925; typecheck, lint:hooks,
build clean. Committed locally; push only on the owner's word.

## Seat tabs removed + play flight (2026-07-17) — owner feature round — local, unpushed

Owner directive: (1) remove the Seat 1-4 tab bar — verified first that it is PURE
client-local view switching for multi-seat self-play (renders nothing for a single held
seat, calls only setSelectedSeat) — clicking the name overlay selects the seat instead;
(2) playing cards animates like the deal: the pile count drops while the played cards fly
FACE UP from the pile to the table, 100% hidden at t0 behind the pile, appearing from its
back edge, unsorted in flight, each landing at its proper table spot.

Built: SeatTabs deleted whole (component, two render sites, all .gd-tabs CSS, the
seatTabsLabel key ×3 locales); SeatPlate gains optional onSelect — a HELD non-active
seat's pill renders as a real <button> ("Switch to {name}" aria, new i18n key ×3,
--held pointer/hover/focus affordances, PlateBody shared innards) wired to the SAME
setSelectedSeat. New PlayOverlay.tsx: the fold stamps playFx {seat, cards, at, id} on
every 'played' (cards are public), cleared on handStarted; rendered while !dealing ∧
!ceremony ∧ now−at<1600, keyed by fold id; the tick's fx leg (the pass-fade clock) now
covers playFx so untimed rooms expire it. Flight mechanics: origin = the pile's
table-facing edge (south = hand-zone top), targets = the well's fresh card rects; WAAPI
keyframes opacity 0→1 over the first 18% ("emerging from behind the pile"), deterministic
per-index jitter/tilt + 70ms stagger ("unsorted"), well cards visibility:hidden until
THEIR flight lands (the landing is the reveal), fill-both + display:none on finish (React
owns the nodes), unmount cleanup can never leave the well hidden, reduced-motion does
nothing, mismatched well bails. Layering: .gd-playfx fixed z-8 under the well's z-10.

Live-verified (390 en, pills only — no tabs exist): pill switching flips the bottombar
identity; south flight airborne while the well card hides then reveals on landing; REMOTE
flight captured (north pile 27→26, joker mid-air) via a mid-flight viewer switch.

Cross-model panel (Codex + Grok, isolated clones, identical brief BRIEF-PLAYFX.md;
producer≠auditor): see docs/audits/playfx-panel.md. Gate 922/922; typecheck, lint:hooks,
build clean. Committed locally; push only on the owner's word.

## Seat zones: flank layout, pass fade, split clocks, unified card sizes (2026-07-17) — owner follow-up — local, unpushed

Owner directive (five items on the lapped-rows build): (1) no name overlay ON the cards —
the name moves to each player's RIGHT-HAND side; (2) the count on the cards' OTHER side,
and PASS leaves the pill: it fades in over the passer's cards and fades off after ~2s;
(3) the countdown sits directly beside the turn sentence, and on YOUR turn an additional
countdown shows above the High→Low sort pill; (5) the ceremony/cut/deal cards use the same
size and style as the playing cards.

Built: SeatPlate is identity-only again (dot/name/tags/badge/committed chip); the count is
a standalone SeatCount chip (tiers/aria/"—"/deal count-up intact); the zone's DOM is always
[pill, cards, count] and CSS turns it into each seat's handedness (the R10 translation):
north a row (pill left = north's right hand, count right), east a column (pill above),
west column-REVERSE (pill below) — with NORTH's flanks position:absolute at right:100%/
left:100% + width:max-content over the ring's empty corner cells, after two dead ends at
390 (track-sized row pushed EAST off the viewport; a flex squeeze crushed the pill to a
bare dot — both caught live, pinned, fixed). Pass: .gd-seatzone__pass keyed per seat,
gd-passfade 2.8s fill-forwards (in by 8%, hold to 71% ≈ 2s, out to 0), base opacity 0 so
reduced-motion never shows it; the feed stays the durable record. Clocks: the headline
chip lost margin-left:auto (8px after the sentence); new .gd-handclock in the actionsRow
sort cell when yourTurn ∧ !concealed ∧ dueSeconds ≠ null, same ≤10s urgency. Sizes:
CutPanel ribbon+flip, CeremonyOverlay faces, DealOverlay deck/template/marker all
size="hand" (were mini/mini/trick); the cut ribbon's --sliver-w carries the .gd-card--hand
clamp (lockstep-pinned), ribbon max-width 18→20rem; .gd-seatstack base rule gained
z-index:0 (seals slot z under the pass fade); the whole --stacked lap CSS is deleted.

Live-verified (390 + 1456 [en], 390 [zh-Hant]; full drive cut → ceremony → deal → play →
pass): flank rects correct and on-screen; fade 1 → 0 on the passer's block only; headline
chip 8px from the sentence ("Planning time 80" / 「起手思考 81」); handclock on the actor's
tab; card widths unified 50.7 @390 / 68 @1456 across cut/ceremony/deal/fan.

Cross-model panel (Codex + Grok, isolated clones, identical brief BRIEF-FLANK.md;
producer≠auditor): see docs/audits/seatzone-flank-panel.md. Gate 910/910; typecheck,
lint:hooks, build clean. Committed locally; push only on the owner's word.

## Remote seat zones: lapped-row refinement + headline clock (2026-07-17) — owner follow-up — local, unpushed

Owner directive (six items on the approved two-row build): (1) deal realism — cards fill
the two rows ALTERNATING column by column (2nd card row 2, 3rd card row 1 col 2), not row
1 first; (2) deeper overlap between the rows; (3) flip the row order — 1st row paints ON
TOP of the 2nd; (4) with row 1 on top it shows whole cards, so ride it partly OUTSIDE the
block boundary showing only ~half its height; (5) relocate name tag + count into the freed
space; (6) move the countdown out of the seat pill into the headline area with best UI
practice. Collaborate with Grok and Codex.

Built: helpers.seatStackSlot — DEALING maps alternating (row = i mod 2, col = ⌊i/2⌋, the
owner's exact description), SETTLED maps row-major (so play-time shrinkage peels the
mostly-hidden inner row and the lay extent never moves); the two occupy IDENTICAL slot
sets at the deal's final 27 (= 2·cap − 1), the only count where `dealing` flips, so the
swap never repaints a pixel (unit-pinned). Geometry: --gd-stack-linefrac 0.5 → 0.36 (with
the front row on top this IS the inner row's visible sliver), new --gd-stack-peek 0.5 and
derived --gd-stack-clip = (rows−1)·(1−peek) subtracted from every cross-axis size and from
north/west row offsets (their outer edge is coordinate 0; east's crop falls out of its
clip-narrowed width — same mirror, expressed at whichever edge is outer);
.gd-seatstack--wrapped { overflow: hidden } crops ONLY wrapped blocks; slot z-index
(rows−1−row) carries ONLY the row flip, DOM order still resolves within a row (R10
newest-on-top intact). A wrapped block is now 0.86 of ONE card deep — shallower than a
single card (was 1.5) — the 390px centre gap grew 122 → 215.6px. Item 5: the count chip
moved INTO the pill (tiers/aria/"—" intact, deal-time counting suppressed tiers) and the
pill goes ABSOLUTE, lapping the block's outer edge (zone --stacked modifier; stack z 0
seals slot z; width: max-content after a live find — see below); a zone without a block
(finished/hidden/pre-deal) keeps the in-flow pill. Item 6: SeatPlate lost every timing
prop; TableHeadline's turn line carries ONE clock chip at its far end (planning word
inside the chip, urgent fill+pulse only when yourTurn ∧ ≤10s — the old own-seat rule
relocated intact), bound to the seat the sentence NAMES (yours on your turn, else the
named actor), minus concealed leader, ceremony/deal suppressed.

Live-verified (390 + 1456 [en], 390 [zh-Hant]; mid-deal + settled): alternating fill per
slot, row-major settled, ring-relative reserve stability (size AND position), peek/sliver/
box measured 0.5/0.36/0.86, z-flip live, pill laps block with "27 cards"/「27 張」chip,
headline "Planning time 80"/「起手思考 80」chip, zero .gd-plate__timer nodes. One live
find, pinned then fixed: the absolute pill's shrink-to-fit width is CAPPED at the zone box,
squeezing a partner-tagged CJK name to an ellipsis (zh-Hant 390) → width: max-content on
the lapping pill (+ T3 pin); re-probed clean in both locales, partner tag included.

Cross-model panel (Codex + Grok, isolated clones, identical brief BRIEF-REFINE.md;
producer≠auditor): CONVERGED on one real defect — the headline clock's soonest-of-
concurrent-deadlines pick could pin another payer's grace-clamped clock (and its urgency)
on "Your turn"/the named actor's line, since per-seat budgets genuinely diverge (server
disconnect-grace clamps; both auditors cited room-helpers.ts; my "same duration" comment
was wrong). Fixed: the chip binds to the seat the turn sentence NAMES (yours on your turn,
else actorSeats[0]), reading that seat's own deadline; + three concurrent-unequal-deadline
integration pins; + the swap-equality claim bounded (identical sets iff columns full:
n ≤ 14 or 27/28 — pinned with the 20-count inequality; skip path = count jump to settled);
+ the planning word regained its `connected` gate. Two Grok LOWs acknowledged-kept (the
6.5rem long-name cap is policy; string-level CSS pins are the DOM-free technique's known
depth, live probes cover the algebra). Full record: docs/audits/seatzone-refine-panel.md.
Gate 901/901 (55 seat-stack + 10 headline-clock); typecheck, lint:hooks, build clean.
Committed locally; push only on the owner's word.

## Remote seat zones: two-row compaction (2026-07-17) — owner mobile follow-up — local, unpushed

Owner directive (screenshot of the ring on a phone): the remote card-back blocks are now
realistic but the full-hand SIDE strips are tall — compact them into "two or three rows,
partially overlapping"; test the n-row arrangement + the name overlay for the optimal
mobile presentation; collaborate with Grok and Codex (review code or UI snapshots).

Tested 1/2/3 rows from one deal (in-page override of the row vars, both widths). Finding:
the ring HEIGHT barely moves with row count (the ring is a fixed grid; the side strips fit
their cells), but the horizontal CENTRE GAP collapses — at 390px 3-row sides run ~2.9
card-widths across each and leave only ~48px between opponents (trick area crushed), while
2 rows keep ~120px and turn the tall strip into a tidy near-square. **Chose 2 rows** (3
stays desktop-viable if the owner prefers). Kept the name/count/block vertical stack (the
decoupling from last round); the compaction comes from the cards, not the overlay.

Built: SeatStack wraps its backs into `rows` rows of `perRow` (helpers.seatStackRows /
seatStackPerRow) — ≤14 cards one line, 15+ two rows. Geometry generalised to TWO axes in
table.css off per-slot --gd-stack-pos (lay, step --gd-stack-exposure) and --gd-stack-row
(cross, step new --gd-stack-linefrac × --gd-stack-aspect). R10 holds within each row
(north/east straight, west reverses over perRow) AND rows grow inward toward the centre
from each seat's own edge (east reverses the row index, west straight) — the two sides
mirror on BOTH axes. perRow is pinned at the cap once wrapped (full top row + remainder,
NOT balanced), so the lay-axis extent is CONSTANT across every wrapped count 15…27 (no
grow-on-play, the 15→14 unwrap continuous on the lay axis) and the wrapped block box equals
the deal reservation (always 2×14). rows/perRow derive from the SIZED count, so `reserve`
shapes the block for its final 2×14 from the deal's first frame — the extent never reflows
as cards land.

Cross-model panel (Codex + Grok, isolated clones, identical brief, each re-ran the gate;
producer≠auditor). Grok: no HIGH; confirmed the calcs tile, the mirror holds on both axes,
the deal freezes both axes; raised balanced-perRow grow-on-play (accepted+fixed via the
constant-perRow policy), a pin missing the aspect factor (tightened), stale comments
(fixed), + LOW test strengthening (done). Codex flagged west's partial-row reversal as a
mirror break — **REJECTED**: west's partial row is the exact vertical mirror of east's
(both leave the gap one step from the extreme end, at mirrored ends; Grok independently
concurred and re-derived the offsets for 20=14+6). Fix RE-AUDIT — Grok CLEAN (re-derived
item-1 no-overflow 28≥27 + constant box + item-2 mirror under the larger fixed-cap gap;
gate 880/880 + typecheck/lint/build); Codex confirmatory. Record: docs/audits/
seatzone-multirow-panel.md.

Gate 880/880; typecheck, lint:hooks, build clean. Live-verified 390 + 1456 [en] + 390
[zh-Hant], settled and mid-deal: 2-row blocks, mirrored side columns, "27 cards"/「27 張」,
one-by-one growth in the reserved 2×14, R10 per-row order measured in both states.
Committed locally; push only on the owner's word.

Known pre-existing (NOT this change): all three blocks translate down ~23-28px together at
the deal→play transition (headline gains a "turn" line + the active pill gains its timer) —
a shared-ancestor settle, orthogonal to the per-block wrap; the block box itself is frozen
by `reserve` through the deal.

## Remote seat zones: realistic hands (2026-07-17) — owner redesign + direction follow-up — local, unpushed

Owner directive (screenshot of the in-game ring): the seat overlay should sit ONLY under
the name, decoupled from the cards and the count; the cards should be REALISTIC — one
card back per card, the same back presentation the deal uses, accumulating one by one
during the dealing animation; side players' cards rotate 90° (top view); backs at the
same size as face-up hand cards but much more overlapped; pick the name/cards/count
arrangement by UX best practice; the count needs a UNIT. Follow-up: placement direction
must be consistent per player — each lays cards from THEIR OWN right to their left,
newest on top ("the card on the very left is on the very top"), so the two side strips
mirror each other.

Built (workflow: implement + static/live lenses + fix + live re-verify; R10 direction
delta + its pins by hand): new SeatStack (one real theme CardBack per remaining card,
hand-size clamp lockstep-pinned, exposure 0.09w single-source) as the pill's SIBLING
inside a new .gd-seatzone (pill = identity/state only; count label + stack directly on
the table; active ring stays on the pill); east/west strips vertical (±90°), north
horizontal; placement direction R10: north/east cascade straight with the index, WEST
REVERSES (newest at strip top) — paint order is DOM order, no z-index, all pinned (T10);
new game.stack.cards key in all three locales ("{count} cards" / "27 張" / "27 张") with
handSizeTier escalation kept and hidden-count configs rendering ZERO backs (no leak);
deal wiring: DealOverlay onRemoteLanded fires per remote landing (marker path included),
GameTable keys the counters BY dealNo (helpers.RemoteDealt — stale counters READ as zero
on a new deal's first frame, no reset effect, no hands-2+ flash), and a `reserve` prop
sizes each strip for the final count from the first dealing frame so the ring never
reflows against DealOverlay's once-measured flight rects; old MiniFan/FAN_CAP/
--theme-back-* injection deleted (metrics contract intact); narrow (<720px) chrome
compression (header/tabs/headline) so the hand sits a screen closer at 390.

Review found + fixed: (HIGH) mid-deal stack growth reflowed the auto-sized ring against
once-measured flight rects — fixed by the deal-time reservation, then live-confirmed:
strips at final extent from frame one, ring/deck/fan pixel-constant, 108/108 landings at
0px error at 1456 AND true-390; (MED) post-paint counter reset flashed stale 27s on hands
2+ — fixed by the dealNo-keyed read; (MED) hand a full scroll below the fold — narrow
chrome compression brought 390 to trick-well + hand-top simultaneously visible, full fan
reveal 339px → 165px; plus React.memo on SeatStack (81 SVG backs no longer re-reconcile
on the 500ms countdown tick), unanchored CSS pin scanner, tab-switch counter hardening.

Visual verification (locale stated with width): desktop 1456 [en] settled + mid-deal,
true-390 iframe [en] + [zh-Hant], zh-Hant desktop; one-by-one growth in strict round-robin
with labels tracking 1:1; pre-deal shows NOTHING at any remote seat; R10 cascade measured
mid-deal and settled (north lefts increasing, east tops increasing, west tops DECREASING,
DOM index = arrival order). Two low findings documented, not fixed (flights transiently
occlude the north pill mid-deal; a server auto-play during choreography settles straight
to the post-play count).

Codex read-only audit pre-commit (clean-auditor doctrine: Claude produced, Codex
audited; record + dispositions in docs/audits/seatzone-codex.md): its HIGH — hidden-count
rooms rendered the growing stack/label mid-deal, contradicting the visibility config then
flipping to "—" at settle — FIXED (null now wins over dealing in stackCountFor, ternary
re-pinned + a null-beats-reserve component pin); its LOW — en critical aria lacked the
unit — FIXED ("Only {count} cards left!", dead game.plate.cards key removed from all
locales); its MED (west mid-deal position) REJECTED on physics: the pile is deliberately
bottom-anchored mid-deal, first card fixed, growing toward the player's left — both
states live-measured.

Suite 872/872; typecheck clean; lint:hooks clean; build clean. Committed locally; push
only on the owner's word.

## Lobby round table (2026-07-16) — owner design + three verified bugs — OPUS round — local, unpushed

Owner reported (screenshots + a design directive): the lobby's center ellipse is redundant;
typing a name in seat 1's form then clicking take-a-seat elsewhere behaved wrongly; a
seated player's name auto-appeared in the next seat's form; a degenerate lone-giant-card
state; and a DESIGN: keep the name panel separate, draw a REAL round table with 4 seats
around it, take-a-seat/leave on the seats, no rename (leave+resit covers it), no "Seat N"
labels — the geography IS the identity.

Root causes (all verified): the old lobby rendered a full pre-filled claim form inside the
FIRST empty seat — after any claim it MIGRATED (still filled) to the next empty seat (the
"name leak"), Enter submitted it to the first empty seat (a real wrong-seat path), and the
ring re-anchored on claim (cards shuffled). The lone-card state: seatCell returned null for
seats missing from the roster payload, so a short seats array rendered one flex-stretched
card.

Built (Opus implement + fix, Sonnet live/honesty lenses; my post-round polish): name panel
(no <form> — Enter structurally cannot claim), a felt-and-rosewood DISC with the room code
+ copy button ON it (the old code hero retired), four chips at fixed compass positions
(partners across; DOM order constant — no re-anchoring, pinned), take-a-seat per chip
claiming exactly that seat with the input clearing on submission (recorder pins,
red-then-green verified), leave on own chips, rename UI removed (transport kept), every
seat 0..3 always renders (lone-card impossible, pinned), no visible seat numbers (aria
keeps positional names). Review findings fixed: flank take-buttons wrapped 2-3 lines on
phones (button font/padding tightened; disc untouched) + a comment arithmetic drift; my
own 390 re-measure still caught the ENGLISH flank label at 2 lines after that fix —
shortened en 'Take a seat' -> 'Sit here' (zh 入座 already short); post-change measure:
single line everywhere, zero overflow (scrollWidth 375).

Visual verification (locale stated with width): desktop 1456 [en] + true 390 iframe [en],
REAL join flow (no token adoption): Enter claimed nothing; clicking the right seat seated
exactly that chip with the input clearing and no shuffle; second claim (self-play) took a
fresh name; leave returned the chip to empty (after a reload — my test iframe's hello had
taken over the seats, the documented newest-tab transport semantic, recovered by re-hello;
not a lobby defect); start gating + seated-only rule editing intact. Design note for the
owner: the disc uses a classic GREEN felt (new --felt tokens) — it reads instantly as a
card table against the lacquer/rosewood; flag if you want an on-lacquer tone instead.

Suite 836/836; typecheck clean; lint:hooks clean. Committed locally; push only on the
owner's word.

## In-pile selection (2026-07-16) — owner refinement — local, unpushed

Owner refinement (two reference images): a PICKED card must stay in its pile — partially
covered like any strip — with the cinnabar border marking its visible portion, instead of
painting its whole face over the strips below it.

Built inline (CSS-only): removed the position:relative + z-index:1 promotion from
.gd-fan__card--selected and :hover (added in the packed-stacks round), so pile paint order
stays natural and later strips keep covering the picked card's body; the selection ring's
covered portion hides under the next card exactly like the reference. The lift shrank
-12px -> -6px: a small nudge kept deliberately as the NON-COLOUR selection cue (nothing
encodes meaning in colour alone) that pokes the strip's top edge without uncovering the
pile.

Visual verification (locale stated with width): desktop 1400 [zh-Hant], live room. Picked a
mid-pile strip (6-hearts, second of a 4-pile): it stays buried with the ring on its visible
strip and the -6px nudge applied (computed transform verified); the pile's lower strips stay
fully readable. One stale-CSS false alarm during verification (the browser served the
pre-edit stylesheet until reload) — re-measured on fresh CSS before concluding.

Suite 827/827; typecheck clean; lint:hooks clean. Committed locally; push only on the
owner's word.

## DEPLOYED 2026-07-16 (2nd) — five commits: bottom bar, quiet table, choreo fixes, toggle animation, audit cleanup

Owner: "visually no issue. audit using codex and grok like usual this branch before merge.
then deploy." PANEL (Codex + Grok, identical briefs, scratch clones, full gate re-run by
both): NO high/medium findings across the four commits; both confirmed engine untouched and
828/828 green. Four LOWs: two restated the tests' own documented runtime/eyes-gated
limitation (marker timing + toggle FLIP — both live-verified under slow motion this
session); two actionable ones fixed pre-push (TrickWell's dead required jiefeng prop +
vacuous dual-state test collapsed to the single strong no-prose pin; a stale fold-useEffect
comment corrected to the layout-effect reality).

Pushed 303553a..45da1da (7723ad1 bottom bar, 687246b quiet table, e0874ff deal-choreography
fixes, 17bb01c sort-toggle animation, 45da1da audit cleanup). Gate before push: 827/827
(one vacuous case honestly removed), typecheck, lint:hooks. VERIFIED LIVE: /api/health
build == 45da1daf3c990c6990735b2b785fcbad522f482e (the pushed HEAD).

## Sort-toggle animation (2026-07-16) — owner feature — local, unpushed

Owner feature: the asc/desc sort toggle should play the SAME cards-fly-to-their-new-slots
animation as the post-deal sort beat, for consistency.

Built inline (small, contained — the FLIP machinery already measures every card's rect each
render; the change widens its gate): the useLayoutEffect now animates on TWO re-lays — the
deal->sorted transition (unchanged) and a descending-prop flip (new wasDescending ref) —
with the same SORT_BEAT_MS duration/easing. Selection, reveal, and play-shrink renders stay
instant (the original design decision, restated in the updated comment). prevRects being
refreshed every render means a toggle spammed mid-flight starts from the mid-flight rects —
graceful by construction. Reduced-motion path unchanged (no animation).

Visual verification (locale stated with width): desktop 1466 [zh-Hant], animate-only
slow-motion x6. Captured MID-FLIGHT: cards visibly in transit between their ascending and
descending pile positions on toggle; settled state correct both directions with the toggle
label consistent (label shows the CURRENT order). Suite 828/828; typecheck clean;
lint:hooks clean. No new pin: the behavior is WAAPI-runtime (eyes-gated like the deal sort
beat it mirrors); the grouping logic it rides on is already pinned.

Committed locally; push only on the owner's word.

## Deal-choreography fixes (2026-07-16) — three owner-reported live bugs — OPUS round — local, unpushed

Owner reported (with screenshots + a slow-motion find): (1) the full sorted hand visible
behind the hand-1 ceremony overlay — "should be NOTHING before receiving cards"; (2) the
face-up ceremony marker lingering on the table after flying to the leader; (3) the marker
PEEKING out of the deck pile (90% covered) during the deal, before its flight beat. The
owner also invited Opus onto dev — dispatched: Opus implemented, ran the exhaustive behavior
lens, and staffed the fix phase; Sonnet ran the live-repro and honesty lenses (logged per
the ladder).

Fixes (workflow closed with ZERO review findings across all three lenses; peek fix + pin
applied by the orchestrator after the owner's follow-up report):
1. PRE-DEAL GATE: new pure predicate holdPreDealFan (helpers) — the fan renders EMPTY (an
   explicit `hidden` prop, chosen over empty-hand/display:none so the DealOverlay's
   slot-measurement path stays byte-identical) from the moment a fresh deal exists until
   the choreography starts revealing. Opus also caught and closed a ONE-FRAME full-hand
   flash on hands 2+ (the event fold ran in useEffect, so dealNo lagged a paint) by moving
   the fold to useLayoutEffect (isomorphic wrapper keeps SSR/renderToStaticMarkup clean).
   Red-then-green pins: holdPreDealFan truth table + HandFan hidden/dealing markup +
   GameTable cut-beat wiring.
2. MARKER DESPAWN: the marker was never removed after landing — fill:'backwards' snapped it
   to the deck centre with the flying opacity stuck on. markerEl.remove() now runs in the
   land callback AFTER onMarkerLanded (suspense timing unchanged); the skip path (.finish()
   -> onfinish) runs the same callback; the viewer-is-leader path leaves the fan slot as
   the single owner. Pinned structurally (single marker source element); runtime is
   eyes-gated, stated.
3. MARKER PRE-BEAT PEEK (owner slow-motion find): the --flying class (opacity 1) was added
   synchronously at schedule time, so the face-up marker peeked from the pile for its whole
   pre-flight delay. Now timer-scheduled at exactly tick.delayMs via the shared skip-cleared
   timers list (a skipped deal keeps the marker invisible end to end). Pinned: rest-state
   opacity 0 (CSS token) + the class-add is timer-scheduled and appears exactly once
   (source pin, marked brittle-by-design); MUTATION-VERIFIED (synchronous re-add fails it).

Visual verification (locale stated with width): desktop 1466 [zh-Hant], slow-motion x4
(duration + delay both stretched). Observed live in one run: ceremony overlay over a
COMPLETELY EMPTY fan (vs the owner's screenshot of the full dimmed hand); the deck pile
showing only backs at every observed beat (the marker's sole appearance was mid-flight,
which is correct); after landing, a clean table — no stray face-up card — with the leader's
ring lit by the reveal. The fixes are width-independent choreography changes; no 390-specific
surface (stated, not skipped silently).

Suite 828/828; typecheck clean; lint:hooks clean. Committed locally; push only on the
owner's word.

## Quiet table (2026-07-16) — on-table info unified into the log; hand-size well; sort below hand — local, unpushed

Owner principle: judge every piece of on-table text by its value to the player — move it to
the bottom log or remove it; the table center shows ONLY cards, at the player's own card
size; the sort toggle moves below the hand.

Built (Sonnet workflow + three-lens review; final 818/818 green, typecheck + lint:hooks
clean):
- TrickWell = cards only, at HAND size (size="hand"; played cards measure exactly equal to
  hand cards — verified 50.7px == 50.7px at true 390). Deleted: the name-combo caption (the
  log's feed.played line is the same info), the waiting/lead prompt (headline turn sentence
  + active plate ring/timer already carry it), and the jiefeng banner — whose FULLER
  sentence ("{leader} leads for {finisher}") now REPLACES the terser feed.jiefeng line in
  all three locales (fold passes both names; semantic-at-fold, localized-at-render kept).
  concealLeader/nameFor/viewerSeat props dropped from the well; the HEADLINE's suspense
  gate is untouched byte-for-byte; dead leadPromptKey + game.trick.* keys removed.
  Well overlap tracks the hand clamp at -0.6; widest legal play = 10-CARD bomb (engine cap;
  the workflow's 8-card comment was corrected) = 4.6w, wrapping gracefully if the bounded
  centre cannot fit it.
- Sort toggle below the hand: HandFan -> .gd-actionsRow (grid 1fr/auto/1fr: ActionBar
  centered, pill right-aligned in its own track — no shared flex line with Pass, no mis-tap
  adjacency) -> bottombar.

Review findings, both fixed with live-browser proof: (1) HIGH — the actions row mis-centered
Play/Pass at 390 whenever the reason line rendered (the auto middle track sized off the
reason text and starved the flanks unevenly; grid measured "0px 316.7px 41.3px"); fixed by
taking the reason line out of flow over a reserved band — post-fix the middle track is a
constant 212px across ALL reason states/locales at 375/390/1024. (2) MED — the implementer's
own well-overlap analysis was wrong (gd-cardframe and gd-card--hand are co-classed on ONE
span, so the added wrapper --gd-cardw was dead code, proven via `initial !important` leaving
margins unchanged); removed, comment corrected. Plus two LOWs cleaned by hand: a leftover
debug harness (already gone) and the 8-vs-10-card-bomb comment (corrected with re-checked
arithmetic).

Visual verification (locale stated with width): desktop 1472 [zh-Hans + zh-Hant] and true
390 iframe [zh-Hant]. Verified live: a played pair renders in the well at exactly hand-card
size with ZERO text; the log's newest-first line carries the play ("阿華 出 對子 3" on top);
empty-center waiting text gone in cut and playing phases; sort pill below the hand,
right-aligned, present/hidden per phase; feed scrollbar engaged at 3+ lines; zero horizontal
overflow at 390 (scrollWidth 375); actions-row flanks measured symmetric.

Suite 818/818; typecheck clean; lint:hooks clean. Committed locally; push only on the
owner's word.

## Bottom bar: thin newest-first log + own plate (2026-07-16) — owner layout round — local, unpushed

Owner's annotated screenshot: the event log moves to the page BOTTOM and gets thin (newest
2 lines always visible, scroll for history), the OWN seat plate joins it on the same line,
and the hand rises toward the table; mobile must get better, not worse.

Built (Sonnet workflow + three-lens review; 816/816 green, typecheck + lint:hooks clean):
- GameTable: the ring's south slot is GONE (grid collapsed — the ring is genuinely shorter);
  .gd-handzone order is sortrow -> HandFan -> ActionBar -> .gd-bottombar [own SeatPlate +
  EventFeed], the plate keeping identical props (timer, pass tag, active ring, badges).
- EventFeed: renders newest-FIRST (render-layer reverse; the fold stays oldest-first so no
  test semantics changed), no scripted scrolling (newest is at the top by construction),
  FEED_LIMIT 6 -> 20 for real scrollback, aria-live=polite kept and role="log" deliberately
  NOT used (it implies additions at the reading end — a comment records the choice).
- CSS: .gd-bottombar flex row (plate flex:none, feed flex:1 min-width:0); .gd-feed
  max-height = exactly 2 lines + padding, overflow-y auto.

Review finding (MED, found by two lenses from different angles, fixed): the feed max-height
calc assumed border-box but the element was content-box, so the "exactly 2 lines" box
actually showed 3 (measured live pre-fix: 58.4px vs the documented 46.4px) — fixed with
box-sizing: border-box; post-fix computed maxHeight == rendered height == 46.4px.

Visual verification (locale stated with width): desktop 1422 [zh-Hant] + true 390 iframe
[zh-Hant]. Verified: ring 3-plates only, hand visibly adjacent to the table; bottom bar
top-aligned plate+feed on one line; feed NEWEST-FIRST live (the hand-start line rendered
above the older cut line; a fresh session's play event prepended); feed box exactly 2 lines
(46.4px border-box, measured); zero horizontal overflow at 390 (scrollWidth 375); the
bottom-bar plate carries the cut-phase timer + active ring (verified as the cutter seat).
Note observed, not a defect: a second same-origin tab/iframe takes over seat delivery
(token takeover by the newest hello), freezing the older tab's feed — pre-existing
documented multi-tab behavior.

Suite 816/816; typecheck clean; lint:hooks clean. Committed locally; push only on the
owner's word.

## DEPLOYED 2026-07-16 — seven commits: Cinnabar Court, drop-down switcher, stacked hand, packed index, 1.3x pip

Owner: "if everything is clean, merge and deploy this version." Gate before push: clean
tree, 812/812 suite, typecheck, lint:hooks, local production build — all green. Pushed
cb02e36..08d62d5 (7 commits: 47aad4e research, f1ad6b9 Cinnabar Court + framework seal +
switching, 7a91c24 panel hardening, 75131b3 drop-down switcher, b97ea2d stacked hand +
lacquer default, 403382c packed horizontal index, 08d62d5 1.3x pip). VERIFIED LIVE:
/api/health build == 08d62d5eb0475c390f579f5f509cf74e673d099f (the pushed HEAD) — the
deploy pipeline (typecheck + lint:hooks + vitest + build) passed by construction. Honest
note: the GitHub Actions LIST API was returning 503s during verification (github-side
outage), so the run records were unviewable at deploy time; the live build hash is the
primary evidence and it matches.

## Packed stacks + horizontal lacquer index (2026-07-16) — owner refs round 2 — local, unpushed

Owner refinements on the stacked hand (two reference images + one follow-up): (1) the corner
suit moves BESIDE the rank (horizontal index) at ROUGHLY THE RANK'S SIZE — clarity over
compactness (follow-up message; the first build had it at 60%); (2) piles compress so covered
cards show ONE index line; (3) the big body pip re-balances toward the bottom-right.

Built (Sonnet workflow + three-lens review incl. real-browser measurement; my same-size-suit
delta applied on top; final 812/812 green, typecheck + lint:hooks clean):
- Lacquer horizontal index: .gd-card__index--row (lacquer-scoped modifier; GhostFace and
  cinnabar-court keep the generic vertical column) — rank 0.36w, suit 0.34w beside it,
  two-glyph '10' rank at 0.28w. Gated OFF at mini (review finding: the first build leaked the
  row layout into the decl-chooser's pinned mini faces — fixed + regression).
- Pile strips are now a PER-THEME metric: DeckThemeMetrics.stackStripW (required, conformance
  range [0.3, 1.0]) — lacquer 0.42 (one line), cinnabar-court 0.841 (its vertical index,
  unchanged); stackOffsetW/stackMarginTopW take stripW + the theme aspect (magic 1.45 gone).
- Pile pitch -0.30 (0.70w visible: the full index row incl. suit for single-glyph ranks,
  ~92%+ for '10') with flex-wrap on the stack row: the worst-case 15-class fresh hand wraps
  to two centered lines at 390; the wrap pin re-derives the REAL 342px content budget from
  both stylesheets and requires >=8 piles per line.
- Pip: left 64% / top 66% / 0.55w — implementer measured pip vs index vs wild seal vs edge in
  a real Chrome render at 36/44/50.7/68px (tightest clearance 4.23px, pip<->seal at trick).

Review findings (both MED, both fixed + pinned): (a) the wrapped second line rendered
8.9px off-center — the sibling-selector negative margin fired across flex line breaks;
fixed by moving the overlap margin onto every stack with an equal compensating row
padding-left (algebraically identical single-line math, symmetric under wrap) + a
padding/margin lockstep pin; verified live post-fix: an 8+3 wrap at true 390 has BOTH lines
centered at exactly the same axis. (b) The mini leak above.

Visual verification (locale stated with width): desktop 1260 [zh-Hant] + true 390 iframe
[zh-Hant], lacquer + cinnabar-court on the same live hand. Verified: strips read
rank+near-equal-suit ('10♥/10♦/10♣' piles fully legible); pip bottom-right on base cards;
the wild 2H base shows seal + pip together; mid-pile selection lifts with the ring;
descending mirrors pile order; theme switch keeps piles intact (no row-modifier leak into
cinnabar-court); 390 zero overflow (scrollWidth 375) with the 8+3 wrap centered. My delta's
first pass also broke one factor-pin regex (caught by the suite immediately, restored with
the correct -0.3 pattern).

Suite 812/812; typecheck clean; lint:hooks clean. Committed locally; push only on the
owner's word.

Owner follow-up (2026-07-16): the body pip grew 1.3x (0.55w -> 0.715w). Re-measured in the
round's own harness (real stylesheet, getBoundingClientRect, 36/44/50.7/68px, A and '10',
wild seal present): zero overlaps with the index row / wild seal / card edge at every size;
tightest clearance 2.87px (pip<->seal at hand-min 44px). No position change needed. Suite
812/812, typecheck + lint clean.

## Rank-stacked hand + lacquer refresh (2026-07-16) — owner reference round — local, unpushed

The owner supplied two mainstream-Guandan reference screenshots and asked for: same-value
cards stacked into columns (each card's index revealed), less overlap, LARGER cards, the
classic-lacquer look brought toward the refs, and classic lacquer as the APP DEFAULT.

Built (Sonnet workflow, three-lens review; 802/802 green, typecheck + lint:hooks clean):
- HandFan settled mode groups the sorted hand into runs of equal levelValue — natural ranks,
  ONE level column (the wild heart level card lands inside it, exactly like the refs' marked
  level pile), SJ/BJ their own piles; worst case is PROVABLY 15 columns (engine-derived pin
  over buildDeck for every level). Single bottom-aligned row; base card of each pile shows
  its full face; stacked cards expose their index strip (offset 0.841w, compressing for
  piles >4 so an 8-copy pile stays ~4.4 card-widths tall, degrading to rank-only strips).
  DEALING mode is untouched: flat arrival-order rows, revealed/undealt slots, and the
  deal-overlay rect measurements all as before; the FLIP sort beat now slides arrival rows
  INTO the stacks (keys unchanged).
- Cards GREW: hand clamp 2.25-3.25rem/11vw -> 2.75-4.25rem/13vw = 50.7px at 390 (+18%,
  +39% area) and 68px desktop (+31%); column pitch -0.6 (0.40w visible per column keeps the
  whole identity column visible for every strip).
- Classic lacquer faces gained the refs' big center suit pip (serif glyph, 0.48w, left 66%,
  hand/trick only — mini untouched, chooser arithmetic intact); jokers stay wordless.
- DEFAULT flipped back to lacquer per the owner's "(app default)" — cinnabar-court stays in
  the drop-down; registry + non-default-switch tests updated honestly.

Workflow review caught TWO HIGHs before I ever saw the tree, both verified with real numbers
or a real browser: (1) the 390 worst-case pin assumed a 374px budget but the actual nested
content width is 342px (.app-main 32px + .gd-table 16px padding) — 15 columns at the -0.55
pitch would have CLIPPED on every phone; fixed by tightening pitch to -0.6 AND rewriting the
pin to DERIVE the budget from both stylesheets. (2) The first pip placement (center, 0.55w,
sans font by inheritance) measurably overlapped the corner suit glyph on EVERY card and the
wild seal on wilds (getBoundingClientRect evidence at 36/44/50.7/68px) — fixed (0.48w,
left 66%, --font-card pinned) and re-measured to zero overlaps. Plus one stale-comment MED.

MY visual gate then caught what DOM-free tests structurally cannot: the inline stack margin
calc(var(--gd-cardw) * F) computed to 0px — the custom property lives on a DESCENDANT of the
card button, out of var() scope, so stacked cards rendered full-height with no overlap.
Fixed by defining the clamp on the fan CONTAINER; the lockstep pin now also requires that
declaration (comments stripped). Verified live after fix: strips overlap exactly like the
refs.

Visual verification (locale stated with width): desktop 1260 [en] + true 390 iframe
[zh-Hant]; lacquer AND cinnabar-court on the same live hand (theme switch over stacks is a
pure re-render); 14-column fresh 27-card hand fits 390 with scrollWidth 375 and ZERO
overflowing elements; mid-pile selection lifts with a z-bump above its pile; asc/desc
toggle mirrors column order (jokers lead in desc, like the refs); a LIVE double re-cut
fired during setup (two uncountable flips in a row, ~0.3%) — re-cut loop + wordless mini
joker flip card verified live as a bonus. Honest note: a STACKED wild's strip hides the
seal band (the seal sits at 0.92w, below the 0.841w strip); identity is still unambiguous —
the strip shows rank+suit and "heart of level rank" IS the wild definition — and the seal
shows in full whenever the wild is the pile's base card or lifted.

Suite 802/802; typecheck clean; lint:hooks clean. Committed locally; push only on the
owner's word.

## Cinnabar Court deck theme (2026-07-16) — owner's pick BUILT — local, unpushed, panel pending

The owner picked a figurative Eastern-minimalist court reimagining (overriding unanimous
point 5 of the redesign research — recorded as a dated owner decision in
docs/research/card-face-redesign.md §2 with both reasons answered: IP by constraint, craft
by an explicit pre-drawing quality bar with abstract fallback). Full design record:
docs/design/deck-themes/cinnabar-court/DESIGN.md; the owner's five reference images live in
its reference/ (direction, not spec — 8.9 MB, docs-only, never bundled).

Decisions: SVG shipped / raster reference-only (pipeline fork resolved, reasons recorded);
name "Cinnabar Court" (id cinnabar-court, 朱砂宮廷/朱砂宫廷; Lacquer Court rejected for
app-identity collision, Goldtrace for naming technique not content); five original pieces
(3 courts x 4 suits by emblem+palette, 2 jokers), not fourteen; ONE adaptive theme,
detail keyed to the size prop; DEFAULT flipped to cinnabar-court (one-line revert:
DEFAULT_DECK_THEME_ID — flagged for owner veto), classic lacquer stays selectable.

CRAFT GATE: PASSED at ship sizes (52/42.9/36px on the table ground + 17.2px fan slivers),
two iterations + one emblem micro-iteration, judged on live renders (DESIGN.md §5 gate
result). Figurative courts ship; no fallback needed.

Build (two workflows, Sonnet implementers + three-lens reviews, one confirmed finding each,
both fixed): framework wild seal is now a language-neutral cinnabar circle-seal INSIDE the
identity column (left 0.07w / top 0.92w / 0.26w — junction triangle dead, CSS-token-pinned,
localized aria unchanged, wildBadge key removed from all three locales); reactive theme
switching (setDeckTheme/subscribeDeckTheme/useDeckTheme via useSyncExternalStore; localStorage
'pref:deckTheme'; in-memory override survives storage failure); header switcher beside the
locale control (client preference, not on the decision surface; three locales); lacquer
jokers wordless (filled star vs hollow lozenge — the vertical-rl letter-stack defect class is
CSS-pinned dead); cinnabar-court theme module wired around the FROZEN art modules (art.tsx +
pips.ts, Fable-drawn per owner dispatch). Conformance additions: no text nodes on joker faces
(every theme), wild-seal geometry pin, joker-emblem geometry pin per theme (right <= 0.40w,
no fixed-px horizontal offsets), mini=index-only ladder pin, pip-count pin against an
INDEPENDENT expected-count table (the self-referential version was caught by mutation
testing in review and fixed). Workflow review findings fixed: lacquer jokerMark box
originally landed at ~0.52-0.56w (occlusion regression) -> absolute 0.06w/0.30w; pip pin
self-reference -> independent table.

VISUAL VERIFICATION (live rooms, in-page adoption; locale stated with width): desktop
1260px [en + zh-Hant] and TRUE 390px iframe [zh-Hant]. Verified: 27 cards two rows zero
overflow at 390; identity column crisp at 17.2px pitch; wild 2H carries the seal in-column
in sliver AND full view (both copies at once in one hand); jokers distinct by emblem
silhouette + colour amount; K/Q/J separate by silhouette (crown+sword / red hood+flower /
flat hat+diagonal); cut ribbon + split halves + deal flights + arrival order + sort beat all
render the new back/faces; theme switch mid-hand is a pure re-render (selection made under
lacquer survived switching to cinnabar-court; F11 mini-fan back tokens swap live both ways).
NOT captured live: the ceremony flip/marker MINI-face frames (beats outpaced the slow-mo
patch, whose setTimeout/animate hooks the choreography partly bypasses) — covered by
component identity (same CardFace size="mini" as conformance + harness); stated honestly.

TWO defects found live, both fixed WITH ratchets before counting: (1) HIGH — useDeckTheme()
placed below GameTable's early returns = Rules-of-Hooks crash, blank table the moment a game
starts (invisible to the DOM-free suite); fixed by hoisting + NEW eslint ratchet
(eslint.config.mjs, react-hooks/rules-of-hooks only, scoped src/client; npm run lint:hooks;
wired into ci.yml + deploy.yml; MUTATION-VERIFIED — re-introducing the bug fails the rule).
(2) MEDIUM — the new header controls overflowed true 390 (page scrollWidth 485), fixed
structurally (flex-wrap on .app-header/.app-controls, max-width 100%) and re-measured
(scrollWidth 390, zero elements past the viewport); layout has no browser-test pin — the
390 eyes-gate checklist now carries the header check.

Image-gen research filed (docs/research/image-generation-options.md, sources + fetch dates
2026-07-16; Codex CLI image_generation VERIFIED reachable at $0 marginal — null option
stands, five owner images suffice).

PANEL (contract compliance, Codex + Grok on scratch clones, identical briefs; Codex clean as
auditor — compliance is a different artifact from the aesthetics it once proposed): verdicts
CLEAN on engine/protocol/DO theme-ignorance, switching isolation, locale/aria handling,
english-only coverage, and both ratchets' wiring. Four findings, ALL FIXED with pins:
(1) MED, found INDEPENDENTLY by both — the stacking pin overclaimed: .gd-card
(position:relative, z-index auto) created no stacking context, so a positioned theme
descendant with a large z-index could paint over the sibling wild seal; fixed with
z-index: 0 on .gd-card (traps the theme subtree) + the pin now requires the DECLARATION with
comments stripped — the first pin version passed on the explanatory comment's prose, caught
by ITS OWN mutation check, then re-verified (delete declaration → fails; restore → 789/789).
(2) LOW (both): the wild-seal pin lacked the joker pins' fixed-px/margin/transform
horizontal ban — parity added. (3) LOW (Grok): the reactive suite never asserted a switch to
a NON-default id — test added (lacquer round-trip with restore). (4) LOW-SUSPECTED (Grok):
single-nav growth could still widen the page at 390 — .app-theme/.app-locale now wrap too.
Codex's clone saw one unrelated property-test timeout under 3-way machine contention
(obligations.property.test.ts, 5s budget); green in Grok's clone and locally x4 — not a
round defect. Final: suite 789/789, 36 files; typecheck clean; lint:hooks clean. Committed
locally; push only on the owner's word.

Owner refinement (2026-07-16): the theme switcher is now a DROP-DOWN (styled native select,
one pill showing the active theme's localized name, goldleaf chevron; native picker on
phones, keyboard/AT free). Verified live: switching through it re-renders mid-hand both
directions and persists; at true 390 [zh-Hant] the header now fits ONE row (scrollWidth 375,
zero overflowing elements). Suite/typecheck/lint green.

## Card face redesign (2026-07-16) — verified, researched, three proposals — OWNER PICKED (see above)

Item-0 verification (live, elementFromPoint grid, [zh-Hant+en] x [desktop+true 390], asc+desc):
the wild marker is NOT occluded (83% visible, glyph readable — it already sits bottom-left) but
the mis-attribution is REAL: the triangle rides the sliver junction and reads as between cards.
English jokers are BROKEN (vertical-rl upright letter-stacks overflow the card). The measured
design envelope: 390 → card 42.9px, fan pitch 17.2px (a 40% sliver owns all identity).

Research (cited, fetched 2026-07-16) + THREE anchoring-free proposals (Fable lead per owner
request — logged; Codex + Grok, identical briefs, never cross-shown; design panel, not audit).
UNANIMOUS foundation across all three: identity column (rank/suit/wild-seal inside 0.36w),
wild becomes a language-neutral cinnabar SEAL in the column (aria stays localized), jokers
word-free with shape+colour dual coding, ONE adaptive theme, pip bodies + abstract courts,
plus two new testable contract pins (no text nodes on joker faces; wild paint box right
<= 0.40 x cardw). THE FORK for the owner: A "Celestial" (sun/moon jokers, warmest) vs B "Crest"
(crest + sparse jester bodies) vs C "Corner Seal" (pure seal geometry, most disciplined).
Recommendation: C as base; A's sun/moon drops in cleanly if warmth wanted; against B's jester
bodies (craft/IP-adjacent). Full record: docs/research/card-face-redesign.md + proposals/.
BUILD HELD for the owner's pick.

## Current phase: DEPLOYED — seven audited rounds live (owner-authorized push 2026-07-16)

**Last updated:** 2026-07-16 (deploy)

## Deploy record (2026-07-16, owner: "if everything is clean, merge and deploy")

Pre-push gate: clean tree, 4 typechecks, 768 unit, 40 e2e — all green. Fast-forward merge
feat/cut-deal-refine -> main (f64b272..b562161, 34 commits, seven audited rounds: design
refinement items 1-5; cut & deal refinement + clockwise fix; deal fidelity + the Codex
producer!=auditor policy; ceremony marker geometry; ceremony suspense/re-cut + English-only
sweep; owner live-build feedback incl. the heart-only wilds correction; the lead-reveal-text
refinement). Push triggered CI + Deploy: BOTH green (CI 2m12s, Deploy 1m19s). Live verification:
https://smashegg.mikechwu-iams.workers.dev/api/health returned build
b562161ef906d0a0bb7eb28c11a61ba4043c7c24 == the pushed HEAD, exactly. (This STATUS record
commit rides after the deploy; the next push will advance the live hash past b562161.)
Still open for the owner: the cut-slider keyboard/AT channel (documented, not fixed — jitter
option available on request).

## Owner live-build feedback round (2026-07-15) — 6 items from the owner's own play session

**Item 1 — RULES CORRECTION (engine, in-house).** Uncountable = jokers + the WILD (the HEART
level card) ONLY; other suits of the level rank COUNT. The previous all-suits rule was drift
from the sourced official text ("jokers or the red-heart 2"); the owner caught it live when a
clubs-2 flip was refused. isCountable now uses isWild. Re-derived consequences, all restated
consistently: 6 uncountables (was 12) => AFK termination bound <=7 alarm cuts (200-seed pin +
the named liveness case updated); the level-2 conditional split becomes 32/22/24/24 over 102
countables => P(even)=56/102~54.9% vs 45.1% — the residue edge SHRINKS to ~9.8pt (was 16.7pt)
— conditional test re-pinned with the new numbers; copy in all three locales now says jokers +
the heart level card.

**Items 2-6 (presentation).** The landing reveal sits centred just below the deck pile (never
over plates/fan); the trick-well lead prompt appears only after the centre is CLEAR (gated
through the whole deal, fades in); the sort toggle hidden through cut/ceremony/deal; countdown
chips (planning window included) wait for the sorted hand, every seat; the ceremony panel shows
ONLY the final two cards in any condition and the cut panel only the LATEST flip (the full flip
history stays public in payload/feed — the redaction pins unchanged). Unused reflip key dropped
x3 locales.

Live-verified (zh-Hant, desktop 907px, TIMED room): exactly 2 ceremony cards; no
toggle/prompt/planning label through cut->ceremony->deal; reveal at x-centre below the deck;
settled state restores all three.

**FOCUSED PANEL EXECUTED (both lineages, clean auditors — in-house build).** Both independently
re-derived the heart-only arithmetic (32/22/24/24 over 102 => 56/102~54.9%) and confirmed the
engine change, the five UI gates, and the scope. Grok caught a HIGH the sandboxed Codex could
not reach: the e2e still pinned "counted flip is never rank 2" (all-suits thinking) — a
legally-counted non-heart 2 failed the suite, which Grok REPRODUCED live (its e2e run: 2
failures). Fixed (e131091): the pin now forbids exactly 2H, engine-guaranteed. Both flagged the
stale 7/12 odds in types.ts + 12-uncountables comments (fixed same commit; prose pin extended
with the stale numbers; historical STATUS entries annotated with SUPERSEDED brackets, never
rewritten). Codex: runtime clean, 768 unit green (e2e sandbox-blocked). Grok: all claims PASS
after fixes, 768 unit + e2e verified. 768 unit + 40 e2e + 4 typechecks green at close.

## Ceremony suspense/re-cut round — PANEL EXECUTED (completing the record below)

Codex: 5/6 PASS + one LOW (three stale count-walk comments — fixed 0db79b1, prose pin extended
with the walk phrasings); its e2e blocked by sandbox listen EPERM (environment). Grok: first run
died to a PLAN RATE LIMIT (a genuine null, retried rather than presented as coverage); the retry
returned 7/7 PASS — CLEAN, including item 4 (the English sweep, which Codex authored and could
not audit): sweep verified comments/docs-only, allowlist honest, locale values untouched, plus
two nits (the stale <=4.5s GameTable comment — fixed d047e61 — and some clumsy sweep glosses,
accepted). Both lineages ran 768 unit green; Grok ran e2e 40/40. The re-cut liveness argument,
the actedSeat-only timing scope, the supersession notes, the UI-level suspense framing, the
900ms budgets, and the keyboard/AT finding were all independently confirmed.

**Last updated (prior below):** 2026-07-15 (ceremony suspense/re-cut)

## Ceremony suspense/re-cut round (2026-07-15) — 6 owner items

**PROCESS ENTRY — SUPERSESSION (METHODOLOGY 9/10), dated 2026-07-15.** The previous round's Q4
rule ("the count walks from the cut to the first countable card, skipping jokers/level cards")
is SUPERSEDED by the owner's re-cut rule: an uncountable flip means the cutter CUTS AGAIN in the
same panel, with a fresh clock; the count never walks. A re-cut re-picks the marker too (one
physical act). Recorded in types.ts (ceremony payload doc), the engine comments, and the test
headers — not silently rewritten.

**Item 2 (engine + a sanctioned timing change, built in-house — load-bearing).** cutDeck is now
repeatable while the flip is uncountable: state carries attempts + the PUBLIC flip history
(view.ceremonyFlips — the stated redaction exception now includes attempt flips; everyone at the
table watched them); each failed attempt emits public ceremonyCutFlipped. LIVENESS FINDING FIXED
EN ROUTE: the room's decision table preserved base for a seat that "remained an actor", so an
alarm-fired default cut flipping uncountable left an EXPIRED base → the alarm would refire the
same deterministic middle cut in a tight infinite loop. Two-part fix: (a) nextDeadlines gains
actedSeat — the seat that just ACTED and remains an actor re-arms FRESH (the owner's restart timer;
preserve-base stays scoped to co-actor actions, i.e. the second tribute payer); (b) defaultAction
varies its position with attempts, so the AFK path terminates in ≤13 alarm cuts [SUPERSEDED
2026-07-15 by the heart-only correction: 6 uncountables, bound ≤7] (only 12
uncountables exist in a double deck) — both pinned (decision-table cases; a named hunted-seed
alarm-path re-cut case; a 200-seed AFK termination sweep). Bonus correctness: a cutter who
becomes the LEADER now gets a real planning window instead of inheriting a stale turn clock.
Termination for a LIVE cutter: no hard bound exists (they could keep hitting ~11% flips), but
the cutter cannot TARGET uncountables (the deck is hidden), each attempt is ~89% countable
(expected attempts ≈1.14, geometric tail), and the alarm path bounds the AFK case — argued in
the engine comment, deliberately unbounded for humans. Replay reproduces the whole logged cut
sequence; both uniformity sweeps + the conditional edge re-measured over the LOOP; e2e cut
steps loop.

**Item 1 (suspense — the reveal moves to the marker's LANDING).** The ceremony panel now ends at
the marker's IDENTITY ("this card is tucked back into the deck — whoever draws it leads") and
never names who gets it; when the face-up marker lands mid-deal, the leader's name fades in
(goldleaf) and the until-then-suppressed seat ring lights up. STATED HONESTLY everywhere: this
is UI-LEVEL suspense, not concealment — markerSeat/cutPosition are public in the payload and the
client needs the depth to fly the marker; devtools could peek; a presentation choice for a
family game. No comment claims the leader is hidden.

**Item 3.** MARKER_FLY_MS 500→900. Budgets re-derived honestly: duration = max(backs, marker
landing) — at the deepest legal cut the marker IS the last landing (the drama pointing at the
right card); typical full experience ≤5s, worst legal cut ≤5.5s, both pinned.

**Item 5 (exploitability update + a finding CONTRADICTING the owner's premise).** The ribbon is
24 slivers (not 108 countable edges) ✓, and no number is displayed ✓ — but the mitigation is
PARTIAL: a native range input exposes exact positions through the KEYBOARD (Home/End anchor +
arrow keys step by 1) and through assistive tech (aria-valuenow announces the exact value). So
"the cutter can't reach the exploit through the UI" is NOT fully true today — a keyboard cutter
can target a residue class. Documented at the slider (CutPanel header) per the owner's
don't-police stance; options if he wants it closed: a small per-mount jitter on the slider→
position mapping (~±2, physical-feeling, closes both channels), or accepting it as-is. OWNER
DECISION PENDING — reported, not pre-empted.

**Item 4 (English-only sweep):** in flight (Codex, non-load-bearing per the allocation policy) —
CJK swept from comments/test-names/expect-messages/docs prose; locale files and locale-DATA
assertions exempt (data, not code); direct quotes of official rule text in research docs kept as
citations; a structural CJK lint test pins the rule. Item 6: tiers logged per subtask (item 2
hard→main loop on the owner-set session model; items 1/3 standard→main loop alongside; item 4
standard→Codex).

764 unit + 40 e2e + 4 typechecks green at build close. Visual verify (desktop + TRUE 390, and a
zh-Hant pass — locale now recorded alongside width) + both-lineage panel next.

**Last updated (prior below):** 2026-07-15 (ceremony marker)

## Ceremony marker round (2026-07-15) — CRITICAL defect + rules fork + result-panel restyle

Owner report: the draw ceremony is deterministic ~89% of the time; the marker is in the wrong place.

**Diagnosed (confirmed):** `runCutRitual` sets `markerSeat = stepSeats(firstDrawer, (flips.length-1)%4)`
and deals the marker at deal index `flips.length-1`. `flips.length` is 1 unless a joker/level card
forces a re-flip (~11%: 4 jokers + 8 level cards / 108), so ~89% of hands `markerSeat = firstDrawer`
— the first drawer always draws the marker and always leads. `count reaches X` / `the marker card lands in X` / `that seat leads X`
collapse to ONE seat. **cutPosition never enters the marker's deal index at all** — the cut only
shifts who leads via which card sits on top (the count). This is the theatre we rejected for the
cut, reintroduced in a plausible formula (the "NO new field" constraint drove the semantics).

**Uniformity-collapse finding (owner's suspicion, confirmed):** both 400-seed sweeps passed because
`markerSeat = firstDrawer = stepSeats(cutter, offset)` and the cutter is PRNG-uniform → the test was
proving "the first drawer is uniform via the uniform cutter," NOT "the marker draw genuinely spreads
the leader." A correct placement makes `markerSeat` depend on cutPosition too (still uniform via the
cutter, but genuinely varying from firstDrawer).

**Rule research (WebSearch; BCTA/competitive Guandan sources):** the OFFICIAL rule is ONE card — South cuts,
flips one the marker card, jokers/heart 2 re-flip, count from the cutter by its value CCW to the first DRAWER, and
**whoever draws that the marker card leads** (one card, two jobs). The the marker card sits at the CUT POSITION (owner: "cut
at 15 ⇒ 15th card dealt"), so the marker's deal index must be a function of cutPosition — correct
under BOTH the one-card and the owner's two-card house rule. The two-card form is NOT in the
competition rules reached (cert/403 on some) — tag UNCERTAIN, likely the owner's table/regional
variant. "Sometimes two cards appear" = the joker/level RE-FLIP sequence (rejected + accepted card
with re-flip labels), NOT the two-card marker — confirmed in code.

**OWNER ANSWERED (prose brief) — BUILT.** ceremonyCardCount: 2 default (1 = official form,
reachable as config; the UNCERTAIN tag on the two-card form is an honest null); count card =
lifted packet's bottom, marker = table packet's top, adjacent at the split; the ceremony is
PUBLICLY VERIFIABLE (both cards shown to all four seats, derivation legible; the redaction
blanket rule now carries exactly the stated exceptions flips ∪ {marker}, pinned as such); the
marker is a PHYSICAL INSTANCE (deck position — two decks mean twins; no copy names it by rank).

**PROCESS ENTRY — REVERSAL (METHODOLOGY 9/10), dated 2026-07-15.** Round-1's claim "a different
cut position REALLY changes every hand" is SUPERSEDED: the cut PRESERVES deck order (lift, look
at the split, put back) and never changes which cards a seat group holds. The original partial
rationale — the cut's physical anti-stacking purpose — is gone with it. What stands, and is now
the recorded rationale: the cut is genuine player agency because it picks the marker's depth,
which REALLY moves the leader. The old cut-agency test (positions 20 vs 80 ⇒ different hands) is
REPLACED by its reversal pin (hand groups invariant; the leader moves). PLAN §4 cutDeck prose
updated with the superseded note; ceremony.test.ts carries the dated pins.

**THE EXPLOITABILITY FINDING (owner's arithmetic, CONFIRMED by measurement).** markerSeat =
stepSeats(cutter, (X + N) mod 4) where the cutter picks N. X=(value−1)%4 is skewed at level 2
(offsets {A,5,9,K}→0=4, {6,10}→1=2, {3,7,J}→2=3, {4,8,Q}→3=3, so P(X even)=7/12 [SUPERSEDED
2026-07-15 by the heart-only correction: 56/102≈54.9%]) — and hand 1
ALWAYS runs at level 2, so the flat levels (A/5/9/K) never apply to the real ceremony. Measured
in the engine (N=500, cutter fixed, even vs odd depth): own-team lead ≈58.3% vs ≈41.7% — the
~16.7pt swing the owner predicted. ABSOLUTE uniformity still holds (PRNG-uniform cutter; both
400-seed sweeps pass) — the same failure shape as the defect, one level up, and the variance
assertion alone would NOT have caught it. New CONDITIONAL test pins the exact numbers. **Owner
decision (recorded): document precisely, do NOT fix** — the physical table has the identical
property, and this is a family game that doesn't police exploiters. "Uniformity holds" is no
longer written unqualified anywhere: absolute holds, conditional does not, stated in
types.ts/index.ts/the tests. Corollary correction (owner): hiding the cut index has a LITTLE
secrecy value after all (a slider could count to a residue class where a physical cutter
cannot) — cut.ts comment corrected.

**Build (engine + client, in-house — load-bearing, Codex stays auditor):** runCutRitual reversed
geometry, both forms, oracle-verified bit-for-bit; ceremony payload += marker + markerDealIndex
(public by nature — the table watches where the marker sits); defect regression pinned (the
marker-to-firstDrawer collapse scored ~11% differs, now ≥40% enforced, equation pinned
everywhere); public-exception redaction pin (per seat: visible tokens outside own hand == flips
∪ {marker} exactly, at three cut depths); one-card form in the obligations CONFIG_MATRIX; client
marker beat now FROM THE PAYLOAD (markerDealBeat = defensive clamp only); the 2× slow window
(MARKER_SLOW_TICKS=6 starting 2 before the beat, clipped at deck end) with budgets honestly
re-derived and re-pinned (landings+slow ≤4.5s; full incl. sort ≤5s); CeremonyOverlay restyled
into Lacquer Ledger (ritual order: who cut → flips + the marker card (labeled, cinnabar-edged, both public)
→ count with its VALUE → the marker card lands in → goldleaf that seat leads; reduced-motion summary kept); i18n
counting→count/countLabel/markerLabel ×3 locales. Bot-name convention fixed (A-Ming/A-Mei/A-Hua/A-Qiang;
[[visual-verify-room-adoption]]). CUT panel untouched (praised).

**Visual verification (desktop + TRUE 390, iframe recipe):** the defect fix is VISIBLE — two live
rooms showed count reaches and that seat leads as DIFFERENT seats (A-Ming→A-Mei at cut 41; A-Qiang→A-Hua at cut 39, where
the marker card was even a level-2 card, demonstrating any-card markers); the restyled panel reads in
ritual order with the goldleaf banner (caught ivory in the first pass — fixed d6f45fb) and is
legible at innerWidth=390 with no H-overflow; a runtime probe confirmed the marker's animation
delay = 1584ms = 41×36 + 3 slow ticks, bit-for-bit the pinned schedule.

**PANEL EXECUTED (both lineages, headless scratch clones; built in-house so both were clean
auditors).** Codex: 7/8 claims CONFIRMED (suites 753 green; e2e blocked by sandbox listen EPERM,
environment not product). Grok: same 7 CONFIRMED and ran e2e 40/40 green. BOTH refuted claim 8
identically: six comments still asserted the superseded rotate-the-deck / collapsed-marker /
unqualified-uniformity model (index.ts banner, types.ts state doc, ceremony.test header,
DealOverlay header incl. the literal defect formula, cut.ts "hidden + uniform", CutPanel
unqualified "leader is uniform"). **Fixed (0978427)** and pinned per the ratchet: a
superseded-model prose pin forbids the exact stale phrases across the seven files. Independent
convergence note: Grok re-derived the offset arithmetic itself (4/2/3/3 → 7/12) and confirmed the
conditional numbers. **754 unit + 40 e2e + 4 typechecks green. Round DONE — merge/push (production
deploy, now FOUR queued rounds on feat/cut-deal-refine) awaits the owner.**

**Last updated (prior below):** 2026-07-15 (deal fidelity)

## Deal fidelity round (2026-07-15) — 3 deal bugs + the Codex producer≠auditor policy

Owner brief: two visual deal bugs, one load-bearing fidelity fix, and a standing Codex-allocation
rule. All on branch feat/cut-deal-refine (stacked on the cut & deal refinement round below).

**Item 4 — the Codex policy (METHODOLOGY, next to the model ladder).** Whoever PRODUCES a change
cannot be its independent auditor (consultation anchors too). Load-bearing (engine/protocol/
redaction/timing/DO alarm) → Codex stays an AUDITOR, built in-house. Not load-bearing (UI/anim/
tooling/tests) → Codex may implement, audited by Grok + the eyes, never by Codex. Applied THIS
round: item 3 in-house (Codex a clean auditor); items 1-2 Codex-authored (Grok + eyes audit).

**Item 3 (78e11f4) — faithful deal: true arrival order + one sort beat. THE VERIFY-FIRST FINDING:**
the owner's redaction argument is right — publishing per-seat deal order leaks nothing — and
STRONGER, it was ALREADY published. handStarted.hands[X] always carried seat X's cards in the
engine's round-robin deal order; viewEvent redacts to X's own cards and preserves the order; the
client received it and threw it away, animating fake pre-sorted slots. The STATUS "true arrival
order unknowable BY REDACTION" claim was simply WRONG (corrected in place). So CLIENT-ONLY — no
engine/protocol/view change. HandFan now lays cards out in arrival order while dealing (revealed
uncovers the landed prefix) and re-lays sorted in one FLIP beat at the end (cards keyed by sorted
index so the slide animates across the 2-row split; reduced-motion skips it). Honest budget
re-pin: dealWithSortMs = landings + settle + one sort ≤ 5s. Pins: obligation-3 (each seat
delivered EXACTLY its own 27 in unsorted deal order, nothing from the other 81; 16 views, never
pre-sorted); dealToHandIndices bijection incl. duplicates; HandFan deal-order render; sort budget.

**Items 1-2 (57649c3, Codex-authored) — two presentation bugs:**
- Item 1: the deck depth shadow-slab selectors were descendant (`.gd-deal__deck .gd-card`), so the
  marker card inside the deck rendered as a stack. Scoped to `.gd-deal__deck > .gd-cardframe >
  .gd-card` — deck keeps its slabs, marker is a single flat card.
- Item 2: the centre deck (z-9) occluded the trick-well turn prompt. `.gd-well` → position:relative
  z-index:10, prompt paints above. CSS-token pins for both.

**Visual verification (state-driver + Chrome, desktop AND true 390px):**
- Obs 3 at DESKTOP: froze a deal mid-flight — 11 own cards landed in genuine unsorted arrival
  order (clubs4 spades4 heartsJ hearts6 hearts4 clubsJ … — NOT the 11 lowest a pre-sorted deal would show);
  after completion the fan settled fully rank-sorted (3,3,3,4,4,4 … A,A,2,small joker). Sort beat works.
- Item 1: deck back keeps 7 shadow-slab layers; the marker card's computed box-shadow is 'none'
  (single card). Item 2: the "wait for X to lead" prompt is legible above the deck (well z-10).
- TRUE 390px (iframe, innerWidth=390, no H-overflow): the 27-card sorted fan is legible in 2 rows
  and the prompt reads clearly. (The obs-3 sort + items 1-2 fixes are width-independent; the
  mid-deal freeze was captured at desktop, the settled/390 render confirmed via the iframe.)

**PANEL EXECUTED — the new policy in action.** Codex audited ONLY item 3 (it authored items 1-2,
so it cannot self-audit them); Grok audited item 3 + items 1-2. **Both CLEAN, no findings.**
Codex: all 6 item-3 claims CONFIRMED — obs 3 is client-only (`git show 78e11f4 -- src/engine
src/server src/shared` empty), no cross-seat leak, foldEvents own-only, obligation-3 pin real,
honest budget, replay/uniformity intact (its e2e blocked only by sandbox 127.0.0.1 EPERM). Grok:
all 8 CONFIRMED incl. items 1-2 — marker slabs correctly scoped (deck keeps them, marker doesn't),
and the well/deck stacking verified (both under `.gd-table`'s context so z-10>z-9, ceremony
overlay mutually exclusive, toast z-20). Both independently answered the owner's question — does
publishing per-seat deal order leak any other seat? **NO.**

**Self-caught + fixed before ship (5fa44dd):** the HandFan FLIP animated ANY position delta, so a
play (hand shrinks, indices remap) or the sort-direction toggle would have animated too. Gated to
the deal→sorted transition ONLY; every other render stays instant. (A pure-animation refinement;
the panels' redaction verdict is unaffected.)

746 unit + 40 e2e + 4 typechecks green. Round DONE — merge to main + push (production deploy) awaits
the owner; main already carries the two prior unpushed rounds too.

**Last updated (prior below):** 2026-07-15 (cut & deal refinement)

## Cut & deal refinement (2026-07-15) — obs 1 (no cut index) + obs 2 (marker at true beat)

Owner brief: two observations, verify-first. **Obs 1** — hide the cut index, spread the deck to
the slider's width and split it live into two packets. Owner's stated reason (the index leaks
who gets the marker) needed VERIFYING: leak-real ⇒ fairness bug + named regression; no-leak ⇒
remove the number for DESIGN reasons. **Obs 2** — the marker card must fly DURING the deal at its
true beat, not tacked on at the end.

**Investigation FIRST (the gate).** Adversarial workflow, four diverse-lens skeptics all trying
to REFUTE "no leak" + a marker-index verifier — unanimous **NO-LEAK** (high confidence, concrete
file:line each): during `ceremonyCut` every view carries only the public `ceremonyCutter`; the
committed deck lives solely in `state.ceremonyCut.deck`, never in any view/event; the outcome
(firstDrawer/markerSeat) is a function of the HIDDEN deck computed only at the `cutDeck` commit;
the cutter's client lacks the deck to predict anything, and the displayed number was the raw
index only. So the number comes off for DESIGN reasons (no physical analogue, meaningless, breaks
the metaphor), CONFIRMING the owner's own reading — no conflict, proceeded to build. (One note:
skeptics flagged a `debugAuthorized`-gated `/dump` dev endpoint that can egress the deck — a
pre-existing debug tool, not a player-reachable path; out of scope.)

**Obs 2 redaction decision: NO new server field.** The marker is `flips[last]` and lands at deal
index `flips.length - 1`; `flips`/`firstDrawer`/`markerSeat` are ALL already public in
`handStarted.ceremony`, so the beat is derived client-side. No new field, no new redaction
surface, grammar pins unchanged.

**BUILD (12ff7bf) — all client presentation + pure predicates; engine/protocol/DO untouched:**
- **Obs 1:** removed the numeric index (all three locales; `game.cut.position` deleted).
  `CutRibbon` draws CUT_RIBBON_SLIVERS overlapping backs spread to the slider width; each sliver
  past the split shifts by a gap (> pitch), so dragging slides the split along the ribbon — the
  deck visibly parting. Pure split geometry (`cut.ts`: cutSplitFraction + cutLeftCount) pinned
  (monotonic, conservation, endpoints). Legal cut range CUT_MIN..CUT_MAX untouched (slider
  min/max pinned) — legalActions/defaultAction cannot drift.
- **Obs 2:** the deal now runs FROM the first drawer (public) so the marker lands at its true
  beat; the face-up marker replaces the back at `markerDealBeat(flips.length)`, leader still gets
  exactly 27. Honest budget re-derivation: choreography = landings + settle (≤4.5s); the old
  landings + MARKER_FLY + 200 tail is GONE — it got shorter and more faithful.
- Regressions: named engine leak guard (cutter's `ceremonyCut` view carries no
  firstDrawer/markerSeat/flips/cutPosition); CutPanel shows no numeric index + spectator parity;
  marker beat lands at the leader in a first-drawer-first schedule; re-pinned budgets.
  **737 unit + 40 e2e + 4 typechecks green.**

**Visual verification (state-driver bot + Chrome).**
- Obs 1 at DESKTOP and TRUE 390px (iframe recipe, innerWidth=390, no H-overflow): the split
  tracks the slider across the whole range (min → all-right, mid → centred, max → all-left),
  gap clearly exceeds card pitch, no number, legible at phone width; spectator sees the spread
  with no slider/number.
- Obs 2 at DESKTOP: froze the deal mid-flight (8× WAAPI slow-mo) — the face-up marker card flies
  to the leader CONCURRENT with the back flights, not after. Runtime probe confirmed
  `markerDelayMs === 0` (true beat for flips.length=1) and `reducedMotion=false` (real
  animation). The deal flights are rect-derived / width-independent, so the beat behaviour holds
  at 390 by construction (flights verified at desktop; cut UI verified at true 390).

**Owner decision to raise (not smuggled):** the CeremonyOverlay pre-announces the leader
(「that seat leads」) BEFORE the deal, which softens obs 2's "watch it come to you" suspense. Trimming the
overlay to end at the count (letting the deal reveal the marker landing) is a connected design
change to a DIFFERENT component than obs 2 named — flagged for the owner, left unchanged.

**PANEL EXECUTED (both lineages, headless scratch clones).** Grok: all 6 claims CONFIRMED, no
findings, 737 unit + 40 e2e green — CLEAN. Codex: confirmed 5/6 and caught ONE real Medium — the
deal order was built from a fixed CCW display cycle, so under `turnDirection:'clockwise'` (which
the engine supports and tests) the marker — the load-bearing who-leads card — would fly to the
WRONG seat. Both independently confirmed: no pre-commit leak, obs 2 adds NO server/view field
(`git show HEAD -- src/engine src/server src/shared` empty), both uniformity sweeps pass, legal
cut range byte-identical, honest budget, no engine/timing/DO smuggled in.

**Fix (3cf08ed):** `dealDirOrder(dir, clockwise)` now mirrors the engine's nextSeat (CCW seat+1,
clockwise seat+3), and GameTable passes `variant.turnDirection` (the client already holds the
config — no new data). schedule[beat].target is now the engine's markerSeat under EITHER config;
DealOverlay comment corrected. Regression pins both directions, closing the loop with the
engine's own clockwise counting test. **738 unit + 40 e2e + 4 typechecks green.** Fix re-audit
(Codex, fresh clone): all 4 points CONFIRMED, no new issue — CLEAN (default CCW unchanged;
clockwise bug closed; both directions pinned; DealOverlay comment now accurate).

**Visual note (honest):** the CCW default is verified in the browser (desktop + true 390 for the
cut UI; desktop for the deal marker). The clockwise fix is UNIT-verified only — clockwise is not
exposed in the lobby UI (reachable solely via direct API room creation), so the marker-at-right-
seat guarantee under CW rests on the property pins + the engine's clockwise test, not the eyes.

**Last updated:** 2026-07-15 (prior: refinement round)

## Design-refinement round (2026-07-15) — PROPOSAL out; items 1-2 decided+justified, 3/4/5 forks with owner

Owner brief: 5 items — (1) nickname edit + leave/change seat [FULL gate: AUTHORITY —
release MUST invalidate the seat token, row-level hash delete + delivery-map purge +
stale-token starvation e2e]; (2) per-seat planning window [FULL: TIMING — actedThisHand
per-seat flag replaces the fragile global held===108 predicate; timingClass(state, seat);
tribute CONSUMES the window (owner lean adopted + justified); untimed stays moot];
(3) REAL cut in the draw ceremony (flip-to-lead) [FULL: ENGINE — cutDeck action, the committed deck in S
(ceremonyCut.deck, redacted like PRNG), flips AND deal derive from the cut, defaultAction middle cut,
uniformity re-proven]; (4) physical deal animation [presentation; proposal said ≤4s, landed
at ≈4.2s landings / ≤5s full choreography inside the 90s planning window; AFTER item 5]; (5) DeckTheme framework [presentation; framework owns the
wild marker/selection/focus overlays so no theme can remove them; conformance ratchet].
Buckets stated per the brief; full proposal:
[design-refinement-preM5.md](docs/research/design-refinement-preM5.md).
Background research (deck depth / deal pacing / cut UX / theme architecture) landed
(journal spot-checked) and drove items 4-5's numbers.

**BUILD COMPLETE (owner batch-approved: "simulate as realistic as possible, and practical"):**
- **Item 1 (eb9822a):** release = row-level token invalidation + delivery-map purge; the
  stale token is granted NOTHING at hello, seat.notHeld on action, ZERO event/resync copies
  across a started game (4-test wire e2e); choose-your-seat via claimSeat.seat + seat.taken
  race code; rename anytime; lobby UI (leave/rename on your seats, every empty seat claimable).
- **Item 2 (48a2195):** per-seat planning window — actedThisHand[4] in S, reset at every deal,
  marked on first APPLIED action (tribute consumes, owner pick); timingClass(state, seat);
  nextDeadlines takes a per-seat resolver (co-actors can arm DIFFERENT fresh clocks);
  obligations pin per-seat vs an independent tracker across the config grid; the owner
  scenario pinned on the wire (follower's first row = planning/45s under fast, leader's
  second = turn/20s); legacy persisted states read as not-yet-acted (named migration test).
- **Item 3 (9dfebd5):** the REAL cut — the shuffled deck committed in S (ceremonyCut.deck, redacted like the PRNG,
  no-card-token grammar pin on every ceremonyCut view), cutDeck 6..102 exact-set choice
  phase, flips AND the deal derive from the rotated deck (marker card REALLY lands at the
  leader; a different position REALLY changes every hand), default middle cut on the
  deadline (AFK cutter named liveness case), class 'turn' + consumes nobody's window,
  BOTH 400-seed uniformity sweeps pass (fixed + varied positions), replay reproduces the
  cut from the log, 29-test ceremony suite vs a deck-arithmetic oracle. SEMANTIC NOTE for
  the record: the old U{0..3} marker draw made the leader uniform even CONDITIONAL on the
  cutter; the real mechanics follow physical rank arithmetic (absolute uniformity holds via
  the PRNG-uniform cutter — the real table's distribution, deliberately).
- **Item 5 (f674289):** DeckTheme contract — themes provide ONLY Face/Back/metrics; the
  framework (CardFace.tsx) draws every game-state indicator OVER the theme (wild marker et al — no
  code path to remove them); F11 mini-fan reads theme back tokens; conformance ratchet runs
  per registered theme (incl. renderToStaticMarkup of every card at every size).
- **Item 4 (37ceca7 + 792a446):** the physical deal — 36ms stagger / 320ms flight round-robin
  (≈4.2s landings ≤4.5s + full choreography ≤5s, both PINNED; the 90s window absorbs it),
  pre-reserved sorted slots — SUPERSEDED by the cut & deal refinement round below, which
  corrects the false "true arrival order unknowable BY REDACTION" justification (the order was
  always in handStarted.hands) and animates true arrival order + one sort beat instead —
  WAAPI + tap-anywhere .finish() (purely local), reduced-motion instant,
  4-tier shadow-slab deck depletion, marker fly-in to the leader. Visual pass: full
  cut→ceremony(real flips incl. joker re-flip)→deal sequence verified at desktop; cut UI +
  settled layouts verified at TRUE 390 (iframe recipe); ONE 390 find — the lobby ring's
  north/south cells inherited the narrow centre column and crushed — fixed (full-row spans)
  and re-verified live.

718 unit + 40 e2e + 4 typechecks green at build close. PLAN §3/§4/§5 updated (per-seat
timingClass — also closing a pre-existing M4 drift where PLAN never gained timingClass at
all — ceremonyCut/cutDeck/actedThisHand, release/rename protocol + lobby semantics).
**PANEL EXECUTED (both lineages, scratch clones, headless; both ran the full 718-test suite
green independently).** Codex: 2 findings (med: timingClass JSDoc overstated "engine never
sees ms" — actionTimeoutMs exists as a legacy suggestion; low: a theme could z-index over
the wild marker). Grok: 4 (med: same marker occlusion; med: deck redaction pinned only in the
named ceremony tests, not continuously in the property walk; low: STATUS/design-doc numbers
drifted from landed values; low: the ≤4.5s pin silently covered landings only, not the full
4.87s choreography). Both checked-clean lists independently confirmed the redaction hard
line (release starves the stale token at hello/action/delivery), first-leader uniformity
under a player-chosen cut, deck unreachability from every runtime view, engine
time/locale/theme-freedom, DO game-agnosticism, the per-seat decision table, and the deal's
client-only-ness. **All findings fixed (6bc3d61 + this commit):** isolated stacking context
+ z-index CSS pin for the marker (conformance-suite enforced), continuous
'deck'/'ceremonyCut'/card-grammar assertions in every obligation-3 view sample, honest
JSDoc/PLAN wording, superseded-numbers notes, dual budget pins (landings ≤4.5s, full ≤5s).
Fix re-audit (Codex, scratch clone): 3× FIXED, 1× PARTIAL (a residual stale ≤4s claim in
this file — corrected here), no new issues. 720 unit + 40 e2e + 4 typechecks green.

**Last updated:** 2026-07-15

## Pre-M5 UX/UI polish (2026-07-15) — AUDIT done; PLAN pending owner pick (strict AUDIT→PLAN→EXECUTE)

Owner brief: fix the structural UX problems before four family members see it —
"would someone who didn't build this know what to do?" Sequence is strict:
audit (collect, don't fix) → plan WITH owner → execute. Deliverables:
[docs/audits/preM5-ux-audit.md](docs/audits/preM5-ux-audit.md) (findings) +
a visual proposal artifact (ring wireframes + 3 style directions):
https://claude.ai/code/artifact/805c4d3a-4f93-44c8-a790-74dc52317d2d

**Phase A method:** computer-use self-play on the deployed build (f6d6bc6), desktop
1440px + TRUE 390px (the Chrome window clamps at innerWidth 606, so 390 was rendered
via an injected same-origin iframe — shared localStorage → same seats). Companion
research: an 11-agent workflow (design-system / four-handed layouts / small-screen
legibility / CJK-a11y), journal spot-checked, no placeholder junk.

**The framing finding:** `seatLayout(you)` already maps south=you, north=(you+2)=partner,
E/W=opponents — the ring semantics EXIST but render as a 3-plates-across-top + hand-at-
bottom stack with a dead center. Converting to the asymmetric ring is a LAYOUT change,
not a seat-logic change, and is the canvas every other decision sits on → decided first.

**Findings (full log in the audit doc):**
- **P1 F3** — raw error codes leak to the player (`room.notSeated` etc.); pre-seat pickers
  are rejected but look editable; the rejection never clears, follows you into the game,
  renders on 2 surfaces and covers the hand. (a reload clears it — per-session client state.)
- **P1 F4/F5** — partner invisible (3 identical top plates; our team/opponents only on the level rail).
- **P2** — whose-turn is spectator-phrased on your own seat (F8); the level (rank) not headlined
  (F7); wild the wild (heart level card) never stated unless held (F6); no low-card alert ≤10 escalation (F11, confirmed
  from SeatPlate.tsx — count chip is value-independent); no legal-play cue on a normal turn
  (F9 — owner decision, per-card legality is genuinely ambiguous in Guandan).
- **P3** — lobby 2×2 grid → lobby ring; Guan vs Traditional Guan glyph (confirm).
- **Keep:** rule/timing pickers, ceremony, level STATE (Phase B folded it into the
  headline badges; the LevelRail ladder was retired), wild marker, trick well, CCW order,
  27-card hand legible in 2 rows @true-390 (no overflow), sort toggle, 3-locale integrity,
  opening-hand thinking planning-clock distinction.
- **Not re-driven live (recently verified M3/M4; Phase-B re-verify vs the ring):** wild
  multi-reading chooser, tribute/anti-tribute/jiefeng, match-end overlay, live 1–2-card state.

**Proposal:** the asymmetric ring (you bottom · partner top · opponents flanking a bounded
center) on BOTH lobby and table, + shared information fixes (turn-in-words, level+wild
headline, ≤10 escalation, two team badges, partner-by-position, human error copy). Three
style directions to choose from — **Lacquer Ledger (recommended)** / Ink & Goldleaf /
Table Around You — all on the same ring + fixes. Recommendation: Lacquer Ledger base +
one bold move (a Songti the level (rank) level headline). 5 owner decisions surfaced (style, clock
placement, partner-hand visibility, 4-colour deck, legal-play cue). **No behaviour/engine/
protocol/timing change** proposed — layout & presentation only.

### Phase B APPROVED (owner, 2026-07-15) — Lacquer Ledger ring, F3 first + independent

Owner picks: **Lacquer Ledger** + the one bold move (a Songti the level (rank) headline, spent on the
most under-served fact F7). Clock on the seat plate (escalate on your own seat when short;
untimed keeps no clock; keep the opening-hand thinking planning distinction). Partner/opponent hands
**value-dependent** (2 cards must LOOK different from 27 — solves F11 structurally; take the
idea from card-back arcs, leave the felt). Legal-play cue **binary** (「you have a playable beating hand」 vs
「cannot beat, must pass」, Pass prominent when no) — NOT per-card highlighting (legality is per-combo).
4-colour deck = settings toggle default off, BUT ♥/♦ must be distinguishable at true 390px
in the DEFAULT deck (verify + report). No behaviour/engine/protocol/timing change. Model
dispatch: Opus layout/hierarchy, Sonnet CSS/components once the direction holds.

**Sequencing:** F3 (independent, done) → ring skeleton 390px-first → info fixes
(turn-in-words, the level (rank)+the wild (heart level card) headline, two team badges + partner-by-position, human error
copy, lobby ring) → Songti bold move → visual re-verify incl. the not-re-driven list →
cross-model panel (VISUAL-change brief) → deploy.

**F3 SHIPPED (feat/preM5-ux-ring, first + independent).** The first-thirty-seconds chain
fixed whole: pickers read as disabled-until-seated (Lobby.configEditable pure predicate) with
a "sit before changing rules and timing" hint, so an unseated edit can't fire; a NEW `describeError`
(src/client/errors.ts) is the single user-facing mapper for the lobby banner AND the in-table
toast — every server rejection code → human copy in all 3 locales, unknown → generic human
line, NEVER the raw code (retired errorKeyFor + the leaky room.rejected/game.error.unknown
`{code}` keys); rejections clear on next action / lobby→game / dismiss, and the app-shell
banner is lobby-only so one failure never renders on two surfaces. Regressions: errors.test.ts
(no code leaks in any locale + dedicated copy), lobby.test.ts (configEditable), store.test.ts
(clear-on-action/start). Unit suite green (670 at F3; 680+ after the ring predicates
and the panel-fix regressions). Live-verified on wrangler dev:
pre-seat pickers dimmed + hint + no rejection on click; seating enables them and clears the hint.

**Methodology flag to close (owner):** Phase A found Chrome clamps at innerWidth 606, so true
390 needs an injected same-origin iframe. What width were M3/M4's "390px verified" claims made
at? To be recorded in this STATUS + the iframe recipe added to METHODOLOGY so 390 is never
claimed loosely again. (Substance survives — this round confirms the 27-card hand is legible at
true 390.)

### Phase B BUILD — ring shipped-ready (feat/preM5-ux-ring); panel running

The M3 3-plates-across-top table is now the asymmetric RING in Lacquer Ledger: you bottom,
partner across the top, opponents flanking a bounded centre (seatLayout already mapped the
directions → a rendering change, not seat logic). Commits: b51e7ed (audit) → 96b5726 (F3) →
54b92e2 (ring + F9) → 0ae25ac (lobby ring + ratchet) → 61d8e56 (cleanup + desktop).

**Info fixes shipped + LIVE-VERIFIED** (dev server, real states driven to via a hints-only bot):
- **F7** the level (rank): a large Songti goldleaf level headline (the one bold move).
- **F6** wild: the wild (heart level card) stated ALWAYS (♥{rank} wild chip), not only when held.
- **F8** turn-in-words: your turn / turn: X on your own seat, not spectator-phrased.
- **F5** partner: a Partner tag (ivory, non-colour cue) + partner-across-the-top position.
- **F11** low-card alert: a value-dependent mini card-back fan — 2 cards LOOK unlike 27 (verified 13 vs 3 vs
  2 at true 390) — + numeral escalation at the ≤10 / ≤2 lines (handSizeTier).
- **F9** legal-play: binary cue 「cannot beat, must pass」 with Pass promoted when you can't beat; 「you have a playable beating hand」
  otherwise (beatState).
- Lobby ring: the same partners-across layout (§2).
- Ratchet: beatState + handSizeTier extracted as pure predicates, pinned in ring.test.ts (the
  client suite is DOM-free — the visual gates live as testable decisions).

**Edge states re-verified in the ring** (all render correctly, undisturbed): the wild
multi-reading chooser (opens over the centre, NOT clipped, both readings + substitution chips),
the match-end result overlay, the hand-1 ceremony, the tribute panel, the trick well, low-card
divergence; 3-locale integrity (zh-Hant/zh-Hans/en, no break, endonyms verbatim; wild→Wild,
Partner→Partner, the level (rank)→LEVEL, turn:→'s turn). Suits distinguish by GLYPH SHAPE (♥ vs ♦), not colour
alone. Anti-tribute / jiefeng are seed-dependent center-panel/banner content (TributePanel /
TrickWell verified) — to confirm in the post-deploy live pass.

**True-390** verified via an injected same-origin iframe (Chrome clamps at innerWidth 606): no
horizontal overflow, the 27-card hand legible, fans read. Method + iframe recipe to be added to
METHODOLOGY (closes the "what width was 390?" flag).

**Deferred (flagged for owner):** the full 2..A level LADDER visualisation — the LevelRail
component was deleted; its STATE (team levels, A-attempts, suspension) is carried by the
headline + team badges, but the climbing-ladder view is gone (re-addable as an expandable).
4-colour deck stays a settings toggle default-off; default ♥/♦ separation rests on the glyph
shape (confirm crispness in the post-deploy pass).

**Cross-model panel (Codex + Grok, a scratch clone each, VISUAL-change brief).** Round 1: 6
findings (0 high, 2 medium, 4 low). Both mediums were F8-completeness — the headline turn cue
keyed on ring/deadline data (empty for untimed anti-tribute → `yourTurn = hints !== null`), and
the CENTRE well still spectator-phrased YOUR own lead (the original F8 defect → `leadPromptKey`
→ your turn to play). Lows: the error-ratchet comment overstated + missing room.notFound; dead
.gd-rail/.gd-layout/… CSS orphaned by the LevelRail delete; a stale test count; a SeatPlate
comment. All fixed + regressioned. Fix re-audit: **Grok 0 findings**; **Codex 1 medium** — the
error ratchet's code list was an incomplete subset (engine forwards more codes); fixed by listing
the COMPLETE Guandan-reachable inventory + a structural forged-code test proving leak-safety by
construction. BOTH auditors' checked-clean, twice, independently confirmed the two correctness
gates: **no engine/server/redaction/timing change**, and **the ring exposes no other seat's hand**
(the mini-fan/count read only view.cardCounts). 680 unit + 4 typechecks green.

**DEPLOYED (main 6bc63e9, 2026-07-15).** Fast-forward merge feat/preM5-ux-ring → main → push;
CI + Deploy green; live build == 6bc63e9 confirmed; the lobby ring verified rendering on
production. Revertible by redeploying main@f6d6bc6 if the aesthetic needs a change for M5.

**Deferred / for M5 (flagged):** the full 2..A level LADDER (state kept in the headline badges;
ladder viz re-addable as an expandable); a real-device iOS/Android matrix; anti-tribute / jiefeng
seed-dependent center-panel states (TributePanel/TrickWell verified — confirm live in M5); the
4-colour-deck default is off (♥/♦ separate by glyph shape). Next: M5 — 4 real people on different
networks, ≥1 mid-game reconnect, live language switch, free tier only (OWNER GATE to start).

## Pre-M5 must-dos (2026-07-14/15) — panel restored; socket-liveness gap measured, designed, shipped

Owner brief: (1) restore the independent-lineage panel — the Q3/TTL round's
null was called too early; (2) research→design→gate the socket-liveness gap.
Full audit record: [preM5-liveness-audit.md](docs/audits/preM5-liveness-audit.md);
research: [socket-liveness.md](docs/research/socket-liveness.md).
Model note (ladder): Fable owner-authorized for this round (both items); the
Q-C research fan-out inherited it (load-bearing M5 design input).

**Item 1 — the panel runs headlessly now (the null was an invocation error, not a TTY law).**
`grok -p/--single` had swallowed `--output-format` as its prompt value; the
right recipe is `--prompt-file … --output-format plain --always-approve`.
Codex's missing "clean flushed report" was `codex exec -o <file>`. Recipes +
protocol (throwaway clone per auditor, mandatory verdict-line format) are in
METHODOLOGY's tool ladder; cost is minutes per change, so the panel ran THREE
times this round. It immediately earned it:

- **Re-sweep of Q3/TTL (the missed sweep):** Grok 5 findings (1 HIGH: socket
  departures never re-armed the TTL after a live-socket wake cleared it —
  abandoned lobbies became immortal; root-caused by wire repro to
  `ctx.getWebSockets()` still containing the closing socket during
  webSocketClose, which also broke the ordinary last-tab-closes lobby).
  Codex 3 findings (1 medium: /purge had no live-socket refusal). All fixed
  + wire-regressioned (2b61c9c); fix re-audit: Codex 0, Grok 2 minor (fixed).
  Q3TTL-audit.md's "no surviving defect" header superseded (addendum there).
- **Liveness sweep + verify (below).**

**Item 2 — socket liveness: measured, then designed, then shipped.**
- **Q-B (measurement, production, 30 min):** NOTHING closes a silent socket —
  app-silent and fully-frozen probes both ended OPEN with the DO holding the
  phantom seat "connected" throughout; zero server-initiated pings either
  direction. The classic "100s Cloudflare idle kill" is origin Proxy Read
  Timeout lore, not a WebSocket policy.
- **Q-C (5-area research workflow, per-claim skeptic-verified):** iOS lock
  suspends JS in seconds and kills the socket with NO close frame; Android
  freezes at 5 min, socket left open; desktop Chrome backgrounds keep pinging
  ~1/min (so ping-presence ≠ human-present, but ping-SILENCE ⇒ absent holds —
  no departure path keeps pinging, no attentive foreground player stops);
  `getWebSocketAutoResponseTimestamp` semantics verified from workerd source
  (only exact-match pings update it; readable without waking; null until the
  first ping).
- **Q-D (shipped, 82d13e5 + 3972539):** the staleness sweep — on every wake
  (and armed AT the attach: a 4th alarmCandidates candidate guarantees a wake
  while any socket is attached) the DO closes (4002) sockets ping-silent ≥
  STALE_SOCKET_MS (180s: > Chrome's ~60s throttled legit cadence, > every
  turn budget + grace — calibration pinned in the matrix); the ORDINARY
  disconnect machinery (presence → grace → Q3 pause → TTL re-arm) runs from
  the close. Client hardening: an immediate ping on visibilitychange→visible
  (zombie-OPEN iOS sockets fail the send and reconnect NOW). The T3 half-open
  immortal-lobby limitation is CLOSED (pause-and-retention.md updated).
- **Gate:** pure decisions (socketLastSeen/isStaleSocket/candidates) matrix-
  tested; property model carries the healthy-socket candidate (its untimed
  case caught the semantic change); 4 liveness e2e incl. the M5 locked-phone
  scenario (silent playing client → PAUSE before the turn deadline, seq
  frozen) and the decoupled-window arming proof (production 48h TTL — the
  attach-armed sweep alone reaps). Panel on the liveness diff: both lineages
  independently converged on the same computed-but-never-armed defect (fixed
  + regressioned); verify pass Codex 0 / Grok 2 comment-lows (fixed).
  658 unit + 36 e2e + 4 typechecks green.

**Out of scope, recorded not smuggled (socket-liveness.md §6):** client-declared
away/presence UX (also the only sub-5-min Android detection route);
claim-victory affordances (gameplay rule — owner's); the real-device iOS/Android
matrix (smallest decisive experiment designed in §3; needs the owner's phone
~2 min per case; the shipped design is correct for any outcome).

**Production notes:** three probe lobbies (V3B92T/BLQSFN/4AFJ9D) created for
Q-B were re-armed post-deploy (connect+close touch) and will self-purge in 48h;
pre-existing lobbies whose last tab closed before this deploy have no armed
alarm — any future touch (a socket attach) re-arms them, or the §4 script
reclaims known codes.

## Q3 pause-on-idle + retention-TTL (2026-07-15) — GATE REACHED on feat/q3-ttl

Free-tier action set (owner-approved Path A). Design:
[pause-and-retention.md](docs/research/pause-and-retention.md); audit:
[Q3TTL-audit.md](docs/audits/Q3TTL-audit.md). Built autonomously under the owner's
run-to-completion grant, off `main` until the gate passed.

| Gate criterion | Evidence | Verdict |
|---|---|---|
| Model = product (no virtual-model test) | The pause/resume/TTL DECISIONS extracted to pure fns (isPausedRoom / mayAutoPlay / resumeOffsetMs / alarmCandidates + retention.ts) that BOTH game-room.ts AND the tests call | ✅ |
| Property test P1–P4 | deadline-liveness.property.test.ts: P1 (paused ⇒ no alarm), P2 (resume conserves remaining — exactly 60s not fresh 90s), P3 (non-actor resume leaves absent actor armed), P4 (deploy-transition stamp + one guard-path auto-play); coverage counter proves the random driver reached pause AND resume | ✅ |
| Decision matrix T1–T3 | retention.test.ts (32): lazy=lobby-only auto-purge, T3 live-socket-never-purged, guard-path arithmetic, fail-safe NULL anchor, stamp≡pause | ✅ |
| Wire e2e | retention.e2e.test.ts: stamp-ordering, no-auto-play-while-paused, resume, real deleteAll → 404, seatless-socket T3, ordinary-reconnect regression | ✅ |
| Two counts unswappable | branded ConnectedSeatCount/LiveSocketCount, constructed only at seatCount()/socketCount() — swap = compile error | ✅ |
| Suites | 645 unit + 29 e2e green, 4 typechecks | ✅ |

**Owner catches folded in during build (6):** deploy-transition NULL-offset
(constructor lazy-stamp); lazy-TTL contradiction (auto-purge lobby-only, meter
asymmetry); live-socket TTL gate + T3; guard-path 0-remaining pin (no floor);
paranoid purge gate (null → fail safe); branded counts + 2-accessor surface;
honest eager-flip comment (not retroactive).

**Bugs the gate caught + fixed autonomously (3):** never-joined-room orphan
(arm TTL on create); warm-instance-after-deleteAll 500 (restore empty schema →
404); Codex's resume-path fragility (gate resume on the true 0→1 edge).

**Cross-model audit — partial, honestly weighted.** Codex (independent lineage)
reviewed and contributed the resume-path fix — but its headless CLI hit the M4
read-only-sandbox EPERM and never flushed a clean report (finding recovered from
its trace; weighted as reasoned corroboration, not a green run). **Grok did NOT
run** — headless `-p` cut after the preamble (TUI needs a real terminal). The
independent-lineage panel the owner emphasized is therefore DEGRADED this round;
a fuller external sweep would need the owner to run codex/grok interactively.
The substantive review is the independent adversarial pass + the tests above.

**Sequence COMPLETE (2026-07-15, autonomous run):**
- **Merged + deployed** (build 944656f, self-verified). **Live-confirmed the
  retroactive pause:** the 3 zombies (P2FFYD/YM2C72/M74D3N, which had climbed to
  seq 364/469/359 — burning the whole time) FROZE — 0 seq advance over 95s. The
  burn is stopped. They'll be reclaimed via §4 on owner confirmation (frozen at
  ~3–4k rows each; not urgent).
- **§4 cleanup script** (scripts/cleanup-rooms.ts) + token-gated `POST
  /api/rooms/:code/purge`: explicit codes, dry-run default, dump-first,
  irreversible only on --delete. e2e: dump→purge→404. NOT auto-invoked.
- **7 PLAN drifts corrected** (R3 sweep) — the false TTL claim (×3) replaced with
  the real lazy mechanism; players→seats + new columns; hibernation tags;
  dump route path/shape + purge; resync-not-event; pre-M4 fresh-clock wording.
- **Q4:** the native Workers `ratelimits` binding on POST /api/rooms is
  Free-available (deploy accepted — closes the one UNCERTAIN) + wired in
  (optional, degrades to no-limit). Functional note: an 18-request burst did NOT
  trip it — the documented permissive/eventually-consistent behavior (per-PoP,
  not an accurate accounting system); it backstops a SUSTAINED accidental loop,
  not a burst. Primary guard = the client's already-debounced create button (no
  retry loop) + fail-closed-at-$0. 18 test rooms created will lobby-TTL self-purge.
- Suites: 650 unit + 30 e2e green, 4 typechecks; CI + Deploy green.

**Audit caveat carried:** the independent-lineage panel was DEGRADED — Codex
contributed 1 fix (resume 0→1 edge) but its headless CLI never flushed a clean
report; Grok did not run (TUI needs a terminal). See docs/audits/Q3TTL-audit.md.
A fuller external sweep needs the owner to run codex/grok interactively.

## M4 (2026-07-14) — reconnection + timeouts + owner items A/B: implementation complete, gate report final

### M4 GATE REPORT — all criteria green; audits resolved

Owner did not approve the gate outright — instead redirected to a close-out
pass (below) plus a question-first free-tier-efficiency research interlude
([docs/research/free-tier-efficiency.md](docs/research/free-tier-efficiency.md),
propose-then-implement) before the M5 decision. This report is final: every
criterion is green and both cross-model audits are archived and resolved.

| Gate criterion | Evidence | Verdict |
|---|---|---|
| Reconnection acceptance (PLAN §5) | e2e reconnection suite: mid-hand drop → reconnect(token, lastSeenSeq) → delta resync with exact contiguous events + per-seat redaction + presence recovery + game continues; snapshot fallback FORCED via lobby-era lastSeenSeq (resync.events === undefined asserted, then plays from the snapshot); no duplicated action across a drop (same actionId resent → resync-not-reapply + witness seq-gap proof) | ✅ |
| Deadlock-freedom property | tests/unit/server/deadline-liveness.property.test.ts: virtual clock over the REAL pure helpers, both games × {fast, standard, untimed, legacy-null}, DL1–DL3 + I1–I4 after every event; named cases incl. untimed + sole-actor disconnect → grace row in the same event → alarm resolves (the PLAN §4 null-timeout case), double tribute co-actor preservation, reconnect-restores-base | ✅ |
| Version skew vs actual redeploy | LIVE DRILL on production (rooms P2FFYD, build bd505e6→7f5744d): tab on old bundle + real deploy → no banner while socket persists (documented limitation observed) → reconnect → 「new version available…」 banner over the INTACT mid-hand table; played an action (the wild chooser!) with the banner up (non-blocking proven); later dismissal survives further reconnects (keyed by build); reload restored the same seat/hand on the new bundle (console: old build ×4 → new build). Every future deploy self-verifies: the smoke check asserts /api/health build == pushed SHA (retry loop after the first versioned deploy raced edge propagation — diagnosed, fixed) | ✅ |
| Timing config (owner item B) | TimingPicker live (fast chess/standard/relaxed/untimed, frozen after start, seated-only authority observed rejecting over the wire); defaults standard 45s/90s justified in docs/research/room-timing.md §5 against an honest research null result; untimed preset live (no clocks connected; hint discloses the 60s grace); planning window OBSERVED live: leader's plate showed opening-hand thinking 82s after the ceremony — the 90s window armed at start and absorbed the ~5s ceremony per design; e2e pins preset→wire deadline windows, timeout auto-play observed end to end (~5s custom timing), untimed grace row on disconnect | ✅ |
| Fresh-clock fix (M2 item) | base_due_at decision table (doc §2) implemented in pure nextDeadlines; every table row unit-pinned by name; wire-level e2e regression: drop + reconnect on the clock → dueAt restored EXACTLY to base, never re-armed; presence isolation (seat X blip leaves seat Y byte-identical) | ✅ |
| Wild chooser card faces (owner item A) | docs/research/wild-chooser-ux.md (data-availability verdict: derivable client-side, zero engine change — obligation 4 untouched); wildSubstitutions/resolveComboFaces unit-tested against validatePlay reconstruction; 390px fit pinned by CSS-token arithmetic ratchet; LIVE: one-wild chooser ({10,10,Q,Q,wild} → full house Q / full house 10, weaker picked and bound), TWO-WILD chooser hunted onto production ({A,A,Q,wild,wild} → mixed chips W→A + W→Q vs collapsed ×2 W→Q, single row height, weaker picked and bound), 390px multi-option chooser verified in a true 390px viewport | ✅ |
| Boundaries | Engine pure/time-free (timingClass is a pure state→label); DO game-agnostic (grep: zero game imports; timing map is opaque); RuleVariant 25 keys untouched; legacy rooms bit-identical (timing_json NULL → actionTimeoutMs path) | ✅ |
| Suites | 609 unit + 25 e2e green ×(independent verification), 4 typechecks; CI + versioned Deploy green | ✅ |

**Visual-round findings (ratchet), both closed:** (1) big-joker single labeled single A (client renders keyRank, a frozen placeholder for joker-keyed forms; jokerRank carries the identity) — regression pinned then fixed, LANDED (commit cb21c24; the fix's non-vacuity was proven by temporary revert). (2) mid-ceremony countdown-dim: no live screenshot was taken this round (the ~4.6s ceremony window closed before capture; cosmetic). Closed the ratchet the durable way instead of chasing a flaky screenshot — the gating logic was extracted to a pure `isCeremonyShowing` predicate (client suite is DOM-free, `environment: 'node'`, so a className swap has no logic to isolate, but the four-condition gate that drives BOTH the ceremony overlay and the dimTimer does) and unit-pinned across all four conditions (hand-1-only, undismissed, ceremony-present, not-past-match-end). UX note carried to M5 polish: seat tabs reset to seat 1 after hash re-entry (cosmetic); hot-seat leader-clock grace.

**Cross-model audits** (Codex → [docs/audits/M4-codex.md](docs/audits/M4-codex.md); Grok → [docs/audits/M4-grok.md](docs/audits/M4-grok.md); Gemini skipped — same partitioning rationale as M1–M3, the two primary lineages fully covered the split surface):
- **Codex: ZERO majors, 2 minors, both fixed.** (1) The doc's I2 invariant wording ("never increases") contradicted the intended restore-to-base semantics the code and tests correctly implement — doc reworded to the never-above-base bound. (2) Property-test fidelity honestly bounded (pure-layer only; DO SQL/ordering owned by e2e — scope note added to the test header) and the alarm loop now asserts it DRAINS all currently-due rows within MAX_ALARM_APPLIES instead of tolerating exhaustion. Checked-clean: full §2 decision table (hunted for uncovered inputs — none), presence semantics, fire-and-forget SQL-before-await boundary, hello reconcile-before-welcome, takeover no-delta path, alarm termination + class re-arming, timeout: namespace, exactly-once seq-gap proof validity, resync/skew field additions (no redaction leak). Sandbox caveat (weighted, owner §0): Codex ran reasoned-only again — an EPERM blocked test execution in its sandbox — so its ZERO-majors is an **inspection** verdict (it read the code, decision table, and tests and found no major defect by reasoning), NOT an independent green run. The executable guarantee comes from OUR CI (the same suites, green, including today's strict E2E_REQUIRE_WIRE=1 dispatch); Codex corroborates that by inspection rather than re-proving it. Read the two together, not the inspection alone.
- **Grok: 1 medium + 2 low, all fixed.** Medium (the genuine catch): the manual `npm run build && npm run deploy` path shipped a 'dev'-sentinel client bundle with a SHA-versioned Worker — permanently suppressing the skew banner for those clients; the deploy script now captures ONE SHA and feeds both the client build and the Worker var. Low: chooser aria strings said wild card while the rest of the product says the wild rule (aligned); the planning label could sit on a disconnect-grace countdown, promising a budget the clock wasn't giving (label now shown only while connected). Checked-clean: game-agnosticism sweep found ZERO leakage (imports, opaque config/timing, no hardcoded seats, class map opacity), the 108-card 'planning' predicate verified sound across ALL hand-opening paths and rule variants with the obligations pin confirmed independent, guess-number omission verified at every DO call site, version-skew CI path/dev-suppression/dismissal-rekeying/non-destructive guarantees, i18n parity + script correctness + preset-number consistency across all 18 new keys, picker freeze/aria/authority.

**Pre-gate strict e2e (CI, workflow_dispatch):** green — all three rare paths reached wire level under E2E_REQUIRE_WIRE=1 with 3× hunt budgets on the runner.

## Free-tier efficiency research interlude (owner mission §1, 2026-07-14) — PROPOSE, awaiting sign-off

Question-first research pass on a batch of free-tier proposals; deliverable
[docs/research/free-tier-efficiency.md](docs/research/free-tier-efficiency.md).
Research-only — **no efficiency code has landed; the action set awaits owner
sign-off** (§0 M4 close-out changes below did land). Method: framing before
findings (METHODOLOGY practice 5), 5 Cloudflare-docs verifiers (VERIFIED with
source URLs + 2026-07-14 fetch dates), 1 empirical rows/match measurement, and
2 Opus adversarial skeptics — **both the load-bearing Q3 design and the Q2
arithmetic were found wrong on first pass and corrected** (the value of the
adversarial pass). Two of the owner's premises were contradicted by the source
and reported plainly.

- **Q1 (auto-response): ALREADY DONE.** `setWebSocketAutoResponse('ping','pong')`
  is live (game-room.ts:195); VERIFIED it answers without waking the DO / no
  duration; presence is close-event-driven so the no-wake behavior can't touch
  liveness. No action.
- **Q2 (zombie/TTL): NO TTL exists; the real risk is bigger than estimated.** The
  binding meter is **rows-written**, not requests: an abandoned mid-match room
  auto-plays the *entire* remaining match at ~1 wake/60s ≈ **~11.5k rows/day per
  room** for possibly multiple days; **~8–9 concurrent abandoned rooms approach
  the 100k rows/day cap** (corrects the request-axis "dozens" estimate). Rows/
  action corrected to ~8 (missed the `actions_seen` TEXT-PK auto-index; DELETE
  and setAlarm both count). Measured ~9–23k rows/match (degenerate defaultAction
  baseline — real play differs).
- **Q3 (pause on connected==0): right direction, first design BROKEN, corrected.**
  Skeptic found a timer-dodge (HIGH) + a permanent-stall (HIGH) + 2 medium. Fix:
  preserve *remaining* budget as a duration at pause, re-arm *all* actors on
  resume (not the changedSeats path), guard `alarm()` with connected==0 — M4/I2/
  I4-consistent. Load-bearing → property-test + wire e2e + Codex/Grok audit at
  implementation. Strictly better than the pre-rejected purge (preserves room +
  replay).
- **Q4 (rate limiting): cheap easy-yes, low urgency.** Vector confirmed
  (unauthenticated `POST /api/rooms`); zone WAF/rate-limit rules don't apply to
  `*.workers.dev`; the fit is the native Workers `ratelimits` binding (~10 lines,
  $0) + a client retry-loop guard — pending a Free-plan availability smoke test.
- **Q5 (rejections): both UPHELD (verified).** Hibernation discards in-memory
  state after ~10s idle → batching unsafe under 45s clocks; static-asset requests
  are already free/unlimited off the Worker meter → caching saves nothing and
  would reintroduce the skew bug. The one safe row-reduction kept: merge the two
  per-action snapshot UPDATEs (−1 row/action).
- **Recommended sequence:** (1) trivial snapshot-UPDATE merge; (2) Q3 corrected
  design, gated; (3) Q4 binding after a smoke test; no-ops Q1/Q5-batch/Q5-cache;
  defer a SQLite retention sweep to M5+.

### Sign-off + expansion (owner, 2026-07-15) — APPROVED + retention/TTL + cleanup script

All three approved (Q3 pause corrected / Q5-merge / Q4 ratelimits). Owner pulled
retention/TTL forward from M5+ (it is the other half of Q3 — Q3 makes abandoned
rooms *inert but immortal*, so it removes the burn and creates accumulation;
design+gate them together) and added an owner-facing cleanup/inspection script.

**§1 live-burn check — CONFIRMED, and it validates Q2's arithmetic.** The likely
zombie generator is our own dev process, not the family. Direct per-room probe
(GET /api/rooms/CODE, no auth) found THREE M4-drill rooms still auto-playing,
0 connected: **P2FFYD (seq 109→110), YM2C72 (133→134), M74D3N (105→107)** over
81s — the ~1 action/60s disconnect-grace cadence, i.e. ~11.5k rows/day EACH
(~34.5k/day for all three, ~⅓ of the 100k/day cap) and climbing until each match
auto-completes (~1–2 more days at seq ~110). This is the live-data validation the
owner wanted — the model was right. NULL result: the account-wide rows-written
aggregate could not be pulled programmatically (wrangler's OAuth token is
rejected by the GraphQL analytics API, 9106); the per-room probe is the direct
evidence instead. These 3 rooms are to be stopped via the §4 cleanup script once
it lands (burn is slow — ~24 rows/min total — so no hasty destructive purge).

**Q5-merge: LANDED.** applyGameAction now writes seq+state_json in ONE combined
UPDATE (was bumpSeq's seq UPDATE + a separate state UPDATE) — −1 row-write/action
(~12%). Behavior-preserving (609 unit + 25 e2e green; e2e covers seq advancement
+ resync). game-room.ts ~1197.

**Gating research landed (read-only workflow):**
- **Delete-metering (the §3 gotcha) — MIXED, one decision-critical UNCERTAIN.**
  Row-wise DELETE is billed per row (+ index entries), so purging a 10–20k-row
  match row-by-row costs a comparable chunk of the 100k/day cap — the disease is
  real. `ctx.storage.deleteAll()` is the ONLY op that reclaims a DO's storage,
  and is a Storage-API primitive (not a SQL query) so it MIGHT be flat-billed —
  but Cloudflare documents no carve-out, so its cost is genuinely UNKNOWN and
  **must be measured on the live Free account.** DROP TABLE doesn't reclaim
  storage; a DO never self-deletes. **Reframe:** Q3 stops the URGENT compute burn;
  retention only reclaims ALREADY-accumulated STORAGE (abundant 5GB, tiny/room) —
  purging spends the SCARCE meter to save the ABUNDANT one, so if `deleteAll()`
  is per-row, retention should be LAZY/storage-pressure-gated, not eager. The
  design forks on the `deleteAll()` measurement; the conservative (lazy) branch is
  safe either way and is the default until measured.
- **PLAN documentation-drift sweep — 7 findings (the process win the owner asked
  for).** The known one is worse than thought: "A room-TTL alarm also self-purges
  abandoned rooms" appears in **§4, §1.6 AND §8** (a reader hits the false claim
  three times) — and STATUS already recorded the gap under Q2 but PLAN was never
  corrected (exactly the drift-survives-audit failure mode). Five more are
  descriptive text that fell behind a MORE-capable implementation: §4 hibernation
  (claims seat-tagged sockets + `{seat,tokenHash}` attachment → really no tags +
  `{seats: Seat[]}`), §6 dump route (`/api/debug/rooms/:code/dump` + `players` →
  really `/api/rooms/:code/dump` + `seats` + an `actions` array), §5 reconnection
  step 4 ("returns the recorded event" → really sends `resync`, never re-applies),
  §4 deadline recompute (still describes the pre-M4 fresh-clock mechanism = the
  M2 bug the code was redesigned to kill), §5 hello (`token` → `tokens[]`, action
  missing `seat`), §4 schema (`players` w/ connected/last_seen_seq → really
  `seats` w/o them). Everything load-bearing else CHECKED-CLEAN (dump gating,
  redaction, idempotency ledger + reserved namespace, single-writer, advisory
  expectedSeq, version-skew, agnosticism, ping-pong). **Correction plan:** fold
  the TTL-claim fix into the §3 TTL implementation (so PLAN describes the real new
  mechanism, not just "none"); correct the 6 descriptive drifts in the same PLAN
  pass. METHODOLOGY self-correction: a design doc that asserts an unbuilt
  mitigation lets a real gap survive audits — the PLAN sweep is now a standing
  check when a milestone claims a mechanism.
- **DO enumeration — REFUTED for code-driven purge (re-run gave real data; first
  run was junk).** The namespace-objects LIST API
  (`GET .../durable_objects/namespaces/{id}/objects`) exists and returns hex `id`
  + `hasStoredData`, but NOT the name — and `idFromName` is one-way (`ctx.id.name`
  is `undefined` when rebuilt via `idFromString`, the only thing a listed hex ID
  gives you). So enumeration can't recover room codes → it's only a coarse audit
  ("does orphan storage exist my registry doesn't know?"). **§4 script model:**
  explicit room codes (owner-supplied / STATUS-recorded) as primary input,
  re-derived via `idFromName(code)`; the per-room self-purge TTL (§3) needs no
  enumeration; an optional future "list all rooms" capability uses a
  **write-once-at-creation KV registry** (1 KV write/create — the idle 1,000/day
  KV meter, NOT the scarce rows-written meter; `expirationTtl` doubles as registry
  retention). Registry is deferrable — the 3 known zombies + on-demand cleanup
  need only explicit codes.

**Then:** §3 TTL + Q3 designed+gated together (`scheduleAlarm` = min(TTL,
seat-deadlines-when-connected>0, probe); Q3's `alarm()` guard scoped so a TTL wake
still fires; conservative/lazy purge via `deleteAll()`+`deleteAlarm()`, replay
preserved by a retention window) → property test w/ connected-count dimension +
wire e2e + Codex resync/liveness + Grok invariant sweep + live drill → §4 script
(dump-then-delete, token-gated, dry-run default) + PLAN corrections folded in →
Q4 last (after a Free-plan smoke test of the binding). `deleteAll()` billing
measured with owner meter-access to optionally unlock eager purge; the 3 live
zombie rooms stopped once the §4 purge path exists.

### Path A approved + two owner catches folded in (owner, 2026-07-15)

Owner approved **Path A**: implement Q3+TTL now; the `smashegg-analytics` token +
`deleteAll()` measurement are non-blocking (SETUP.md §2.5 always marked token
creation `[HUMAN]` — M0's browser automation was the deviation, not my refusing to
mint credentials via automation). Two of the owner's earlier arguments withdrawn
and recorded: (1) "purge now, 20× cheaper" assumed we'd ever purge — under the
lazy/storage-pressure-gated policy we probably never pay that bill (storage
abundant); (2) the `deleteAll()` measurement was never on the critical path. The
3 zombies are left to burn (~34.5k rows/day, ~⅓ cap, $0) — Q3 freezes them at
~1k rows or they auto-complete first; no detour.

Two real gaps the owner caught (neither the research nor my reframe found them),
now folded into [pause-and-retention.md](docs/research/pause-and-retention.md)
§3.1/§3.2/§5-P4/§7 and the audit brief:
- **Deploy-transition `pause_started_at`-NULL bug.** A room already at
  `connected==0` when Q3 deploys never hit the 1→0 stamp → resume computes a
  NULL offset (garbage shift). The clean-state property tests are structurally
  blind to it. Fix: constructor lazy-stamps `pause_started_at=now` when it wakes a
  playing room with 0 sockets and NULL stamp (before any resume math); + a named
  migration-case test (invariant P4).
- **TTL lazy-branch was self-contradictory.** "TTL reclaims after the window,
  automatically" IS eager reclamation — spending the SCARCE rows-written meter to
  reclaim ABUNDANT storage if `deleteAll()` is per-row. Resolved (§3.1): in the
  default lazy mode, auto-purge **lobby-abandoned only** (a few rows, cheap);
  finished/paused rooms arm NO TTL alarm and are reclaimed **manually via §4** (or
  auto once `RETENTION_MODE='eager'` after the measurement proves `deleteAll()`
  flat). PLAN must describe THIS — the unconditional "self-purges abandoned rooms"
  is exactly the drift that survived four audits.

## Process: model dispatch policy change (owner mission, 2026-07-14)

Opus replaces Fable as the default hard tier from M4 on; Fable is
escalation-only on logged demonstrated need (policy text: PLAN §9; ladder
rule: METHODOLOGY; verified mechanism + sources: docs/research/
model-dispatch.md). Applied as committed repo-level `.claude/settings.json`
(`"model": "opus"` — project settings override the user default; subagents
inherit unless a per-invocation model is stated). **Sanity-checked live**
(owner §5): three probe subagents self-reported Haiku 4.5 (explicit haiku),
Opus 4.8 (explicit opus), and Fable 5 (no param — inherit from this
still-Fable session), confirming both that explicit routing works and why
unannotated calls are banned while a Fable session is live. Honest caveats:
(a) the project `model` setting is read at session start — this running
session stays on Fable; the next session in this repo starts on Opus (the
startup header names the settings file, per docs); (b) the M4 implementation
workflow already in flight was launched pre-policy with inherited-Fable
agents — allowed to finish rather than restarted (M4 is the last scheduled
hard-tier milestone; a restart would cost more than it saves); all
subsequent dispatch follows the new ladder.

## M3 hardening (2026-07-14) — watch-items + wild disambiguation + QA ratchet: GATE REACHED

- **M3 gate approved by owner.** Hardening scope before deep M4: §1 wild-card disambiguation (the general fix behind the play-becomes-pass class — dedicated research + engine enumeration + chooser + property tests + Codex audit), §2 QA ratchet (e2e traverses REAL product paths: UI-default config, feature-visibility defaults, concrete-selection incl. wild chooser, forced anti-tribute + suspension over the wire; standing METHODOLOGY rule: every computer-use find becomes a regression before its fix counts), §3 descending-sort toggle, §4 zh-Hans + device auto-locale (3-way parity), §5 cache revalidation watch-item.
- **§5 verified (headers checked live):** `index.html` already ships `max-age=0, must-revalidate` — HTTP caching is correct; hashed assets revalidate via ETag (safe; `immutable` would be a minor optimization; Workers-assets default). **Real skew vector identified:** long-lived SPA sessions never refetch index.html, so a mid-session deploy strands the RUNNING page — the round-3 false alarm was exactly this (a tab held the pre-fix bundle). Not fixable with headers → **tracked to M4: protocol-level version signal + reload prompt on skew** (reconnection-adjacent by design).
- In flight: research doc (fable) ∥ sort toggle (sonnet) ∥ zh-Hans+auto-locale (sonnet); then §1 implementation from the doc → §2 ratchet e2e → deploy → visual re-check (wild chooser, sort, zh-Hans, auto-locale, phone width) → Codex (§1 algorithm) + Grok (i18n/sort/§2 coverage) audits.

### M3-HARDENING GATE REPORT (2026-07-14) — all criteria green

| Criterion | Evidence | Verdict |
|---|---|---|
| §1 research doc | docs/research/wild-disambiguation.md — 5 formalized sub-rules, 47-row probe-verified enumeration, gap analysis (classifyPlays sound+complete; deltas G1/G2), algorithm ≤76 template validations, oracle'd test plan; post-implementation Corrections (FH-9/SF-8 — the oracle beat manual enumeration) | ✅ |
| §1 implementation + tests | Spec v1.4 (owner mission §1 = the G1 sign-off); G1 in validatePlay (all call sites inherit), G2 compareComboStrength; 54 named rows + 4 properties vs an independent brute-force oracle (2,768 selections, ZERO engine disagreements) | ✅ |
| §1 chooser over the wire | e2e (client's own matchSelection round-trip) AND live on production: {8,8,9,9,wild} → chooser 「choose the declared combination」 larger-on-top (full house 9 / full house 8) → picked the WEAKER → well shows A-Fu・full house 8 with the wild as the third 8 | ✅ |
| §2 QA ratchet | 5 product-path e2e: UI-literal creation payload + config:null loud contract (stays lobby, asserted); feature defaults (ceremony on); wild path via client matcher; anti-tribute + aMaxAttempts:1 suspension — all three rare paths hit WIRE level every verification run; METHODOLOGY standing rule + title-honesty addendum | ✅ |
| §3 sort toggle | Exact-reverse descending (unit-pinned index stability), persisted client pref, localized ×3; verified live both directions | ✅ |
| §4 zh-Hans + auto-locale | Hand-adapted simplified locale (mainland terminology), 3-way parity, detectLocale (languages + language fallback, zh-MO→Hant), saved-choice precedence; verified live (natural create room/room code copy; the visual round's switcher self-labeling nit fixed per the ratchet — endonym constants replace per-locale translated language names, glyphs regression-pinned) | ✅ |
| §5 cache watch-item | index.html revalidates correctly; real skew vector = long-lived SPA sessions → M4 version-signal item | ✅ closed |
| Boundaries | Engine pure/locale-free, DO game-agnostic, 3-locale parity; 523 unit + 16 e2e green, 4 typechecks | ✅ |

**Cross-model audit** (Codex: §1 algorithm → [docs/audits/M3H-codex.md](docs/audits/M3H-codex.md); Grok: i18n/sort/§2 coverage → [docs/audits/M3H-grok.md](docs/audits/M3H-grok.md)):
- **Codex: ZERO findings** — suppression both call paths, obligation-4 agreement, ordering incl. variants, oracle independence (verified non-circular), FH-9/SF-8 corrections covered. Caveat recorded: its sandbox blocked test execution (reasoned-only); our CI executes the same suites green.
- **Grok: 2 majors + 4 minors, all fixed.** M1/M2 (the genuine catch): rare-path e2e titles advertised "full wire stack" while the wire phase was optional and proof level console-only — CI could green while proving less. Fixed: honest retitles ("engine-guaranteed, wire-verified when seed-huntable"), machine-readable proof-level record asserted by a dedicated summary test, opt-in E2E_REQUIRE_WIRE=1 strict mode (passed 16/16 on its verification run), METHODOLOGY title-honesty rule. Minors: event feed re-localizes at render time (semantic params — a mid-game language switch no longer mixes locales in history); detectLocale consults navigator.language and maps zh-MO→zh-Hant; fallback-chain comment corrected to what is implemented. Checked-clean: full i18n mapping/parity/terminology sweep (tribute/return tribute/anti-tribute/jiefeng/the wild rule correct, no Taiwan-isms), sort reverse/index-stability/pref isolation, tests 1–2 path honesty.

**Visual re-check log (production, desktop + 390px):** three-locale switcher works with auto-detect; zh-Hans natural throughout; the wild chooser demo took three attempts against the 45s turn clock (the leader's deadline starts at trick-win and my slow multi-seat passing consumed it — the alarm auto-leading each time is itself the timeout system visibly working); succeeded with all-in-one-batch input; descending sort verified; no overflow. UX note for M5 polish: consider pausing/longer grace on the leader clock for hot-seat self-play. The round's other find — locale options translated instead of self-labeled (Simplified Chinese self-label shown under zh-Hant) — was fixed in-round: endonyms are now constants outside the locale files, with a unit regression pinning the glyphs.

## M3 (2026-07-14) — Guandan into the table UI: GATE REPORT

| Gate criterion | Evidence | Verdict |
|---|---|---|
| Full Guandan match, 4 clients, over the wire | e2e `guandan.e2e.test.ts`: full match (~1–2k actions) to `matchEnded`, room `finished`; multi-run stability across 5 server-minted seeds | ✅ |
| Multi-seat / self-play | e2e: one socket drives all 4 seats to a hand end with per-seat redaction proven; visually driven live (rounds 2–3) | ✅ |
| Tribute / anti-tribute / jiefeng / A-attempt / suspension reachable & correct | Tribute + jiefeng observed over the wire every run; anti-tribute & suspension reachability is seed-dependent over the wire — owned by named engine tests (house-rules, tribute suites), documented in the e2e header | ✅ (honest split) |
| Lobby rule-picker alters play | e2e: `cardCountVisibility` change → opponents' counts numeric vs hidden | ✅ |
| drawCard ceremony on hand 1, engine-seeded | e2e: ceremony payload public + identical across seats, markerSeat leads; visually verified live (owner counting rule animating: the cut → re-flip → count → lead) | ✅ |
| Dump→replay reproduces a full Guandan match (config incl.) | e2e: seq-tagged snapshot verification post-matchEnd | ✅ |
| Visual gate (owner-required) | 3 computer-use rounds on production, 8-point checklist PASS (see iteration log below) — caught a start-blocking config bug, frozen ceremony, play-becomes-pass matcher bug | ✅ |
| Boundaries intact | game-room.ts zero game imports (grep+compile); engine purity guard clean; i18n parity green; 431 unit + 10 e2e | ✅ |

**Cross-model audit** (Codex: Guandan↔interface integration + ceremony determinism → [docs/audits/M3-codex.md](docs/audits/M3-codex.md); Grok: turn-direction/seat-offset sweep + picker wiring → [docs/audits/M3-grok.md](docs/audits/M3-grok.md); Gemini skipped — same partitioning rationale):
- **Codex: ZERO findings.** Checked-clean: registration/replay resolution, init/replay PRNG order, owner counting rule exact, re-flip recording, uniformity-by-construction, selection matching (actively hunted counterexamples across all-wild/joker/SF edges — none), hint round-trip, lobby start path.
- **Grok: 1 major + 3 minors, all addressed.** F1 (major): a PARTIAL config (foreign/old client) missing `turnDirection` silently rotated the engine clockwise — nextSeat's ternary + no init validation. Fixed systemically: `validateRuleVariant` now strictly validates all 25 keys at init (missing/out-of-range → `config.invalid: <key>`, unknown keys → `config.unknownKey: <key>` — typos can never no-op), surfacing as `room.startFailed` with the lobby retained; `nextSeat` also flipped to make CCW the structural fallback (defense in depth). Default/UI paths were never affected. F2/F3: labeling/doc fixes (fixedSeat is implemented-but-uncurated, not "guarded"; ceremony JSDoc now says in-turn-direction). F4 (accepted, tracked to polish): a foreign valid-but-non-curated config displays as defaults in the read-only lobby until edited — write path is safe; cosmetic read-path nit.
- Grok's checked-clean sweep: every guandan seat-progression site (trick/tribute/ceremony/jiefeng/levels) coherent under both turnDirection values via the single nextSeat convention; client plate geometry proven consistent with both engine branches without a layout flip; picker happy-path create=display=send; the three real guards UI-unreachable AND init-rejected.

**M3 (2026-07-14, build log) — Guandan into the table UI

- **M2 gate approved by owner.** M3 target bar: playable, clean, clearly usable — not final-pixel polish (that is M5/polish scope). Two gates: functional (e2e) AND visual (computer-use iteration on the deployed URL against a UX checklist — required, logged per pass).
- **Owner feature now fully specified — the draw ceremony (flip-to-lead) (drawCard ceremony):** engine-side seeded ceremony data in `handStarted` (hand 1 only): cutter (PRNG), counting flips with re-flip on joker/level-rank, **counting rule pinned: rank counts CCW with the cutter as position 1 (A=self, 2=next, 3=partner, 4=remaining; (rank−1) mod 4)**, marker draw = leader; UI animates exactly the event data. Uniformity preserved (statistical test) — flavor, not fairness. This resolves the previously-UNCERTAIN first-lead offset; `turnDirection` stays a config key with CCW default, and a consistency sweep of all seat-progression sites is part of the engine task.
- Build plan: engine (ceremony + guandan registration + CCW sweep) ∥ client infra (partysocket RoomConnection, multi-seat store, routing, lobby shell) → table UI + rule-picker → Guandan e2e → deploy → computer-use visual iteration rounds → Codex/Grok audits (integration+ceremony determinism / CCW sweep+picker wiring).

### Visual iteration log (computer use on the deployed URL — owner-required gate)

**Round 1 (2026-07-14, desktop 1568px):** walked home → create → lobby → claim ×4 (self-play) → start. Findings:
1. **BUG (blocker, caught only by live walkthrough):** room creation sent `config: null` (HomePage comment wrongly assumed init defaults it) → `Start game` rejected with `room.startFailed`. Every e2e run passed because they all send explicit configs — this is precisely the class of gap the owner's visual-iteration requirement exists for.
2. Ceremony would NEVER appear in the product: created rooms used the engine default `firstLeadMethod:'random'` and the picker didn't expose it. Product default for created rooms → `drawCard`; picker gains the draw ceremony (flip-to-lead) toggle.
3. App shell (home/room/lobby) completely unstyled — default browser look (blue underlined header link, raw buttons, bullet-list seats, white background) while table/picker carry the design system; jarring clash.
4. Lobby primary action (Start game) was the least visible element (tiny unstyled button below the fold); room code shown as plain heading text instead of the shareable hero it should be for a friends-and-family flow.
5. Claim input stayed active after all 4 seats were filled.
6. Rejection toast showed only the raw error code, no explanatory params.
Positives: rule-picker panel already reads well (rosewood/segmented, natural zh-Hant labels); zh-Hant copy natural; language switch works; multi-claim self-play flow works. Fix batch dispatched (round-1 fixes workflow); table itself not yet reachable — inspected in round 2 after the start bug fix.

**Round 2 (2026-07-14, desktop, after round-1 fixes deployed):** home/lobby transformed and on-system (lacquer shell, hero create, serif room-code chip + copy link, seat plates with claim-form-in-plate and prefilled name, start button with live disabled-reason, first-hand leader toggle present with drawCard product default). Reached the real table. Findings:
1. **Ceremony overlay stuck on shuffling… indefinitely** (never advances stages; tap-skip works) — and the first actor's 45s clock drains behind it: A-Lan's opening turn was consumed by the alarm (the timeout auto-play visibly worked in production, which is its own positive).
2. **small joker card faces render nearly blank** (vertical joker text invisible; big joker correct).
3. **2♥ wild ribbon not distinguishable** at hand size.
4. **PLAY-BECOMES-PASS (major, reproduced ×2):** with a legal beating single selected and lifted, clicking the primary action logged a pass — suspected hint-matcher demanding multiset equality against the engine's single wild-frugal representative (4♦ selection vs 4♠ hint) leaving Play dead and Pass catching the click; no pass-with-selection guard.
5. Selection persists after the turn resolves.
Positives: level rail + goldleaf playing 2 with our team/opponents markers reads immediately; turn ring + countdown unmistakable and moves correctly; seat-tab self-play works with correct per-seat rotation and redacted hands; trick well labels plays (A-Lan・single 3); event feed localized and clear; pass badges on plates. Round-2 fix batch dispatched with mandated root-cause reporting.

**Round 3 (2026-07-14, desktop + 390px phone width, after round-2 fixes deployed): CHECKLIST PASS.**
- Root causes confirmed fixed live: ceremony animates the full owner sequence (Lao Wang the cut → grey '2' flip labeled re-flip → 'J' counted → (11−1) mod 4 = 2 CCW steps → count reaches A-Fu → marker leads) in ~5s and unmounts; a selected 4♣ PLAYED as single 4 (select→Play→trick well, selection cleared, turn advanced) — play-becomes-pass dead; small joker legible; 2♥/4♥ wilds carry the visible cinnabar wild corner. Note: one "still stuck" false alarm during verification was my browser's cached pre-fix bundle (hard reload resolved; normal users revalidate index.html — not a product defect, logged for honesty).
- Phone width (390×844): level rail collapses to the our team/opponents/the level (rank) strip, three plates fit, hand wraps to two clean rows, zero horizontal overflow, CJK wraps correctly.
- Tribute phase inspected live (local room driven to hand-2 tribute by a 147-action bot, seats adopted via localStorage): panel reads without instruction — Lao Wang paid tribute to Xiao Mei with the actual small joker card public, return tribute pending with the receiver on the clock; the eligible-return glow highlights exactly the levelValue≤10 cards (no 4s at level 4 — the owner's rule made visible); strip shows playing 4 with per-viewer team perspective correct.
- Visual/UX exit checklist: hand legible+sorted ✓ · current player unmistakable ✓ · legal hints visible ✓ · tribute understandable without instruction ✓ · ceremony reads clearly ✓ · no phone-width overflow ✓ · CJK rendering ✓ · joker/wild legibility ✓.

## M2 (2026-07-14) — GameRoom DO + session/room plumbing: GATE REACHED

- **M1 gate approved by owner.** The three audit findings resolved: **all stay guarded** (loud init rejection + tests, already in place) — `tributeLevelBasis='previousLevel'` (hair-split, owner never selects it), `levelTrack='shared'`+`demote` (semantics undefined by any source, combination nobody wants), `equalTributeAssignment='winnersChoose'` (Western variant, wrong lineage). The `aceFinishDemotes`×suspension ambiguity stays logged as-is. Documented in spec §10 "Implementation status" with per-decision reasoning; any can be promoted later behind its existing key.
- **New owner requirements folded into PLAN §4/§5/§9:** (A) seat-token authority model — one connection may hold up to all 4 seat tokens (full self-play); redaction keyed strictly on tokens held (the one correctness property that matters under the deliberately relaxed anti-cheat posture); one multiplexed socket chosen over N sockets. (B) lobby phase — per-room `{gameId, config}` opaque to the room layer, editable pre-start with live broadcast, frozen at `Game.init`; chosen default: any seated player edits, any starts once all seats claimed. Guandan's rule-picker UI and the draw-card ceremony are tracked M3 items.
- Build order: guess-number engine + registry (agent) → protocol + GameRoom DO rewrite (orchestrator, hard tier) → e2e harness / dump→replay generalization / live gates → Codex (resync) + Grok (seat-token redaction) audits.

### M2 GATE REPORT (2026-07-14) — all criteria green

| Gate criterion | Evidence | Verdict |
|---|---|---|
| 4 simulated clients complete a game via `wrangler dev` | e2e "4 clients complete a guess-number game" | ✅ |
| Multi-seat + solo (owner req. A) | e2e: one socket drives 2 seats; 4-seat solo playthrough with 4 redacted copies per seq on one socket | ✅ |
| Lobby cycle (owner req. B) | e2e: edit → live `configChanged` → invalid-config `room.startFailed` (stays lobby) → start → post-start freeze | ✅ |
| DO game-agnostic | `game-room.ts` imports only protocol/games-registry/engine-core/room-helpers/Env/`cloudflare:workers`; grep + compile proven | ✅ |
| Kill/restart mid-game → resume | e2e: process kill, same persist dir, reconnect → delta events bit-identical to live copies, view deep-equal, game finished | ✅ |
| Dump→replay roundtrip (config incl.) | room records seed + per-action rows; `dump-room.ts --replay` live verdict `ok:true` (19 actions, snapshotSeq 23), duplicate-actionId proven not double-recorded | ✅ |
| **G-ALARM (hibernated)** | Production: seq advanced 4→7 with zero sockets connected (3 alarm-applied default actions), clean 3-event delta on reconnect | ✅ PASS |
| **G-WSMETER** | Production dashboard: DO requests **57** vs 44 counted client WS messages + ~13 HTTP/upgrade/alarm invocations → **≈1:1 accounting confirmed** (PLAN §1.6's conservative assumption holds; 0.343 GB-s duration, 376/83 SQL rows, $0.00 billable) | ✅ PASS |

**Cross-model audit** (Codex: resync skeleton → [docs/audits/M2-codex.md](docs/audits/M2-codex.md); Grok: seat-token authority/redaction → [docs/audits/M2-grok.md](docs/audits/M2-grok.md); both anchoring-free; Gemini skipped again — same partitioning rationale, recorded):
- **Codex, 1 major (fixed):** client-forgeable `timeout:seat:seq` actionIds could poison `actions_seen` and swallow a genuine future timeout (stall). Fix: `timeout:` is now a reserved namespace, rejected with `action.reservedActionId` + e2e test. Checked-clean: resync gap math (incl. lobby-seq offsets), view/event consistency, idempotency, attachment rehydration, single-writer atomicity (no interleaving awaits), zero-socket alarms. Could-not-verify: platform-level mid-broadcast eviction granularity (mitigated by design: SQLite persists before fan-out).
- **Grok, 0 blockers/majors — redaction model sound.** 3 minors, all addressed: (F1, fixed) hello dropping seats now broadcasts disconnected-presence + recomputes deadlines (was a soft-disconnect timer dodge); (F2, fixed) dump-token compare now constant-time-ish (`timingSafeEqualStr`); (F3, fixed) PLAN §5 stale-socket wording aligned to the implemented soft takeover. Checked-clean: every egress path per-seat redacted (fan-out, resync, welcome/RoomInfo, seatClaimed token privacy, dump hashes-only, logs), token lifecycle (256-bit mint, SHA-256 at rest, replay-after-takeover = delivery move per PLAN §4), action authority on all three paths, dump gate (no bypass incl. empty-token/env-unset).

**Notes for later milestones:** deadline recompute on presence change restarts phase timers (M4 refinement); replay's direct guandan fallback becomes dead code when M3 registers guandan; e2e restart test degrades to prefix-consistency assertions if a CI restart exceeds the 15s turn timeout (documented in-test); Codex's platform-eviction question stays open as a design-mitigated unknown.

## M1 (2026-07-14) — pure Guandan engine + replay harness: GATE REPORT

Build shape: foundations (PRNG/cards/config/types) by the orchestrator; five modules (combos+wilds → generate; tribute, levels, trick) by a staged fable/sonnet workflow against frozen foundations; `GameDefinition` glue by the orchestrator; four gate suites by a parallel workflow. **296 tests green, 4 typecheck configs clean (engine purity guard included), engine line coverage 97.94% (gate ≥90%).**

### Exit gate — the three owner-review items

| # | Gate criterion | Evidence | Verdict |
|---|---|---|---|
| 1 | Property tests for all six PLAN §3 obligations | `tests/unit/engine/obligations.property.test.ts` — 19 tests over the default profile + 14 single-key config variants (~31 seeded playouts); failures emit replayable `{seed, config, actions}` artifacts (verified end-to-end by fault injection) | ✅ pass |
| 2 | Every spec §9 edge case a named test; coverage ≥90%; purity guard | `tests/unit/engine/spec-edge-cases.test.ts` — §9.1…§9.22 map 1:1 to tests named "§9.N …"; coverage 97.94% lines; `tsconfig.engine.json` compiles with zero platform types | ✅ pass |
| 3 | Replay reconstructs a scripted match bit-for-bit | `scripts/replay.ts` (engine-pure core) + `replay-cli.ts`; `tests/unit/replay.test.ts` proves every-seq snapshot equality across ≥3 full hands (default + variant config), tamper detection at the exact seq, harness self-determinism | ✅ pass |

Obligation → test mapping: (1) determinism, (2) serializability, (3) zero-trust views incl. no-PRNG-leak + redaction under every visibility config, (4) legalActions⇔applyAction (canonical-form for plays, exact for choice phases — plus generate.test.ts's brute-force completeness property), (5) liveness incl. defaultAction-applies-ok in every phase, (6) locale-free error/event grammar — all in `obligations.property.test.ts`, cross-covered by `integration.test.ts` (seeded bot playouts to natural matchEnd, bit-identical same-seed replays).

Owner house rules: `tests/unit/engine/house-rules.test.ts` — 14 named engine-driven tests: 1-2/1-3 win at A, 1-4 does not; K+3 clamps to A; the full suspension lifecycle (exhaust → opponents' level with `suspensionApplied` → win clears flag → fresh counter → A window reopens); return-tribute `levelValue ≤ 10` at level T incl. fallback; mixed SJ+BJ never a pair anywhere (validator + 120-combination generator sweep); jiefeng both branches.

### Cross-model audit (panel: Codex + Grok primary; Gemini fallback)

Surface split per plan — **Codex** (deep: wilds validator/generator + tribute machine; spot: levels/beats) → [docs/audits/M1-codex.md](docs/audits/M1-codex.md); **Grok** (deep: levels/A-attempt/level-selection + bomb hierarchy + comparison + hand-boundary glue; spot: tribute leader/equal-assign, generate feasibility) → [docs/audits/M1-grok.md](docs/audits/M1-grok.md). Both anchoring-free (spec + code only, no conclusions shared). Mutual spot-check areas: both clean. **Gemini: skipped** — the surface partitioned cleanly into per-subsystem reads within Codex/Grok context windows; no single-pass whole-repo need (per-milestone decision, recorded here).

Findings (all in NON-default config space; zero blockers; default/CORE paths clean in both reports):
1. **`tributeLevelBasis:'previousLevel'` was dead config (silently ignored)** — found INDEPENDENTLY by both lineages (convergence; our own 15-config test matrix missed this key, which is exactly the panel's value). Mitigated: loud `config.notImplemented` at init + test. **Owner decision pending:** implement pre-M3 vs leave guarded.
2. **`levelTrack:'shared'` + `aFailConsequence:'demote'` desyncs the shared ladder** (Grok; per-team demotion breaks the shared invariant and a later shared upgrade drags the other team down). Spec leaves shared-ladder demotion undefined. Mitigated: loud init rejection of the combination + test. **Owner decision pending:** define semantics vs leave guarded.
3. `equalTributeAssignment:'winnersChoose'` unusable — known, deliberate, init-rejected (needs a decision action). **Owner decision pending:** implement pre-M3 vs leave guarded.

Spec ambiguity logged (Grok, not scored a defect): `aceFinishDemotes` × `suspendPlayOpponentLevel` on the same hand — spec silent; engine applies the ace demote after suspension and can wipe the flag; both keys non-default.

### Honest uncertainties (from suite authors, verbatim substance)
- `antiTributeDecision` phase is exercised via documented constructed states (bounded playouts can't guarantee both big jokers land on payers); §9.19's "leftovers never consulted" proven indirectly (fresh-27-card assertion after a real hand transition); §9.4's invariant-holds is probabilistic (4 seeded playouts, no throw, jiefeng exercised).
- Long-horizon A-machinery under `demote`/`none` exercised only as far as ≤8-hand playouts climb (house-rules tests cover the A scenarios via constructed states instead).

### M1 deltas worth noting
- `@cloudflare/workers-types` v5 + `@types/node` + `@vitest/coverage-v8` added; `tsconfig.scripts.json` is the 4th typecheck config (replay CLI split from the engine-pure core so node types never leak into client/engine checks).

## Round 3 (2026-07-13) — owner sign-off + rule-default decisions → M0 started

- **Owner signed off PLAN.md rev 2** subject to rule-default decisions, all now applied (spec v1.3):
  - Confirmed: `aWinPartnerNotLast=true`, `overshootWinsGame=false`, `returnTributeMaxRank=10`, `fullHouseJokerPair=true` (mixed SJ+BJ never a pair — CORE reaffirmed; spec §2.2/§4.1 already enforce it, M1 tests will assert it), `jiefengRecipient=partner` with the exact §5.6 condition (already specified verbatim — no change needed, confirmed).
  - **Changed:** A-attempt failure → `aFailConsequence: suspendPlayOpponentLevel|demote|none`, owner default `suspendPlayOpponentLevel` — never demote; per-team `aAttemptsExhausted` flag; hands play at opponents' level while set (a §1.5 level-selection refinement); flag clears on the team's next hand win, so A resumes automatically. Sub-decision taken per owner intent: attempt counter restarts **fresh** on resumption (`aAttemptCounterReset`, default `fresh`, sub-config kept cheap). Table now 25 keys.
  - Light research on whether "suspend + play opponents' level" is a documented named variant: launched (results logged here when in).
- **Build order confirmed:** M0 → M1 → M2 → M3 → M4 → M5; G-COMPOSE + G-ALARM retired first at hello-world cost. `aFailConsequence` module tracked pre-M3 (M1 engine work).
- **M0 scaffold built and locally verified** (4 scaffold agents + orchestrator verification pass):
  - Green: all 3 typechecks (engine purity guard / server strict + workers-types v5 / client), 5/5 unit tests (i18n key parity, default zh-Hant, interpolation), vite build, and a full `wrangler dev` smoke: `/api/health` JSON; static SPA served with `lang="zh-Hant"`; DO SQLite counter; **alarm armed and fired at +15.003s (G-ALARM local sanity — real gate is the free-tier deploy)**; hibernation-API WebSocket echo (raw-socket handshake + frame test); invalid room codes and unknown `/api/*` paths → JSON 404.
  - Fixes found by verification (all applied): `@cloudflare/workers-types` pin didn't exist on the registry and wrangler 4.110 requires the v5 major (→ `^5.20260708.1`); `GameRoom` wasn't re-exported from the Worker entrypoint (wrangler refuses to boot); demo room code `HELLO2A` was 7 chars against a 6-char route regex (orchestrator's own prompt bug → `TABLE2`); unknown `/api/*` fell through to the SPA fallback and answered API calls with HTML (→ explicit 404 guard).
  - **aFailConsequence research (light) — clean null result:** the exact suspend/never-demote/resume-on-win combination is not documented anywhere as a named variant; closest analogues are Lianzhong's "continue playing A without demotion" room toggle and pagat's David Wu demote-to-opponents'-level. Tagged house VARIANT, owner-specified. → docs/research/afail-consequence-research.md; spec §6.4 notes it.
  - **Ops constraint (owner, 2026-07-13): Firecrawl disabled** (credit limit reached) — all research agents now use built-in WebSearch/WebFetch + curl + `gh`; recorded in METHODOLOGY.md's tool ladder.
  - **Live gates PASSED (2026-07-13, free tier):** first deploy succeeded — `https://smashegg.mikechwu-iams.workers.dev`. **G-COMPOSE ✅**: one deploy serves the zh-Hant SPA + Worker API + Durable Object (SQLite counter persisted). **G-ALARM ✅**: DO alarm armed at epoch-ms 1783991776736 and fired at 1783991791736 — exactly +15.000s — on the deployed free plan. API hardening verified live (unknown `/api/*` → JSON 404). Note: a freshly registered workers.dev subdomain returned Cloudflare `error 1042` for the first ~1 minute — plain propagation delay, recovered on retry; logged so nobody debugs it as a code bug later.
  - **GitHub live (2026-07-14):** repo `mikechwu/smashegg` (public, owner-created), both commits pushed. **CI workflow: green** on GitHub runners (typecheck ×3, unit tests, build, dist assertions). `CLOUDFLARE_ACCOUNT_ID` secret and `WORKER_URL` variable set via `gh`. **Deploy workflow: red, expected** — fails precisely at wrangler auth because `CLOUDFLARE_API_TOKEN` is not yet set (verified in the run log; nothing else is wrong).
  - **M0 CLOSED (2026-07-14).** CI API token `smashegg-ci` created in the dashboard via browser automation (Workers-edit template; Account Resources = the single account; Zone Resources = all zones of that account; a distinct name so the pre-existing similarly-templated token used elsewhere stays untouched). Token verified active against `/user/tokens/verify`, stored only as the `CLOUDFLARE_API_TOKEN` GitHub secret, then the Deploy workflow re-ran **green** (run 29298708261: typecheck → tests → build → dist assertions → `wrangler deploy` → post-deploy smoke against WORKER_URL). M0 exit gate fully satisfied: push-to-main auto-deploys the localized hello page; PLAN/STATUS/SETUP in repo; CI green; **G-COMPOSE ✅ G-ALARM ✅** on the deployed free tier.

### Next: M1 — pure Guandan rules engine + deterministic replay harness
Per PLAN §9: combination detection/comparison, the wild rule template-matching validator (spec §4.4), legal-move generation, tribute state machine, level/A-attempt logic incl. `aFailConsequence=suspendPlayOpponentLevel`, 25-key RuleVariant config, property tests for the six interface obligations, spec-§9 edge cases as named tests, `scripts/replay.ts`. Cross-model audit (Codex + Gemini) at the gate.

## Round 2 (2026-07-13) — owner feedback incorporated

**Cross-model usage this round** (per PLAN §9 panel policy): web-research fan-out + synthesis by Claude-family agents (2 researchers: research-methodology extraction, Guandan tribute verification); **Codex CLI** ran the anchoring-free consistency review of the revised tribute/anti-tribute spec sections (load-bearing rules change → independent lineage required). **Codex result: 0 rule errors, 13 areas checked-clean (coverage documented), 4 blocking ambiguities found and fixed** — `seatOrder` direction now bound to `turnDirection` (not absolute clockwise); double-tribute payment staging + atomic reveal defined (was only defined for returns); `returnNoLowCardPolicy: anyCard` semantics scoped; `antiTributeMode: optional` state machine specified (decide-before-reveal, unanimity for split jokers, decline reveals nothing, default-action = invoke). Gemini/Grok not run this round — no large-context or third-lineage-corroboration task met the budget bar; both verified installed for milestone gates.

### Done (verified)
- **Rules corrections (owner + official-source verification).** Located the official the official Competitive Guandan Rules (Trial) tribute clause verbatim (two agreeing copies); full per-question verification: [docs/research/guandan-tribute-verification.md](docs/research/guandan-tribute-verification.md). Spec bumped to v1.2:
  - Tribute/return are **choices over eligible sets** (rank forced, card chosen); `legalActions` exposes the sets for UI hinting; `applyAction` validates membership.
  - Tribute and return cards **public to all four players** (owner-pinned; official + pagat concordant); double-tribute returns revealed simultaneously → engine applies both `tributeReturned` events atomically.
  - Anti-tribute: condition verified verbatim; **mandatory public reveal** of the qualifying big jokers with holder attribution, nothing else; `antiTributeMode: auto|optional` (default `auto`).
  - `equalTributeAssignment: seatOrder|random|winnersChoose` replaces `doubleTributeTieAward` (three-way source conflict: official/Tangrenyou/pagat); `doubleTributeTieLead` **removed** (lead rule unanimous & derivable); `returnNoLowCardPolicy` fallback now CORE-backed by official text. Table now 23 keys, each tagged house-rules-sensitive (✓) or technical (—).
- **PLAN.md rev 2:** new §6 Debuggability (deterministic replay harness, gated room-dump affordance, structured per-mutation logs — required deliverables in the M1/M2 gates); per-seat `hints` in the wire protocol; obligations delta stated (ob. 4 split combination/choice scope, ob. 3 gains reveal-scope assertions); named gate checks **G-COMPOSE / G-ALARM / G-WSMETER** promoted from the risk register into M0/M2 exit gates; audit panel = Codex + Gemini + optional Grok (all three CLIs verified installed).
- **Research methodology adopted from an internal reference research project** → [docs/research/METHODOLOGY.md](docs/research/METHODOLOGY.md) (full extraction with file-level provenance kept in local notes, not pushed). Adopted: research-over-memory with fetch dates; ≥2-source corroboration with low-trust-source discarding; per-claim VERIFIED/UNCERTAIN tags; null results headlined with diagnosis; question-first research prompts; anchoring-free cross-checks; "checked, no finding" coverage lists; named pre-declared gates; dated supersession markers; self-correction logging. Not adopted (domain-specific): backtesting conventions, walk-forward/purged CV, DSR/PBO, market-data hygiene, conformal gating, trading metrics, cost modeling.

### Null results / dead ends (this round)
- **No decline flow for anti-tribute exists anywhere.** Targeted searches (decline anti-tribute / can decline anti-tribute / choose tribute) found nothing across official rules, platforms, and explainers; the option is also strategically dominated. Diagnosis: genuinely unspecified because unwanted — `antiTributeMode:'optional'` is retained as future-proofing only.
- **The official clause text does not spell out the anti-tribute reveal step** — platform practice and physical necessity make it standard; tagged UNCERTAIN (narrow sense) in spec §7.6 while the reveal remains required behavior here.
- **Equal-tribute assignment is a genuine three-way source conflict** (official seat-order / Tangrenyou random / pagat winners-choose) — documented as such and made a config key rather than resolved.
- (Carried from round 1) No Cloudflare-endorsed "event log + seq resync" recipe; no documented per-DO WS-connection or session-duration caps beyond the 32,768 ceiling.

### Corrections log
- Round-1 self-corrections (from the 3-reviewer adversarial pass, 24 findings — 2 blockers among them: no randomness path for mid-match deals; tribute computed from leftover cards in three spec locations): all fixed; details in the 2026-07-13 round-1 entry below.
- Round-2: `doubleTributeTieAward/-TieLead` design superseded by verified sources (see above) — logged here rather than silently rewritten.

### Assumed (explicitly, not verified)
- Wrangler v4 still the current major (docs confirm v4 line active; npm blocked) — re-verified at M0.
- DO request accounting for inbound WS messages — named gate **G-WSMETER** (M2).
- DO Alarms free-plan availability (inferred from pricing structure) — named gate **G-ALARM** (M0, re-checked hibernated M2).
- Assets+DO-in-one-Worker composition (two documented config blocks, no single worked example) — named gate **G-COMPOSE** (M0).

### Next
1. **[BLOCKED on user]** Sign-off on PLAN.md rev 2 (checklist in PLAN §11). Owner said they'll personally review the RuleVariant table: docs/rules/guandan.md §10 — 23 keys, house-rules-sensitive ones tagged ✓.
2. Then M0 (needs SETUP.md human steps 2.1–2.5).

## Round 1 (2026-07-13) — initial research & plan

- Research fan-out (4 parallel agents): Cloudflare facts, reconnection patterns, reference-implementation audit (local notes), Guandan spec — findings in docs/research/ + docs/rules/ with per-item VERIFIED/UNCERTAIN tags.
- PLAN.md v1 drafted; then a 3-reviewer adversarial pass (interface adequacy / rules consistency / infra-fact consistency) returned 24 findings, all triaged and fixed — including 2 blockers: (a) the interface had no randomness path for dealing hand N+1 of an unbounded match (fixed: serializable PRNG state inside S + no-actorless-phases rule); (b) the rules spec computed tribute from the previous hand's leftover cards (fixed: newly dealt hand). Majors: advisory `expectedSeq` (double-tribute concurrency), `viewEvent(config)`, canonical-form obligation 4, generation-range/joker-guard/joker-bomb fixes, §3.8 wild policy, demotion timing, fabricated "20:1" figure removed, alarms uncertainty surfaced, token-template name de-asserted.

## Milestone tracker
| Milestone | State |
|---|---|
| Research & PLAN | ✅ rev 2 drafted, awaiting sign-off |
| M0 skeleton + CI/CD (G-COMPOSE, G-ALARM) | ✅ closed 2026-07-14 |
| M1 rules engine + replay harness | ✅ gate approved 2026-07-14 |
| M2 generic GameRoom DO + dump/replay roundtrip (G-ALARM hibernated, G-WSMETER) | ✅ gate approved 2026-07-14 |
| M3 Guandan plugged in | 🟡 gate reached 2026-07-14, awaiting owner review |
| M4 reconnection | ⏸ not started |
| M5 live MVP | ⏸ not started |

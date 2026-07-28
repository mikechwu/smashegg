> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

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

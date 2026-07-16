# Cinnabar Court — deck theme design record

**Date:** 2026-07-16 · **Status:** BUILD (owner picked the direction; this file records the
decisions made before drawing). Art direction lead: Fable (owner-requested, logged per the
model-dispatch ladder). Implementation: Sonnet-class. Scaffolding: Haiku-class where used.

## 0. The owner's decision, and the override it contains

The owner picked: reimagine the traditional French court cards and jokers through the app's
Eastern-minimalist aesthetic, using the five reference images now filed under `reference/`.

**This overrides unanimous point 5 of docs/research/card-face-redesign.md** ("NO figurative
court art — abstract/typographic instead"), which all three blind proposals agreed on. Recorded
as a dated owner decision (2026-07-16), not silently dropped. Both of that point's reasons are
answered rather than waved off:

- **IP — resolved by constraint:** original art in an Eastern idiom resembles no published
  deck. Hard rules for every piece: no reproduction of any specific deck's artwork, no
  trademarks, nothing derived from a Bicycle scan. Public-domain conventions (corner index,
  pip geometry, the K/Q/J concept, double-ended mirroring) are free to use.
- **Craft — NOT resolved by fiat:** bad figurative art is worse than none. §5 sets an explicit
  quality bar BEFORE drawing; if the art does not clear it at the sizes that matter, the theme
  falls back to the abstract treatment (proposal C's typographic medallions) and the owner is
  told. A null result is legitimate.

Everything else in the unanimous foundation stands: identity column inside 0.34–0.36w with a
gutter before 0.40w; the wild seal as a framework-owned language-neutral symbol in the column;
wordless jokers; one adaptive theme; the two contract pins (no text nodes on joker faces; wild
paint box right ≤ 0.40 × cardW).

## 1. Reference images — direction, not spec

`reference/` holds the owner's five images (king-of-spades, queen-of-hearts, jack-of-diamonds,
joker-big, joker-small; 1060×1484 PNG, ~8.9 MB total). They live in docs/ deliberately: they
are a design record, never a shipped asset, and the bundler never sees them. **They are
direction, not a spec — the shipped cards are OUR drawings in that aesthetic**, not traces or
reproductions of these images.

What the references establish (and the shipped art keeps):
- Ivory ground; ink / cinnabar / goldleaf palette; flat lacquer planes with line accents.
- K/Q/J as mirrored double-ended figures; K frontal with sword + gold crown; Q with veil,
  tiara and a flower; J in profile with a gauze hat and halberd. Suit pips worked into the
  robes; meander (回紋) belt at the mirror line.
- Jokers single-ended and word-free: big = full-palette jester with opera-mask face and gold
  cloud ring; small = pure-ink silhouette jester, spiked cap, winged shoulders. Corner index
  = a cap emblem, not a word — the two caps differ by silhouette, not colour alone.

What the references do NOT establish: their fine ornament density (floral scrolls, dragon
medallions, wave bands) is unreachable at our render sizes and is deliberately dropped.

## 2. Pipeline decision — SVG shipped, raster as reference only

The owner's two instructions ("scale with SVG" / "consider generating images") pull vector vs
raster. **Decision: generated/reference images are style reference only; every shipped card is
SVG drawn in that style.** Reasons: one design must be crisp from a 32px mini chip to desktop,
which only vector gives; 14 faces × multiple DPRs of raster is bundle weight for art mostly
seen for a moment in the trick well; the DeckTheme Face contract and the adaptive detail
ladder both assume vector; and the idiom itself — flat planes, tight palette, no photoreal
gradients — is SVG-native. Raster was considered and rejected, not forgotten.

Image GENERATION (for future reference exploration only): see
docs/research/image-generation-options.md (researched 2026-07-16, sources + fetch dates).
The build does not depend on it — the five owner images are sufficient reference.

## 3. Name

Candidates considered (owner asked for 2–3 with reasoning):
1. **Cinnabar Court** — names the dominant accent (the cinnabar seal system, red lacquer) AND
   the centerpiece of this theme (the court reimagining); double meaning of "court"
   (royal/card) survives translation; reads as one style among several, not the app identity.
2. **Lacquer Court** — rejected: collides with the app's own identity (Lacquer Ledger); a
   theme named "Lacquer ..." reads as THE default forever, which the owner explicitly warned
   against.
3. **Goldtrace (描金)** — names the lacquer technique, not the content; gold is this deck's
   accent, not its ground; weakest of the three.

**Picked: Cinnabar Court.** id `cinnabar-court`; i18n `theme.cinnabarCourt.name` =
en "Cinnabar Court" / zh-Hant "朱砂宮廷" / zh-Hans "朱砂宫廷" (parallel to 經典漆案's
four-character pattern). Reversible: display strings + one registry id.

## 4. Decomposition — five original pieces, not fourteen

Real French decks already recur the same figure across suits. **3 court figures + 2 jokers =
5 pieces**; the 12 court faces are 3 figures × 4 suits specialised by emblem + palette.
Number cards (A, 2–10) are pure pip geometry — no art. Per-suit figure variety (12 originals)
was considered and rejected: 4× the art and 4× the coherence risk buys nothing the minimalist
brief wants.

Shared parts (one grammar, drawn once):
- **Bust** — head plane (ivory), hair/beard planes (ink), shoulder/robe planes, collar V with
  gold trim. K = frontal + goatee; Q = frontal + hair arcs + veil; J = PROFILE (silhouette
  head, the traditional jack cue that survives smallest).
- **Headdress** — K gold crown with cinnabar inlay; Q gold tiara + cinnabar veil arcs;
  J ink gauze hat (幞頭) with gold band.
- **Attribute** — K vertical sword; Q flower (cinnabar bloom, gold heart); J diagonal halberd.
  Silhouette-level identity: these three read before any face detail does.
- **Emblem slot** — the suit pip in an ivory lozenge cartouche on the chest.
- **Belt** — gold meander band at the mirror junction (where the two half-figures meet).
- **Mirroring** — each court is one bust group + its 180° rotation, double-ended like the
  references.

Per-suit specialisation: emblem pip (shape-primary) + robe palette mapping (red suits →
cinnabar-dominant robe with ink accents; black suits → ink-dominant with cinnabar accents;
gold constant). Palette REINFORCES suit, never carries it alone.

Jokers (single-ended, per the references' direction):
- **Big** — full-palette jester: opera-mask face, cinnabar/ink cap with gold bells, robe
  planes, gold cloud ring behind. Corner emblem: cinnabar tri-bell cap glyph.
- **Small** — pure-ink silhouette jester: spiked cap, winged shoulders, mask face. Corner
  emblem: ink cap-with-mask glyph. Big vs small = colour AMOUNT + distinct silhouette
  (USPCC convention; never colour alone). No words on either face in any locale.

## 5. Craft quality bar (set before drawing; judged on screenshots at true sizes)

The measured envelope this theme ships into: hand card = clamp(36px, 11vw, 52px) → **42.9px
wide at true 390**; trick = 36px; mini = 32px; fan pitch 17.2px at 390 (visible sliver = left
40%). There is NO larger card render surface in the app today — the bar is set at these
sizes, not at the reference images' poster scale.

- **C1 (hand, 42.9px @390 + 52px desktop):** a court card reads as "royal figure" (headdress
  + robe + attribute) and as distinct from a number card at a glance; K/Q/J separate by
  silhouette (sword vs flower vs profile+halberd) without reading the index.
- **C2 (trick, 36px):** the court reads as a figure, not noise; body art never muddies the
  index. K/Q/J separation may lean on the index at this size.
- **C3 (mini, 32px):** index only — the ladder hides body art; no art bar to clear.
- **C4 (jokers):** big vs small distinguishable in the 17.2px sliver by corner-emblem
  silhouette + colour amount; full figures distinct by silhouette at hand size.
- **C5 (inspection, 300px harness):** no anatomical jank (hands hidden in sleeves or reduced
  to simple holds), exactly two stroke weights, palette = the four tokens + ivory, nothing
  outside them.
- **Fallback:** if C1 or C2 fails after two refinement iterations, courts fall back to the
  abstract typographic-medallion treatment (proposal C) and the owner is told. The jokers and
  pip/number system ship either way — the gate is per-piece, not all-or-nothing.

**GATE RESULT (2026-07-16): PASSED — figurative treatment ships; no fallback needed.**
Judged on live browser renders of the master art at exact ship sizes (52 / 42.9 / 36 px cards
on the lacquer table ground, plus a 17.2px-pitch fan-sliver strip). Two full iterations were
used: iteration 1 exposed blank mannequin faces, lens-shaped robes, a detached veil, and
joker corner emblems that read as a second head (small joker's even read as a ROYAL CROWN —
confusable with K); iteration 2 (trapezoid shouldered robes + sleeve wedges, minimal
stroke-features, attached hood-veil, bold sword/halberd, glyph-clean cap emblems) cleared:
C1 — K/Q/J separate by silhouette alone at 42.9px (pointed crown + vertical sword vs rounded
red hood + flower dot vs flat hat + strong diagonal); C2 — courts read as figures at 36px
with the index legible; C4 — jokers distinct in the 17.2px sliver by emblem silhouette +
colour amount; C5 — two stroke weights, palette tokens only, no anatomical jank (hands
eliminated by design: sleeves + held attributes). One further micro-iteration simplified the
big joker's corner emblem to cap + diamond (the reference's own corner treatment) after it
read as a grinning face at inspection size. Master geometry: art.tsx + pips.ts (frozen; the
iteration harness lives in the session scratchpad, superseded by the committed modules).

## 6. Adaptive detail ladder (one theme, size-keyed)

- `mini` (32px): identity column only. No body art. (Decl-chooser chips, ceremony flips.)
- `trick` (36px): bold tier — figure planes + attribute silhouette; no facial features, no
  interior ornament.
- `hand` (36–52px): bold tier + emblem cartouche; facial features only if they survive 42.9px
  in the harness (empirical, not assumed — likely featureless ivory face planes).
- Larger surfaces (none today): the grammar scales; fine detail is a future tier, not shipped
  dead code.

## 7. Theme switching (client preference, nothing else)

Per the owner: like language — a client-side preference, persisted per client
(`pref:deckTheme` localStorage, same idiom as handSort), switchable any time. NOT in room
config, NOT in the protocol, NOT in the engine; the DO never learns it exists; nobody else's
view changes. Switching mid-hand/mid-ceremony/mid-deal disturbs nothing (pure re-render — no
fan-state reset, no lost selection, no resync). The F11 mini-fan reads back tokens from theme
metrics, so 2-vs-27 stays value-dependent under every theme. No device signal exists for a
theme, so it defaults to the default theme — stated, not heuristicised. The control lives with
preferences (header, beside the locale switcher), not on the table's decision surface.

**Default theme: `cinnabar-court`** — the owner commissioned this redesign as the deck
players see; the classic lacquer face stays registered and selectable. Reversible with a
one-line change (`DEFAULT_DECK_THEME_ID`), flagged in the round report for owner veto.

## 8. Contract & conformance additions landing with this theme

- Wild seal: framework-owned overlay becomes a language-neutral cinnabar circle-seal (ivory
  four-petal cutout) INSIDE the identity column below the suit — the junction triangle dies;
  mis-attribution becomes structurally impossible. aria stays localized.
- Pins: joker faces contain no text nodes (every registered theme — this also forces the
  classic lacquer joker fix); wild overlay paint box right ≤ 0.40 × cardW; plus regressions
  for the two verified defects (junction ambiguity, English joker letter-stack overflow).
- Ratchet: conformance runs per registered theme, every distinct card at every size; 27 cards
  two rows at true 390 with zero overflow; suits separate by glyph shape, never colour alone.

# Cut-by-hand round — cross-model panel (2026-07-17)

Scope: uncommitted working-tree diff making the cut panel's card ribbon
ITSELF the slide control (owner: cut the deck directly with mouse or
finger; no separate visible sliding bar). Implementation: an invisible
native range input overlays the cards for the cutter — the drag is the
native slider drag, keyboard/AT semantics intact — with the visible bar
removed and spectators keeping the bare ribbon.
Producer: Claude. Auditors: Codex + Grok, isolated clones, identical brief
(`BRIEF-CUTDRAG.md`), gate re-run by each. Producer did not audit its own
change.

Verified live before the panel (390 en): a press at the ribbon's 25%
dragged to 80% moved the split 12 → 20 slivers; Home snapped to 0; the
overlay measured invisible and exactly covering the ribbon; Cut proceeded.
One live find pinned pre-panel: the first overlay sat UNDER the slivers'
split-order z (0..23) and the cards swallowed the drag — fixed with
z-index 30 + pin.

## Round 1

- **Codex — fully CLEAN: no HIGH/MED/LOW.** Refuted every focus question
  with cites: the finger-to-split coarseness near edges is inherent to the
  documented 97→24 non-numeric display (not a regression); z-30 wins
  inside the ribbon's own stacking context without covering the flip
  row/prompt/confirm siblings; the native range + label keep keyboard and
  AT semantics; no repo browser matrix makes :has() a concern. Noted the
  DOM-free tests can't exercise real pointer drags (covered by the live
  drive). Gate: typecheck + lint pass; vitest/build EPERM sandbox
  (environment, every round).
- **Grok — ship-quality, no HIGH; 1 MED + LOWs (gate: 932/932 + tc + lint
  + build PASS).** The MED: with the bar gone, TOUCH users get no
  conventional "drag here" chrome (cursor hints are mouse-only) — the
  split + prompt remain but the control affordance is gone for low-vision
  and touch discovery. LOWs: pointer-events unpinned (none would silently
  kill the interaction), touch-action-on-parent clarity, the pre-existing
  edge-geometry lag now more salient on-card, a :has() matrix nit. Also
  verified the aria-hidden restructure (container-level → per-sliver, so
  AT can reach the input), the §leak doctrine carry-forward, spectator
  bareness, and the ribbon stacking seal.

## Fixes applied (producer)

1. **The split-riding handle** (Grok MED): a decorative goldleaf chevron
   pair rides the gap itself — positioned off a `--split` var the live
   ribbon advertises, mirroring the sliver-distribution formula, z-29
   under the input, pointer-events none, a 160ms left transition (none
   under reduced motion), cutter-only. Visible "drag here" chrome exactly
   at the cut point. Pinned (presence + --split for the cutter; absence
   for spectators).
2. **Hit-path hardening** (Grok LOWs): the slider carries explicit
   `pointer-events: auto` (pinned, with a not-none pin) and its own
   `touch-action: none`.
3. The edge-lag and :has() nits: ACKNOWLEDGED, KEPT (inherent to the
   documented coarse display; no shipped-matrix concern).

Post-fix gate: **932/932**, typecheck, lint:hooks, build clean; live
re-drive: drag 12 → 20, Home → 0, handle riding the split (screenshot),
Cut → deal started.

## Round 2 (targeted — finder verifies the handle)

- **Grok — interaction/stacking PASS (z-29 handle inert under the z-30
  input; touch-action on both layers; cutter-only mount; gate 932/932 +
  typecheck), but the handle GEOMETRY not confirmed:** the first formula
  sat half a card into the right packet for interior splits and missed the
  reachable edge splits entirely (my clamp() bounds could never bind — the
  interior line's edge values sit INSIDE them).

## Fixes applied (producer, round 2)

The parted-midpoint formula corrected to Grok's own derivation —
pitch·(S − 0.5) + sliver/2 + gap/2, exact for 1 ≤ S ≤ 23 — and the edge
splits handled EXPLICITLY: the component marks S = 0/24 with
data-split-edge and CSS overrides pin the handle to the edge gaps' true
centres (gap/2 and 100% − gap/2). Live-measured exact at 390: handle
centre 11.2px on Home, ribbonWidth − 11.2 on End. Pins updated (interior
fragments, both edge overrides, the data attribute, z-29/pointer-events
none).

## Round 3 (targeted — finder verifies the geometry fix)

- **Grok — CONFIRMED exact for ALL splits 0..24.** Re-derived the interior
  line and both edge overrides against the sliver distribution; re-proved
  reachability (CUT_MIN 6..CUT_MAX 102 hits every sliver count, Home → 0,
  End → 24); confirmed clamp-alone was structurally insufficient; verified
  the data attribute adds no stacking/hit consequence (inert on the
  spectator ribbon, omitted for interior splits). Gate 932/932 +
  typecheck. Nothing modified.

## Verdict

**Clean.** The deck is now genuinely the control: drag the cards and they
part under the finger, keyboard and screen-reader semantics intact, no
visible bar anywhere, with a goldleaf handle riding the exact parted
midpoint at every reachable split. Codex passed the design outright in
round 1; Grok's three passes tightened touch affordance and then the
handle's geometry to pixel-exact. Gate 932/932 + typecheck + lint:hooks +
build, green locally and in Grok's clone every round; live-driven at 390
(drag 12 → 20 slivers, Home/End to the exact edge-gap centres, Cut →
deal).

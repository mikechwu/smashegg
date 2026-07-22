# Prefill scope + one-tap clear — cross-lineage audit (2026-07-22)

Scope: the prefill round's two shipped parts — item 1a (sitAskPrefill,
blank-when-ambiguous) and item 2 (the desk's one-tap clear) — in
Lobby.tsx, GameTable.tsx, PlayDesk.tsx, table.css, 3 locales, and the
pins. Producer: Claude. Auditors: Codex + Grok in isolated clones (Grok
ran the affected suites in its clone green).

## Both lineages: sound — zero HIGH

- **1a scoped correctly:** readLastName flows ONLY through sitAskPrefill
  at ask-open, fed live signals (snapshot.seats.size, the claimed
  roster); no unconditional prefill path survives; no claim/token change
  (the predicate only picks the input's initial value).
- **Item 2's cross-system zeroing HOLDS by construction:** every listed
  surface — the fan's variant-D face lifts, the D3 dim, the staged
  strip, the combo/verdict line, tribute eligibility, ActionBar's
  selectionCount and its pass-confirm arm (disarmed by its existing
  effect) — derives from the ONE `selected` set the clear empties; the
  chooser closes explicitly. The survival reconciler cannot rehydrate a
  user wipe (empty selections pass through by identity — Grok walked the
  sequence). Engine/protocol/timing untouched. Both lineages confirmed
  every named revert vector is caught by the new pins.

## Findings → outcomes

- **MED (Grok) / LOW (Codex), fixed:** the 重選 pill measured ~52×28px —
  undersized for the very elder-precision goal that motivated it (and
  smaller than Play/Pass). Fixed: a 44px-class floor
  (min-height 2.75rem, centered content), pinned.
- **LOW ×3 (acknowledged, kept):** exact-trim name identity misses Latin
  case/width variants (CJK family names — the audience — have no case;
  a soft duplicate hazard, not a regression); a shared-device person
  claiming several seats now retypes each name (that is the CORRECT
  behavior — the names belong to different people); the pins are
  source/static-render per the DOM-free suite idiom (the live driven
  checks cover the interactions end-to-end).

## Post-fix state

Gate 1033/1033 (43 files) + typecheck + lint:hooks + build. Live: 6/6
zh-Hant checks at TRUE 390×844 (clear absent/present/zeroing-both;
prefill blank-on-second-claim / prefilled-on-rejoin /
blank-on-duplicate).

## Verdict

**Ship — both lineages.** The diagnosis honored the round's order:
verified as the designed memory with a too-coarse ambiguity rule, not
the residue-bug class; the corrected rule and the clear's
single-source construction are both pinned against drift.

# Chooser hand-size round — cross-model panel (2026-07-17)

Scope: uncommitted working-tree diff moving the decl chooser ("Declare the
combination") to HAND-size card faces — the owner's consistency ask — with
the result row adopting the trick well's own -0.6 overlap (it IS the combo
as it will hit the table) and the fit arithmetic re-proved at the hand
clamp. Producer: Claude. Auditors: Codex + Grok, isolated clones, identical
brief (`BRIEF-CHOOSER.md`), gate re-run by each. Producer did not audit its
own change.

Verified live before the panel (390 en, a REAL ambiguous selection — 2♥
wild + 3,4,5,6 → Straight 7 vs Straight 6): every chooser face measured
exactly the fan's 50.7px; the panel 228px wide, on-screen, both options
rendered.

## Round 1 — both auditors CLEAN on substance (single round)

- **Codex — no HIGH/MED; 1 LOW (stale mini-era comments).** Re-derived the
  fit at 390/375/320 (six overlapped faces = 3·cardw; chips the wider
  constraint; desktop cap valid at 350 ≤ 352), verified the mixed-row box
  parity (frame vs bare ghost, both border-box cardw with --gd-cardw on
  the margin-receiving element), the left-to-right paint order matching
  the well, and the scroll/Cancel (§3.2) semantics. Gate: typecheck +
  lint pass; vitest/build EPERM in its read-only sandbox (environment,
  every round).
- **Grok — PASS, no HIGH/MED; 3 LOWs.** Confirmed the 6-face row is the
  true worst multi-reading case (engine sizes 1–6 reach the chooser),
  that hand size is NARROWER than the old flat mini row (174 vs 224 with
  chrome — the overlap pays for the size), the header's pre-existing
  flex-wrap absorbing the two-chip+label case, Cancel reachability under
  taller rows, aria unchanged, the seal at 11.4px ≥ 8, and — a nice
  catch — that hand size turns ON the lacquer theme's richer face
  treatment (row index + body pip) for real faces, which is exactly the
  "same style as hand cards" ask. Its LOWs: the same comment drift Codex
  found (table.css ×2 + lacquer.tsx), acceptable looseness in the fit
  ratchet (option padding + mult chip unpinned — headroom absorbs both at
  shipped floors; only a non-shipped 320px mult-edge would wrap), and the
  known wrap+negative-margin degradation shared with the well. Gate:
  **925/925 + typecheck + lint + build PASS.**

## Fixes applied (producer)

All three stale-comment sites rewritten (the .gd-chooser fit commentary now
states the hand-clamp arithmetic; .gd-card--mini documented as DORMANT with
the frozen-theme rationale; lacquer.tsx's mini gate re-explained as
future-proofing). The two acceptable-looseness LOWs are ACKNOWLEDGED, KEPT
(pinning option padding/mult would re-derive numbers the shipped floors
never approach; 320px is not a shipped floor). Gate re-run: 925/925 +
typecheck + lint + build.

## Verdict

**Clean in one round.** Both auditors independently passed the change on
substance with converging documentation-grade residue only — fixed on the
spot. The chooser now previews a play in exactly the table's cards: same
clamp, same overlap, same theme treatment, proved to fit at 390/375 from
stylesheet tokens and verified live with a real two-reading selection.

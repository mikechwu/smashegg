> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Deploy record (2026-07-28) — 61d5455 verified live (health build == pushed HEAD)

Owner word: "P2 — Deploy. Ship it."

**What actually changed for a player**, across the whole arc, in two lines of CSS and one commented import:

| | before | after |
|---|---|---|
| hand card, inner 333-719 | `clamp(2.75rem, 13vw, 4.25rem)` — 46.8px at 360, 50.7 at 390, 55.9 at 430 | **46.51px**, constant |
| hand card, inner <= 332 | the clamp's rem floor, 44px | **44px** — unchanged |
| hand card, inner >= 720 | the clamp | unchanged |
| card ink | rode the box | own basis, still scales with the root font-size, capped |
| deck picker | two themes | **one** — `cinnabar-court` unregistered |

**Gate:** typecheck (4 projects) + unit **1334/1334 (60 files)** + `gen-model.mjs --check` + containment at 320/332/333/360/375/390/430 (28 probes, desk title clean, joker case present on a re-run after its non-vacuity guard reported zero) + theme fallback against the built bundle + glyph rules in both regimes at root 12/16/24.

**Live verification** at `https://smashegg.mikechwu-iams.workers.dev`:

| check | result |
|---|---|
| `/api/health` build | `61d5455…` == pushed HEAD |
| card box at inner 320 | 44px |
| card box at inner 390 | 46.5px |
| picker contents | `lacquer` only |
| a stored preference for the withdrawn theme | falls back to `lacquer`, does not break |
| horizontal scroll at either width | none |

**Modelled effect of the card change, at `lacquer`, inner height 664, following state:**

| inner width | before | after |
|---|---|---|
| 360 | 0.15% | 0.15% |
| 390 | 7.65% | 0.08% |
| 430 | **66.93%** | 0.02% |

430 is the one that mattered and no round had swept it until J0.

**Rollback:** restore the previous `--gd-handcardw` / `--gd-handglyphw` declarations and uncomment the theme registration in `CardFace.tsx`. Reverting the card restores the 66.93% modelled failure at inner 430, so a rollback is for a defect the new card introduced — a complaint about card size is a tuning conversation, not a revert.

**Comms owed:** anyone whose stored preference was `cinnabar-court` silently gets lacquer. Verified not to break; still a deck that changed without explanation. A message to the group is the whole of it, and it belongs to the owner to send.

**What to watch, and it is people — there is no telemetry, by decision.** Does the card read as easily as before on the phones actually in use (about 8% narrower at inner 390 and about 17% at 430, both `lacquer`), and did anyone notice their deck changed. Anything else is noise until reported twice. **If a report arrives, the first question is which width and which phone** — the one field that has decided nearly every finding in this arc.

> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

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

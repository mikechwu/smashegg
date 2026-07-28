> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

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

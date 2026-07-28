> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Deploy record (2026-07-24) — ecdc672 verified live (health build == pushed HEAD)

Round close on the owner's word: pushed ecdc672 (auto-pass on no-legal-play — a
server-enforced forced-pass grace, a timing-class refinement with no new action;
engine time-free AND flag-free; room-layer on/off, default ON). Gate green
(typecheck + unit 1109/1109 + lint:hooks + build; auto-pass e2e 4/4; replay through
a forced-pass hand). Both lineages audited on the final code: Codex on
deadline/idempotency/liveness — SHIP, 0 confirmed defects across all 7 load-bearing
claims; an independent adversarial design review on config placement/engine-time-
freedom — SHIP (Grok tooling unavailable this session; disclosed), room-layer
placement endorsed + one improvement applied (timeoutMsFor is now an exhaustive
switch so a future TimingClass can't silently map to perTurnMs). Visual-verified
at true 390px + desktop + reduced-motion; the untimed reason line reads
unmistakably no-play (owner decision-3 caveat). `npm run deploy` → Version
f706d66a; `/api/health` polled to full edge convergence (12/12 == ecdc672).

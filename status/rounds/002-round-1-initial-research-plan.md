> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Round 1 (2026-07-13) — initial research & plan

- Research fan-out (4 parallel agents): Cloudflare facts, reconnection patterns, reference-implementation audit (local notes), Guandan spec — findings in docs/research/ + docs/rules/ with per-item VERIFIED/UNCERTAIN tags.
- PLAN.md v1 drafted; then a 3-reviewer adversarial pass (interface adequacy / rules consistency / infra-fact consistency) returned 24 findings, all triaged and fixed — including 2 blockers: (a) the interface had no randomness path for dealing hand N+1 of an unbounded match (fixed: serializable PRNG state inside S + no-actorless-phases rule); (b) the rules spec computed tribute from the previous hand's leftover cards (fixed: newly dealt hand). Majors: advisory `expectedSeq` (double-tribute concurrency), `viewEvent(config)`, canonical-form obligation 4, generation-range/joker-guard/joker-bomb fixes, §3.8 wild policy, demotion timing, fabricated "20:1" figure removed, alarms uncertainty surfaced, token-template name de-asserted.

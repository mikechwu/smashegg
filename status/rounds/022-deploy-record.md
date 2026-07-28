> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Deploy record (2026-07-16, owner: "if everything is clean, merge and deploy")

Pre-push gate: clean tree, 4 typechecks, 768 unit, 40 e2e — all green. Fast-forward merge
feat/cut-deal-refine -> main (f64b272..b562161, 34 commits, seven audited rounds: design
refinement items 1-5; cut & deal refinement + clockwise fix; deal fidelity + the Codex
producer!=auditor policy; ceremony marker geometry; ceremony suspense/re-cut + English-only
sweep; owner live-build feedback incl. the heart-only wilds correction; the lead-reveal-text
refinement). Push triggered CI + Deploy: BOTH green (CI 2m12s, Deploy 1m19s). Live verification:
https://smashegg.mikechwu-iams.workers.dev/api/health returned build
b562161ef906d0a0bb7eb28c11a61ba4043c7c24 == the pushed HEAD, exactly. (This STATUS record
commit rides after the deploy; the next push will advance the live hash past b562161.)
Still open for the owner: the cut-slider keyboard/AT channel (documented, not fixed — jitter
option available on request).

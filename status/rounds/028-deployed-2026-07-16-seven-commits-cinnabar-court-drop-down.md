> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## DEPLOYED 2026-07-16 — seven commits: Cinnabar Court, drop-down switcher, stacked hand, packed index, 1.3x pip

Owner: "if everything is clean, merge and deploy this version." Gate before push: clean
tree, 812/812 suite, typecheck, lint:hooks, local production build — all green. Pushed
cb02e36..08d62d5 (7 commits: 47aad4e research, f1ad6b9 Cinnabar Court + framework seal +
switching, 7a91c24 panel hardening, 75131b3 drop-down switcher, b97ea2d stacked hand +
lacquer default, 403382c packed horizontal index, 08d62d5 1.3x pip). VERIFIED LIVE:
/api/health build == 08d62d5eb0475c390f579f5f509cf74e673d099f (the pushed HEAD) — the
deploy pipeline (typecheck + lint:hooks + vitest + build) passed by construction. Honest
note: the GitHub Actions LIST API was returning 503s during verification (github-side
outage), so the run records were unviewable at deploy time; the live build hash is the
primary evidence and it matches.

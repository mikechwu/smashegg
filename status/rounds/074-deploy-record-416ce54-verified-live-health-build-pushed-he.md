> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## Deploy record (2026-07-24) — 416ce54 verified live (health build == pushed HEAD)

Round close on the owner's word ("after pass audit from codex and grok and
everything is clean, then ready to deploy"). BOTH AUDITS CLEAN:
  • **Grok (UX) — SHIP.** Re-verified its three earlier blockers now hold, citing
    the current strings/CSS. Two minor non-blockers fixed first: the honesty line
    was the faintest text on the panel though it is what stops the tags
    over-claiming (now --fs-sm/0.9), and the read-only fan announced itself as
    手牌 when it is the REMAINDER (HandFan gained an optional `label`).
  • **Codex (code) — SHIP.** Its FIRST verdict was DON'T-SHIP, and the stated
    reason was that its read-only sandbox could not execute the gates (EPERM on
    node_modules/.vite-temp) — explicitly "not because of a confirmed code
    regression". Rather than reinterpret that unilaterally, the gates were run
    here and the evidence handed back; it then confirmed SHIP on code-correctness
    grounds. Its two LOWs were fixed first: `readOnly` was honoured only in the
    SETTLED HandFan branch (a future readOnly+dealing caller would silently get
    press targets back), and `readOnly` still PAINTED selection/glow if handed
    non-empty sets — half-true against its own "no selection affordance"
    contract. Both now hold in BOTH branches and are pinned.
    Carried honestly: Codex also noted several UI lifecycle assertions are
    source-text pins rather than behaviour tests. True; the load-bearing ones were
    separately proven non-vacuous by mutation.

Gate: typecheck (4 tsconfigs) + unit 1168/1168 (49 files) + lint:hooks + build.
Outgoing sweep clean. `npm run deploy` → Version b9c79cf3-fdf2-4db0-850b-565b4796ed95;
`/api/health` build == 416ce542… == pushed HEAD, polled to FULL EDGE CONVERGENCE
(12/12 on the first round); site 200. Bundle +17 kB raw / +5.4 kB gzip — Codex
checked the import graph and confirmed nothing unintended was pulled client-side
(the finder's runtime imports are cards/combos/generate, and combos was already
client-reachable via helpers).

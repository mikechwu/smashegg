> **Answers:** what was believed and decided in this round. **This file is HISTORY and is never edited** — it records what was true at the time, including claims later withdrawn.
> **Before quoting any figure from it:** `status/WITHDRAWN.md` (is it retracted?) and `status/VALIDATED.md` (what is it good for?). **Live state:** `status/CURRENT.md`.

## M2 (2026-07-14) — GameRoom DO + session/room plumbing: GATE REACHED

- **M1 gate approved by owner.** The three audit findings resolved: **all stay guarded** (loud init rejection + tests, already in place) — `tributeLevelBasis='previousLevel'` (hair-split, owner never selects it), `levelTrack='shared'`+`demote` (semantics undefined by any source, combination nobody wants), `equalTributeAssignment='winnersChoose'` (Western variant, wrong lineage). The `aceFinishDemotes`×suspension ambiguity stays logged as-is. Documented in spec §10 "Implementation status" with per-decision reasoning; any can be promoted later behind its existing key.
- **New owner requirements folded into PLAN §4/§5/§9:** (A) seat-token authority model — one connection may hold up to all 4 seat tokens (full self-play); redaction keyed strictly on tokens held (the one correctness property that matters under the deliberately relaxed anti-cheat posture); one multiplexed socket chosen over N sockets. (B) lobby phase — per-room `{gameId, config}` opaque to the room layer, editable pre-start with live broadcast, frozen at `Game.init`; chosen default: any seated player edits, any starts once all seats claimed. Guandan's rule-picker UI and the draw-card ceremony are tracked M3 items.
- Build order: guess-number engine + registry (agent) → protocol + GameRoom DO rewrite (orchestrator, hard tier) → e2e harness / dump→replay generalization / live gates → Codex (resync) + Grok (seat-token redaction) audits.

### M2 GATE REPORT (2026-07-14) — all criteria green

| Gate criterion | Evidence | Verdict |
|---|---|---|
| 4 simulated clients complete a game via `wrangler dev` | e2e "4 clients complete a guess-number game" | ✅ |
| Multi-seat + solo (owner req. A) | e2e: one socket drives 2 seats; 4-seat solo playthrough with 4 redacted copies per seq on one socket | ✅ |
| Lobby cycle (owner req. B) | e2e: edit → live `configChanged` → invalid-config `room.startFailed` (stays lobby) → start → post-start freeze | ✅ |
| DO game-agnostic | `game-room.ts` imports only protocol/games-registry/engine-core/room-helpers/Env/`cloudflare:workers`; grep + compile proven | ✅ |
| Kill/restart mid-game → resume | e2e: process kill, same persist dir, reconnect → delta events bit-identical to live copies, view deep-equal, game finished | ✅ |
| Dump→replay roundtrip (config incl.) | room records seed + per-action rows; `dump-room.ts --replay` live verdict `ok:true` (19 actions, snapshotSeq 23), duplicate-actionId proven not double-recorded | ✅ |
| **G-ALARM (hibernated)** | Production: seq advanced 4→7 with zero sockets connected (3 alarm-applied default actions), clean 3-event delta on reconnect | ✅ PASS |
| **G-WSMETER** | Production dashboard: DO requests **57** vs 44 counted client WS messages + ~13 HTTP/upgrade/alarm invocations → **≈1:1 accounting confirmed** (PLAN §1.6's conservative assumption holds; 0.343 GB-s duration, 376/83 SQL rows, $0.00 billable) | ✅ PASS |

**Cross-model audit** (Codex: resync skeleton → [docs/audits/M2-codex.md](docs/audits/M2-codex.md); Grok: seat-token authority/redaction → [docs/audits/M2-grok.md](docs/audits/M2-grok.md); both anchoring-free; Gemini skipped again — same partitioning rationale, recorded):
- **Codex, 1 major (fixed):** client-forgeable `timeout:seat:seq` actionIds could poison `actions_seen` and swallow a genuine future timeout (stall). Fix: `timeout:` is now a reserved namespace, rejected with `action.reservedActionId` + e2e test. Checked-clean: resync gap math (incl. lobby-seq offsets), view/event consistency, idempotency, attachment rehydration, single-writer atomicity (no interleaving awaits), zero-socket alarms. Could-not-verify: platform-level mid-broadcast eviction granularity (mitigated by design: SQLite persists before fan-out).
- **Grok, 0 blockers/majors — redaction model sound.** 3 minors, all addressed: (F1, fixed) hello dropping seats now broadcasts disconnected-presence + recomputes deadlines (was a soft-disconnect timer dodge); (F2, fixed) dump-token compare now constant-time-ish (`timingSafeEqualStr`); (F3, fixed) PLAN §5 stale-socket wording aligned to the implemented soft takeover. Checked-clean: every egress path per-seat redacted (fan-out, resync, welcome/RoomInfo, seatClaimed token privacy, dump hashes-only, logs), token lifecycle (256-bit mint, SHA-256 at rest, replay-after-takeover = delivery move per PLAN §4), action authority on all three paths, dump gate (no bypass incl. empty-token/env-unset).

**Notes for later milestones:** deadline recompute on presence change restarts phase timers (M4 refinement); replay's direct guandan fallback becomes dead code when M3 registers guandan; e2e restart test degrades to prefix-consistency assertions if a CI restart exceeds the 15s turn timeout (documented in-test); Codex's platform-eviction question stays open as a design-mitigated unknown.

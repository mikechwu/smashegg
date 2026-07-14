# M2 Cross-Model Audit — Codex (resync/reconnection skeleton)

Ran 2026-07-14 against the M2 GameRoom DO. Anchoring-free.

**FINDINGS — concrete defects only, each tagged blocker/major/minor, each with the failing sequence of messages/events.**

major — Client `actionId` can collide with synthetic timeout ids and suppress a real timeout.

Evidence: client action ids are accepted as arbitrary strings up to 128 chars in [src/server/game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:897), with no reserved namespace check before `applyGameAction` records them in `actions_seen` at [src/server/game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:1037). Timeout ids use the public deterministic format `timeout:${seat}:${seq}` in [src/server/room-helpers.ts](/Users/mikechwu/Projects/smashegg/src/server/room-helpers.ts:92), and alarms pass that id into the same idempotency path at [src/server/game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:1209). Duplicate ids short-circuit before applying the default action at [src/server/game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:969).

Failing sequence:
1. Current game seq is `7`; seat 0 can make a legal action.
2. Seat 0 sends a legal action with client-chosen `actionId: "timeout:1:8"`.
3. The server applies it, bumps seq to `8`, and records `"timeout:1:8"` in `actions_seen` at lines 1027-1042.
4. Deadlines are recomputed; seat 1 is expected to act at seq `8`.
5. Seat 1 times out. `alarm()` reads `seq = 8`, builds `timeoutActionId(1, 8)`, i.e. the same `"timeout:1:8"`, at lines 1187-1216.
6. `applyGameAction` finds the existing `actions_seen` row and returns `duplicate` without applying `game.defaultAction`.
7. `alarm()` then deletes the deadline row for that seat on non-`applied` outcome at lines 1218-1222. The timeout has been swallowed, and if seat 1 remains absent the game can stall.

**CHECKED, NO FINDING — enumerate the verified-clean areas.**

Resync gap correctness: no concrete skip/duplicate defect found. `hello` captures one `seq` at [src/server/game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:643), reads events with `seq > lastSeenSeq` at lines 658-662, and only sends a delta if `deltaCoversGap` proves exact coverage of `lastSeenSeq+1..seq` at lines 664-680. The helper requires exact length and contiguous seqs in [src/server/room-helpers.ts](/Users/mikechwu/Projects/smashegg/src/server/room-helpers.ts:125). For a hello whose `lastSeenSeq` predates lobby mutations, lobby seq bumps create no event rows, so the length/contiguity check fails and the reconnect gets snapshot-only resync. If `lastSeenSeq` is exactly the last lobby seq before `start`, the start event row covers the gap and the delta is valid.

Resync view/event consistency: no concrete defect found. Live fan-out and resync both redact stored full-fidelity event arrays through `redactEventsFor` and use the same `game.playerView(state, seat)` source: live at [src/server/game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:1089), resync at [src/server/game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:667). The e2e restart test confirms contiguous delta seqs and bit-for-bit event redaction for the pre-kill span in [tests/e2e/room.e2e.test.ts](/Users/mikechwu/Projects/smashegg/tests/e2e/room.e2e.test.ts:404).

Duplicate client action ids, aside from the timeout namespace collision above: no double-apply path found. Applied actions write `actions_seen` after seq/event persistence at [src/server/game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:1027), and duplicate ids return before engine application at lines 967-997.

Hibernation attachment rebuild: no concrete defect found. Constructor rebuilds socket-seat cache from `ctx.getWebSockets()` and `deserializeAttachment()` at [src/server/game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:168), and every seat-set mutation persists the attachment through `serializeAttachment` at [src/server/game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:341).

Eviction/restart after persisted action: no concrete resync defect found. The authoritative snapshot/event/action/idempotency rows are in SQLite before fan-out at [src/server/game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:1027), so a reconnect after missed broadcast can recover from `events` or snapshot. The restart e2e covers process death and resync continuity at [tests/e2e/room.e2e.test.ts](/Users/mikechwu/Projects/smashegg/tests/e2e/room.e2e.test.ts:360).

Alarm with zero sockets: no concrete defect found. Deadlines are computed from `connectedSeats()` and persisted in SQLite at [src/server/game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:1107). `alarm()` re-reads room/deadline/state from storage, applies default actions with `ws: null`, and fan-out simply iterates an empty `sessions` map if there are no sockets at [src/server/game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:1151).

Single-writer action mutation path: no await between `currentSeq()`/`readState()` and persistence in `applyGameAction`. The read, engine apply, seq bump, snapshot update, event insert, `actions_seen` insert, and action log insert are synchronous in [src/server/game-room.ts](/Users/mikechwu/Projects/smashegg/src/server/game-room.ts:960). The later async deadline recompute starts after the action is already durable and broadcast.

**COULD NOT VERIFY — each item plus why.**

Cloudflare platform guarantee for “eviction mid-broadcast” at instruction granularity. The code’s SQLite truth is clear, and reconnect recovery is clear, but whether the runtime can terminate a handler after persistence and before all `ws.send()` calls is a platform behavior question not fully proven by the local code or bundled research notes.

Codex session ID: 019f5f12-bead-7b11-8198-22837221cae7
Resume in Codex: codex resume 019f5f12-bead-7b11-8198-22837221cae7
